import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";

import {
  CONTENT_SECTIONS,
  PRODUCT_CODES,
  type ContentSection,
  type ProductCode,
} from "@/lib/domain";
import { loadAstroRefs } from "@/server/astro/refs";
import { logAudit } from "@/server/audit";
import { expectedKeys } from "@/server/content/keys";
import type { AppDb } from "@/server/db/types";
import { contentEntries } from "@/server/db/schema";
import { MAX_BODY, MAX_TEASER, MAX_TITLE } from "@/server/import/validate";

export type CoverageRow = {
  product: ProductCode;
  section: ContentSection;
  expected: number;
  published: number;
  draft: number;
  missing: number;
  /** Seeded "[Placeholder] …" texts still waiting for real content. */
  placeholder: number;
};

export const PLACEHOLDER_PREFIX = "[Placeholder]";

/** "366/366", "1176/1176"… per product and section (admin dashboard, SPEC §6.2). */
export async function contentCoverage(db: AppDb): Promise<CoverageRow[]> {
  const refs = await loadAstroRefs(db);
  const ref = { signCodes: refs.signs.map((s) => s.code), periodCount: refs.periods.length };
  const rows = await db
    .select({
      product: contentEntries.productCode,
      section: contentEntries.section,
      key: contentEntries.key,
      status: contentEntries.status,
      title: contentEntries.title,
    })
    .from(contentEntries);

  const out: CoverageRow[] = [];
  for (const product of PRODUCT_CODES) {
    for (const { section, keys } of expectedKeys(product, ref)) {
      const expected = new Set(keys);
      const here = rows.filter(
        (r) => r.product === product && r.section === section && expected.has(r.key),
      );
      const published = here.filter((r) => r.status === "published").length;
      out.push({
        product,
        section,
        expected: expected.size,
        published,
        draft: here.length - published,
        missing: expected.size - here.length,
        placeholder: here.filter((r) => r.title.startsWith(PLACEHOLDER_PREFIX)).length,
      });
    }
  }
  return out;
}

export async function missingKeys(db: AppDb, product: ProductCode, section: ContentSection) {
  const refs = await loadAstroRefs(db);
  const keys =
    expectedKeys(product, {
      signCodes: refs.signs.map((s) => s.code),
      periodCount: refs.periods.length,
    }).find((s) => s.section === section)?.keys ?? [];
  const present = new Set(
    (
      await db
        .select({ key: contentEntries.key })
        .from(contentEntries)
        .where(and(eq(contentEntries.productCode, product), eq(contentEntries.section, section)))
    ).map((r) => r.key),
  );
  return keys.filter((k) => !present.has(k));
}

export const listQuerySchema = z.object({
  product: z.enum(PRODUCT_CODES).default("birthday"),
  section: z.enum(CONTENT_SECTIONS).default("main"),
  q: z.string().trim().max(100).default(""),
  status: z.enum(["all", "draft", "published"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

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
        ilike(contentEntries.body, like),
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

export const entryInputSchema = z.object({
  product: z.enum(PRODUCT_CODES),
  section: z.enum(CONTENT_SECTIONS),
  key: z.string().trim().min(1).max(20),
  title: z.string().trim().min(1).max(MAX_TITLE),
  body: z.string().trim().min(1).max(MAX_BODY),
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
export type EntryInput = z.input<typeof entryInputSchema>;

export class UnknownContentKeyError extends Error {
  constructor() {
    super("unknown_key");
  }
}

/** Creates or updates one text by (product, section, key); the key must be an expected one. */
export async function saveContentEntry(db: AppDb, actorId: string, input: EntryInput) {
  const data = entryInputSchema.parse(input);
  const refs = await loadAstroRefs(db);
  const valid = expectedKeys(data.product, {
    signCodes: refs.signs.map((s) => s.code),
    periodCount: refs.periods.length,
  }).find((s) => s.section === data.section);
  if (!valid?.keys.includes(data.key)) throw new UnknownContentKeyError();

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(contentEntries)
      .values({
        productCode: data.product,
        section: data.section,
        key: data.key,
        title: data.title,
        body: data.body,
        teaser: data.teaser,
        score: data.score,
        status: data.status,
        updatedBy: actorId,
      })
      .onConflictDoUpdate({
        target: [contentEntries.productCode, contentEntries.section, contentEntries.key],
        set: {
          title: data.title,
          body: data.body,
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
