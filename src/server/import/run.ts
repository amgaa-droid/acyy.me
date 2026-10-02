import { and, eq, sql } from "drizzle-orm";

import { loadAstroRefs } from "@/server/astro/refs";
import { logAudit } from "@/server/audit";
import type { AppDb } from "@/server/db/types";
import { contentEntries, periods48 } from "@/server/db/schema";
import type { ImportKindSpec } from "./kinds";
import { parseWorkbook } from "./parse";
import { validateImport, type ImportReport } from "./validate";

export type RunImportResult = ImportReport & {
  missingColumns: string[];
  mapping: Record<string, string>;
  committed: boolean;
};

/**
 * Parse → validate → (optionally) apply in one transaction (SPEC §10).
 * The client re-sends the file on confirm, so nothing unvalidated is ever stored.
 */
export async function runImport(
  db: AppDb,
  opts: {
    spec: ImportKindSpec;
    file: ArrayBuffer | Buffer;
    fileName: string;
    actorId: string;
    commit: boolean;
  },
): Promise<RunImportResult> {
  const { spec } = opts;
  const parsed = await parseWorkbook(opts.file, spec);
  const base = { missingColumns: parsed.missingColumns, mapping: parsed.mapping, committed: false };

  if (parsed.missingColumns.length) {
    return {
      ...base,
      kind: spec.kind,
      rows: 0,
      errors: parsed.missingColumns.map((column) => ({ code: "missing_column" as const, column })),
      entries: [],
      ranges: [],
      missing: [],
      toInsert: 0,
      toUpdate: 0,
      ok: false,
    };
  }

  const astro = await loadAstroRefs(db);
  // Content keys follow the periods table (as coverage does); the table's own import defines all 48.
  const refs = { signs: astro.signs, periodCount: spec.target ? astro.periods.length : 48 };
  const existing = spec.target
    ? new Set(
        (
          await db
            .select({ key: contentEntries.key })
            .from(contentEntries)
            .where(
              and(
                eq(contentEntries.productCode, spec.target.product),
                eq(contentEntries.section, spec.target.section),
              ),
            )
        ).map((r) => r.key),
      )
    : undefined;

  const report = validateImport(spec, parsed.rows, refs, existing);
  if (!opts.commit || !report.ok) return { ...report, ...base };

  await db.transaction(async (tx) => {
    if (spec.target) {
      const { product, section } = spec.target;
      const activeCodes = `{${spec.target.fields.map((f) => f.code).join(",")}}`;
      for (let i = 0; i < report.entries.length; i += 500) {
        await tx
          .insert(contentEntries)
          .values(
            report.entries.slice(i, i + 500).map((e) => ({
              productCode: product,
              section,
              key: e.key,
              title: e.title,
              fields: e.fields,
              teaser: e.teaser,
              score: e.score,
              status: "published" as const,
              updatedBy: opts.actorId,
            })),
          )
          .onConflictDoUpdate({
            target: [contentEntries.productCode, contentEntries.section, contentEntries.key],
            set: {
              title: sql.raw("excluded.title"),
              // Replace the active sub-sections; archived ones keep their stored text.
              fields: sql`(${contentEntries.fields} - ${activeCodes}::text[]) || excluded.fields`,
              teaser: sql.raw("excluded.teaser"),
              score: sql.raw("excluded.score"),
              status: sql.raw("excluded.status"),
              updatedBy: sql.raw("excluded.updated_by"),
              updatedAt: sql`now()`,
            },
          });
      }
    } else {
      await tx.delete(periods48);
      await tx.insert(periods48).values(report.ranges);
    }
    await logAudit(tx, {
      actorId: opts.actorId,
      action: "content.import",
      entity: spec.target ? "content_entries" : "periods48",
      entityId: spec.kind,
      data: {
        file: opts.fileName,
        rows: report.rows,
        inserted: report.toInsert,
        updated: report.toUpdate,
        missing: report.missing.length,
      },
    });
  });

  return { ...report, ...base, committed: true };
}
