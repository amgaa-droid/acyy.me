import ExcelJS from "exceljs";
import { and, gte, lte, sql } from "drizzle-orm";

import { parseIsoDate, toIsoDate } from "@/lib/birth-date";
import { addDays } from "@/lib/daily";
import { loadAstroRefs } from "@/server/astro/refs";
import { logAudit } from "@/server/audit";
import { DAILY_TEXT_MAX, listDailyKinds } from "@/server/daily";
import { dailyEntries } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { type ColumnSpec } from "./kinds";
import { cellText, mapColumns } from "./parse";
import { resolveSign } from "./validate";

/**
 * Excel import of daily horoscopes (SPEC §3.2): one row per day × sign, one text column per
 * daily kind (header = kind code or its Mongolian name). An empty cell leaves that text as it
 * is — the import never deletes. The template for a date range comes pre-filled with the texts
 * already written, so it doubles as an export.
 */

export const DAILY_MAX_ROWS = 5000;
/** Longest range a template covers. */
export const DAILY_TEMPLATE_MAX_DAYS = 366;

export type DailyImportErrorCode =
  | "missing_column"
  | "no_kind_columns"
  | "empty_file"
  | "too_many_rows"
  | "invalid_date"
  | "unknown_sign"
  | "duplicate"
  | "too_long";

export type DailyImportError = {
  code: DailyImportErrorCode;
  /** Excel row number (1 = header); absent for file-level errors. */
  row?: number;
  column?: string;
  value?: string;
  /** The first row of a duplicate. */
  detail?: string;
};

export type DailyImportEntry = { date: string; signCode: string; kindCode: string; text: string };

export type DailyImportReport = {
  rows: number;
  /** Kind codes found as columns. */
  kinds: string[];
  /** Headers that matched nothing (ignored). */
  ignoredColumns: string[];
  errors: DailyImportError[];
  /** Texts to write (new or changed). */
  entries: DailyImportEntry[];
  toInsert: number;
  toUpdate: number;
  unchanged: number;
  from: string | null;
  to: string | null;
  /** Days in the file whose found kinds × 12 signs aren't all filled (after the import). */
  incomplete: { date: string; filled: number; total: number }[];
  ok: boolean;
};

export type DailyParsedRow = {
  row: number;
  date: string;
  sign: string;
  texts: Record<string, string>;
};

const DATE_COLUMN: ColumnSpec = { name: "date", aliases: ["огноо", "өдөр", "day"], required: true };
const SIGN_COLUMN: ColumnSpec = {
  name: "sign",
  aliases: ["орд", "zodiac", "sign_code"],
  required: true,
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "2026-10-02", "2026.10.2", "2026/10/02", an Excel date or date serial → "YYYY-MM-DD", else null. */
export function normalizeDate(value: ExcelJS.CellValue): string | null {
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
  }
  if (typeof value === "number" && value > 20000 && value < 80000) {
    // Excel's 1900 date system (as exceljs reads an unformatted date cell).
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
    return toIsoDate({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() });
  }
  const m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(cellText(value));
  if (!m) return null;
  const iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return parseIsoDate(iso) ? iso : null;
}

/** Reads the first worksheet: row 1 = header (date, sign, then kind columns). */
export async function parseDailyWorkbook(
  buffer: ArrayBuffer | Buffer,
  kinds: readonly { code: string; nameMn: string }[],
): Promise<{
  rows: DailyParsedRow[];
  kinds: string[];
  ignoredColumns: string[];
  errors: DailyImportError[];
}> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], kinds: [], ignoredColumns: [], errors: [{ code: "empty_file" }] };

  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  for (let i = 1; i <= Math.max(headerRow.cellCount, ws.columnCount); i++) {
    headers.push(cellText(headerRow.getCell(i).value));
  }
  const kindColumns = kinds.map((k) => ({ name: k.code, aliases: [k.nameMn], required: false }));
  const { mapping, missing } = mapColumns(headers, [DATE_COLUMN, SIGN_COLUMN, ...kindColumns]);
  const found = kinds.map((k) => k.code).filter((c) => c in mapping);
  const used = new Set(Object.values(mapping));
  const ignoredColumns = headers.filter((h, i) => h && !used.has(i));

  const errors: DailyImportError[] = missing.map((column) => ({ code: "missing_column", column }));
  if (found.length === 0) errors.push({ code: "no_kind_columns" });
  if (errors.length) return { rows: [], kinds: found, ignoredColumns, errors };

  const rows: DailyParsedRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const rawDate = row.getCell(mapping.date + 1).value;
    const texts: Record<string, string> = {};
    for (const code of found) texts[code] = cellText(row.getCell(mapping[code] + 1).value);
    const dateText = rawDate instanceof Date ? "date" : cellText(rawDate);
    const sign = cellText(row.getCell(mapping.sign + 1).value);
    if (!dateText && !sign && Object.values(texts).every((v) => !v)) continue;
    rows.push({ row: r, date: normalizeDate(rawDate) ?? `!${dateText}`, sign, texts });
  }
  return { rows, kinds: found, ignoredColumns, errors };
}

