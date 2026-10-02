import { mn } from "@/i18n/mn";
import { parseIsoDate } from "@/lib/birth-date";
import { STRENGTHS_FIELD } from "@/lib/catalog-refs";
import { fieldItems, isItemKind } from "@/lib/fields";
import { splitSentences } from "@/lib/preview";
import type { ReadingSection } from "@/server/reading";

/**
 * Share-card text rules (SPEC §8): names as the first part of the name (or just the initial
 * when hidden), a one-sentence quote kept short enough for the card, and — for a card made from
 * selected text — only text that really is in the reading.
 */
export function cardName(name: string, hide: boolean): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  if (!first) return "";
  return hide ? `${first[0].toUpperCase()}.` : first;
}

function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).trimEnd()}…`;
}

export function cardQuote(body: string | null | undefined, max = 160): string | null {
  if (!body) return null;
  const first = splitSentences(body)[0];
  return first ? clamp(first, max) : null;
}

/** "1988-03-25" → "3-р сарын 25": the birthday without the year (a card is public). */
export function cardMonthDay(birthDate: string): string | null {
  const ymd = parseIsoDate(birthDate);
  return ymd ? mn.share.monthDay(ymd.m, ymd.d) : null;
}

export type CardList = { label: string; items: string[] };

/** The "Давуу тал" items of a birthday text ("Энэ өдөр төрсөн хүмүүсийн давуу тал"). */
export function cardStrengths(sections: ReadingSection[]): CardList | null {
  for (const s of sections) {
    if (s.keyType !== "month_day") continue;
    const field = s.fields?.find((f) => f.code === STRENGTHS_FIELD && isItemKind(f.kind));
    if (!field) continue;
    const items = fieldItems(field.value, field.kind);
    if (items.length > 0) return { label: mn.share.bornOnDay(field.name), items };
  }
  return null;
}

/** The first chips field of a reading — a pair's "Нийцтэй харилцаа". */
export function cardChips(sections: ReadingSection[]): CardList | null {
  const field = sections.flatMap((s) => s.fields ?? []).find((f) => f.kind === "chips");
  if (!field) return null;
  const items = fieldItems(field.value, field.kind);
  return items.length > 0 ? { label: field.name, items } : null;
}

export const EXCERPT_MAX = 400;

/** Letters and digits only, lower-cased: how a selection is matched against the stored text. */
const canon = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * The text a reader selected, as it goes on a card — or null when it isn't from this reading.
 * Each selected line must be found in the reading's own text, in reading order (a browser
 * selection differs from the stored text only in whitespace, bullets and letter case); lines
 * that aren't — labels, list numbers — are dropped. So a card never carries made-up text.
 */
export function cardExcerpt(
  sections: ReadingSection[],
  selection: string,
  max = EXCERPT_MAX,
): string | null {
  const corpus = canon(
    sections
      .flatMap((s) => [
        s.name,
        s.title,
        s.teaser,
        ...(s.fields ?? []).flatMap((f) => [f.name, f.value]),
      ])
      .join(" "),
  );
  const kept: string[] = [];
  let from = 0;
  for (const raw of selection.split(/[\r\n]+/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    const key = canon(line);
    if (!key) continue;
    const at = corpus.indexOf(key, from);
    if (at < 0) continue;
    kept.push(line);
    from = at + key.length;
  }
  if (canon(kept.join("")).length < 2) return null;
  return clamp(kept.join("\n"), max);
}
