import { and, count, eq, isNull, ne, sql } from "drizzle-orm";

import { logAudit } from "@/server/audit";
import {
  account,
  helpChats,
  invitations,
  persons,
  previewViews,
  purchases,
  session,
  user,
} from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { getBalance } from "@/server/wallet";

/**
 * Account deletion from /me (SPEC §9 "Данс устгах", privacy policy §9).
 * Personal data goes: persons (theirs and the people they added), invitations, sessions,
 * Google/Facebook/password logins, preview counts, help-chat history, and the names inside
 * purchase snapshots.
 * The money trail stays for the accounts (purchases, topups, wallet_entries, the wallet) under
 * an anonymised `user` row with `deleted_at` — the row itself is kept because those tables
 * reference it. The wallet balance is forfeited as the terms say; the ledger is not touched.
 */

/** What the confirmation sheet warns about. */
export type DeletionSummary = {
  balance: number;
  readings: number;
  /** People added besides "Би". */
  people: number;
  /** Other users linked to one of this user's people (they lose their shared reading). */
  linkedOthers: number;
};

export async function accountDeletionSummary(db: AppDb, userId: string): Promise<DeletionSummary> {
  const live = and(eq(persons.ownerUserId, userId), isNull(persons.deletedAt));
  const [[readings], [people], [linked]] = await Promise.all([
    db.select({ n: count() }).from(purchases).where(eq(purchases.userId, userId)),
    db
      .select({ n: count() })
      .from(persons)
      .where(and(live, eq(persons.isSelf, false))),
    db
      .select({ n: count() })
      .from(persons)
      .where(and(live, sql`${persons.linkedUserId} IS NOT NULL`, ne(persons.linkedUserId, userId))),
  ]);
  return {
    balance: await getBalance(db, userId),
    readings: readings.n,
    people: people.n,
    linkedOthers: linked.n,
  };
}

export const DELETED_USER_NAME = "Устгасан хэрэглэгч";
/** `.invalid` can never receive mail (RFC 2606), and the id keeps `user.email` unique. */
export const deletedEmail = (userId: string) => `deleted-${userId}@deleted.invalid`;

/** Deletes the account's personal data in one transaction. Idempotent. */
export async function deleteAccount(db: AppDb, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [u] = await tx
      .select({ id: user.id, deletedAt: user.deletedAt })
      .from(user)
      .where(eq(user.id, userId))
      .for("update");
    if (!u || u.deletedAt) return;

    const summary = await accountDeletionSummary(tx as unknown as AppDb, userId);

    // Their links into other people's lists end; those owners keep their own person.
    await tx.update(persons).set({ linkedUserId: null }).where(eq(persons.linkedUserId, userId));
    await tx.delete(invitations).where(eq(invitations.inviterUserId, userId));
    // purchases.person_*_id are SET NULL; the snapshot keeps what the ledger needs.
    await tx.delete(persons).where(eq(persons.ownerUserId, userId));
    await tx.delete(previewViews).where(eq(previewViews.userId, userId));
    await tx.delete(helpChats).where(eq(helpChats.userId, userId));
    await tx.delete(session).where(eq(session.userId, userId));
    await tx.delete(account).where(eq(account.userId, userId));

    // Snapshot names are personal data; dates/signs alone say what was sold.
    await tx
      .update(purchases)
      .set({
        snapshot: sql`jsonb_set(${purchases.snapshot}, '{persons}', (
          SELECT coalesce(jsonb_agg(p || '{"name": ""}'::jsonb), '[]'::jsonb)
          FROM jsonb_array_elements(${purchases.snapshot}->'persons') AS p
        ))`,
      })
      .where(eq(purchases.userId, userId));

    await tx
      .update(user)
      .set({
        name: DELETED_USER_NAME,
        email: deletedEmail(userId),
        emailVerified: false,
        image: null,
        adultConfirmedAt: null,
        onboarding: {},
        deletedAt: new Date(),
      })
      .where(eq(user.id, userId));

    // No email or name in the log: only the counts, for support questions later.
    await logAudit(tx, {
      actorId: userId,
      action: "account.delete",
      entity: "user",
      entityId: userId,
      data: summary,
    });
  });
}
