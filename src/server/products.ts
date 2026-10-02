import { asc, eq, inArray } from "drizzle-orm";

import type { AppDb } from "@/server/db/types";
import { productFields, productParts, products } from "@/server/db/schema";

/**
 * A product with its parts and their sub-sections (fields), as configured in /admin/products.
 * Everything that used to be hard-coded per product code (keys, templates, reading layout)
 * is derived from this.
 */

type ProductRow = typeof products.$inferSelect;
type PartRow = typeof productParts.$inferSelect;
export type FieldRow = typeof productFields.$inferSelect;

export type PartDef = PartRow & { fields: FieldRow[] };
export type ProductDef = ProductRow & { parts: PartDef[] };

/** Parts that are sold, imported and counted (not archived), in display order. */
export function activeParts<P extends Pick<PartRow, "archivedAt">>(product: { parts: P[] }): P[] {
  return product.parts.filter((p) => p.archivedAt === null);
}

/** Fields that are shown, edited and imported (not archived), in display order. */
export function activeFields(part: PartDef): FieldRow[] {
  return part.fields.filter((f) => f.archivedAt === null);
}

function assemble(rows: ProductRow[], parts: PartRow[], fields: FieldRow[]): ProductDef[] {
  const bySort = <T extends { sort: number; code: string }>(a: T, b: T) =>
    a.sort - b.sort || a.code.localeCompare(b.code);
  return rows.map((p) => ({
    ...p,
    parts: parts
      .filter((part) => part.productCode === p.code)
      .sort(bySort)
      .map((part) => ({
        ...part,
        fields: fields
          .filter((f) => f.productCode === p.code && f.partCode === part.code)
          .sort(bySort),
      })),
  }));
}

export async function loadProductDefs(db: AppDb, codes?: string[]): Promise<ProductDef[]> {
  if (codes && codes.length === 0) return [];
  const rows = await db
    .select()
    .from(products)
    .where(codes ? inArray(products.code, codes) : undefined)
    .orderBy(asc(products.sort), asc(products.code));
  if (rows.length === 0) return [];
  const wanted = rows.map((r) => r.code);
  const [parts, fields] = await Promise.all([
    db.select().from(productParts).where(inArray(productParts.productCode, wanted)),
    db.select().from(productFields).where(inArray(productFields.productCode, wanted)),
  ]);
  return assemble(rows, parts, fields);
}

export async function loadProductDef(db: AppDb, code: string): Promise<ProductDef | null> {
  const [row] = await db.select().from(products).where(eq(products.code, code));
  if (!row) return null;
  const [parts, fields] = await Promise.all([
    db.select().from(productParts).where(eq(productParts.productCode, code)),
    db.select().from(productFields).where(eq(productFields.productCode, code)),
  ]);
  return assemble([row], parts, fields)[0];
}
