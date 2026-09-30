import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { PRODUCT_CODES, RELATION_GROUPS } from "@/lib/domain";
import { isMonthDay } from "@/server/astro/calendar";
import { validateCoverage, type CoverageIssue } from "@/server/astro/coverage";
import { logAudit } from "@/server/audit";
import type { AppDb } from "@/server/db/types";
import { periods48, products, zodiacSigns } from "@/server/db/schema";

const md = z.string().trim().refine(isMonthDay, "invalid_month_day");

export class CoverageError extends Error {
  constructor(readonly issues: CoverageIssue[]) {
    super("coverage");
  }
}

// ---------- Sign ranges (Editor/Owner) ----------

export const signRangesSchema = z
  .array(z.object({ code: z.string().min(1), startMd: md, endMd: md }))
  .min(1);

/** Saves all 12 sign ranges at once; refused unless every day is covered exactly once. */
export async function saveSignRanges(db: AppDb, actorId: string, input: unknown) {
  const ranges = signRangesSchema.parse(input);
  const { ok, issues } = validateCoverage(ranges);
  if (!ok) throw new CoverageError(issues);

  await db.transaction(async (tx) => {
    const existing = await tx.select().from(zodiacSigns);
    const known = new Set(existing.map((s) => s.code));
    if (ranges.length !== existing.length || ranges.some((r) => !known.has(r.code))) {
      throw new z.ZodError([
        { code: "custom", path: ["code"], message: "unknown_sign", input: undefined },
      ]);
    }
    for (const r of ranges) {
      await tx
        .update(zodiacSigns)
        .set({ startMd: r.startMd, endMd: r.endMd })
        .where(eq(zodiacSigns.code, r.code));
    }
    await logAudit(tx, {
      actorId,
      action: "zodiac.ranges.save",
      entity: "zodiac_signs",
      data: ranges,
    });
  });
}

// ---------- 48 periods (Editor/Owner) ----------

export const periodRangesSchema = z
  .array(
    z.object({
      no: z.number().int().min(1).max(48),
      startMd: md,
      endMd: md,
      label: z
        .string()
        .trim()
        .max(60)
        .nullish()
        .transform((v) => v || null),
    }),
  )
  .length(48)
  .refine((rows) => new Set(rows.map((r) => r.no)).size === 48, "duplicate_no");

export async function savePeriodRanges(db: AppDb, actorId: string, input: unknown) {
  const ranges = periodRangesSchema.parse(input).sort((a, b) => a.no - b.no);
  const { ok, issues } = validateCoverage(ranges);
  if (!ok) throw new CoverageError(issues);

  await db.transaction(async (tx) => {
    await tx.delete(periods48);
    await tx.insert(periods48).values(ranges);
    await logAudit(tx, {
      actorId,
      action: "periods48.save",
      entity: "periods48",
      data: { count: 48 },
    });
  });
}

// ---------- Products (Owner) ----------

export const productUpdateSchema = z.object({
  code: z.enum(PRODUCT_CODES),
  price: z.coerce.number().int().min(0).max(1_000_000),
  isActive: z.boolean(),
  adultOnly: z.boolean(),
  allowedGroups: z.array(z.enum(RELATION_GROUPS)).min(1),
});
export type ProductUpdate = z.input<typeof productUpdateSchema>;

export async function listProducts(db: AppDb) {
  return db.select().from(products).orderBy(asc(products.sort));
}

export async function updateProduct(db: AppDb, actorId: string, input: ProductUpdate) {
  const { code, ...data } = productUpdateSchema.parse(input);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(products).where(eq(products.code, code));
    const [after] = await tx.update(products).set(data).where(eq(products.code, code)).returning();
    await logAudit(tx, {
      actorId,
      action: "product.update",
      entity: "products",
      entityId: code,
      data: {
        before: {
          price: before.price,
          isActive: before.isActive,
          adultOnly: before.adultOnly,
          allowedGroups: before.allowedGroups,
        },
        after: data,
      },
    });
    return after;
  });
}
