import type { KeyType } from "@/lib/domain";
import { activeFields, activeParts, type FieldRow, type ProductDef } from "@/server/products";

/**
 * Excel import kinds (SPEC §10), derived from the product catalogue: one per product part
 * (key columns by its key type, then title, one column per sub-section, teaser, score) plus
 * the 48-period ranges. Each column has a canonical name (used in templates) plus aliases,
 * so files with Mongolian or slightly different headers still map.
 */

export type ColumnSpec = { name: string; aliases: string[]; required: boolean };

const col = (name: string, aliases: string[], required = true): ColumnSpec => ({
  name,
  aliases,
  required,
});

export type ImportTarget = {
  product: string;
  section: string;
  keyType: KeyType;
  byGender: boolean;
  /** Active fields, in order — one column each. */
  fields: FieldRow[];
};

export type ImportKindSpec = {
  kind: string;
  label: string;
  file: string;
  columns: ColumnSpec[];
  /** Content target; null for periods48 (updates the ranges table). */
  target: ImportTarget | null;
};

export const PERIODS_KIND = "periods48";

const PERIODS_SPEC: ImportKindSpec = {
  kind: PERIODS_KIND,
  label: "48 үеийн муж",
  file: "periods48.xlsx",
  columns: [
    col("no", ["үе", "дугаар", "№", "number"]),
    col("start", ["эхлэх", "эхлэл", "start_md"]),
    col("end", ["дуусах", "төгсгөл", "end_md"]),
    col("label", ["нэр", "тайлбар"], false),
  ],
  target: null,
};

const SIGN_ALIASES = ["орд", "zodiac", "sign_code"];
const PERIOD_ALIASES = ["үе", "period_no"];

const KEY_COLUMNS: Record<KeyType, ColumnSpec[]> = {
  month_day: [col("month_day", ["огноо", "сар_өдөр", "сар-өдөр", "date", "md"])],
  sign: [col("sign", SIGN_ALIASES)],
  period: [col("period", PERIOD_ALIASES)],
  sign_pair: [
    col("sign_a", ["орд_a", "орд 1", "орд1", "a"]),
    col("sign_b", ["орд_b", "орд 2", "орд2", "b"]),
  ],
  sign_pair_ordered: [
    col("sign_a", ["орд_a", "орд 1", "орд1", "a"]),
    col("sign_b", ["орд_b", "орд 2", "орд2", "b"]),
  ],
  period_pair: [
    col("period_a", ["үе_a", "үе 1", "үе1", "a"]),
    col("period_b", ["үе_b", "үе 2", "үе2", "b"]),
  ],
};

const GENDER_COLUMN = col("gender", ["хүйс", "sex"]);
export const TITLE_COLUMN = col("title", ["гарчиг", "нэр", "heading"]);
/**
 * Legacy single-text column: "## Heading" sections are matched to sub-sections by name,
 * the rest goes to "general". Explicit sub-section columns win.
 */
const BODY_COLUMN = col("body", ["текст", "агуулга", "бичвэр", "text", "content"], false);
const TEASER_COLUMN = col("teaser", ["тизер", "үнэгүй", "free"], false);
const SCORE_COLUMN = col("score", ["оноо", "хувь", "percent"], false);

/** Sub-section columns: header = field code, its Mongolian name also accepted. */
function fieldColumn(f: FieldRow): ColumnSpec {
  return col(f.code, [f.nameMn], f.required);
}

export function kindFor(product: ProductDef, partCode: string): string {
  return product.parts.length > 1 ? `${product.code}.${partCode}` : product.code;
}

/** The content import kind of each product part. */
function contentKinds(products: ProductDef[]): ImportKindSpec[] {
  return products.flatMap((product) =>
    activeParts(product).map((part) => {
      const kind = kindFor(product, part.code);
      const fields = activeFields(part);
      return {
        kind,
        label: product.parts.length > 1 ? `${product.nameMn} — ${part.nameMn}` : product.nameMn,
        file: `${kind}.xlsx`,
        columns: [
          ...KEY_COLUMNS[part.keyType],
          ...(part.byGender ? [GENDER_COLUMN] : []),
          TITLE_COLUMN,
          ...fields.map(fieldColumn),
          TEASER_COLUMN,
          SCORE_COLUMN,
        ],
        target: {
          product: product.code,
          section: part.code,
          keyType: part.keyType,
          byGender: part.byGender,
          fields,
        },
      };
    }),
  );
}

/**
 * For parsing uploads: like the template columns, but a legacy `body` column may stand in
 * for the sub-section columns (required ones are then checked per row).
 */
export function uploadColumns(spec: ImportKindSpec): ColumnSpec[] {
  if (!spec.target) return spec.columns;
  const fieldCodes = new Set(spec.target.fields.map((f) => f.code));
  return [
    ...spec.columns.map((c) => (fieldCodes.has(c.name) ? { ...c, required: false } : c)),
    BODY_COLUMN,
  ];
}

export function allKinds(products: ProductDef[]): ImportKindSpec[] {
  return [...contentKinds(products), PERIODS_SPEC];
}

export function findKind(products: ProductDef[], kind: string): ImportKindSpec | null {
  return allKinds(products).find((k) => k.kind === kind) ?? null;
}
