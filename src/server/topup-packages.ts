import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import type { AppDb } from "@/server/db/types";
import { topupPackages, topups } from "@/server/db/schema";

/**
 * Top-up packages (SPEC §4.1): what the wallet sheet offers — pay `amount`, get `amount + bonus`.
 * Owner manages them at /admin/packages. Top-ups copy amount/bonus, so edits never rewrite
 * history. Once a package has top-ups its price is fixed and it can't be deleted — only its
 * bonus may change, or it can be deactivated.
 */

export type TopupPackage = typeof topupPackages.$inferSelect;
/** What the client needs to render the picker. */
export type PackageOption = Pick<TopupPackage, "id" | "amount" | "bonus">;

export class PackageError extends Error {
  constructor(readonly code: "not_found" | "amount_taken" | "has_topups" | "amount_locked") {
    super(code);
  }
}

const moneySchema = z.coerce.number().int();

export const packageInputSchema = z.object({
  amount: moneySchema.min(100).max(10_000_000),
  bonus: moneySchema.min(0).max(10_000_000),
  isActive: z.boolean().default(true),
  sort: z.coerce.number().int().min(0).max(1000).default(0),
});
export const packageUpdateSchema = packageInputSchema.extend({ id: z.uuid() });
export type PackageInput = z.input<typeof packageInputSchema>;

const order = [asc(topupPackages.sort), asc(topupPackages.amount)];

export async function listPackages(db: AppDb): Promise<TopupPackage[]> {
  return db
    .select()
    .from(topupPackages)
    .orderBy(...order);
}

export async function listActivePackages(db: AppDb): Promise<PackageOption[]> {
  return db
    .select({ id: topupPackages.id, amount: topupPackages.amount, bonus: topupPackages.bonus })
    .from(topupPackages)
    .where(eq(topupPackages.isActive, true))
    .orderBy(...order);
}

/** The active package the user picked (by id, as the wallet sheet sends it). */
export async function findActivePackage(db: AppDb, id: string) {
  if (!z.uuid().safeParse(id).success) return undefined;
  const [row] = await db
    .select()
    .from(topupPackages)
    .where(and(eq(topupPackages.id, id), eq(topupPackages.isActive, true)));
  return row;
}

/** Whether any top-up (paid or not) was made with this package. */
async function hasTopups(db: Pick<AppDb, "select">, id: string) {
  const [used] = await db
    .select({ id: topups.id })
    .from(topups)
    .where(eq(topups.packageId, id))
    .limit(1);
  return Boolean(used);
}

/** Index of the package with the best bonus ratio (for a "best value" badge), or -1. */
export function bestValueIndex(packages: Pick<PackageOption, "amount" | "bonus">[]): number {
  let best = -1;
  let bestRatio = 0;
  packages.forEach((p, i) => {
    const ratio = p.bonus / p.amount;
    if (ratio > bestRatio) [best, bestRatio] = [i, ratio];
  });
  return best;
}

async function amountTaken(db: Pick<AppDb, "select">, amount: number, exceptId?: string) {
  const [row] = await db
    .select({ id: topupPackages.id })
    .from(topupPackages)
    .where(
      exceptId
        ? and(eq(topupPackages.amount, amount), ne(topupPackages.id, exceptId))
        : eq(topupPackages.amount, amount),
    );
  return Boolean(row);
}

export async function createPackage(db: AppDb, actorId: string, input: unknown) {
  const data = packageInputSchema.parse(input);
  return db.transaction(async (tx) => {
    if (await amountTaken(tx, data.amount)) throw new PackageError("amount_taken");
    const [row] = await tx.insert(topupPackages).values(data).returning();
    await logAudit(tx, {
      actorId,
      action: "topup_package.create",
      entity: "topup_packages",
      entityId: row.id,
      data,
    });
    return row;
  });
}

export async function updatePackage(db: AppDb, actorId: string, input: unknown) {
  const { id, ...data } = packageUpdateSchema.parse(input);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(topupPackages).where(eq(topupPackages.id, id));
    if (!before) throw new PackageError("not_found");
    // A sold package keeps its price, so history and stats stay readable: a new price is a new
    // package (and the old one gets deactivated). The bonus may change (promotions).
    if (data.amount !== before.amount && (await hasTopups(tx, id)))
      throw new PackageError("amount_locked");
    if (await amountTaken(tx, data.amount, id)) throw new PackageError("amount_taken");
    const [row] = await tx
      .update(topupPackages)
      .set(data)
      .where(eq(topupPackages.id, id))
      .returning();
    await logAudit(tx, {
      actorId,
      action: "topup_package.update",
      entity: "topup_packages",
      entityId: id,
      data: {
        before: { amount: before.amount, bonus: before.bonus, isActive: before.isActive },
        after: data,
      },
    });
    return row;
  });
}

export async function deletePackage(db: AppDb, actorId: string, id: string) {
  if (!z.uuid().safeParse(id).success) throw new PackageError("not_found");
  await db.transaction(async (tx) => {
    if (await hasTopups(tx, id)) throw new PackageError("has_topups");
    const [row] = await tx.delete(topupPackages).where(eq(topupPackages.id, id)).returning();
    if (!row) throw new PackageError("not_found");
    await logAudit(tx, {
      actorId,
      action: "topup_package.delete",
      entity: "topup_packages",
      entityId: id,
      data: { amount: row.amount, bonus: row.bonus },
    });
  });
}
