import { describe, expect, it } from "vitest";

import type { ReadingField, ReadingSection } from "@/server/reading";

import { cardChips, cardExcerpt, cardMonthDay, cardName, cardQuote, cardStrengths } from "./text";

const field = (code: string, name: string, kind: ReadingField["kind"], value: string) => ({
  code,
  name,
  kind,
  isFree: false,
  value,
});

const section = (over: Partial<ReadingSection>): ReadingSection => ({
  section: "main",
  name: "Төрсөн өдөр",
  keyType: "month_day",
  key: "03-25",
  title: "Эрч хүчний өдөр",
  fields: [],
  teaser: null,
  score: null,
  ...over,
});

const birthday = section({
  teaser: "Та бол төрөлхийн манлайлагч.",
  fields: [
    field("strengths", "Давуу тал", "list", "• Эрч хүчтэй\n• Шулуун шударга\nЭрч хүчтэй"),
    field("weaknesses", "Сул тал", "list", "Тэвчээргүй"),
    field(
      "general",
      "Ерөнхий шинж",
      "text",
      "Та шинэ санааг хэрэгжүүлэхдээ гарамгай.\nБусдыг дагуулдаг.\n\n## Ажил мэргэжил\n\nУдирдах ажилд тохирно.",
    ),
    field("advice", "Зөвлөгөө", "cards", "• Тэвчээртэй бай\n• Бусдыг сонс"),
  ],
});

describe("cardName", () => {
  it("uses the first part of the name, or only the initial when hidden", () => {
    expect(cardName("Анар Бат-Эрдэнэ", false)).toBe("Анар");
    expect(cardName("  өлзий ", true)).toBe("Ө.");
    expect(cardName("", true)).toBe("");
  });
});

describe("cardQuote", () => {
  it("takes the first sentence only", () => {
    expect(cardQuote("Эхний өгүүлбэр. Хоёр дахь нь нууц.")).toBe("Эхний өгүүлбэр.");
    expect(cardQuote(null)).toBeNull();
  });

  it("shortens long sentences at a word boundary", () => {
    const long = `${"үг ".repeat(100)}төгсгөл.`;
    const q = cardQuote(long, 40)!;
    expect(q.length).toBeLessThanOrEqual(41);
    expect(q.endsWith("…")).toBe(true);
  });
});

describe("cardMonthDay", () => {
  it("shows the birthday without the year", () => {
    expect(cardMonthDay("1988-03-25")).toBe("3-р сарын 25");
    expect(cardMonthDay("2000-02-29")).toBe("2-р сарын 29");
    expect(cardMonthDay("1999-12-01")).toBe("12-р сарын 1");
    expect(cardMonthDay("nope")).toBeNull();
  });
});

describe("cardStrengths", () => {
  it("lists the strengths of a birthday text under a 'born on this day' label", () => {
    expect(cardStrengths([birthday])).toEqual({
      label: "Энэ өдөр төрсөн хүмүүсийн давуу тал",
      items: ["Эрч хүчтэй", "Шулуун шударга"],
    });
  });

  it("is only for texts keyed by the birthday, with a strengths list", () => {
    expect(cardStrengths([section({ ...birthday, keyType: "sign", key: "aries" })])).toBeNull();
    expect(cardStrengths([section({ fields: null })])).toBeNull();
    expect(
      cardStrengths([section({ fields: [field("strengths", "Давуу тал", "text", "Урт текст.")] })]),
    ).toBeNull();
  });
});

describe("cardChips", () => {
  it("takes the first chips field of the reading", () => {
    const pair = section({
      keyType: "period_pair",
      fields: [
        field("caution_for", "Сорилттой харилцаа", "alert", "Гэрлэлт"),
        field("good_for", "Нийцтэй харилцаа", "chips", "Бизнес, нийгмийн харилцаа"),
      ],
    });
    expect(cardChips([pair])).toEqual({
      label: "Нийцтэй харилцаа",
      items: ["Бизнес", "нийгмийн харилцаа"],
    });
    expect(cardChips([birthday])).toBeNull();
  });
});

describe("cardExcerpt", () => {
  it("accepts text selected in the reading, whatever the whitespace and letter case", () => {
    expect(cardExcerpt([birthday], "  санааг   хэрэгжүүлэхдээ гарамгай. ")).toBe(
      "санааг хэрэгжүүлэхдээ гарамгай.",
    );
    // An upper-cased sub-heading (CSS text-transform) followed by its paragraph.
    expect(cardExcerpt([birthday], "АЖИЛ МЭРГЭЖИЛ\n\nУдирдах ажилд тохирно.")).toBe(
      "АЖИЛ МЭРГЭЖИЛ\nУдирдах ажилд тохирно.",
    );
    // List items are selected without their bullets; a title and a teaser are text too.
    expect(cardExcerpt([birthday], "Тэвчээртэй бай\nБусдыг сонс")).toBe(
      "Тэвчээртэй бай\nБусдыг сонс",
    );
    expect(cardExcerpt([birthday], "Эрч хүчний өдөр\nТа бол төрөлхийн манлайлагч.")).toBe(
      "Эрч хүчний өдөр\nТа бол төрөлхийн манлайлагч.",
    );
  });

  it("drops lines that are not in the reading, and rejects text that is not from it at all", () => {
    expect(cardExcerpt([birthday], "01\nТэвчээртэй бай\nЭнэ бол зохиомол мөр")).toBe(
      "Тэвчээртэй бай",
    );
    expect(cardExcerpt([birthday], "Манай өрсөлдөгч муу.")).toBeNull();
    expect(cardExcerpt([birthday], "")).toBeNull();
    expect(cardExcerpt([birthday], "…\n!")).toBeNull();
    expect(cardExcerpt([section({ fields: null, title: null })], "Удирдах ажилд")).toBeNull();
  });

  it("only keeps lines in reading order, so the text can't be rearranged", () => {
    expect(cardExcerpt([birthday], "Удирдах ажилд тохирно.\nБусдыг дагуулдаг.")).toBe(
      "Удирдах ажилд тохирно.",
    );
  });

  it("shortens a long selection at a word boundary", () => {
    const body = `${"урт үг ".repeat(200)}төгсгөл.`;
    const q = cardExcerpt(
      [section({ fields: [field("general", "Ерөнхий", "text", body)] })],
      body,
    )!;
    expect(q.length).toBeLessThanOrEqual(401);
    expect(q.endsWith("…")).toBe(true);
  });
});
