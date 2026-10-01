/**
 * One-off migration of the old site's texts (MSSQL dump → OldDB/export/*.json, see
 * scripts/legacy-to-xlsx.ts) into the SPEC §10 import templates. Pure functions only.
 *
 * Legacy shape: a birthday text has 8 HTML sections (2 of them used to be free), a period-pair
 * text has a short paragraph plus keyword lists and "good for / bad for" relation types.
 * Each becomes its own sub-section column.
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

/** Column = sub-section code (src/server/db/seed-data.ts, birthday / synastry.period_pair). */
export type BirthdayRow = { month_day: string; title: string } & Record<string, string>;
export type PeriodPairRow = { period_a: string; period_b: string; title: string } & Record<
  string,
  string
>;
export type PeriodRow = { no: string; start: string; end: string };

/** Legacy section ids (acyyTitle) → birthday sub-sections. 1/8 are keyword lists (free). */
const KEYWORD_FIELDS: [number, string][] = [
  [1, "strengths"],
  [8, "weaknesses"],
];
const TEXT_FIELDS: [number, string][] = [
  [4, "general"],
  [2, "meditation"],
  [3, "advice"],
  [5, "health"],
  [6, "numerology"],
  [7, "tarot"],
];

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

  const row: BirthdayRow = { month_day: `${pad2(b.month)}-${pad2(b.day)}`, title: b.title.trim() };
  for (const [key, code] of KEYWORD_FIELDS) row[code] = keywords(section(key).html).join("\n");
  for (const [key, code] of TEXT_FIELDS) row[code] = htmlToText(section(key).html);
  return row;
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
  return {
    period_a: String(a),
    period_b: String(b),
    title: p.title.trim(),
    general: htmlToText(p.text ?? ""),
    strengths: keywords(p.strength).join("\n"),
    weaknesses: keywords(p.weakness).join("\n"),
    good_for: normalizeRelation(p.goodFor) ?? "",
    caution_for: normalizeRelation(p.badFor) ?? "",
  };
}

/** Legacy "12/26" → "12-26". */
export function periodRow(p: LegacyPeriod): PeriodRow {
  const md = (s: string) => s.trim().replace("/", "-");
  return { no: String(p.index), start: md(p.start), end: md(p.end) };
}
