/**
 * Plain-text search for the help screen and the AI assistant (no embeddings, no API calls):
 * - `faqMatches` — FAQs that look like the typed question (suggestions while typing, and the
 *   server answers a near-identical question straight from the FAQ without calling the AI);
 * - `pickChunks` — the knowledge chunks most relevant to a question, within a token budget.
 *
 * Mongolian adds suffixes to a stem (төлбөр, төлбөрөө, төлбөрийн…), so words are compared by
 * their first letters (`STEM`) — crude, but it catches most inflections.
 */

const STEM = 5;

/** Question words and fillers that say nothing about the topic. */
const STOP = new Set(
  [
    "вэ",
    "бэ",
    "уу",
    "үү",
    "юу",
    "юм",
    "яаж",
    "яах",
    "хэрхэн",
    "хэзээ",
    "хаана",
    "яагаад",
    "ямар",
    "хэд",
    "би",
    "миний",
    "минь",
    "маань",
    "та",
    "таны",
    "тань",
    "энэ",
    "тэр",
    "бол",
    "ба",
    "болон",
    "эсвэл",
    "байна",
    "байгаа",
    "байх",
    "болох",
    "болно",
    "гэж",
    "гэсэн",
    "нь",
    "ч",
    "л",
    "дээр",
    "руу",
    "рүү",
    "дээ",
    "шүү",
    "сайн",
  ].map((w) => w.slice(0, STEM)),
);

/** Lower-cased word stems of a text, stop words removed, in order (repeats kept). */
export function stems(text: string): string[] {
  return (text.toLocaleLowerCase("mn").match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((w) => w.length >= 2)
    .map((w) => w.slice(0, STEM))
    .filter((w) => !STOP.has(w));
}

/** Set similarity (Ochiai / cosine on sets): 1 = the same words, 0 = nothing in common. */
export function similarity(a: string, b: string): number {
  const A = new Set(stems(a));
  const B = new Set(stems(b));
  if (A.size === 0 || B.size === 0) return 0;
  let common = 0;
  for (const w of A) if (B.has(w)) common++;
  return common / Math.sqrt(A.size * B.size);
}

export type FaqLike = { id: string; question: string; answer: string };

/**
 * FAQs whose question resembles `text`, best first. Only the question is compared: an answer
 * mentions many topics, a question one.
 */
export function faqMatches<T extends FaqLike>(
  text: string,
  faqs: readonly T[],
  { min = 0.35, limit = 3 }: { min?: number; limit?: number } = {},
): { faq: T; score: number }[] {
  return faqs
    .map((faq) => ({ faq, score: similarity(text, faq.question) }))
    .filter((m) => m.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * The FAQ that answers `text` outright, if any: nearly the same words (≥ `min`) and at least two
 * of them, so "Төлбөр?" alone never short-circuits the assistant.
 */
export function faqAnswerFor<T extends FaqLike>(text: string, faqs: readonly T[], min = 0.75) {
  const [best] = faqMatches(text, faqs, { min, limit: 1 });
  if (!best) return null;
  const q = new Set(stems(text));
  const common = new Set(stems(best.faq.question).filter((w) => q.has(w)));
  return common.size >= 2 ? best.faq : null;
}

/**
 * Rough token count for Cyrillic Mongolian: measured ≈ 2.3 characters per token (gpt-5-mini,
 * the knowledge prompt), so 2.2 errs on the high side; Latin text is cheaper still.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2.2);
}

export type Chunk = {
  id: string;
  title: string;
  body: string;
  /** Always sent, whatever the question (the overview, prices, admin rules). */
  pinned?: boolean;
};

export function chunkText(c: Chunk): string {
  return `### ${c.title}\n${c.body}`;
}

/**
 * The chunks to send with a question. If everything fits in `budget` tokens, everything goes —
 * in its fixed order, so the prompt stays the same from question to question and the
 * provider's prompt cache serves it at a fraction of the price. Past the budget: pinned chunks,
 * then the best BM25 matches for the question until the budget is spent (still in fixed order).
 */
export function pickChunks(chunks: readonly Chunk[], query: string, budget: number): Chunk[] {
  const cost = chunks.map((c) => estimateTokens(chunkText(c)));
  const total = cost.reduce((a, b) => a + b, 0);
  if (total <= budget) return [...chunks];

  const docs = chunks.map((c) => stems(`${c.title} ${c.title} ${c.body}`));
  const avgLen = docs.reduce((a, d) => a + d.length, 0) / Math.max(docs.length, 1);
  const df = new Map<string, number>();
  for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) ?? 0) + 1);
  const terms = [...new Set(stems(query))];
  const k1 = 1.2;
  const b = 0.75;
  const score = docs.map((d) => {
    let s = 0;
    for (const t of terms) {
      const f = d.filter((w) => w === t).length;
      if (!f) continue;
      const n = df.get(t) ?? 0;
      const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
      s += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avgLen));
    }
    return s;
  });

  const chosen = new Set<number>();
  let used = 0;
  chunks.forEach((c, i) => {
    if (c.pinned) {
      chosen.add(i);
      used += cost[i];
    }
  });
  const ranked = chunks
    .map((_, i) => i)
    .filter((i) => !chosen.has(i) && score[i] > 0)
    .sort((x, y) => score[y] - score[x]);
  for (const i of ranked) {
    if (used + cost[i] > budget) continue;
    chosen.add(i);
    used += cost[i];
  }
  return chunks.filter((_, i) => chosen.has(i));
}
