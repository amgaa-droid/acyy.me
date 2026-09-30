import { describe, expect, it } from "vitest";

import { firstSentences, splitSentences } from "./preview";

describe("splitSentences", () => {
  it("splits on . ! ? …", () => {
    expect(splitSentences("Нэг. Хоёр! Гурав? Дөрөв… Тав")).toEqual([
      "Нэг.",
      "Хоёр!",
      "Гурав?",
      "Дөрөв…",
      "Тав",
    ]);
  });

  it("keeps runs of terminators and closing quotes together", () => {
    expect(splitSentences("Үнэн үү?! Тийм...  «Мэдээж.» Дараа нь.")).toEqual([
      "Үнэн үү?!",
      "Тийм...",
      "«Мэдээж.»",
      "Дараа нь.",
    ]);
  });

  it("does not split on initials, dotted abbreviations or decimals", () => {
    expect(splitSentences("Б.Анар ирсэн. Ном, дэвтэр г.м. зүйл авна. Оноо 3.5 байна.")).toEqual([
      "Б.Анар ирсэн.",
      "Ном, дэвтэр г.м. зүйл авна.",
      "Оноо 3.5 байна.",
    ]);
    expect(splitSentences("Д. Батаа хэлэв. Тийм.")).toEqual(["Д. Батаа хэлэв.", "Тийм."]);
  });

  it("collapses whitespace and handles text without a terminator", () => {
    expect(splitSentences("  Нэг\n\n мөр  ")).toEqual(["Нэг мөр"]);
    expect(splitSentences("")).toEqual([]);
  });
});

describe("firstSentences", () => {
  it("returns only the first n sentences — never the rest", () => {
    const body = "Эхний өгүүлбэр. Хоёр дахь нь! Гурав дахь нь нууц. Дөрөв.";
    const preview = firstSentences(body, 2);
    expect(preview).toBe("Эхний өгүүлбэр. Хоёр дахь нь!");
    expect(preview).not.toContain("нууц");
  });
});
