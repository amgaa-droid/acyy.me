import { describe, expect, it } from "vitest";

import {
  bodyProse,
  extractHighlights,
  hasHighlights,
  parseBody,
  parseTraits,
  readingBlocks,
} from "./body";
import { firstSentences } from "./preview";

describe("parseBody", () => {
  it("splits paragraphs on blank lines and keeps single line breaks", () => {
    expect(parseBody("Нэг.\nХоёр.\n\n\nГурав.")).toEqual([
      { type: "paragraph", text: "Нэг.\nХоёр." },
      { type: "paragraph", text: "Гурав." },
    ]);
  });

  it("treats '## ' lines as headings, even without surrounding blank lines", () => {
    expect(parseBody("## Зөвлөгөө\n• Нэг\n• Хоёр\n## Эрүүл мэнд\r\nТекст.")).toEqual([
      { type: "heading", text: "Зөвлөгөө" },
      { type: "paragraph", text: "• Нэг\n• Хоёр" },
      { type: "heading", text: "Эрүүл мэнд" },
      { type: "paragraph", text: "Текст." },
    ]);
  });

  it("does not treat '#', '##' without text or mid-line '##' as headings", () => {
    expect(parseBody("# Нэг\n##\nА ## Б")).toEqual([
      { type: "paragraph", text: "# Нэг\n##\nА ## Б" },
    ]);
  });
});

describe("headings stay out of previews", () => {
  it("bodyProse drops heading lines", () => {
    expect(bodyProse("## Ерөнхий шинж\n\nЭхний. Хоёр.\n\n## Дараах\n\nГурав.")).toBe(
      "Эхний. Хоёр.\n\nГурав.",
    );
  });

  it("firstSentences starts after a leading heading", () => {
    expect(firstSentences("## Ерөнхий шинж\n\nЭхний өгүүлбэр. Хоёр дахь. Гурав.", 2)).toBe(
      "Эхний өгүүлбэр. Хоёр дахь.",
    );
  });
});

describe("extractHighlights", () => {
  const body = [
    "Эхний догол.",
    "## Давуу тал",
    "• Итгэлцэл\n• Хамтын зорилго",
    "## Сул тал",
    "• Зөрүүд зан",
    "## Зөвлөгөө",
    "Энгийн хэсэг.",
    "## Тохиромжтой харилцаа",
    "Гэрлэлт, Найз",
    "## Анхаарах харилцаа",
    "Хамтран ажиллах",
  ].join("\n\n");

  it("lifts the four highlight sections out and keeps everything else in order", () => {
    expect(extractHighlights(body)).toEqual({
      highlights: {
        goodFor: ["Гэрлэлт", "Найз"],
        cautionFor: ["Хамтран ажиллах"],
        strengths: ["Итгэлцэл", "Хамтын зорилго"],
        weaknesses: ["Зөрүүд зан"],
      },
      rest: "Эхний догол.\n\n## Зөвлөгөө\n\nЭнгийн хэсэг.",
    });
  });

  it("leaves a body without highlight headings untouched", () => {
    const { highlights, rest } = extractHighlights("Нэг.\n\n## Гарчиг\n\nХоёр.");
    expect(hasHighlights(highlights)).toBe(false);
    expect(rest).toBe("Нэг.\n\n## Гарчиг\n\nХоёр.");
  });

  it("matches headings case-insensitively and de-duplicates items", () => {
    const { highlights } = extractHighlights("## тохиромжтой харилцаа\n\nГэрлэлт, Гэрлэлт");
    expect(highlights.goodFor).toEqual(["Гэрлэлт"]);
  });
});

describe("parseTraits", () => {
  it("reads the birthday teaser into strengths and weaknesses", () => {
    expect(
      parseTraits("Давуу тал: Эрч хүчтэй · Үнэнч · Бие даасан\nСул тал: Шүүмжлэмтгий · Бүдүүлэг"),
    ).toEqual({
      strengths: ["Эрч хүчтэй", "Үнэнч", "Бие даасан"],
      weaknesses: ["Шүүмжлэмтгий", "Бүдүүлэг"],
    });
  });

  it("returns null for a free-form teaser", () => {
    expect(parseTraits("Энэ бол жирийн тизер: нэг, хоёр.")).toBeNull();
  });
});

describe("readingBlocks", () => {
  it("turns the meditation into a quote and advice into cards, keeping order", () => {
    const body = [
      "## Ерөнхий шинж",
      "Текст.",
      "## Бясалгах үг",
      "Усыг нь уувал ёсыг нь дагана.",
      "## Зөвлөгөө",
      "• Уян хатан, зөөлөн байж сур.\n• Хүн бүрийг ялах хэрэггүй.",
      "## Эрүүл мэнд",
      "Өөр текст.",
    ].join("\n\n");
    expect(readingBlocks(body)).toEqual([
      { type: "heading", text: "Ерөнхий шинж" },
      { type: "paragraph", text: "Текст." },
      { type: "quote", label: "Бясалгах үг", text: "Усыг нь уувал ёсыг нь дагана." },
      {
        type: "cards",
        label: "Зөвлөгөө",
        items: ["Уян хатан, зөөлөн байж сур.", "Хүн бүрийг ялах хэрэггүй."],
      },
      { type: "heading", text: "Эрүүл мэнд" },
      { type: "paragraph", text: "Өөр текст." },
    ]);
  });

  it("drops an empty quote or card section", () => {
    expect(readingBlocks("## Бясалгах үг\n\n## Зөвлөгөө\n\nТекст.")).toEqual([
      { type: "cards", label: "Зөвлөгөө", items: ["Текст."] },
    ]);
  });
});
