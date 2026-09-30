/**
 * Old site texts → SPEC §10 import files for /admin/import.
 *
 *   pnpm tsx scripts/legacy-to-xlsx.ts [exportDir]   (default: OldDB/export)
 *
 * Reads birthdays.json + compatibility.json (extracted from the legacy MSSQL dump, kept out of
 * git) and writes birthday.xlsx, synastry_periods.xlsx and periods48.xlsx to <exportDir>/import.
 * Every file is parsed back and dry-run validated with the real import code before it's kept.
 */
import ExcelJS from "exceljs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ZODIAC_SIGNS } from "@/server/db/seed-data";
import { IMPORT_KINDS, type ImportKind } from "@/server/import/kinds";
import { parseWorkbook } from "@/server/import/parse";
import { validateImport } from "@/server/import/validate";
import {
  birthdayRow,
  periodPairRow,
  periodRow,
  type LegacyBirthday,
  type LegacyPair,
  type LegacyPeriod,
} from "@/server/legacy/transform";

async function build(kind: ImportKind, rows: Record<string, string>[]): Promise<Buffer> {
  const spec = IMPORT_KINDS[kind];
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(kind, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = spec.columns.map((c) => ({
    header: c.name,
    key: c.name,
    width: c.name === "body" ? 80 : c.name === "title" || c.name === "teaser" ? 36 : 10,
    style: { numFmt: "@", alignment: { wrapText: true, vertical: "top" } },
  }));
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function main() {
  const dir = path.resolve(process.argv[2] ?? "OldDB/export");
  const outDir = path.join(dir, "import");
  const birthdays: LegacyBirthday[] = JSON.parse(
    await readFile(path.join(dir, "birthdays.json"), "utf8"),
  );
  const compat: { periods: LegacyPeriod[]; pairs: LegacyPair[] } = JSON.parse(
    await readFile(path.join(dir, "compatibility.json"), "utf8"),
  );

  const files: [ImportKind, Record<string, string>[]][] = [
    ["periods48", compat.periods.map(periodRow)],
    ["birthday", birthdays.map(birthdayRow)],
    ["synastry_periods", compat.pairs.map(periodPairRow)],
  ];
  const refs = { signs: ZODIAC_SIGNS.map((s) => ({ ...s })), periodCount: compat.periods.length };

  await mkdir(outDir, { recursive: true });
  let failed = false;
  for (const [kind, rows] of files) {
    const buffer = await build(kind, rows);
    const spec = IMPORT_KINDS[kind];
    const parsed = await parseWorkbook(buffer, spec);
    const report = validateImport(spec, parsed.rows, refs);
    const count = kind === "periods48" ? report.ranges.length : report.entries.length;
    console.log(
      `${spec.file}: ${count} rows, ${report.errors.length} errors, ${report.missing.length} missing keys`,
    );
    for (const e of report.errors.slice(0, 10)) console.log("  ", e);
    if (!report.ok || report.missing.length) {
      failed = true;
      continue;
    }
    await writeFile(path.join(outDir, spec.file), buffer);
  }
  if (failed) {
    console.error("Some files failed validation — not written.");
    process.exit(1);
  }
  console.log(`→ ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
