import ExcelJS from "exceljs";

import { ALL_MONTH_DAYS, type MonthDayRange } from "@/server/astro/calendar";
import { periodPairKeys, signPairKeys } from "@/server/content/keys";
import type { ImportKindSpec } from "./kinds";

export type TemplateRefs = {
  signs: { code: string; nameMn: string }[];
  periods: (MonthDayRange & { no: number; label: string | null })[];
};

/** Key cells for every expected row, so editors only fill in title/body (/score). */
function keyRows(spec: ImportKindSpec, refs: TemplateRefs): string[][] {
  const nameOf = new Map(refs.signs.map((s) => [s.code, s.nameMn]));
  switch (spec.kind) {
    case "birthday":
      return ALL_MONTH_DAYS.map((md) => [md]);
    case "synastry_signs":
      return signPairKeys(refs.signs.map((s) => s.code)).map((k) =>
        k.split("|").map((c) => nameOf.get(c) ?? c),
      );
    case "synastry_periods":
      return periodPairKeys(refs.periods.length).map((k) => k.split("|"));
    case "periods48":
      return refs.periods.map((p) => [String(p.no), p.startMd, p.endMd, p.label ?? ""]);
    default:
      return refs.signs.map((s) => [s.nameMn]);
  }
}

const INSTRUCTIONS = [
  "Эхний хуудасны 1-р мөр = баганын нэр. Нэрийг өөрчлөхгүй байх (монгол нэр ч танигдана).",
  "Түлхүүр баганууд (огноо, орд, үе) урьдчилан бөглөгдсөн. title, body-г бөглөнө.",
  "Орд: монгол нэр (Хилэнц) эсвэл code (scorpio). Огноо: MM-DD (03-21).",
  "Нийцэлд A×B ба B×A нэг текст. Давхар мөр оруулбал алдаа гарна.",
  "score (заавал биш): 0–100 бүхэл тоо.",
  "Хоосон мөр алгасагдана. Дутуу түлхүүрүүд тайланд харагдана, импорт хэсэгчлэн хийгдэж болно.",
  "Алдаатай мөр байвал юу ч импортлогдохгүй — эхлээд тайлангаа шалгана.",
];

export async function buildTemplate(spec: ImportKindSpec, refs: TemplateRefs): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Зурхай admin";
  const ws = wb.addWorksheet(spec.kind, { views: [{ state: "frozen", ySplit: 1 }] });

  ws.columns = spec.columns.map((c) => ({
    header: c.name,
    key: c.name,
    width: c.name === "body" ? 80 : c.name === "title" ? 36 : 14,
    style: c.name === "body" ? { alignment: { wrapText: true, vertical: "top" } } : undefined,
  }));
  ws.getRow(1).font = { bold: true };

  const keyCols =
    spec.kind === "periods48"
      ? 4
      : spec.columns.length - (spec.columns.some((c) => c.name === "score") ? 3 : 2);
  for (const keys of keyRows(spec, refs)) {
    const row = ws.addRow(keys);
    for (let i = 1; i <= keyCols; i++) row.getCell(i).numFmt = "@"; // keep "03-21" as text
  }
  // Text format for key columns so Excel doesn't turn MM-DD into dates on edit.
  for (let i = 1; i <= keyCols; i++) ws.getColumn(i).numFmt = "@";

  const help = wb.addWorksheet("Заавар");
  help.getColumn(1).width = 110;
  help.addRow([`${spec.label} — ${spec.file}`]).font = { bold: true };
  for (const line of INSTRUCTIONS) help.addRow([line]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
