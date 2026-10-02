import { describe, expect, it } from "vitest";

import { buildTranslationRequest, cleanTranslation, parseTranslation } from "./translate";

describe("translation request", () => {
  it("puts the admin prompt first, then sign names and the JSON format", () => {
    const req = buildTranslationRequest({
      prompt: "  Translate well.  ",
      kindName: "daily love horoscope",
      signs: [
        { code: "aries", nameMn: "Хонь" },
        { code: "taurus", nameMn: "Үхэр" },
      ],
      texts: { aries: "A", taurus: "T" },
    });
    expect(req.json).toBe(true);
    expect(req.system.startsWith("Translate well.")).toBe(true);
    expect(req.system).toContain("Aries — Хонь, Taurus — Үхэр");
    expect(req.system).toContain("JSON");
    // No escaped newlines or "-" in the format line: models copied them into the text.
    expect(req.system).not.toMatch(/\\n|\n-/);
    expect(req.user).toContain("daily love horoscope");
    expect(req.user).toContain('"aries": "A"');
  });
});

describe("parseTranslation", () => {
  it("reads plain or fenced JSON and keeps only expected signs", () => {
    const raw = '```json\n{"aries": " Сайн өдөр. ", "leo": "Арслан", "extra": "x"}\n```';
    expect(parseTranslation(raw, ["aries", "leo"], 3000)).toEqual({
      texts: { aries: "Сайн өдөр.", leo: "Арслан" },
      missing: [],
      tooLong: [],
    });
  });

  it("finds the object inside chatter", () => {
    const raw = 'Here you go: {"aries": "Тийм"} Hope it helps!';
    expect(parseTranslation(raw, ["aries"], 3000).texts).toEqual({ aries: "Тийм" });
  });

  it("turns literal \\n and made-up bullets into plain paragraphs", () => {
    // What a model wrote: "\\n" (double-escaped) and "- " at each paragraph.
    const raw = JSON.stringify({
      aries: "Туслах нь таатай.\\n\\n- Зүрх зөв газар нь байна.\\n\\n- Асуудалгүй.",
    });
    expect(parseTranslation(raw, ["aries"], 3000).texts.aries).toBe(
      "Туслах нь таатай.\n\nЗүрх зөв газар нь байна.\n\nАсуудалгүй.",
    );
    // A dash inside a sentence stays.
    expect(cleanTranslation("Энэ бол — гоё өдөр.")).toBe("Энэ бол — гоё өдөр.");
  });

  it("normalises paragraphs", () => {
    const raw = JSON.stringify({ aries: "Нэг.\r\n\r\n\r\n  Хоёр. " });
    expect(parseTranslation(raw, ["aries"], 3000).texts.aries).toBe("Нэг.\n\nХоёр.");
  });

  it("reports missing, empty and too long translations", () => {
    const raw = JSON.stringify({ aries: "", taurus: 5, leo: "x".repeat(11), virgo: "ok" });
    expect(parseTranslation(raw, ["aries", "taurus", "gemini", "leo", "virgo"], 10)).toEqual({
      texts: { virgo: "ok" },
      missing: ["aries", "taurus", "gemini"],
      tooLong: ["leo"],
    });
  });

  it("throws on non-objects", () => {
    expect(() => parseTranslation("[1,2]", ["aries"], 10)).toThrow();
    expect(() => parseTranslation("nope", ["aries"], 10)).toThrow();
  });
});
