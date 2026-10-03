import { and, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import type { AppDb } from "@/server/db/types";
import { auditLogs, topups } from "@/server/db/schema";
import { signTopup } from "@/server/qpay/signature";
import { findActivePackage } from "@/server/topup-packages";
import type { QPayProvider } from "@/server/qpay/types";
import { credit } from "@/server/wallet";

/**
 * Top-ups (SPEC §4.3). QPay's callback is never trusted by itself (CLAUDE.md rule 6):
 * every path that credits money — callback, cron, admin re-check, the user's "check" button —
 * goes through settleTopup(), which asks the provider (checkPayment) and credits with
 * idempotency keys derived from QPay's payment id.
 */

export type Topup = typeof topups.$inferSelect;
const TOPUP_TTL_MS = 24 * 60 * 60 * 1000;
/** Invoices one user may create per hour (SPEC §12) — paid or not. */
export const INVOICES_PER_HOUR = 10;
/** One cron run stops starting new checks after this long (it is called every 5 minutes). */
const CHECK_BUDGET_MS = 4 * 60 * 1000;

export class InvalidTierError extends Error {
  constructor() {
    super("invalid_tier");
  }
}
/** The package changed (bonus/price) or was retired after the user saw it: show the new terms. */
export class PackageChangedError extends Error {
  constructor() {
    super("package_changed");
  }
}
export class TopupRateLimitError extends Error {
  constructor() {
    super("topup_rate_limited");
  }
}
export class TopupNotFoundError extends Error {
  constructor() {
    super("topup_not_found");
  }
}

export function callbackUrl(appUrl: string, topupId: string, secret: string): string {
  const u = new URL("/api/qpay/callback", appUrl);
  u.searchParams.set("topup_id", topupId);
  u.searchParams.set("sig", signTopup(topupId, secret));
  return u.toString();
}

export async function createTopup(
  db: AppDb,
  provider: QPayProvider,
  opts: {
    userId: string;
    /** The package as the user saw it in the sheet — charged only if it still matches. */
    offer: { packageId: string; amount: number; bonus: number };
    appUrl: string;
    callbackSecret: string;
    description: string;
    /** Invoices per hour this user may have (default INVOICES_PER_HOUR). */
    maxPerHour?: number;
  },
): Promise<Topup> {
  const tier = await findActivePackage(db, opts.offer.packageId);
  if (!tier) throw new InvalidTierError();
  if (tier.amount !== opts.offer.amount || tier.bonus !== opts.offer.bonus)
    throw new PackageChangedError();

  // The hourly limit is counted and the row written under a per-user lock, so parallel requests
  // can't each read "9" and all get through. The lock ends with the transaction — before QPay is
  // called, so a slow QPay never holds it.
  const topup = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${opts.userId}))`);
    const [{ recent }] = await tx
      .select({ recent: count() })
      .from(topups)
      .where(
        and(
          eq(topups.userId, opts.userId),
          gte(topups.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
        ),
      );
    if (recent >= (opts.maxPerHour ?? INVOICES_PER_HOUR)) throw new TopupRateLimitError();
    const [row] = await tx
      .insert(topups)
      .values({
        userId: opts.userId,
        packageId: tier.id,
        amount: tier.amount,
        bonus: tier.bonus,
        provider: provider.mode,
      })
      .returning();
    return row;
  });

  try {
    const invoice = await provider.createInvoice({
      topupId: topup.id,
      amount: tier.amount,
      description: opts.description,
      callbackUrl: callbackUrl(opts.appUrl, topup.id, opts.callbackSecret),
    });
    const [updated] = await db
      .update(topups)
      .set({
        invoiceId: invoice.invoiceId,
        invoiceData: {
          qrImage: invoice.qrImage,
          qrText: invoice.qrText,
          deeplinks: invoice.deeplinks,
          ...(invoice.shortUrl ? { shortUrl: invoice.shortUrl } : {}),
        },
      })
      .where(eq(topups.id, topup.id))
      .returning();
    return updated;
  } catch (err) {
    await db.update(topups).set({ status: "failed" }).where(eq(topups.id, topup.id));
    throw err;
  }
}

type SettleResult =
  | { status: "paid"; credited: boolean }
  | { status: "pending" | "expired" | "failed"; credited: false };

/**
 * Checks the invoice with QPay and, if paid for the right amount, credits amount + bonus.
 * Safe to call any number of times, concurrently: ledger keys are `qpay:<paymentId>` and
 * `qpay:<paymentId>:bonus`, and the status flip is guarded.
 */
export async function settleTopup(
  db: AppDb,
  provider: QPayProvider,
  topupId: string,
  opts: { source: "callback" | "cron" | "admin" | "user"; actorId?: string | null; now?: Date } = {
    source: "cron",
  },
): Promise<SettleResult> {
  if (!z.uuid().safeParse(topupId).success) throw new TopupNotFoundError();
  const [topup] = await db.select().from(topups).where(eq(topups.id, topupId));
  if (!topup) throw new TopupNotFoundError();
  if (topup.status === "paid") return { status: "paid", credited: false };
  if (!topup.invoiceId || topup.status === "failed")
    return { status: topup.status, credited: false };

  const check = await provider.checkPayment(topup.invoiceId);
  if (!check.paid) return { status: topup.status, credited: false };

  const paymentId = check.paymentId ?? topup.invoiceId;
  if (check.amount !== topup.amount) {
    await db.transaction(async (tx) => {
      await tx.update(topups).set({ status: "failed", paymentId }).where(eq(topups.id, topup.id));
      await logAudit(tx, {
        actorId: opts.actorId ?? null,
        action: "topup.amount_mismatch",
        entity: "topups",
        entityId: topup.id,
        data: { expected: topup.amount, paid: check.amount, paymentId, source: opts.source },
      });
    });
    return { status: "failed", credited: false };
  }

  let credited = false;
  await db.transaction(async (tx) => {
    const main = await credit(tx as AppDb, "topup", {
      userId: topup.userId,
      amount: topup.amount,
      idempotencyKey: `qpay:${paymentId}`,
      refType: "topup",
      refId: topup.id,
    });
    credited = !main.duplicate;
    if (topup.bonus > 0) {
      await credit(tx as AppDb, "bonus", {
        userId: topup.userId,
        amount: topup.bonus,
        idempotencyKey: `qpay:${paymentId}:bonus`,
        refType: "topup",
        refId: topup.id,
      });
    }
    await tx
      .update(topups)
      .set({ status: "paid", paymentId, paidAt: opts.now ?? new Date() })
      .where(and(eq(topups.id, topup.id), inArray(topups.status, ["pending", "expired"])));
    if (opts.source === "admin") {
      await logAudit(tx, {
        actorId: opts.actorId ?? null,
        action: "topup.recheck_paid",
        entity: "topups",
        entityId: topup.id,
        data: { paymentId },
      });
    }
  });
  return { status: "paid", credited };
}

/**
 * Cron (every 5 min, SPEC §4.3): re-check pending top-ups from the last 24 h;
 * older pending ones get one final check and are then marked expired.
 * Newest first — someone who just paid is waiting — and within a time budget, so a slow QPay
 * can't make runs pile up: what is left over (`skipped`) is checked by the next run.
 */
export async function checkPendingTopups(
  db: AppDb,
  provider: QPayProvider,
  now = new Date(),
  budgetMs = CHECK_BUDGET_MS,
) {
  const cutoff = new Date(now.getTime() - TOPUP_TTL_MS);
  const pending = await db
    .select()
    .from(topups)
    .where(eq(topups.status, "pending"))
    .orderBy(desc(topups.createdAt));
  const summary = { checked: 0, paid: 0, expired: 0, errors: 0, skipped: 0 };
  const started = Date.now();

  for (const t of pending) {
    if (Date.now() - started >= budgetMs) {
      summary.skipped++;
      continue;
    }
    summary.checked++;
    try {
      const res = await settleTopup(db, provider, t.id, { source: "cron", now });
      if (res.status === "paid") summary.paid++;
      else if (t.createdAt < cutoff) {
        await db
          .update(topups)
          .set({ status: "expired" })
          .where(
            and(eq(topups.id, t.id), eq(topups.status, "pending"), lt(topups.createdAt, cutoff)),
          );
        summary.expired++;
      }
    } catch (err) {
      summary.errors++;
      console.error("[qpay:cron]", t.id, err);
    }
  }
  return summary;
}

/**
 * What QPay reports as paid for top-ups that failed because the amount didn't match the invoice
 * (a double or partial payment): topup id → the amount received. Nothing was credited for these,
 * so the Owner settles each by hand (adjust) — /admin/topups shows them.
 */
export async function paidAmountMismatches(
  db: AppDb,
  topupIds: string[],
): Promise<Map<string, number>> {
  if (topupIds.length === 0) return new Map();
  const rows = await db
    .select({ id: auditLogs.entityId, data: auditLogs.data })
    .from(auditLogs)
    .where(
      and(eq(auditLogs.action, "topup.amount_mismatch"), inArray(auditLogs.entityId, topupIds)),
    );
  const out = new Map<string, number>();
  for (const r of rows) {
    const paid = (r.data as { paid?: unknown } | null)?.paid;
    if (r.id && typeof paid === "number") out.set(r.id, paid);
  }
  return out;
}

export async function getTopupForUser(db: AppDb, userId: string, topupId: string): Promise<Topup> {
  if (!z.uuid().safeParse(topupId).success) throw new TopupNotFoundError();
  const [t] = await db
    .select()
    .from(topups)
    .where(and(eq(topups.id, topupId), eq(topups.userId, userId)));
  if (!t) throw new TopupNotFoundError();
  return t;
}

export async function listTopups(
  db: AppDb,
  opts: { status?: Topup["status"]; userId?: string; since?: Date; limit?: number } = {},
) {
  const conds = [];
  if (opts.status) conds.push(eq(topups.status, opts.status));
  if (opts.userId) conds.push(eq(topups.userId, opts.userId));
  if (opts.since) conds.push(gte(topups.createdAt, opts.since));
  return db
    .select()
    .from(topups)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(topups.createdAt))
    .limit(opts.limit ?? 100);
}