const keyOf = (date: string, signCode: string, kindCode: string) =>
  `${date}|${signCode}|${kindCode}`;

/**
 * Checks parsed rows: valid date, known sign, one row per day × sign, texts ≤ the limit. Every
 * non-empty text becomes an entry unless it equals what's stored (`existing`: key → text).
 */
export function validateDailyRows(
  rows: readonly DailyParsedRow[],
  ctx: {
    kinds: readonly string[];
    signs: { code: string; nameMn: string }[];
    existing: ReadonlyMap<string, string>;
    ignoredColumns?: string[];
  },
): DailyImportReport {
  const report: DailyImportReport = {
    rows: rows.length,
    kinds: [...ctx.kinds],
    ignoredColumns: ctx.ignoredColumns ?? [],
    errors: [],
    entries: [],
    toInsert: 0,
    toUpdate: 0,
    unchanged: 0,
    from: null,
    to: null,
    incomplete: [],
    ok: false,
  };
  if (rows.length === 0) {
    report.errors.push({ code: "empty_file" });
    return report;
  }
  if (rows.length > DAILY_MAX_ROWS) {
    report.errors.push({ code: "too_many_rows", detail: String(DAILY_MAX_ROWS) });
    return report;
  }

  const seen = new Map<string, number>();
  /** date → filled day × sign × kind cells, after the import. */
  const filled = new Map<string, Set<string>>();
  for (const r of rows) {
    const date = r.date.startsWith("!") ? null : r.date;
    if (!date)
      report.errors.push({
        code: "invalid_date",
        row: r.row,
        column: "date",
        value: r.date.slice(1),
      });
    const signCode = resolveSign(r.sign, ctx.signs);
    if (!signCode)
      report.errors.push({ code: "unknown_sign", row: r.row, column: "sign", value: r.sign });
    for (const kind of ctx.kinds) {
      if (r.texts[kind].length > DAILY_TEXT_MAX)
        report.errors.push({
          code: "too_long",
          row: r.row,
          column: kind,
          detail: String(DAILY_TEXT_MAX),
        });
    }
    if (!date || !signCode) continue;

    const dup = seen.get(`${date}|${signCode}`);
    if (dup !== undefined) {
      report.errors.push({
        code: "duplicate",
        row: r.row,
        value: `${date} · ${r.sign}`,
        detail: String(dup),
      });
      continue;
    }
    seen.set(`${date}|${signCode}`, r.row);
    if (!report.from || date < report.from) report.from = date;
    if (!report.to || date > report.to) report.to = date;

    const cells = filled.get(date) ?? new Set<string>();
    filled.set(date, cells);
    for (const kind of ctx.kinds) {
      const key = keyOf(date, signCode, kind);
      const text = r.texts[kind].replace(/\r\n/g, "\n").trim();
      const stored = ctx.existing.get(key);
      if (text || stored) cells.add(key);
      if (!text || text.length > DAILY_TEXT_MAX) continue;
      if (stored === text) report.unchanged++;
      else {
        report.entries.push({ date, signCode, kindCode: kind, text });
        if (stored === undefined) report.toInsert++;
        else report.toUpdate++;
      }
    }
  }

  const total = ctx.kinds.length * ctx.signs.length;
  report.incomplete = [...filled.entries()]
    .filter(([, cells]) => cells.size < total)
    .map(([date, cells]) => ({ date, filled: cells.size, total }))
    .sort((a, b) => a.date.localeCompare(b.date));
  report.ok = report.errors.length === 0;
  return report;
}

async function storedTexts(db: AppDb, from: string, to: string): Promise<Map<string, string>> {
  const rows = await db
    .select()
    .from(dailyEntries)
    .where(and(gte(dailyEntries.date, from), lte(dailyEntries.date, to)));
  return new Map(rows.map((r) => [keyOf(r.date, r.signCode, r.kindCode), r.text]));
}

/**
 * Parse → validate → (optionally) write in one transaction. The client re-sends the file on
 * confirm, so nothing unvalidated is stored.
 */
