import { describe, expect, it } from "vitest";

import { lockedSummary, type ReadingField } from "@/server/reading";

const field = (name: string, value: string, isFree = false): ReadingField => ({
  code: name,
  name,
  kind: "text",
  isFree,
  value,
});

describe("lockedSummary", () => {
  it("lists the paid fields' headings once, in order, and counts their words", () => {
    const summary = lockedSummary([
      [field("Ерөнхий", "free text here", true), field("Зан чанар", "нэг хоёр гурав")],
      [field("Хайр дурлал", "дөрөв таван"), field("Зан чанар", "зургаа")],
    ]);
    expect(summary.headings).toEqual(["Зан чанар", "Хайр дурлал"]);
    expect(summary.words).toBe(6);
  });

  it("carries no reading text — only names and a number", () => {
    const summary = lockedSummary([[field("Ажил", "НУУЦ ТЕКСТ энд")]]);
    expect(JSON.stringify(summary)).not.toContain("НУУЦ");
  });

  it("is empty when nothing is locked", () => {
    expect(lockedSummary([[field("Ерөнхий", "бүгд үнэгүй", true)]])).toEqual({ headings: [], words: 0 });
  });
});
