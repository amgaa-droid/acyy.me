import ExcelJS from "exceljs";

import type { FieldKind } from "@/lib/domain";
import type { MonthDayRange } from "@/server/astro/calendar";
import { expectedPartKeys } from "@/server/content/keys";
import { TITLE_COLUMN, type ImportKindSpec } from "./kinds";

const FIELD_KIND_HINTS: Record<FieldKind, string> = {
  text: "текст",
  quote: "ишлэл",
  cards: "карт (мөр бүр нэг)",
  list: "жагсаалт (мөр бүр нэг)",
  chips: "онцлох (мөр/таслалаар)",
  alert: "анхааруулга (мөр/таслалаар)",
};

export type TemplateRefs = {
  signs: { code: string; nameMn: string }[];
  periods: (MonthDayRange & { no: number; label: string | null })[];
};

/** Key cells for every expected row, so editors only fill in the text columns. */
function keyRows(spec: ImportKindSpec, refs: TemplateRefs): string[][] {
  if (!spec.target)
    return refs.periods.map((p) => [String(p.no), p.startMd, p.endMd, p.label ?? ""]);
  const nameOf = new Map(refs.signs.map((s) => [s.code, s.nameMn]));
  const keys = expectedPartKeys(
    { keyType: spec.target.keyType, byGender: spec.target.byGender },
    { signCodes: refs.signs.map((s) => s.code), periodCount: refs.periods.length },
  );
  return keys.map((k) =>
    k.split("|").map((c) => (c === "male" ? "Эр" : c === "female" ? "Эм" : (nameOf.get(c) ?? c))),
  );
}

const WIDE = new Set(["body", "general"]);

const INSTRUCTIONS = [
  "Эхний хуудасны 1-р мөр = баганын нэр. Нэрийг өөрчлөхгүй байх (монгол нэр ч танигдана).",
  "Түлхүүр баганууд (огноо, орд, үе, хүйс) урьдчилан бөглөгдсөн. title болон дэд хэсгийн багануудыг бөглөнө.",
  "Орд: монгол нэр (Хилэнц) эсвэл code (scorpio). Огноо: MM-DD (03-21). Хүйс: Эр / Эм.",
  "Хосын түлхүүрт A×B ба B×A нэг текст; чиглэлтэй хост (144) Хонь→Арслан, Арслан→Хонь тусдаа текст. Давхар мөр оруулбал алдаа гарна.",
  "Дэд хэсэг бүр тусдаа багана (доорх жагсаалт). Жагсаалт, карт төрлийн хэсэгт нэг мөрөнд нэг зүйл бичнэ.",
  "Текст төрлийн хэсэгт догол мөрийг хоосон мөрөөр тусгаарлана, «## Гарчиг» мөр дэд гарчиг болно.",
  "teaser (заавал биш): худалдаж авахаас өмнө үнэгүй харагдах богино текст (≤ 500 тэмдэгт).",
  "score (заавал биш): 0–100 бүхэл тоо.",
  "Хоосон мөр алгасагдана. Дутуу түлхүүрүүд тайланд харагдана, импорт хэсэгчлэн хийгдэж болно.",
  "Алдаатай мөр байвал юу ч импортлогдохгүй — эхлээд тайлангаа шалгана.",
];

export async function buildTemplate(spec: ImportKindSpec, refs: TemplateRefs): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Зурхай admin";
  const ws = wb.addWorksheet(spec.kind, { views: [{ state: "frozen", ySplit: 1 }] });

  const fieldCodes = new Set(spec.target?.fields.map((f) => f.code));
  const isText = (name: string) => fieldCodes.has(name) || name === "teaser";
  ws.columns = spec.columns.map((c) => ({
    header: c.name,
    key: c.name,
    width: WIDE.has(c.name) ? 80 : isText(c.name) || c.name === "title" ? 40 : 14,
    style: isText(c.name) ? { alignment: { wrapText: true, vertical: "top" } } : undefined,
  }));
  ws.getRow(1).font = { bold: true };

  const keyCols = spec.target ? spec.columns.indexOf(TITLE_COLUMN) : 4;
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
  if (spec.target) {
    help.addRow([]);
    help.addRow(["Дэд хэсгүүд (багана — нэр — төрөл):"]).font = { bold: true };
    for (const f of spec.target.fields) {
      const flags = [f.required ? "заавал" : null, f.isFree ? "үнэгүй" : null].filter(Boolean);
      help.addRow([
        `${f.code} — ${f.nameMn} — ${FIELD_KIND_HINTS[f.kind]}${flags.length ? ` (${flags.join(", ")})` : ""}`,
      ]);
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
