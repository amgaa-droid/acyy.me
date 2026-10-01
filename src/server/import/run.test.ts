import ExcelJS from "exceljs";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadAstroRefs } from "@/server/astro/refs";
import { auditLogs, contentEntries, periods48 } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { createTestDb, insertUser } from "@/test/db";
import { seedProductDefs } from "@/server/db/seed-data";
import { allKinds, type ImportKindSpec } from "./kinds";

const IMPORT_KINDS: Record<string, ImportKindSpec> = Object.fromEntries(
  allKinds(seedProductDefs()).map((k) => [k.kind, k]),
);
import { runImport } from "./run";
import { buildTemplate } from "./template";

let db: AppDb;
let close: () => Promise<void>;
let actorId: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  actorId = (await insertUser(db, "editor@test.local")).id;
});
afterAll(() => close());

/** Loads a generated template and fills title/body (and optional score) for every row. */
async function filledTemplate(kind: string, fill: (row: ExcelJS.Row, i: number) => void) {
  const spec = IMPORT_KINDS[kind];
  const refs = await loadAstroRefs(db);
  const buf = await buildTemplate(spec, refs);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  ws.eachRow((row, i) => {
    if (i > 1) fill(row, i);
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("templates", () => {
  it("prefill every expected key", async () => {
    const refs = await loadAstroRefs(db);
    const counts: Record<string, number> = {};
    for (const spec of Object.values(IMPORT_KINDS)) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load((await buildTemplate(spec, refs)) as unknown as ArrayBuffer);
      counts[spec.kind] = wb.worksheets[0].rowCount - 1;
      expect(wb.worksheets[1].name).toBe("Заавар");
    }
    expect(counts).toEqual({
      birthday: 366,
      sign: 12,
      love: 12,
      sex: 12,
      dating: 12,
      "synastry.sign_pair": 144,
      "synastry.period_pair": 1176,
      periods48: 48,
    });
  });
});

describe("runImport", () => {
  it("dry-run reports without writing; commit upserts + audits", async () => {
    const file = await filledTemplate("synastry.sign_pair", (row, i) => {
      row.getCell(3).value = `Гарчиг ${i}`;
      row.getCell(4).value = `Текст ${i}.`;
      row.getCell(6).value = 50 + (i % 50);
    });

    const dry = await runImport(db, {
      spec: IMPORT_KINDS["synastry.sign_pair"],
      file,
      fileName: "s.xlsx",
      actorId,
      commit: false,
    });
    expect(dry).toMatchObject({
      ok: true,
      committed: false,
      toInsert: 144,
      toUpdate: 0,
      missing: [],
    });
    expect(await db.select().from(contentEntries)).toHaveLength(0);

    const done = await runImport(db, {
      spec: IMPORT_KINDS["synastry.sign_pair"],
      file,
      fileName: "s.xlsx",
      actorId,
      commit: true,
    });
    expect(done.committed).toBe(true);
    const rows = await db
      .select()
      .from(contentEntries)
      .where(
        and(eq(contentEntries.productCode, "synastry"), eq(contentEntries.section, "sign_pair")),
      );
    expect(rows).toHaveLength(144);
    expect(rows.every((r) => r.status === "published" && r.updatedBy === actorId)).toBe(true);

    const again = await runImport(db, {
      spec: IMPORT_KINDS["synastry.sign_pair"],
      file,
      fileName: "s.xlsx",
      actorId,
      commit: false,
    });
    expect(again).toMatchObject({ toInsert: 0, toUpdate: 144 });

    const audit = await db.select().from(auditLogs).where(eq(auditLogs.action, "content.import"));
    expect(audit).toHaveLength(1);
    expect(audit[0].data).toMatchObject({ file: "s.xlsx", inserted: 144 });
  });

  it("a file with any bad row imports nothing", async () => {
    const file = await filledTemplate("love", (row, i) => {
      row.getCell(2).value = `Гарчиг ${i}`;
      row.getCell(3).value = i === 5 ? "" : "Текст.";
    });
    const res = await runImport(db, {
      spec: IMPORT_KINDS.love,
      file,
      fileName: "l.xlsx",
      actorId,
      commit: true,
    });
    expect(res.committed).toBe(false);
    expect(res.errors).toEqual([{ code: "required", row: 5, column: "general" }]);
    expect(
      await db.select().from(contentEntries).where(eq(contentEntries.productCode, "love")),
    ).toHaveLength(0);
  });

  it("reports missing columns", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("x").addRow(["орд", "гарчиг"]);
    const file = Buffer.from(await wb.xlsx.writeBuffer());
    const res = await runImport(db, {
      spec: IMPORT_KINDS.sign,
      file,
      fileName: "x.xlsx",
      actorId,
      commit: false,
    });
    expect(res.missingColumns).toEqual(["general"]);
    expect(res.ok).toBe(false);
  });

  it("maps Mongolian headers and Excel date cells", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("x");
    ws.addRow(["Огноо", "Гарчиг", "Текст"]);
    ws.addRow([new Date(Date.UTC(2001, 2, 21)), "Хаврын өдөр", "Текст."]);
    ws.addRow(["3-22", "Дараа өдөр", "Текст."]);
    const file = Buffer.from(await wb.xlsx.writeBuffer());
    const res = await runImport(db, {
      spec: IMPORT_KINDS.birthday,
      file,
      fileName: "b.xlsx",
      actorId,
      commit: false,
    });
    expect(res.ok).toBe(true);
    expect(res.entries.map((e) => e.key)).toEqual(["03-21", "03-22"]);
    expect(res.mapping).toEqual({ month_day: "Огноо", title: "Гарчиг", body: "Текст" });
  });

  it("periods48 replaces the ranges table atomically", async () => {
    const file = await filledTemplate("periods48", (row) => {
      row.getCell(4).value = `Үе ${row.getCell(1).value}`;
    });
    const res = await runImport(db, {
      spec: IMPORT_KINDS.periods48,
      file,
      fileName: "p.xlsx",
      actorId,
      commit: true,
    });
    expect(res.committed).toBe(true);
    const rows = await db.select().from(periods48);
    expect(rows).toHaveLength(48);
    expect(rows.find((r) => r.no === 1)?.label).toBe("Үе 1");
  });
});
