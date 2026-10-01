import { describe, expect, it } from "vitest";

import { buildPlaceholderPeriods } from "@/server/astro/calendar";
import { ZODIAC_SIGNS } from "@/server/db/seed-data";
import { seedProductDefs } from "@/server/db/seed-data";
import { allKinds, type ImportKindSpec } from "./kinds";

const IMPORT_KINDS: Record<string, ImportKindSpec> = Object.fromEntries(
  allKinds(seedProductDefs()).map((k) => [k.kind, k]),
);
import type { ParsedRow } from "./parse";
import {
  normalizeMonthDay,
  resolveGender,
  resolveSign,
  splitBodyToFields,
  validateImport,
} from "./validate";

const refs = { signs: ZODIAC_SIGNS, periodCount: 48 };
let n = 1;
const r = (values: Record<string, string>): ParsedRow => ({ row: ++n, values });
const text = { title: "Гарчиг", body: "Текст." };

describe("helpers", () => {
  it("normalizes month-days", () => {
    expect(normalizeMonthDay("3-5")).toBe("03-05");
    expect(normalizeMonthDay("03/21")).toBe("03-21");
    expect(normalizeMonthDay("02.29")).toBe("02-29");
    expect(normalizeMonthDay("02-30")).toBeNull();
    expect(normalizeMonthDay("2024-03-01")).toBeNull();
  });

  it("resolves signs by code or Mongolian name", () => {
    expect(resolveSign("Хилэнц", ZODIAC_SIGNS)).toBe("scorpio");
    expect(resolveSign(" хилэнц ", ZODIAC_SIGNS)).toBe("scorpio");
    expect(resolveSign("SCORPIO", ZODIAC_SIGNS)).toBe("scorpio");
    expect(resolveSign("Могой", ZODIAC_SIGNS)).toBeNull();
  });
});

/** A made-up gender-split, ordered-pair and period catalogue for the new key types. */
const custom: Record<string, ImportKindSpec> = Object.fromEntries(
  allKinds(
    seedProductDefs([
      {
        code: "career",
        nameMn: "Ажил",
        description: "",
        price: 1000,
        personCount: 1,
        allowedGroups: ["self"],
        adultOnly: false,
        icon: "briefcase",
        tint: "tint-1",
        parts: [
          {
            code: "main",
            nameMn: "Орд",
            keyType: "sign",
            byGender: true,
            fields: [
              { code: "general", nameMn: "Ерөнхий", kind: "text", required: true },
              { code: "strengths", nameMn: "Давуу тал", kind: "list" },
            ],
          },
        ],
      },
      {
        code: "crush",
        nameMn: "Сэтгэл",
        description: "",
        price: 1000,
        personCount: 2,
        allowedGroups: ["self"],
        adultOnly: false,
        icon: "heart",
        tint: "tint-2",
        parts: [
          {
            code: "main",
            nameMn: "Хос",
            keyType: "sign_pair_ordered",
            fields: [{ code: "general", nameMn: "Ерөнхий", kind: "text", required: true }],
          },
        ],
      },
    ]),
  ).map((k) => [k.kind, k]),
);

describe("validateImport — key types", () => {
  it("gender-split keys need a valid gender column", () => {
    expect(custom.career.columns.map((c) => c.name)).toEqual([
      "sign",
      "gender",
      "title",
      "general",
      "strengths",
      "teaser",
      "score",
    ]);
    const report = validateImport(
      custom.career,
      [
        r({ sign: "Хуц", gender: "Эр", title: "А", general: "Текст." }),
        r({ sign: "Хуц", gender: "female", title: "Б", general: "Текст." }),
        r({ sign: "Хуц", gender: "?", title: "В", general: "Текст." }),
      ],
      refs,
    );
    expect(report.errors.map((e) => e.code)).toEqual(["invalid_gender"]);
    expect(report.entries.map((e) => e.key)).toEqual(["aries|male", "aries|female"]);
    expect(report.missing).toHaveLength(22);
    expect(resolveGender("Эмэгтэй")).toBe("female");
  });

  it("ordered pairs keep A×B and B×A apart", () => {
    const report = validateImport(
      custom.crush,
      [
        r({ sign_a: "Хуц", sign_b: "Арслан", title: "А", general: "Текст." }),
        r({ sign_a: "Арслан", sign_b: "Хуц", title: "Б", general: "Текст." }),
      ],
      refs,
    );
    expect(report.ok).toBe(true);
    expect(report.entries.map((e) => e.key)).toEqual(["aries|leo", "leo|aries"]);
    expect(report.missing).toHaveLength(142);
  });

  it("stores each sub-section column as its field", () => {
    const report = validateImport(
      custom.career,
      [r({ sign: "Хуц", gender: "Эр", title: "А", general: " Текст. ", strengths: "• а\n• б" })],
      refs,
    );
    expect(report.entries[0].fields).toEqual({ general: "Текст.", strengths: "• а\n• б" });
  });
});

describe("splitBodyToFields (legacy body column)", () => {
  const fields = IMPORT_KINDS.birthday.target!.fields;

  it("maps '## ' sections to sub-sections by name; the rest goes to general", () => {
    expect(
      splitBodyToFields(
        "Оршил.\n\n## Бясалгах үг\n\nАмгалан.\n\n## зөвлөгөө\n\n• Нэг\n\n## Бусад\n\nНэмэлт.",
        fields,
      ),
    ).toEqual({
      general: "Оршил.\n\n## Бусад\n\nНэмэлт.",
      meditation: "Амгалан.",
      advice: "• Нэг",
    });
  });

  it("a body-only file still imports (sub-section columns optional)", () => {
    const report = validateImport(
      IMPORT_KINDS.birthday,
      [r({ month_day: "03-21", title: "А", body: "## Ерөнхий шинж\n\nТекст." })],
      refs,
    );
    expect(report.ok).toBe(true);
    expect(report.entries[0].fields).toEqual({ general: "Текст." });
  });
});

