import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
  CODE_PATTERN,
  FIELD_KINDS,
  KEY_GENDERS,
  KEY_TYPES,
  KEY_TYPE_ARITY,
  PRODUCT_ICONS,
  PRODUCT_TINTS,
  RELATION_GROUPS,
} from "@/lib/domain";
import { isMonthDay } from "@/server/astro/calendar";
import { validateCoverage, type CoverageIssue } from "@/server/astro/coverage";
import { logAudit } from "@/server/audit";
import type { AppDb } from "@/server/db/types";
import {
  contentEntries,
  periods48,
  productFields,
  productParts,
  products,
  purchases,
  zodiacSigns,
} from "@/server/db/schema";
import { genderKey } from "@/server/content/keys";
import { activeFields, activeParts, loadProductDef } from "@/server/products";
import { PLACEHOLDER_PREFIX, productCoverage } from "./content";

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
// Products, their parts (what texts are keyed by) and fields (sub-sections) — /admin/products.
// Codes never change once created: they are stored in purchases and content.

export class CatalogError extends Error {
  constructor(
    readonly code:
      | "not_found"
      | "code_taken"
      | "has_purchases"
      | "has_content"
      | "arity_mismatch"
      | "last_part"
      | "needs_confirm"
      | "not_ready",
  ) {
    super(code);
  }
}

const codeSchema = z.string().trim().regex(CODE_PATTERN);
const nameSchema = z.string().trim().min(1).max(80);
const priceSchema = z.coerce.number().int().min(0).max(1_000_000);

export const productCreateSchema = z.object({
  code: codeSchema,
  nameMn: nameSchema,
  personCount: z.coerce.number().pipe(z.union([z.literal(1), z.literal(2)])),
  price: priceSchema,
  keyType: z.enum(KEY_TYPES),
  byGender: z.boolean().default(false),
});
export type ProductCreate = z.input<typeof productCreateSchema>;

export const productUpdateSchema = z.object({
  code: codeSchema,
  nameMn: nameSchema,
  description: z.string().trim().max(300).default(""),
  price: priceSchema,
  isActive: z.boolean(),
  adultOnly: z.boolean(),
  allowedGroups: z.array(z.enum(RELATION_GROUPS)).min(1),
  sort: z.coerce.number().int().min(0).max(1000),
  icon: z.enum(PRODUCT_ICONS),
  tint: z.enum(PRODUCT_TINTS),
});
export type ProductUpdate = z.input<typeof productUpdateSchema>;

export const partInputSchema = z.object({
  productCode: codeSchema,
  code: codeSchema,
  nameMn: nameSchema,
  keyType: z.enum(KEY_TYPES),
  byGender: z.boolean().default(false),
  /** The admin agreed to delete / convert the part's real texts (see updatePart). */
  confirm: z.boolean().default(false),
});
export type PartInput = z.input<typeof partInputSchema>;

export const fieldInputSchema = z.object({
  productCode: codeSchema,
  partCode: codeSchema,
  code: codeSchema,
  nameMn: nameSchema,
  kind: z.enum(FIELD_KINDS),
  isFree: z.boolean().default(false),
  required: z.boolean().default(false),
});
export type FieldInput = z.input<typeof fieldInputSchema>;

const partRefSchema = z.object({ productCode: codeSchema, partCode: codeSchema });
const fieldRefSchema = partRefSchema.extend({ code: codeSchema });
const moveSchema = z.object({
  productCode: codeSchema,
  partCode: codeSchema.nullable(),
  code: codeSchema,
  dir: z.enum(["up", "down"]),
});

async function hasPurchases(db: Pick<AppDb, "select">, productCode: string) {
  const [row] = await db
    .select({ id: purchases.id })
    .from(purchases)
    .where(eq(purchases.productCode, productCode))
    .limit(1);
  return Boolean(row);
}

/** Texts of a part: real ones vs. seeded "[Placeholder] …" ones (which never block changes). */
export async function partTextCounts(
  db: Pick<AppDb, "select">,
  productCode: string,
  partCode: string,
): Promise<{ real: number; placeholder: number }> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      placeholder: sql<number>`count(*) filter (where ${contentEntries.title} like ${`${PLACEHOLDER_PREFIX}%`})::int`,
    })
    .from(contentEntries)
    .where(and(eq(contentEntries.productCode, productCode), eq(contentEntries.section, partCode)));
  return { real: row.total - row.placeholder, placeholder: row.placeholder };
}

