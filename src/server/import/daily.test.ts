import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { saveDailyTexts } from "@/server/daily";
import { auditLogs, dailyEntries } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { createTestDb, insertUser } from "@/test/db";
import { buildDailyTemplate, normalizeDate, runDailyImport } from "./daily";

let db: AppDb;
let close: () => Promise<void>;
let actorId: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  actorId = (await insertUser(db, "editor@test.local")).id;
});
afterAll(() => close());
beforeEach(async () => {
  await db.delete(dailyEntries);
  await db.delete(auditLogs);
});

/** A workbook from a header row and data rows. */
async function workbook(rows: ExcelJS.CellValue[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("daily");
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const run = (file: Buffer, commit = false) =>
  runDailyImport(db, { file, fileName: "daily.xlsx", actorId, commit });

describe("normalizeDate", () => {
  it("accepts ISO-like text, Excel dates and date serials", () => {
    expect(normalizeDate("2026-10-02")).toBe("2026-10-02");
    expect(normalizeDate("2026.10.2")).toBe("2026-10-02");
    expect(normalizeDate("2026/1/9")).toBe("2026-01-09");
    expect(normalizeDate(new Date(Date.UTC(2028, 1, 29)))).toBe("2028-02-29");
    expect(normalizeDate(46297)).toBe("2026-10-02");
  });

  it("rejects impossible or partial dates", () => {
    expect(normalizeDate("2026-02-30")).toBeNull();
    expect(normalizeDate("10-02")).toBeNull();
    expect(normalizeDate("")).toBeNull();
    expect(normalizeDate(12)).toBeNull();
  });
});

describe("template", () => {
  it("has every day × sign across the year boundary, pre-filled with stored texts", async () => {
    await saveDailyTexts(db, actorId, {
      date: "2027-01-01",
      kind: "love",
      texts: { leo: "Хайр." },
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildDailyTemplate(db, "2026-12-31", 2)) as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    expect(ws.getRow(1).values).toEqual([undefined, "date", "sign", "general", "love", "work"]);
    expect(ws.rowCount).toBe(1 + 2 * 12);
    expect(ws.getRow(2).values).toEqual([undefined, "2026-12-31", "Хонь", "", "", ""]);
    const leo = ws.getRow(1 + 12 + 5); // 2027-01-01, 5th sign = Арслан
    expect(leo.getCell(1).value).toBe("2027-01-01");
    expect(leo.getCell(2).value).toBe("Арслан");
    expect(leo.getCell(4).value).toBe("Хайр.");
    expect(wb.worksheets[1].name).toBe("Заавар");
  });

  it("round-trips: an untouched template imports nothing", async () => {
    await saveDailyTexts(db, actorId, {
      date: "2026-10-02",
      kind: "general",
      texts: { aries: "А", leo: "Б" },
    });
    const res = await run(await buildDailyTemplate(db, "2026-10-02", 3));
    expect(res).toMatchObject({
      ok: true,
      rows: 36,
      unchanged: 2,
      toInsert: 0,
      toUpdate: 0,
      entries: [],
    });
  });
});

describe("runDailyImport", () => {
  it("dry run reports, commit writes; empty cells keep the stored text", async () => {
    await saveDailyTexts(db, actorId, {
      date: "2026-10-02",
      kind: "general",
      texts: { aries: "Хуучин.", taurus: "Үлдэнэ." },
    });
    const file = await workbook([
      ["Огноо", "Орд", "Өнөөдрийн зурхай", "love", "тэмдэглэл"],
      ["2026-10-02", "Хонь", "Шинэ.", "Хайр.", "x"],
      ["2026-10-02", "taurus", "", "  Мөр 1\r\n\r\nМөр 2  ", ""],
      [new Date(Date.UTC(2026, 9, 3)), "Хилэнц", "Маргааш.", "", ""],
    ]);

    const dry = await run(file);
    expect(dry).toMatchObject({
      ok: true,
      committed: false,
      rows: 3,
      kinds: ["general", "love"],
      ignoredColumns: ["тэмдэглэл"],
      toInsert: 3,
      toUpdate: 1,
      unchanged: 0,
      from: "2026-10-02",
      to: "2026-10-03",
    });
    expect(dry.incomplete).toEqual([
      { date: "2026-10-02", filled: 4, total: 24 },
      { date: "2026-10-03", filled: 1, total: 24 },
    ]);
    expect(await db.select().from(dailyEntries)).toHaveLength(2);

    const done = await run(file, true);
    expect(done.committed).toBe(true);
    const rows = await db.select().from(dailyEntries);
    const text = (date: string, sign: string, kind: string) =>
      rows.find((r) => r.date === date && r.signCode === sign && r.kindCode === kind)?.text;
    expect(rows).toHaveLength(5);
    expect(text("2026-10-02", "aries", "general")).toBe("Шинэ.");
    expect(text("2026-10-02", "taurus", "general")).toBe("Үлдэнэ.");
    expect(text("2026-10-02", "taurus", "love")).toBe("Мөр 1\n\nМөр 2");
    expect(text("2026-10-03", "scorpio", "general")).toBe("Маргааш.");
    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.action, "daily.import"));
    expect(log.entityId).toBe("2026-10-02..2026-10-03");

    // The same file again changes nothing.
    expect(await run(file)).toMatchObject({ ok: true, toInsert: 0, toUpdate: 0, unchanged: 4 });
  });

  it("rejects bad rows with their row numbers and writes nothing", async () => {
    const res = await run(
      await workbook([
        ["date", "sign", "general"],
        ["2026-02-30", "Хонь", "a"],
        ["2026-10-02", "Плутон", "b"],
        ["2026-10-02", "Хонь", "c"],
        ["2026-10-02", "aries", "d"],
        ["2026-10-03", "Хонь", "x".repeat(3001)],
      ]),
      true,
    );
    expect(res.ok).toBe(false);
    expect(res.committed).toBe(false);
    expect(res.errors).toEqual([
      { code: "invalid_date", row: 2, column: "date", value: "2026-02-30" },
      { code: "unknown_sign", row: 3, column: "sign", value: "Плутон" },
      { code: "duplicate", row: 5, value: "2026-10-02 · aries", detail: "4" },
      { code: "too_long", row: 6, column: "general", detail: "3000" },
    ]);
    expect(await db.select().from(dailyEntries)).toHaveLength(0);
  });

  it("needs the date and sign columns and at least one kind column", async () => {
    const noSign = await run(
      await workbook([
        ["date", "general"],
        ["2026-10-02", "a"],
      ]),
    );
    expect(noSign.errors).toEqual([{ code: "missing_column", column: "sign" }]);
    const noKind = await run(
      await workbook([
        ["date", "sign", "other"],
        ["2026-10-02", "Хонь", "a"],
      ]),
    );
    expect(noKind.errors).toEqual([{ code: "no_kind_columns" }]);
    const empty = await run(await workbook([["date", "sign", "general"]]));
    expect(empty.errors).toEqual([{ code: "empty_file" }]);
  });
});
