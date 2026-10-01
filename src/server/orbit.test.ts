import { describe, expect, it } from "vitest";

import { byCloseness, orbitReadings } from "./orbit";
import { subjectKey } from "./purchase";

describe("orbitReadings", () => {
  const counts: Record<string, number> = { birthday: 1, sign: 1, love: 1, synastry: 2 };
  const personCountOf = (code: string) => counts[code];
  const purchases = [
    { id: "r1", productCode: "synastry", subjectKey: subjectKey(["me", "mom"]) },
    { id: "r2", productCode: "love", subjectKey: "mom" },
    { id: "r3", productCode: "birthday", subjectKey: "mom" },
    { id: "r4", productCode: "birthday", subjectKey: "me" },
    { id: "r5", productCode: "synastry", subjectKey: subjectKey(["mom", "friend"]) },
  ];

  it("splits single readings and the pair reading with me, per person", () => {
    const map = orbitReadings("me", ["mom", "friend"], purchases, personCountOf);
    expect(map.get("me")).toEqual({ products: ["birthday"], pair: null });
    expect(map.get("mom")).toEqual({
      products: ["love", "birthday"],
      pair: { purchaseId: "r1", productCode: "synastry" },
    });
    // A pair between two other people is not a line to me.
    expect(map.get("friend")).toEqual({ products: [], pair: null });
  });

  it("finds the pair regardless of person order in the subject key", () => {
    const map = orbitReadings(
      "b",
      ["a"],
      [{ id: "x", productCode: "synastry", subjectKey: subjectKey(["b", "a"]) }],
      personCountOf,
    );
    expect(map.get("a")?.pair?.purchaseId).toBe("x");
  });
});

describe("byCloseness", () => {
  it("puts romantic, then family, then friends, then others; keeps order within a group", () => {
    const people = [
      { id: "1", relation: "coworker" as const },
      { id: "2", relation: "friend" as const },
      { id: "3", relation: "mother" as const },
      { id: "4", relation: "crush" as const },
      { id: "5", relation: "father" as const },
    ];
    expect(byCloseness(people).map((p) => p.id)).toEqual(["4", "3", "5", "2", "1"]);
  });
});