const partWhere = (productCode: string, partCode: string) =>
  and(eq(productParts.productCode, productCode), eq(productParts.code, partCode));
const partTextsWhere = (productCode: string, partCode: string) =>
  and(eq(contentEntries.productCode, productCode), eq(contentEntries.section, partCode));

/** Real texts may only go away with the admin's explicit OK. */
async function assertConfirmed(
  tx: Pick<AppDb, "select">,
  productCode: string,
  partCode: string,
  confirm: boolean,
) {
  const { real } = await partTextCounts(tx, productCode, partCode);
  if (real > 0 && !confirm) throw new CatalogError("needs_confirm");
  return real;
}

async function getProductRow(db: Pick<AppDb, "select">, code: string) {
  const [row] = await db.select().from(products).where(eq(products.code, code));
  if (!row) throw new CatalogError("not_found");
  return row;
}

/**
 * A new product starts inactive with one part (its key type) and one required prose field;
 * the Owner adds sub-sections and texts, then activates it.
 */
export async function createProduct(db: AppDb, actorId: string, input: ProductCreate) {
  const data = productCreateSchema.parse(input);
  if (KEY_TYPE_ARITY[data.keyType] !== data.personCount) throw new CatalogError("arity_mismatch");
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(products).where(eq(products.code, data.code));
    if (existing) throw new CatalogError("code_taken");
    const [{ maxSort }] = await tx
      .select({ maxSort: sql<number>`coalesce(max(${products.sort}), 0)::int` })
      .from(products);
    const [row] = await tx
      .insert(products)
      .values({
        code: data.code,
        nameMn: data.nameMn,
        price: data.price,
        personCount: data.personCount,
        allowedGroups: [...RELATION_GROUPS],
        isActive: false,
        sort: maxSort + 1,
      })
      .returning();
    await tx.insert(productParts).values({
      productCode: data.code,
      code: "main",
      nameMn: data.nameMn,
      keyType: data.keyType,
      byGender: data.byGender && KEY_TYPE_ARITY[data.keyType] === 1,
      sort: 1,
    });
    await tx.insert(productFields).values({
      productCode: data.code,
      partCode: "main",
      code: "general",
      nameMn: "Ерөнхий",
      kind: "text",
      required: true,
      sort: 1,
    });
    await logAudit(tx, {
      actorId,
      action: "product.create",
      entity: "products",
      entityId: data.code,
      data,
    });
    return row;
  });
}

/**
 * Saves the product's settings. Activating needs at least one part with a field; texts still
 * missing don't block it (partial catalogues are allowed) — the result says how many are missing
 * so the admin sees a warning.
 */
