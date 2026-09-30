/**
 * Sentence splitting for the paywall preview (SPEC §3.1): the server sends only the first
 * N sentences of an unpurchased text. Terminators: . ! ? … (and runs like "?!" or "...").
 * Not a sentence end: initials ("Б.Анар"), dotted abbreviations ("г.м.", "т.б."),
 * decimals ("3.5"), or a terminator not followed by whitespace / end of text.
 */
const TERMINATORS = new Set([".", "!", "?", "…"]);
const CLOSERS = new Set(['"', "'", "»", "”", "’", ")", "]"]);

function isAbbreviation(text: string, dotIndex: number): boolean {
  let start = dotIndex;
  while (start > 0 && !/\s/.test(text[start - 1])) start--;
  const token = text.slice(start, dotIndex); // word before the dot, without it
  const letters = token.replace(/[.«"'(]/g, "");
  if (letters.length === 1 && /\p{L}/u.test(letters)) return true; // initial: "Б."
  if (token.includes(".")) return true; // "г.м", "т.б"
  return false;
}

export function splitSentences(text: string): string[] {
  const s = text.replace(/\s+/g, " ").trim();
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (!TERMINATORS.has(s[i])) continue;
    let end = i;
    while (end + 1 < s.length && TERMINATORS.has(s[end + 1])) end++;
    while (end + 1 < s.length && CLOSERS.has(s[end + 1])) end++;
    const atEnd = end + 1 >= s.length;
    if (!atEnd && s[end + 1] !== " ") {
      i = end;
      continue;
    }
    if (s[i] === "." && end === i && isAbbreviation(s, i)) continue;
    out.push(s.slice(start, end + 1).trim());
    start = end + 1;
    i = end;
  }
  const rest = s.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

export function firstSentences(text: string, n: number): string {
  return splitSentences(text).slice(0, n).join(" ");
}
