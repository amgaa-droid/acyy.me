import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { isUniqueViolation } from "@/server/db/errors";
import type { AppDb } from "@/server/db/types";
import { walletEntries, wallets } from "@/server/db/schema";

/**
 * The wallet ledger (SPEC §4.2, CLAUDE.md rule 1). This is the ONLY module that changes
 * `wallets.balance`. Every change:
 *   - runs in a transaction and locks the wallet row (`SELECT … FOR UPDATE`),
 *   - writes one `wallet_entries` row with `balance_after`,
 *   - carries an `idempotency_key` (UNIQUE): replaying the same key is a no-op that
 *     returns the original entry.
 * Amounts are whole MNT (integers). The DB also enforces balance ≥ 0.
 */

type WalletEntry = typeof walletEntries.$inferSelect;
type CreditType = "topup" | "bonus" | "refund" | "adjust";
type DebitType = "purchase" | "adjust";

const MAX_AMOUNT = 10_000_000;
const amountSchema = z.number().int().positive().max(MAX_AMOUNT);
const keySchema = z.string().min(1).max(200);

export class InsufficientFundsError extends Error {
  constructor(
    readonly balance: number,
    readonly required: number,
  ) {
    super("insufficient_funds");
  }
}

type LedgerResult = { entry: WalletEntry; balance: number; duplicate: boolean };

type Movement = {
  userId: string;
  amount: number;
  idempotencyKey: string;
  refType?: string | null;
  refId?: string | null;
  note?: string | null;
  createdBy?: string | null;
};

async function findByKey(db: AppDb, key: string): Promise<WalletEntry | undefined> {
  const [entry] = await db
    .select()
    .from(walletEntries)
    .where(eq(walletEntries.idempotencyKey, key));
  return entry;
}

async function move(
  db: AppDb,
  sign: 1 | -1,
  type: CreditType | DebitType,
  m: Movement,
): Promise<LedgerResult> {
  const amount = amountSchema.parse(m.amount);
  const idempotencyKey = keySchema.parse(m.idempotencyKey);

  const replay = async (): Promise<LedgerResult | null> => {
    const existing = await findByKey(db, idempotencyKey);
    if (!existing) return null;
    if (existing.userId !== m.userId) throw new Error("idempotency_key_reused_for_another_user");
    return { entry: existing, balance: await getBalance(db, m.userId), duplicate: true };
  };

  const earlier = await replay();
  if (earlier) return earlier;

  try {
    return await db.transaction(async (tx) => {
      await tx.insert(wallets).values({ userId: m.userId }).onConflictDoNothing();
      const [wallet] = await tx
        .select({ balance: wallets.balance })
        .from(wallets)
        .where(eq(wallets.userId, m.userId))
        .for("update");

      // Re-check under the lock: a concurrent call with the same key may have just committed.
      const [dup] = await tx
        .select()
        .from(walletEntries)
        .where(eq(walletEntries.idempotencyKey, idempotencyKey));
      if (dup) return { entry: dup, balance: wallet.balance, duplicate: true };

      const balance = wallet.balance + sign * amount;
      if (balance < 0) throw new InsufficientFundsError(wallet.balance, amount);

      await tx
        .update(wallets)
        .set({ balance, updatedAt: sql`now()` })
        .where(eq(wallets.userId, m.userId));
      const [entry] = await tx
        .insert(walletEntries)
        .values({
          userId: m.userId,
          type,
          amount: sign * amount,
          balanceAfter: balance,
          idempotencyKey,
          refType: m.refType ?? null,
          refId: m.refId ?? null,
          note: m.note ?? null,
          createdBy: m.createdBy ?? null,
        })
        .returning();
      return { entry, balance, duplicate: false };
    });
  } catch (err) {
    // Same key committed by another transaction between our checks → treat as a replay.
    if (isUniqueViolation(err)) {
      const again = await replay();
      if (again) return again;
    }
    throw err;
  }
}

/** Adds money. Replaying an idempotency key returns the original entry unchanged. */
export function credit(db: AppDb, type: CreditType, m: Movement): Promise<LedgerResult> {
  return move(db, 1, type, m);
}

/** Takes money; throws InsufficientFundsError (and changes nothing) if the balance is short. */
export function debit(db: AppDb, type: DebitType, m: Movement): Promise<LedgerResult> {
  return move(db, -1, type, m);
}

export async function getBalance(db: AppDb, userId: string): Promise<number> {
  const [w] = await db
    .select({ balance: wallets.balance })
    .from(wallets)
    .where(eq(wallets.userId, userId));
  return w?.balance ?? 0;
}

export async function listEntries(db: AppDb, userId: string, limit = 50): Promise<WalletEntry[]> {
  return db
    .select()
    .from(walletEntries)
    .where(eq(walletEntries.userId, userId))
    .orderBy(desc(walletEntries.createdAt), desc(walletEntries.id))
    .limit(limit);
}

/** Owner correction (SPEC §4.1): signed amount, reason required; credit or debit with type=adjust. */
const adjustSchema = z.object({
  userId: z.uuid(),
  amount: z
    .number()
    .int()
    .refine((n) => n !== 0 && Math.abs(n) <= MAX_AMOUNT, "invalid_amount"),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: keySchema,
  createdBy: z.uuid(),
});

export async function adjust(
  db: AppDb,
  input: z.input<typeof adjustSchema>,
): Promise<LedgerResult> {
  const a = adjustSchema.parse(input);
  const m = {
    userId: a.userId,
    amount: Math.abs(a.amount),
    // Its own namespace: a hand-typed key can never stand in for a payment's or a purchase's.
    idempotencyKey: `adjust:${a.idempotencyKey}`,
    refType: "admin",
    refId: a.createdBy,
    note: a.reason,
    createdBy: a.createdBy,
  };
  return a.amount > 0 ? credit(db, "adjust", m) : debit(db, "adjust", m);
}

/** Sum of the ledger — must always equal wallets.balance (used in tests and admin checks). */
export async function ledgerSum(db: AppDb, userId: string): Promise<number> {
  const [row] = await db
    .select({ sum: sql<string>`coalesce(sum(${walletEntries.amount}), 0)` })
    .from(walletEntries)
    .where(and(eq(walletEntries.userId, userId)));
  return Number(row.sum);
}
