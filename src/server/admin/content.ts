import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { KeyType } from "@/lib/domain";
import { loadAstroRefs } from "@/server/astro/refs";
import { logAudit } from "@/server/audit";
import { expectedPartKeys, type KeyRefs } from "@/server/content/keys";
import type { AppDb } from "@/server/db/types";
import { contentEntries } from "@/server/db/schema";
import { MAX_FIELD, MAX_TEASER, MAX_TITLE } from "@/server/import/validate";
import {
  activeFields,
  activeParts,
  loadProductDef,
  loadProductDefs,
  type PartDef,
  type ProductDef,
} from "@/server/products";

type CoverageRow = {
  product: string;
  productName: string;
  /** Part code and name; the name is shown only for multi-part products. */
  section: string;
  sectionName: string | null;
  keyType: KeyType;
  isActive: boolean;
  expected: number;
  published: number;
  draft: number;
  missing: number;
  /** Seeded "[Placeholder] …" texts still waiting for real content. */
  placeholder: number;
};

export const PLACEHOLDER_PREFIX = "[Placeholder]";

async function keyRefs(db: AppDb): Promise<KeyRefs> {
  const refs = await loadAstroRefs(db);
  return { signCodes: refs.signs.map((s) => s.code), periodCount: refs.periods.length };
}

async function coverageOf(db: AppDb, defs: ProductDef[]): Promise<CoverageRow[]> {
  if (defs.length === 0) return [];
  const ref = await keyRefs(db);
  const rows = await db
    .select({
      product: contentEntries.productCode,
      section: contentEntries.section,
      key: contentEntries.key,
      status: contentEntries.status,
      title: contentEntries.title,
    })
    .from(contentEntries);

  return defs.flatMap((product) =>
    activeParts(product).map((part) => {
      const expected = new Set(expectedPartKeys(part, ref));
      const here = rows.filter(
        (r) => r.product === product.code && r.section === part.code && expected.has(r.key),
      );
      const published = here.filter((r) => r.status === "published").length;
      return {
        product: product.code,
        productName: product.nameMn,
        section: part.code,
        sectionName: activeParts(product).length > 1 ? part.nameMn : null,
        keyType: part.keyType,
        isActive: product.isActive,
        expected: expected.size,
        published,
        draft: here.length - published,
        missing: expected.size - here.length,
        placeholder: here.filter((r) => r.title.startsWith(PLACEHOLDER_PREFIX)).length,
      };
    }),
  );
}

/** "366/366", "1176/1176"… per product and part (admin dashboard, SPEC §6.2). */
export async function contentCoverage(db: AppDb): Promise<CoverageRow[]> {
  return coverageOf(db, await loadProductDefs(db));
}

export async function productCoverage(db: AppDb, code: string): Promise<CoverageRow[]> {
  const def = await loadProductDef(db, code);
  return def ? coverageOf(db, [def]) : [];
}

export async function missingKeys(db: AppDb, part: PartDef) {
  const keys = expectedPartKeys(part, await keyRefs(db));
  const present = new Set(
    (
      await db
        .select({ key: contentEntries.key })
        .from(contentEntries)
        .where(
          and(
            eq(contentEntries.productCode, part.productCode),
            eq(contentEntries.section, part.code),
          ),
        )
    ).map((r) => r.key),
  );
  return keys.filter((k) => !present.has(k));
}

