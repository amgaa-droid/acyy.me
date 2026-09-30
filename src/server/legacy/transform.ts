/**
 * One-off migration of the old site's texts (MSSQL dump → OldDB/export/*.json, see
 * scripts/legacy-to-xlsx.ts) into the SPEC §10 import templates. Pure functions only.
 *
 * Legacy shape: a birthday text has 8 HTML sections (2 of them used to be free), a period-pair
 * text has a short paragraph plus keyword lists and "good for / bad for" relation types.
 */

export type LegacySection = { key: number; name: string; isFree: boolean; html: string };
export type LegacyBirthday = {
  month: number;
  day: number;
  title: string;
  sections: LegacySection[];
};
export type LegacyPeriod = { index: number; start: string; end: string };
export type LegacyPair = {
  period1: number;
  period2: number;
  title: string;
  goodFor: string | null;
  badFor: string | null;
  text: string | null;
  strength: string | null;
  weakness: string | null;
};

export type BirthdayRow = { month_day: string; title: string; body: string; teaser: string };
export type PeriodPairRow = { period_a: string; period_b: string; title: string; body: string };
export type PeriodRow = { no: string; start: string; end: string };

/** Legacy section ids (acyyTitle). 1/8 become the free teaser, the rest the body in this order. */
const STRENGTHS = 1;
const WEAKNESSES = 8;
const BODY_ORDER = [4, 2, 3, 5, 6, 7]; // Ерөнхий шинж, Бясалгах үг, Зөвлөгөө, Эрүүл мэнд, Тоон хэлээр, Таро хөзөр

const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  lt: "<",
  gt: ">",
  ndash: "–",
  mdash: "—",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  bull: "•",
  hellip: "…",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, name: string) => {
    if (name[0] === "#") {
      const code =
        name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[name.toLowerCase()] ?? m;
  });
}

const isBullet = (p: string) => p.startsWith("• ");

/**
 * HTML → the body markup of src/lib/body.ts: paragraphs separated by a blank line, list items
 * as "• " lines (consecutive items stay in one block).
 */
export function htmlToText(html: string): string {
  const text = decodeEntities(
    html
      .replace(/\r\n?/g, "\n")
      .replace(/\n/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n\n• ")
      .replace(/<\/(p|div|blockquote|ul|ol|li|h\d)>/gi, "\n\n")
      .replace(/<[^>]+>/g, ""),
  );
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split("\n")
        .map((line) => line.replace(/[ \t ]+/g, " ").trim())
        .filter(Boolean)
        .join("\n")
        .replace(/^[∙·•]\s*/, "• "),
    )
    .filter(Boolean);

  const out: string[] = [];
  for (const p of paragraphs) {
    const prev = out.at(-1);
    if (prev !== undefined && isBullet(p) && isBullet(prev.split("\n").at(-1)!)) {
      out[out.length - 1] = `${prev}\n${p}`;
    } else out.push(p);
  }
  return out.join("\n\n");
}

/** "ХУВИЙН ЗОХИОН БАЙГУУЛАЛТТАЙ" → "Хувийн зохион байгуулалттай". */
export function sentenceCase(s: string): string {
  const t = s.trim().toLocaleLowerCase("mn");
  return t ? t[0].toLocaleUpperCase("mn") + t.slice(1) : t;
}

/** Keyword list (one per line in the legacy HTML / text) → ["Тайван", "Бодлоготой", …]. */
export function keywords(source: string | null): string[] {
  if (!source) return [];
  const text = /<[a-z]/i.test(source) ? htmlToText(source) : source;
  return text
    .split(/\n+/)
    .map((k) => k.replace(/^•\s*/, "").trim())
    .filter(Boolean)
    .map((k) => (k === k.toLocaleUpperCase("mn") ? sentenceCase(k) : k));
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function birthdayRow(b: LegacyBirthday): BirthdayRow {
  const byKey = new Map(b.sections.map((s) => [s.key, s]));
  const section = (key: number) => {
    const s = byKey.get(key);
    if (!s) throw new Error(`${pad2(b.month)}-${pad2(b.day)}: section ${key} missing`);
    return s;
  };

  const teaser = [STRENGTHS, WEAKNESSES]
    .map((key) => `${section(key).name}: ${keywords(section(key).html).join(" · ")}`)
    .join("\n");
  const body = BODY_ORDER.map(
    (key) => `## ${section(key).name}\n\n${htmlToText(section(key).html)}`,
  ).join("\n\n");

  return { month_day: `${pad2(b.month)}-${pad2(b.day)}`, title: b.title.trim(), body, teaser };
}

/** "Эцэг,эх-Хүүхэд", "гэрлэлт", "Гэрлэт" → consistent relation labels. */
export function normalizeRelation(s: string | null): string | null {
  if (!s) return null;
  const t = s
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/(^|\s)Гэрлэт(?=$|[\s,])/gu, "$1Гэрлэлт")
    .trim();
  return t ? t[0].toLocaleUpperCase("mn") + t.slice(1) : null;
}

export function periodPairRow(p: LegacyPair): PeriodPairRow {
  const [a, b] = p.period1 <= p.period2 ? [p.period1, p.period2] : [p.period2, p.period1];
  const blocks = [htmlToText(p.text ?? "")];
  const list = (heading: string, items: string[]) => {
    if (items.length) blocks.push(`## ${heading}\n\n${items.map((i) => `• ${i}`).join("\n")}`);
  };
  list("Давуу тал", keywords(p.strength));
  list("Сул тал", keywords(p.weakness));
  const good = normalizeRelation(p.goodFor);
  const bad = normalizeRelation(p.badFor);
  if (good) blocks.push(`## Тохиромжтой харилцаа\n\n${good}`);
  if (bad) blocks.push(`## Анхаарах харилцаа\n\n${bad}`);
  return {
    period_a: String(a),
    period_b: String(b),
    title: p.title.trim(),
    body: blocks.filter(Boolean).join("\n\n"),
  };
}

/** Legacy "12/26" → "12-26". */
export function periodRow(p: LegacyPeriod): PeriodRow {
  const md = (s: string) => s.trim().replace("/", "-");
  return { no: String(p.index), start: md(p.start), end: md(p.end) };
}
