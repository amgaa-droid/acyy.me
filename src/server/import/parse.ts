import ExcelJS from "exceljs";

import { uploadColumns, type ColumnSpec, type ImportKindSpec } from "./kinds";

export type ParsedRow = { row: number; values: Record<string, string> };
export type ParseResult = {
  rows: ParsedRow[];
  /** canonical column → header text found in the file */
  mapping: Record<string, string>;
  missingColumns: string[];
  sheetName: string | null;
};

const normalizeHeader = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\s\-.]+/g, "_")
    .replace(/^_+|_+$/g, "");

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Plain text of any exceljs cell value. Dates become "MM-DD" (Excel often turns "03-21" into a date). */
export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return `${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
  if (typeof value === "object") {
    if ("richText" in value)
      return value.richText
        .map((r) => r.text)
        .join("")
        .trim();
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("text" in value) return String(value.text).trim();
    if ("error" in value) return "";
  }
  return String(value).trim();
}

/** Finds each spec column in the header row by canonical name or alias. */
export function mapColumns(
  headers: string[],
  columns: ColumnSpec[],
): { mapping: Record<string, number>; found: Record<string, string>; missing: string[] } {
  const normalized = headers.map(normalizeHeader);
  const mapping: Record<string, number> = {};
  const found: Record<string, string> = {};
  const missing: string[] = [];

  for (const c of columns) {
    const candidates = [c.name, ...c.aliases].map(normalizeHeader);
    const index = normalized.findIndex((h) => h && candidates.includes(h));
    if (index >= 0) {
      mapping[c.name] = index;
      found[c.name] = headers[index];
    } else if (c.required) {
      missing.push(c.name);
    }
  }
  return { mapping, found, missing };
}

/** Reads the first worksheet: row 1 = header, then data rows (blank rows skipped). */
export async function parseWorkbook(
  buffer: ArrayBuffer | Buffer,
  spec: ImportKindSpec,
): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  const ws = wb.worksheets[0];
  const columns = uploadColumns(spec);
  if (!ws)
    return {
      rows: [],
      mapping: {},
      missingColumns: columns.filter((c) => c.required).map((c) => c.name),
      sheetName: null,
    };

  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  for (let i = 1; i <= Math.max(headerRow.cellCount, ws.columnCount); i++) {
    headers.push(cellText(headerRow.getCell(i).value));
  }

  const { mapping, found, missing } = mapColumns(headers, columns);
  // Without a legacy `body` column, the required sub-section columns must be there.
  if (spec.target && !("body" in mapping)) {
    for (const f of spec.target.fields) {
      if (f.required && !(f.code in mapping)) missing.push(f.code);
    }
  }
  const rows: ParsedRow[] = [];
  if (missing.length === 0) {
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const values: Record<string, string> = {};
      for (const [name, index] of Object.entries(mapping)) {
        values[name] = cellText(row.getCell(index + 1).value);
      }
      if (Object.values(values).some((v) => v !== "")) rows.push({ row: r, values });
    }
  }
  return { rows, mapping: found, missingColumns: missing, sheetName: ws.name };
}
