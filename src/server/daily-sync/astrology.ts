/**
 * Astrology.com's "tomorrow" daily horoscopes, the source of the daily sync: one page per
 * horoscope × sign, e.g. https://www.astrology.com/horoscope/daily-love/tomorrow/aries.html.
 * We take only the main text (`<div id="content">`), not the extras (couples, finances, food…).
 */

/** Our daily kind → astrology.com's horoscope path. */
export const SOURCE_PATHS: Record<string, string> = {
  general: "daily",
  love: "daily-love",
  work: "daily-work",
};

export const SOURCE_NAMES: Record<string, string> = {
  general: "daily horoscope",
  love: "daily love horoscope",
  work: "daily work horoscope",
};

export function sourceUrl(kind: string, sign: string): string {
  const path = SOURCE_PATHS[kind];
  if (!path) throw new Error(`No source for kind ${kind}`);
  return `https://www.astrology.com/horoscope/${path}/tomorrow/${sign}.html`;
}

export type SourcePage = { date: string; sign: string | null; text: string };

export class SourceError extends Error {
  constructor(readonly code: "fetch" | "parse" | "wrong_sign") {
    super(code);
  }
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** HTML fragment → plain text, paragraphs (`<p>`, `<br>`) separated by a blank line. */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n\n")
    .replace(/<\/p>/gi, "\n\n");
  return decodeEntities(withBreaks.replace(/<[^>]+>/g, ""))
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** "October 3, 2026" → "2026-10-03". */
export function parseLongDate(s: string): string | null {
  const m = /^\s*([a-z]+)\s+(\d{1,2}),\s*(\d{4})\s*$/i.exec(s);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

/** The day the page is for and its main text. Throws SourceError("parse") if either is missing. */
export function parseSourcePage(html: string): SourcePage {
  const iso = /horoscopeDate:\s*"(\d{4}-\d{2}-\d{2})"/.exec(html)?.[1];
  const long = /<span id="content-date">([^<]+)<\/span>/.exec(html)?.[1];
  const date = iso ?? (long ? parseLongDate(long) : null);
  const sign = /zodiacSign:\s*"([a-z]+)"/.exec(html)?.[1] ?? null;
  const body = /<div id="content">([\s\S]*?)<\/div>/.exec(html)?.[1];
  const text = body ? htmlToText(body) : "";
  if (!date || !text) throw new SourceError("parse");
  return { date, sign, text };
}

export type FetchPage = (url: string) => Promise<string>;

export const fetchSourcePage: FetchPage = async (url) => {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; ZurkhaiDailySync/1.0)",
        accept: "text/html",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new SourceError("fetch");
  }
  if (!res.ok) throw new SourceError("fetch");
  return res.text();
};

/** Fetches and parses one page, checking it is the sign we asked for (no silent redirects). */
export async function loadSourcePage(
  fetchPage: FetchPage,
  kind: string,
  sign: string,
): Promise<SourcePage> {
  const page = parseSourcePage(await fetchPage(sourceUrl(kind, sign)));
  if (page.sign && page.sign !== sign) throw new SourceError("wrong_sign");
  return page;
}