describe("validateImport — content", () => {
  it("accepts a full sign file and reports insert vs update", () => {
    const rows = ZODIAC_SIGNS.map((s) => r({ sign: s.nameMn, ...text }));
    const report = validateImport(IMPORT_KINDS.love, rows, refs, new Set(["aries", "leo"]));
    expect(report.ok).toBe(true);
    expect(report.entries).toHaveLength(12);
    expect(report.missing).toEqual([]);
    expect(report).toMatchObject({ toInsert: 10, toUpdate: 2 });
  });

  it("lists missing keys without failing (partial import)", () => {
    const report = validateImport(IMPORT_KINDS.sign, [r({ sign: "Хуц", ...text })], refs);
    expect(report.ok).toBe(true);
    expect(report.missing).toHaveLength(11);
    expect(report.missing).not.toContain("aries");
  });

  it("rejects unknown keys, empty body/title and bad scores", () => {
    const report = validateImport(
      IMPORT_KINDS["synastry.sign_pair"],
      [
        r({ sign_a: "Хуц", sign_b: "Могой", ...text }),
        r({ sign_a: "Хуц", sign_b: "Үхэр", title: "", body: "" }),
        r({ sign_a: "Хуц", sign_b: "Ихэр", ...text, score: "101" }),
        r({ sign_a: "Хуц", sign_b: "Мэлхий", ...text, score: "75%" }),
      ],
      refs,
    );
    expect(report.ok).toBe(false);
    expect(report.errors.map((e) => [e.code, e.column])).toEqual([
      ["unknown_sign", "sign_b"],
      ["required", "title"],
      ["required", "general"],
      ["invalid_score", "score"],
    ]);
    expect(report.entries).toEqual([
      {
        key: "aries|cancer",
        title: "Гарчиг",
        fields: { general: "Текст." },
        teaser: null,
        score: 75,
      },
    ]);
  });

  it("treats A|B and B|A as the same key (duplicate) for unordered pairs", () => {
    const report = validateImport(
      IMPORT_KINDS["synastry.period_pair"],
      [
        r({ period_a: "12", period_b: "3", ...text }),
        r({ period_a: "3", period_b: "12", ...text }),
      ],
      refs,
    );
    const first = n - 1;
    expect(report.errors).toEqual([
      { code: "duplicate", row: n, value: "3|12", detail: String(first) },
    ]);
  });

  it("period pairs: canonical numeric keys, range-checked", () => {
    const report = validateImport(
      IMPORT_KINDS["synastry.period_pair"],
      [
        r({ period_a: "12", period_b: "3", ...text }),
        r({ period_a: "49", period_b: "1", ...text }),
      ],
      refs,
    );
    expect(report.entries.map((e) => e.key)).toEqual(["3|12"]);
    expect(report.errors).toMatchObject([
      { code: "invalid_period", column: "period_a", value: "49" },
    ]);
    expect(report.missing).toHaveLength(1175);
  });

  it("birthday: month-day formats and duplicates across formats", () => {
    const report = validateImport(
      IMPORT_KINDS.birthday,
      [
        r({ month_day: "3-5", ...text }),
        r({ month_day: "03-05", ...text }),
        r({ month_day: "13-01", ...text }),
      ],
      refs,
    );
    expect(report.errors.map((e) => e.code)).toEqual(["duplicate", "invalid_month_day"]);
    expect(report.missing).toHaveLength(365);
  });

  it("teaser is optional, trimmed and length-limited", () => {
    const report = validateImport(
      IMPORT_KINDS.birthday,
      [
        r({ month_day: "01-01", ...text, teaser: "  Давуу тал: Тайван\nСул тал: Удаан " }),
        r({ month_day: "01-02", ...text, teaser: "   " }),
        r({ month_day: "01-03", ...text, teaser: "а".repeat(501) }),
      ],
      refs,
    );
    expect(report.errors).toEqual([{ code: "too_long", row: n, column: "teaser" }]);
    expect(report.entries.map((e) => e.teaser)).toEqual([
      "Давуу тал: Тайван\nСул тал: Удаан",
      null,
    ]);
  });

  it("empty file is an error", () => {
    expect(validateImport(IMPORT_KINDS.sign, [], refs).errors).toEqual([{ code: "empty_file" }]);
  });
});

describe("validateImport — periods48", () => {
  const good = () =>
    buildPlaceholderPeriods().map((p) => r({ no: String(p.no), start: p.startMd, end: p.endMd }));

  it("accepts a complete, gap-free table", () => {
    const report = validateImport(IMPORT_KINDS.periods48, good(), refs);
    expect(report.ok).toBe(true);
    expect(report.ranges).toHaveLength(48);
  });

  it("reports missing periods", () => {
    const report = validateImport(IMPORT_KINDS.periods48, good().slice(0, 47), refs);
    expect(report.errors).toEqual([{ code: "missing_period", value: "48" }]);
  });

  it("reports gaps and overlaps", () => {
    const rows = good();
    rows[0].values.end = "12-31"; // period 1: 12-26–12-31 → 01-01, 01-02 uncovered
    const gap = validateImport(IMPORT_KINDS.periods48, rows, refs);
    expect(gap.errors).toEqual([{ code: "coverage_gap", detail: "01-01, 01-02" }]);

    const rows2 = good();
    rows2[1].values.start = "01-02"; // period 2 now also starts on 01-02
    const overlap = validateImport(IMPORT_KINDS.periods48, rows2, refs);
    expect(overlap.errors).toEqual([{ code: "coverage_overlap", value: "01-02", detail: "1, 2" }]);
  });
});
