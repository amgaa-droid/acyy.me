import { splitSentences } from "@/lib/preview";

/**
 * Share-card text rules (SPEC §8): names as the first part of the name (or just the initial
 * when hidden), and a one-sentence quote kept short enough for the card.
 */
export function cardName(name: string, hide: boolean): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  if (!first) return "";
  return hide ? `${first[0].toUpperCase()}.` : first;
}

export function cardQuote(body: string | null | undefined, max = 160): string | null {
  if (!body) return null;
  const first = splitSentences(body)[0];
  if (!first) return null;
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).trimEnd()}…`;
}
