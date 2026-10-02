import { and, eq, inArray, sql } from "drizzle-orm";

import { AVATAR_SEEDS, avatarIndexesFor } from "@/lib/avatar-seeds";
import type { AstroRefs } from "@/server/astro/refs";
import type { AppDb } from "@/server/db/types";
import { account, persons, purchases, user } from "@/server/db/schema";
import { activeParts, type ProductDef } from "@/server/products";
import { buildSnapshot, subjectKey } from "@/server/purchase";
import { credit } from "@/server/wallet";
import type { PersonPlan, UserPlan } from "./users";

/**
 * Writes one planned legacy account (src/server/legacy/users.ts). Idempotent — re-running with
 * the same plan changes nothing:
 * - user: found by legacy_user_id, else created. An account that already exists with the same
 *   email is adopted only if its owner has linked this very Facebook id (from /me) — the old
 *   site's emails prove nothing, so a matching address alone must not hand someone a login;
 * - Facebook account row (provider "facebook", the old app-scoped id) → Better Auth signs the
 *   person straight into this user, before any email matching;
 * - people: UNIQUE(owner, legacy_key); purchases: UNIQUE(user, product, subject);
 * - balance: credit() with idempotency key "legacy:balance:{id}" (a replay is a no-op).
 * Legacy purchases carry `legacy_ref` and no wallet entry: they were paid on the old site.
 */

export type ApplyContext = { refs: AstroRefs; products: Map<string, ProductDef> };

export type ApplyResult =
  | {
      ok: true;
      userId: string;
      createdUser: boolean;
      newPeople: number;
      newPurchases: number;
      credited: number;
    }
  | {
      ok: false;
      reason:
        "facebook_id_taken" | "user_has_other_facebook" | "legacy_id_mismatch" | "email_taken";
    };

export class LegacyProductMissingError extends Error {
  constructor(readonly product: string) {
    super(`legacy_product_missing:${product}`);
  }
}

type ConflictReason = Extract<ApplyResult, { ok: false }>["reason"];

