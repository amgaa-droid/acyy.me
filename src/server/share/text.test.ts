import { describe, expect, it } from "vitest";

import { cardName, cardQuote } from "./text";

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