export const listQuerySchema = z.object({
  product: z.string().trim().max(32).default(""),
  section: z.string().trim().max(32).default(""),
  q: z.string().trim().max(100).default(""),
  status: z.enum(["all", "draft", "published"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
});
type ListQuery = z.infer<typeof listQuerySchema>;

export const PAGE_SIZE = 50;

export async function listContent(db: AppDb, query: ListQuery) {
  const conds = [
    eq(contentEntries.productCode, query.product),
    eq(contentEntries.section, query.section),
  ];
  if (query.status !== "all") conds.push(eq(contentEntries.status, query.status));
  if (query.q) {
    const like = `%${query.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conds.push(
      or(
        ilike(contentEntries.key, like),
        ilike(contentEntries.title, like),
        sql`${contentEntries.fields}::text ILIKE ${like}`,
      )!,
    );
  }
  const where = and(...conds);
  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: contentEntries.id,
        key: contentEntries.key,
        title: contentEntries.title,
        status: contentEntries.status,
        score: contentEntries.score,
        updatedAt: contentEntries.updatedAt,
      })
      .from(contentEntries)
      .where(where)
      .orderBy(asc(contentEntries.key))
      .limit(PAGE_SIZE)
      .offset((query.page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(contentEntries).where(where),
  ]);
  return { items, total };
}

export async function getContentEntry(db: AppDb, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db.select().from(contentEntries).where(eq(contentEntries.id, id));
  return row ?? null;
}

const entryInputSchema = z.object({
  product: z.string().trim().min(1).max(32),
  section: z.string().trim().min(1).max(32),
  key: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(MAX_TITLE),
  fields: z.record(z.string(), z.string().max(MAX_FIELD)),
  teaser: z
    .string()
    .trim()
    .max(MAX_TEASER)
    .nullish()
    .transform((v) => v || null),
  score: z
    .union([z.literal(""), z.null(), z.coerce.number().int().min(0).max(100)])
    .transform((v) => (v === "" ? null : v)),
  status: z.enum(["draft", "published"]),
});
type EntryInput = z.input<typeof entryInputSchema>;

export class UnknownContentKeyError extends Error {
  constructor() {
    super("unknown_key");
  }
}

/** A required sub-section is empty, or nothing at all was filled in. */
export class MissingFieldsError extends Error {
  constructor(readonly fields: string[]) {
    super("missing_fields");
  }
}

/**
 * Keeps only the part's active fields (trimmed, non-empty) and checks required ones.
 * Values of archived fields are carried over from `previous` so restoring a field brings them back.
 */
function cleanFields(
  part: PartDef,
  input: Record<string, string>,
  previous: Record<string, string> = {},
): Record<string, string> {
  const active = activeFields(part);
  const out: Record<string, string> = {};
  for (const f of part.fields) {
    if (f.archivedAt !== null && previous[f.code]) out[f.code] = previous[f.code];
  }
  for (const f of active) {
    const v = input[f.code]?.replace(/\r\n?/g, "\n").trim();
    if (v) out[f.code] = v;
  }
  const missing = active.filter((f) => f.required && !out[f.code]).map((f) => f.code);
  if (missing.length || !active.some((f) => out[f.code])) throw new MissingFieldsError(missing);
  return out;
}

/** Creates or updates one text by (product, part, key); the key must be an expected one. */
export async function saveContentEntry(db: AppDb, actorId: string, input: EntryInput) {
  const data = entryInputSchema.parse(input);
  const def = await loadProductDef(db, data.product);
  const part = def?.parts.find((p) => p.code === data.section && p.archivedAt === null);
  if (!part || !expectedPartKeys(part, await keyRefs(db)).includes(data.key)) {
    throw new UnknownContentKeyError();
  }

  return db.transaction(async (tx) => {
    const [prev] = await tx
      .select({ fields: contentEntries.fields })
      .from(contentEntries)
      .where(
        and(
          eq(contentEntries.productCode, data.product),
          eq(contentEntries.section, data.section),
          eq(contentEntries.key, data.key),
        ),
      );
    const fields = cleanFields(part, data.fields, prev?.fields);
    const [row] = await tx
      .insert(contentEntries)
      .values({
        productCode: data.product,
        section: data.section,
        key: data.key,
        title: data.title,
        fields,
        teaser: data.teaser,
        score: data.score,
        status: data.status,
        updatedBy: actorId,
      })
      .onConflictDoUpdate({
        target: [contentEntries.productCode, contentEntries.section, contentEntries.key],
        set: {
          title: data.title,
          fields,
          teaser: data.teaser,
          score: data.score,
          status: data.status,
          updatedBy: actorId,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    await logAudit(tx, {
      actorId,
      action: "content.save",
      entity: "content_entries",
      entityId: row.id,
      data: { product: data.product, section: data.section, key: data.key, status: data.status },
    });
    return row;
  });
}
