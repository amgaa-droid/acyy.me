import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { z } from "zod";

import { findTier } from "@/config/topup";
import { logAudit } from "@/server/audit";
import type { AppDb } from "@/server/db/types";
import { topups } from "@/server/db/schema";
import { signTopup } from "@/server/qpay/signature";
import type { QPayProvider } from "@/server/qpay/types";
import { credit } from "@/server/wallet";

/**
 * Top-ups (SPEC §4.3). QPay's callback is never trusted by itself (CLAUDE.md rule 6):
 * every path that credits money — callback, cron, admin re-check, the user's "check" button —
 * goes through settleTopup(), which asks the provider (checkPayment) and credits with
 * idempotency keys derived from QPay's payment id.
 */

export type Topup = typeof topups.$inferSelect;
export const TOPUP_TTL_MS = 24 * 60 * 60 * 1000;

export class InvalidTierError extends Error {
  constructor() {
    super("invalid_tier");
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
    amount: number;
    appUrl: string;
    callbackSecret: string;
    description: string;
  },
): Promise<Topup> {
  const tier = findTier(opts.amount);
  if (!tier) throw new InvalidTierError();

  const [topup] = await db
    .insert(topups)
    .values({
      userId: opts.userId,
      amount: tier.amount,
      bonus: tier.bonus,
      provider: provider.mode,
    })
    .returning();

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

export type SettleResult =
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
 */
export async function checkPendingTopups(db: AppDb, provider: QPayProvider, now = new Date()) {
  const cutoff = new Date(now.getTime() - TOPUP_TTL_MS);
  const pending = await db.select().from(topups).where(eq(topups.status, "pending"));
  const summary = { checked: 0, paid: 0, expired: 0, errors: 0 };

  for (const t of pending) {
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