export async function updateProduct(db: AppDb, actorId: string, input: ProductUpdate) {
  const { code, ...data } = productUpdateSchema.parse(input);
  const result = await db.transaction(async (tx) => {
    const before = await getProductRow(tx, code);
    if (data.isActive) {
      const def = await loadProductDef(tx as AppDb, code);
      const parts = def ? activeParts(def) : [];
      if (!parts.length || parts.some((p) => activeFields(p).length === 0)) {
        throw new CatalogError("not_ready");
      }
    }
    const [after] = await tx.update(products).set(data).where(eq(products.code, code)).returning();
    await logAudit(tx, {
      actorId,
      action: "product.update",
      entity: "products",
      entityId: code,
      data: {
        before: {
          nameMn: before.nameMn,
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
  const missing = result.isActive
    ? (await productCoverage(db, code)).reduce((n, c) => n + c.expected - c.published, 0)
    : 0;
  return { product: result, missing };
}

/** Only a product nobody bought can be deleted (its texts go with it); otherwise deactivate. */
export async function deleteProduct(db: AppDb, actorId: string, input: string) {
  const code = codeSchema.parse(input);
  await db.transaction(async (tx) => {
    await getProductRow(tx, code);
    if (await hasPurchases(tx, code)) throw new CatalogError("has_purchases");
    await tx.delete(contentEntries).where(eq(contentEntries.productCode, code));
    await tx.delete(products).where(eq(products.code, code));
    await logAudit(tx, { actorId, action: "product.delete", entity: "products", entityId: code });
  });
}

/** Adds a part (e.g. a second text for a pair). Its key must take as many people as the product. */
export async function addPart(db: AppDb, actorId: string, input: PartInput) {
  const data = partInputSchema.parse(input);
  await db.transaction(async (tx) => {
    const product = await getProductRow(tx, data.productCode);
    if (KEY_TYPE_ARITY[data.keyType] !== product.personCount) {
      throw new CatalogError("arity_mismatch");
    }
    const existing = await tx
      .select()
      .from(productParts)
      .where(eq(productParts.productCode, data.productCode));
    if (existing.some((p) => p.code === data.code)) throw new CatalogError("code_taken");
    await tx.insert(productParts).values({
      productCode: data.productCode,
      code: data.code,
      nameMn: data.nameMn,
      keyType: data.keyType,
      byGender: data.byGender && KEY_TYPE_ARITY[data.keyType] === 1,
      sort: Math.max(0, ...existing.map((p) => p.sort)) + 1,
    });
    await tx.insert(productFields).values({
      productCode: data.productCode,
      partCode: data.code,
      code: "general",
      nameMn: "Ерөнхий",
      kind: "text",
      required: true,
      sort: 1,
    });
    await logAudit(tx, {
      actorId,
      action: "product.part.add",
      entity: "product_parts",
      entityId: `${data.productCode}.${data.code}`,
      data,
    });
  });
}

/**
 * Name: always. Key type / gender split: only while nobody bought the product (bought readings
 * keep their keys) — except sign pair → ordered sign pair, which keeps them valid. The part's texts no longer fit the new keys, so they are deleted — except
 * when only the gender split is switched on: each text is copied to both genders as a draft.
 * Real texts (not placeholders) need `confirm`.
 */
export async function updatePart(db: AppDb, actorId: string, input: PartInput) {
  const { confirm, ...data } = partInputSchema.parse(input);
  await db.transaction(async (tx) => {
    const product = await getProductRow(tx, data.productCode);
    const [part] = await tx
      .select()
      .from(productParts)
      .where(partWhere(data.productCode, data.code));
    if (!part) throw new CatalogError("not_found");
    const byGender = data.byGender && KEY_TYPE_ARITY[data.keyType] === 1;
    const keysChange = part.keyType !== data.keyType || part.byGender !== byGender;
    let texts: "kept" | "split" | "deleted" = "kept";
    // Sign pair → ordered sign pair keeps every key valid ("aries|leo" is also the aries→leo
    // text) and readings show both directions, so it's allowed even after sales; texts stay.
    const widening =
      part.keyType === "sign_pair" && data.keyType === "sign_pair_ordered" && !byGender;
    if (keysChange && !widening) {
      if (KEY_TYPE_ARITY[data.keyType] !== product.personCount) {
        throw new CatalogError("arity_mismatch");
      }
      if (await hasPurchases(tx, data.productCode)) throw new CatalogError("has_purchases");
      await assertConfirmed(tx, data.productCode, data.code, confirm);
      const splitByGender = part.keyType === data.keyType && !part.byGender && byGender;
      const where = partTextsWhere(data.productCode, data.code);
      if (splitByGender) {
        const rows = await tx.select().from(contentEntries).where(where);
        const real = rows.filter((r) => !r.title.startsWith(PLACEHOLDER_PREFIX));
        await tx.delete(contentEntries).where(where);
        const copies = real.flatMap((r) =>
          KEY_GENDERS.map((g) => ({
            productCode: r.productCode,
            section: r.section,
            key: genderKey(r.key, g),
            title: r.title,
            fields: r.fields,
            teaser: r.teaser,
            score: r.score,
            status: "draft" as const,
            updatedBy: actorId,
          })),
        );
        for (let i = 0; i < copies.length; i += 500) {
          await tx.insert(contentEntries).values(copies.slice(i, i + 500));
        }
        texts = "split";
      } else {
        await tx.delete(contentEntries).where(where);
        texts = "deleted";
      }
    }
    await tx
      .update(productParts)
      .set({ nameMn: data.nameMn, keyType: data.keyType, byGender })
      .where(partWhere(data.productCode, data.code));
    await logAudit(tx, {
      actorId,
      action: "product.part.update",
      entity: "product_parts",
      entityId: `${data.productCode}.${data.code}`,
      data: { before: part, after: { ...data, byGender }, texts },
    });
  });
}

/**
 * Deletes a part of a product nobody bought, with its texts (real ones need `confirm`).
 * Bought products archive parts instead. At least one active part must remain.
 */
export async function deletePart(
  db: AppDb,
  actorId: string,
  input: { productCode: string; partCode: string; confirm?: boolean },
) {
  const { productCode, partCode, confirm } = partRefSchema
    .extend({ confirm: z.boolean().default(false) })
    .parse(input);
  await db.transaction(async (tx) => {
    await getProductRow(tx, productCode);
    const parts = await tx
      .select()
      .from(productParts)
      .where(eq(productParts.productCode, productCode));
    const part = parts.find((p) => p.code === partCode);
    if (!part) throw new CatalogError("not_found");
    if (await hasPurchases(tx, productCode)) throw new CatalogError("has_purchases");
    const othersActive = parts.some((p) => p.code !== partCode && p.archivedAt === null);
    if (!othersActive) throw new CatalogError("last_part");
    const real = await assertConfirmed(tx, productCode, partCode, confirm);
    await tx.delete(contentEntries).where(partTextsWhere(productCode, partCode));
    await tx.delete(productParts).where(partWhere(productCode, partCode));
    await logAudit(tx, {
      actorId,
      action: "product.part.delete",
      entity: "product_parts",
      entityId: `${productCode}.${partCode}`,
      data: { deletedTexts: real },
    });
  });
}

/**
 * Archiving stops selling a part (new purchases, import, coverage) while readings bought with it
 * keep showing it. Restoring brings it back — earlier buyers see it again too.
 */
export async function setPartArchived(
  db: AppDb,
  actorId: string,
  input: { productCode: string; partCode: string; archived: boolean },
) {
  const { productCode, partCode, archived } = partRefSchema
    .extend({ archived: z.boolean() })
    .parse(input);
  await db.transaction(async (tx) => {
    await getProductRow(tx, productCode);
    const parts = await tx
      .select()
      .from(productParts)
      .where(eq(productParts.productCode, productCode));
    if (!parts.some((p) => p.code === partCode)) throw new CatalogError("not_found");
    if (archived && !parts.some((p) => p.code !== partCode && p.archivedAt === null)) {
      throw new CatalogError("last_part");
    }
    await tx
      .update(productParts)
      .set({ archivedAt: archived ? new Date() : null })
      .where(partWhere(productCode, partCode));
    await logAudit(tx, {
      actorId,
      action: archived ? "product.part.archive" : "product.part.restore",
      entity: "product_parts",
      entityId: `${productCode}.${partCode}`,
    });
  });
}

/**
 * How many real texts of a part have a value in each field (a used field can only be archived;
 * placeholders don't count).
 */
export async function fieldUsage(
  db: Pick<AppDb, "select">,
  productCode: string,
  partCode: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select({ code: sql<string>`k.key`, n: sql<number>`count(*)::int` })
    .from(contentEntries)
    .innerJoin(sql`jsonb_each_text(${contentEntries.fields}) as k`, sql`btrim(k.value) <> ''`)
    .where(
      and(
        partTextsWhere(productCode, partCode),
        sql`${contentEntries.title} not like ${`${PLACEHOLDER_PREFIX}%`}`,
      ),
    )
    .groupBy(sql`k.key`);
  return Object.fromEntries(rows.map((r) => [r.code, r.n]));
}

async function getPartFields(tx: Pick<AppDb, "select">, productCode: string, partCode: string) {
  const [part] = await tx
    .select()
    .from(productParts)
    .where(and(eq(productParts.productCode, productCode), eq(productParts.code, partCode)));
  if (!part) throw new CatalogError("not_found");
  return tx
    .select()
    .from(productFields)
    .where(and(eq(productFields.productCode, productCode), eq(productFields.partCode, partCode)));
}

/** Adds a sub-section at the end. A code used before (even archived) can't be reused. */
export async function addField(db: AppDb, actorId: string, input: FieldInput) {
  const data = fieldInputSchema.parse(input);
  await db.transaction(async (tx) => {
    const fields = await getPartFields(tx, data.productCode, data.partCode);
    if (fields.some((f) => f.code === data.code)) throw new CatalogError("code_taken");
    await tx
      .insert(productFields)
      .values({ ...data, sort: Math.max(0, ...fields.map((f) => f.sort)) + 1 });
    await logAudit(tx, {
      actorId,
      action: "product.field.add",
      entity: "product_fields",
      entityId: `${data.productCode}.${data.partCode}.${data.code}`,
      data,
    });
  });
}

/** Name, look, free/required flags. The code (the key in stored texts) never changes. */
export async function updateField(db: AppDb, actorId: string, input: FieldInput) {
  const data = fieldInputSchema.parse(input);
  await db.transaction(async (tx) => {
    const fields = await getPartFields(tx, data.productCode, data.partCode);
    const before = fields.find((f) => f.code === data.code);
    if (!before) throw new CatalogError("not_found");
    const { productCode, partCode, code, ...set } = data;
    await tx
      .update(productFields)
      .set(set)
      .where(
        and(
          eq(productFields.productCode, productCode),
          eq(productFields.partCode, partCode),
          eq(productFields.code, code),
        ),
      );
    await logAudit(tx, {
      actorId,
      action: "product.field.update",
      entity: "product_fields",
      entityId: `${productCode}.${partCode}.${code}`,
      data: { before, after: set },
    });
  });
}

/**
 * Archiving hides a sub-section everywhere (reading, editor, import) but keeps its stored
 * texts, so restoring brings them back.
 */
export async function setFieldArchived(
  db: AppDb,
  actorId: string,
  raw: { productCode: string; partCode: string; code: string; archived: boolean },
) {
  const input = fieldRefSchema.extend({ archived: z.boolean() }).parse(raw);
  await db.transaction(async (tx) => {
    const fields = await getPartFields(tx, input.productCode, input.partCode);
    if (!fields.some((f) => f.code === input.code)) throw new CatalogError("not_found");
    await tx
      .update(productFields)
      .set({ archivedAt: input.archived ? new Date() : null })
      .where(
        and(
          eq(productFields.productCode, input.productCode),
          eq(productFields.partCode, input.partCode),
          eq(productFields.code, input.code),
        ),
      );
    await logAudit(tx, {
      actorId,
      action: input.archived ? "product.field.archive" : "product.field.restore",
      entity: "product_fields",
      entityId: `${input.productCode}.${input.partCode}.${input.code}`,
    });
  });
}

/** A sub-section no text has a value for can be deleted for good; otherwise archive it. */
export async function deleteField(
  db: AppDb,
  actorId: string,
  raw: { productCode: string; partCode: string; code: string },
) {
  const input = fieldRefSchema.parse(raw);
  await db.transaction(async (tx) => {
    const fields = await getPartFields(tx, input.productCode, input.partCode);
    if (!fields.some((f) => f.code === input.code)) throw new CatalogError("not_found");
    const used = (await fieldUsage(tx, input.productCode, input.partCode))[input.code] ?? 0;
    if (used > 0) throw new CatalogError("has_content");
    await tx
      .delete(productFields)
      .where(
        and(
          eq(productFields.productCode, input.productCode),
          eq(productFields.partCode, input.partCode),
          eq(productFields.code, input.code),
        ),
      );
    await logAudit(tx, {
      actorId,
      action: "product.field.delete",
      entity: "product_fields",
      entityId: `${input.productCode}.${input.partCode}.${input.code}`,
    });
  });
}

/** Moves a part (partCode = null) or a field one step up/down by swapping sort values. */
export async function moveItem(
  db: AppDb,
  actorId: string,
  raw: { productCode: string; partCode: string | null; code: string; dir: "up" | "down" },
) {
  const input = moveSchema.parse(raw);
  await db.transaction(async (tx) => {
    const isPart = input.partCode === null;
    const rows = isPart
      ? await tx.select().from(productParts).where(eq(productParts.productCode, input.productCode))
      : await getPartFields(tx, input.productCode, input.partCode!);
    const list = [...rows].sort((a, b) => a.sort - b.sort || a.code.localeCompare(b.code));
    const i = list.findIndex((r) => r.code === input.code);
    if (i < 0) throw new CatalogError("not_found");
    const j = input.dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    for (const [sort, row] of list.entries()) {
      if (isPart) {
        await tx
          .update(productParts)
          .set({ sort: sort + 1 })
          .where(
            and(eq(productParts.productCode, input.productCode), eq(productParts.code, row.code)),
          );
      } else {
        await tx
          .update(productFields)
          .set({ sort: sort + 1 })
          .where(
            and(
              eq(productFields.productCode, input.productCode),
              eq(productFields.partCode, input.partCode!),
              eq(productFields.code, row.code),
            ),
          );
      }
    }
    await logAudit(tx, {
      actorId,
      action: "product.reorder",
      entity: isPart ? "product_parts" : "product_fields",
      entityId: [input.productCode, input.partCode, input.code].filter(Boolean).join("."),
      data: { dir: input.dir },
    });
  });
}