export async function runDailyImport(
  db: AppDb,
  opts: { file: ArrayBuffer | Buffer; fileName: string; actorId: string; commit: boolean },
): Promise<DailyImportReport & { committed: boolean }> {
  const [kinds, refs] = await Promise.all([listDailyKinds(db), loadAstroRefs(db)]);
  const parsed = await parseDailyWorkbook(opts.file, kinds);
  if (parsed.errors.length) {
    return {
      ...validateDailyRows([], { kinds: parsed.kinds, signs: refs.signs, existing: new Map() }),
      ignoredColumns: parsed.ignoredColumns,
      errors: parsed.errors,
      rows: 0,
      committed: false,
    };
  }
  const dates = parsed.rows
    .map((r) => r.date)
    .filter((d) => !d.startsWith("!"))
    .sort();
  const existing = dates.length
    ? await storedTexts(db, dates[0], dates[dates.length - 1])
    : new Map();
  const report = validateDailyRows(parsed.rows, {
    kinds: parsed.kinds,
    signs: refs.signs,
    existing,
    ignoredColumns: parsed.ignoredColumns,
  });
  if (!opts.commit || !report.ok) return { ...report, committed: false };

  await db.transaction(async (tx) => {
    for (let i = 0; i < report.entries.length; i += 500) {
      await tx
        .insert(dailyEntries)
        .values(report.entries.slice(i, i + 500).map((e) => ({ ...e, updatedBy: opts.actorId })))
        .onConflictDoUpdate({
          target: [dailyEntries.kindCode, dailyEntries.date, dailyEntries.signCode],
          set: { text: sql.raw("excluded.text"), updatedBy: opts.actorId, updatedAt: sql`now()` },
        });
    }
    await logAudit(tx, {
      actorId: opts.actorId,
      action: "daily.import",
      entity: "daily_entries",
      entityId: `${report.from}..${report.to}`,
      data: {
        file: opts.fileName,
        rows: report.rows,
        kinds: report.kinds,
        inserted: report.toInsert,
        updated: report.toUpdate,
      },
    });
  });
  return { ...report, committed: true };
}

const INSTRUCTIONS = [
  "Эхний хуудасны 1-р мөр = баганын нэр. Нэг мөр = нэг өдөр × нэг орд.",
  "date: ОООО-СС-ӨӨ (2026-10-02). sign: ордны монгол нэр (Хилэнц) эсвэл code (scorpio).",
  "Төрөл бүр тусдаа багана: толгой нь код (general) эсвэл монгол нэр (Өнөөдрийн зурхай). Хэрэггүй төрлийн баганыг устгаж болно.",
  `Текст: энгийн текст, ≤ ${DAILY_TEXT_MAX} тэмдэгт; догол мөрийг хоосон мөрөөр тусгаарлана.`,
  "Хоосон нүд одоо байгаа текстийг өөрчлөхгүй (импорт юу ч устгахгүй). Устгахыг /admin/daily-аас хийнэ.",
  "Загвар тухайн өдрүүдийн одоо байгаа текстээр бөглөгдсөн — засаад буцаан оруулж болно.",
  "Нэг өдөр × орд хоёр мөрөнд давхардвал алдаа. Алдаатай мөр байвал юу ч импортлогдохгүй — эхлээд тайлангаа шалгана.",
];

/** Template for `days` days from `from`: every day × sign, kind columns pre-filled with stored texts. */
export async function buildDailyTemplate(db: AppDb, from: string, days: number): Promise<Buffer> {
  const n = Math.max(1, Math.min(DAILY_TEMPLATE_MAX_DAYS, Math.floor(days)));
  const to = addDays(from, n - 1);
  const [kinds, refs, existing] = await Promise.all([
    listDailyKinds(db, { activeOnly: true }),
    loadAstroRefs(db),
    storedTexts(db, from, to),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Зурхай admin";
  const ws = wb.addWorksheet("daily", { views: [{ state: "frozen", ySplit: 1, xSplit: 2 }] });
  ws.columns = [
    { header: "date", key: "date", width: 13, style: { numFmt: "@" } },
    { header: "sign", key: "sign", width: 11 },
    ...kinds.map((k) => ({
      header: k.code,
      key: k.code,
      width: 60,
      style: { alignment: { wrapText: true, vertical: "top" as const } },
    })),
  ];
  ws.getRow(1).font = { bold: true };
  for (let i = 0; i < n; i++) {
    const date = addDays(from, i);
    for (const s of refs.signs) {
      const row = ws.addRow([
        date,
        s.nameMn,
        ...kinds.map((k) => existing.get(keyOf(date, s.code, k.code)) ?? ""),
      ]);
      row.getCell(1).numFmt = "@";
    }
  }

  const help = wb.addWorksheet("Заавар");
  help.getColumn(1).width = 110;
  help.addRow([`Өдрийн зурхай — ${from} … ${to}`]).font = { bold: true };
  for (const line of INSTRUCTIONS) help.addRow([line]);
  help.addRow([]);
  help.addRow(["Төрлүүд (багана — нэр):"]).font = { bold: true };
  for (const k of kinds) help.addRow([`${k.code} — ${k.nameMn}`]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
