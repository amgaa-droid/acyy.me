import { describe, expect, it } from "vitest";

import { byCloseness, pairsFromPurchases } from "./planets";

describe("pairsFromPurchases", () => {
  const counts: Record<string, number> = { birthday: 1, synastry: 2 };
  const personCountOf = (code: string) => counts[code];
  const buy = (id: string, productCode: string, a: string | null, b: string | null = null) => ({
    id,
    productCode,
    personAId: a,
    personBId: b,
  });

  it("splits pairs with me from pairs between my people; newest wins", () => {
    const purchases = [
      buy("r1", "synastry", "mom", "me"),
      buy("r2", "synastry", "mom", "dad"),
      buy("r0", "synastry", "dad", "mom"), // older duplicate of r2
      buy("r3", "birthday", "mom"),
    ];
    expect(pairsFromPurchases("me", ["mom", "dad"], purchases, personCountOf)).toEqual({
      mePairs: { mom: "r1" },
      pairs: [{ a: "mom", b: "dad", purchaseId: "r2" }],
    });
  });

  it("skips pairs with a deleted person or someone who isn't mine", () => {
    const purchases = [buy("r1", "synastry", "mom", null), buy("r2", "synastry", "mom", "stranger")];
    expect(pairsFromPurchases("me", ["mom"], purchases, personCountOf)).toEqual({
      mePairs: {},
      pairs: [],
    });
  });
});

describe("byCloseness", () => {
  it("puts romantic, family, friends, others, then «Хэн ч биш»; keeps order within a group", () => {
    const people = [
      { id: "1", relation: "coworker" as const },
      { id: "2", relation: "friend" as const },
      { id: "3", relation: "mother" as const },
      { id: "4", relation: "crush" as const },
      { id: "5", relation: "father" as const },
      { id: "6", relation: "nobody" as const },
    ];
    expect(byCloseness([people[5], ...people.slice(0, 5)]).map((p) => p.id)).toEqual([
      "4",
      "3",
      "5",
      "2",
      "1",
      "6",
    ]);
  });
});