/** Thrown inside the transaction so a half-adopted account rolls back. */
class LegacyConflict extends Error {
  constructor(readonly reason: ConflictReason) {
    super(reason);
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** "2019-06-01T08:00:00.000" (no zone, taken as UTC) → Date; undefined when missing or malformed. */
export function legacyDate(raw: string | null | undefined): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(`${raw}Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** A stable avatar per person, matching the gender when it's known. */
export function legacyAvatar(p: Pick<PersonPlan, "key" | "gender">): string {
  const pool =
    p.gender === "unspecified" ? AVATAR_SEEDS.map((_, i) => i) : avatarIndexesFor(p.gender);
  return AVATAR_SEEDS[pool[hash(p.key) % pool.length]];
}

export async function applyLegacyUser(
  db: AppDb,
  plan: UserPlan,
  ctx: ApplyContext,
): Promise<ApplyResult> {
  for (const p of plan.purchases) {
    if (!ctx.products.has(p.product)) throw new LegacyProductMissingError(p.product);
  }

  try {
    return await applyInTx(db, plan, ctx);
  } catch (err) {
    if (err instanceof LegacyConflict) return { ok: false, reason: err.reason };
    throw err;
  }
}

function applyInTx(db: AppDb, plan: UserPlan, ctx: ApplyContext): Promise<ApplyResult> {
  return db.transaction(async (tx) => {
    // 1. The user.
    let [u] = await tx.select().from(user).where(eq(user.legacyUserId, plan.legacyUserId));
    let createdUser = false;
    if (!u) {
      const [byEmail] = await tx.select().from(user).where(eq(user.email, plan.email));
      if (byEmail) {
        if (byEmail.legacyUserId !== null) throw new LegacyConflict("legacy_id_mismatch");
        const [proof] = await tx
          .select({ id: account.id })
          .from(account)
          .where(
            and(
              eq(account.userId, byEmail.id),
              eq(account.providerId, "facebook"),
              eq(account.accountId, plan.facebookId),
            ),
          );
        if (!proof) {
          const [otherFb] = await tx
            .select({ id: account.id })
            .from(account)
            .where(and(eq(account.userId, byEmail.id), eq(account.providerId, "facebook")));
          throw new LegacyConflict(otherFb ? "user_has_other_facebook" : "email_taken");
        }
        [u] = await tx
          .update(user)
          .set({ legacyUserId: plan.legacyUserId })
          .where(eq(user.id, byEmail.id))
          .returning();
      } else {
        const createdAt = legacyDate(plan.createdAt);
        [u] = await tx
          .insert(user)
          .values({
            name: plan.name,
            email: plan.email,
            emailVerified: false,
            legacyUserId: plan.legacyUserId,
            ...(createdAt ? { createdAt } : {}),
          })
          .returning();
        createdUser = true;
      }
    }

    // 2. The Facebook login.
    const fbRows = await tx
      .select({ userId: account.userId, accountId: account.accountId })
      .from(account)
      .where(
        and(
          eq(account.providerId, "facebook"),
          sql`(${account.accountId} = ${plan.facebookId} OR ${account.userId} = ${u.id})`,
        ),
      );
    if (fbRows.some((r) => r.accountId === plan.facebookId && r.userId !== u.id)) {
      throw new LegacyConflict("facebook_id_taken");
    }
    if (fbRows.some((r) => r.userId === u.id && r.accountId !== plan.facebookId)) {
      throw new LegacyConflict("user_has_other_facebook");
    }
    if (!fbRows.some((r) => r.userId === u.id)) {
      await tx
        .insert(account)
        .values({ providerId: "facebook", accountId: plan.facebookId, userId: u.id });
    }

    // 3. People.
    const inserted = plan.people.length
      ? await tx
          .insert(persons)
          .values(
            plan.people.map((p) => ({
              ownerUserId: u.id,
              isSelf: false,
              relation: p.relation,
              relationLabel: p.relationLabel,
              name: p.name,
              gender: p.gender,
              birthDate: p.birthDate,
              avatarSeed: legacyAvatar(p),
              legacyKey: p.key,
            })),
          )
          .onConflictDoNothing()
          .returning({ id: persons.id })
      : [];
    const rows = plan.people.length
      ? await tx
          .select()
          .from(persons)
          .where(
            and(
              eq(persons.ownerUserId, u.id),
              inArray(
                persons.legacyKey,
                plan.people.map((p) => p.key),
              ),
            ),
          )
      : [];
    const byKey = new Map(rows.map((r) => [r.legacyKey!, r]));

    // 4. Purchases (already paid on the old site — no wallet movement).
    let newPurchases = 0;
    for (const p of plan.purchases) {
      const people = p.personKeys.map((k) => byKey.get(k)!);
      const def = ctx.products.get(p.product)!;
      const createdAt = legacyDate(p.createdAt);
      const [row] = await tx
        .insert(purchases)
        .values({
          userId: u.id,
          productCode: p.product,
          pricePaid: p.pricePaid,
          personAId: people[0].id,
          personBId: people[1]?.id ?? null,
          subjectKey: subjectKey(people.map((x) => x.id)),
          snapshot: buildSnapshot(activeParts(def), people, ctx.refs),
          legacyRef: p.legacyRef,
          // No usable date on the old row → the default (now).
          ...(createdAt ? { createdAt } : {}),
        })
        .onConflictDoNothing()
        .returning({ id: purchases.id });
      if (row) newPurchases++;
    }

    // 5. Balance.
    let credited = 0;
    if (plan.balance > 0) {
      const res = await credit(tx as unknown as AppDb, "adjust", {
        userId: u.id,
        amount: plan.balance,
        idempotencyKey: `legacy:balance:${plan.legacyUserId}`,
        refType: "legacy_user",
        refId: String(plan.legacyUserId),
        note: "acyy.me-ийн хуучин үлдэгдэл",
      });
      if (!res.duplicate) credited = plan.balance;
    }

    return {
      ok: true,
      userId: u.id,
      createdUser,
      newPeople: inserted.length,
      newPurchases,
      credited,
    };
  });
}
