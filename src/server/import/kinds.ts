import type { ContentSection, ProductCode } from "@/lib/domain";

/**
 * Excel import kinds (SPEC §10). Each column has a canonical name (used in templates)
 * plus aliases, so files with Mongolian or slightly different headers still map.
 */
export type ImportKind =
  | "birthday"
  | "sign"
  | "love"
  | "sex"
  | "dating"
  | "synastry_signs"
  | "synastry_periods"
  | "periods48";

export type ColumnSpec = { name: string; aliases: string[]; required: boolean };

const col = (name: string, aliases: string[], required = true): ColumnSpec => ({
  name,
  aliases,
  required,
});

const TITLE = col("title", ["гарчиг", "нэр", "heading"]);
const BODY = col("body", ["текст", "агуулга", "бичвэр", "text", "content"]);
const SCORE = col("score", ["оноо", "хувь", "percent"], false);
const SIGN = col("sign", ["орд", "zodiac", "sign_code"]);

export type ImportKindSpec = {
  kind: ImportKind;
  label: string;
  file: string;
  columns: ColumnSpec[];
  /** Content target; null for periods48 (updates the ranges table). */
  target: { product: ProductCode; section: ContentSection } | null;
};

export const IMPORT_KINDS: Record<ImportKind, ImportKindSpec> = {
  birthday: {
    kind: "birthday",
    label: "Төрсөн өдрийн зурхай (366)",
    file: "birthday.xlsx",
    columns: [col("month_day", ["огноо", "сар_өдөр", "сар-өдөр", "date", "md"]), TITLE, BODY],
    target: { product: "birthday", section: "main" },
  },
  sign: {
    kind: "sign",
    label: "Ордны зурхай (12)",
    file: "sign.xlsx",
    columns: [SIGN, TITLE, BODY],
    target: { product: "sign", section: "main" },
  },
  love: {
    kind: "love",
    label: "Хайр дурлалын зурхай (12)",
    file: "love.xlsx",
    columns: [SIGN, TITLE, BODY],
    target: { product: "love", section: "main" },
  },
  sex: {
    kind: "sex",
    label: "Секс зурхай (12)",
    file: "sex.xlsx",
    columns: [SIGN, TITLE, BODY],
    target: { product: "sex", section: "main" },
  },
  dating: {
    kind: "dating",
    label: "Болзооны зурхай (12)",
    file: "dating.xlsx",
    columns: [SIGN, TITLE, BODY],
    target: { product: "dating", section: "main" },
  },
  synastry_signs: {
    kind: "synastry_signs",
    label: "Нийцэл — ордны хос (78)",
    file: "synastry_signs.xlsx",
    columns: [
      col("sign_a", ["орд_a", "орд 1", "орд1", "a"]),
      col("sign_b", ["орд_b", "орд 2", "орд2", "b"]),
      TITLE,
      BODY,
      SCORE,
    ],
    target: { product: "synastry", section: "sign_pair" },
  },
  synastry_periods: {
    kind: "synastry_periods",
    label: "Нийцэл — үеийн хос (1,176)",
    file: "synastry_periods.xlsx",
    columns: [
      col("period_a", ["үе_a", "үе 1", "үе1", "a"]),
      col("period_b", ["үе_b", "үе 2", "үе2", "b"]),
      TITLE,
      BODY,
      SCORE,
    ],
    target: { product: "synastry", section: "period_pair" },
  },
  periods48: {
    kind: "periods48",
    label: "48 үеийн муж",
    file: "periods48.xlsx",
    columns: [
      col("no", ["үе", "дугаар", "№", "number"]),
      col("start", ["эхлэх", "эхлэл", "start_md"]),
      col("end", ["дуусах", "төгсгөл", "end_md"]),
      col("label", ["нэр", "тайлбар"], false),
    ],
    target: null,
  },
};

export const IMPORT_KIND_LIST = Object.values(IMPORT_KINDS);

export function isImportKind(value: string): value is ImportKind {
  return value in IMPORT_KINDS;
}
