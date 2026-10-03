import { describe, expect, it } from "vitest";

import {
  chunkText,
  estimateTokens,
  faqAnswerFor,
  faqMatches,
  pickChunks,
  similarity,
  stems,
  type Chunk,
} from "./help-search";

const FAQS = [
  { id: "1", question: "Хэтэвчээ хэрхэн цэнэглэх вэ?", answer: "QPay-ээр." },
  { id: "2", question: "Төрсөн огноог буруу оруулсан. Яаж засах вэ?", answer: "Устгаад нэм." },
  { id: "3", question: "Секс зурхай яагаад харагдахгүй байна вэ?", answer: "18+." },
];

describe("help search", () => {
  it("compares Mongolian words by stem and drops question words", () => {
    expect(stems("Хэтэвчээ хэрхэн цэнэглэх вэ?")).toEqual(["хэтэв", "цэнэг"]);
    expect(stems("хэтэвчний цэнэглэлт")).toEqual(["хэтэв", "цэнэг"]);
    expect(similarity("Хэтэвч цэнэглэх", "хэтэвчээ цэнэглэе")).toBe(1);
    expect(similarity("Хэтэвч", "Секс зурхай")).toBe(0);
    expect(similarity("вэ?", "уу")).toBe(0);
  });

  it("suggests FAQs that look like the question, best first", () => {
    const m = faqMatches("огноо буруу оруулчихлаа", FAQS);
    expect(m[0].faq.id).toBe("2");
    expect(faqMatches("сайн байна уу", FAQS)).toEqual([]);
  });

  it("answers from an FAQ only for a near-identical question of two words or more", () => {
    expect(faqAnswerFor("Хэтэвчээ яаж цэнэглэх вэ", FAQS)?.id).toBe("1");
    expect(faqAnswerFor("секс зурхай харагдахгүй байна", FAQS)?.id).toBe("3");
    // One shared word is not enough to skip the assistant.
    expect(faqAnswerFor("цэнэглэх", FAQS)).toBeNull();
    // Same topic, a different question → the AI answers.
    expect(faqAnswerFor("Цэнэглэсэн мөнгө буцааж авах боломжтой юу", FAQS)).toBeNull();
  });

  it("estimates tokens on the high side for Cyrillic", () => {
    expect(estimateTokens("абвгдеж")).toBe(4);
    expect(estimateTokens("")).toBe(0);
  });

  const chunks: Chunk[] = [
    { id: "a", title: "Апп", body: "Ерөнхий тайлбар ".repeat(20), pinned: true },
    { id: "b", title: "Хэтэвч", body: "Цэнэглэх QPay бонус үлдэгдэл ".repeat(20) },
    { id: "c", title: "Урих", body: "Урилга линк имэйл найз ".repeat(20) },
    { id: "d", title: "Орд", body: "Хонь Үхэр Ихэр муж ".repeat(20) },
  ];
  const cost = (ids: string[]) =>
    chunks.filter((c) => ids.includes(c.id)).reduce((n, c) => n + estimateTokens(chunkText(c)), 0);

  it("sends all knowledge, in order, while it fits the budget", () => {
    expect(pickChunks(chunks, "урилга", 100_000).map((c) => c.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("past the budget: pinned chunks plus the best matches, still in order", () => {
    const budget = cost(["a", "c"]);
    expect(pickChunks(chunks, "Найзаа урилгаар яаж урих вэ", budget).map((c) => c.id)).toEqual([
      "a",
      "c",
    ]);
    const two = cost(["a", "b", "d"]);
    expect(pickChunks(chunks, "хэтэвч цэнэглэх ордны муж", two).map((c) => c.id)).toEqual([
      "a",
      "b",
      "d",
    ]);
    // Nothing matches: only what is pinned.
    expect(pickChunks(chunks, "цаг агаар", budget).map((c) => c.id)).toEqual(["a"]);
  });
});
