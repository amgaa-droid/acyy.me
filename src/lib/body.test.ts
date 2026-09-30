import { describe, expect, it } from "vitest";

import { bodyProse, parseBody } from "./body";
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
