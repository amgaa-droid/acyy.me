import { ITEM_FIELD_KINDS, type FieldKind } from "./domain";

/**
 * Values of a text's sub-sections (product_fields). Prose kinds (text, quote) are plain text
 * with blank-line paragraphs ("## " sub-headings allowed in text, src/lib/body.ts). Item kinds
 * hold one item per line; "• " / "- " bullets are stripped, and chips/alert also split on commas
 * ("Гэрлэлт, Хамтрагч").
 */

const BULLET = /^[•\-–*]\s*/;

export function isItemKind(kind: FieldKind): boolean {
  return ITEM_FIELD_KINDS.includes(kind);
}

export function fieldItems(value: string, kind: FieldKind): string[] {
  const splitter = kind === "chips" || kind === "alert" ? /\n|,/ : /\n/;
  const items: string[] = [];
  for (const raw of value.replace(/\r\n?/g, "\n").split(splitter)) {
    const item = raw.replace(BULLET, "").trim();
    if (item && !items.includes(item)) items.push(item);
  }
  return items;
}

/** Trimmed value, or null when the field is effectively empty. */
export function fieldValue(fields: Record<string, string>, code: string): string | null {
  const v = fields[code]?.trim();
  return v ? v : null;
}
