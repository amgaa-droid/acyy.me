import { describe, expect, it } from "vitest";

import { parseBody } from "@/lib/body";
import { firstSentences } from "@/lib/preview";
import {
  birthdayRow,
  htmlToText,
  keywords,
  normalizeRelation,
  periodPairRow,
  periodRow,
  type LegacyBirthday,
} from "./transform";

describe("htmlToText", () => {
  it("turns paragraphs and <br> into blank lines / line breaks and decodes entities", () => {
    expect(
      htmlToText(
        '<p style="text-align:&#32;left;">Нэг&nbsp;хоёр.<br> Гурав</p>\n<p>“Дөрөв” &ndash; тав</p>',
      ),
    ).toBe("Нэг хоёр.\nГурав\n\n“Дөрөв” – тав");
  });

  it("keeps list items together as bullet lines", () => {
    expect(htmlToText("<ul>\n<li>Нэг.&nbsp;</li>\n<li>Хоёр</li>\n</ul>\n<p>Дараа</p>")).toBe(
      "• Нэг.\n• Хоёр\n\nДараа",
    );
  });

  it("normalizes hand-typed ∙ bullets", () => {
    expect(htmlToText("<p>∙&nbsp;&nbsp;Нэг.</p>\n<p>∙&nbsp;&nbsp;Хоёр!</p>")).toBe(
      "• Нэг.\n• Хоёр!",
    );
  });

  it("unwraps blockquotes and drops empty paragraphs", () => {
    expect(htmlToText("<blockquote>\n<p>Текст.</p>\n</blockquote><p><br><br></p>")).toBe("Текст.");
  });
});

describe("keywords", () => {
  it("splits upper-case keyword lists into sentence case", () => {
    expect(keywords("<p>ТАЙВАН<br> ХУВИЙН ЗОХИОН БАЙГУУЛАЛТТАЙ<br>ӨГЛӨГЧ<br><br></p>")).toEqual([
      "Тайван",
      "Хувийн зохион байгуулалттай",
      "Өглөгч",
    ]);
  });

  it("keeps mixed-case plain-text lists as written", () => {
    expect(keywords("Эерэг \nГоо зүйтэй\nЗөв шаардлага тавьдаг")).toEqual([
      "Эерэг",
      "Гоо зүйтэй",
      "Зөв шаардлага тавьдаг",
    ]);
    expect(keywords(null)).toEqual([]);
  });
});

describe("normalizeRelation", () => {
  it("fixes spacing, the 'Гэрлэт' typo and capitalization", () => {
    expect(normalizeRelation("Эцэг,эх-Хүүхэд")).toBe("Эцэг, эх-Хүүхэд");
    expect(normalizeRelation("Хайр дурлал, \nЭцэг, эх-Хүүхэд")).toBe(
      "Хайр дурлал, Эцэг, эх-Хүүхэд",
    );
    expect(normalizeRelation("Гэрлэт")).toBe("Гэрлэлт");
    expect(normalizeRelation("гэрлэлт")).toBe("Гэрлэлт");
    expect(normalizeRelation("  ")).toBeNull();
  });
});

const section = (key: number, name: string, html: string) => ({ key, name, isFree: false, html });
const legacyDay: LegacyBirthday = {
  month: 2,
  day: 29,
  title: " Өөрийгөө эрэгч ",
  sections: [
    section(1, "Давуу тал", "<p>ТАЙВАН<br> БОДЛОГОТОЙ</p>"),
    section(2, "Бясалгах үг", "<p>Бясал.</p>"),
    section(3, "Зөвлөгөө", "<ul><li>Нэг.</li><li>Хоёр.</li></ul>"),
    section(4, "Ерөнхий шинж", "<p>Эхний өгүүлбэр. Хоёр дахь. Гурав дахь.</p>"),
    section(5, "Эрүүл мэнд", "<p>Эрүүл.</p>"),
    section(6, "Тоон хэлээр", "<p>Тоо.</p>"),
    section(7, "Таро хөзөр", "<p>Таро.</p>"),
    section(8, "Сул тал", "<p>УДААН<br> НООМОЙ</p>"),
  ],
};

describe("birthdayRow", () => {
  it("maps strengths/weaknesses to the teaser and the rest to a headed body", () => {
    const row = birthdayRow(legacyDay);
    expect(row.month_day).toBe("02-29");
    expect(row.title).toBe("Өөрийгөө эрэгч");
    expect(row.teaser).toBe("Давуу тал: Тайван · Бодлоготой\nСул тал: Удаан · Ноомой");
    expect(
      parseBody(row.body)
        .filter((b) => b.type === "heading")
        .map((b) => b.text),
    ).toEqual([
      "Ерөнхий шинж",
      "Бясалгах үг",
      "Зөвлөгөө",
      "Эрүүл мэнд",
      "Тоон хэлээр",
      "Таро хөзөр",
    ]);
    expect(row.body).not.toMatch(/Тайван|Удаан/);
  });

  it("previews from the general section, skipping its heading", () => {
    expect(firstSentences(birthdayRow(legacyDay).body, 2)).toBe("Эхний өгүүлбэр. Хоёр дахь.");
  });

  it("fails loudly when a section is missing", () => {
    expect(() => birthdayRow({ ...legacyDay, sections: legacyDay.sections.slice(1) })).toThrow(
      /section 1 missing/,
    );
  });
});

describe("periodPairRow", () => {
  it("orders the pair and builds text + lists + relation types", () => {
    const row = periodPairRow({
      period1: 7,
      period2: 3,
      title: "Тэмцэх ээлж",
      text: "Уян хатан бай. \n",
      strength: "Түшигтэй\nТачаангуй",
      weakness: null,
      goodFor: "гэрлэлт",
      badFor: "Эцэг,эх-Хүүхэд",
    });
    expect(row).toMatchObject({ period_a: "3", period_b: "7", title: "Тэмцэх ээлж" });
    expect(row.body).toBe(
      [
        "Уян хатан бай.",
        "## Давуу тал\n\n• Түшигтэй\n• Тачаангуй",
        "## Тохиромжтой харилцаа\n\nГэрлэлт",
        "## Анхаарах харилцаа\n\nЭцэг, эх-Хүүхэд",
      ].join("\n\n"),
    );
  });
});

describe("periodRow", () => {
  it("converts MM/DD to MM-DD", () => {
    expect(periodRow({ index: 1, start: "12/26", end: "01/02" })).toEqual({
      no: "1",
      start: "12-26",
      end: "01-02",
    });
  });
});
