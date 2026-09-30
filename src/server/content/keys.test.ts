import { describe, expect, it } from "vitest";

import { ZODIAC_SIGNS } from "@/server/db/seed-data";
import { expectedKeys, periodPairKey, periodPairKeys, signPairKey, signPairKeys } from "./keys";

const signCodes = ZODIAC_SIGNS.map((s) => s.code);

describe("pair keys", () => {
  it("are order-independent", () => {
    expect(signPairKey("scorpio", "aries")).toBe(signPairKey("aries", "scorpio"));
    expect(signPairKey("scorpio", "aries")).toBe("aries|scorpio");
    expect(periodPairKey(12, 3)).toBe("3|12");
    expect(periodPairKey(5, 5)).toBe("5|5");
  });

  it("sorts periods numerically, not lexically", () => {
    expect(periodPairKey(10, 9)).toBe("9|10");
  });
});

describe("pair key lists", () => {
  it("78 unique sign pairs including self-pairs", () => {
    const keys = signPairKeys(signCodes);
    expect(keys).toHaveLength(78);
    expect(new Set(keys).size).toBe(78);
    expect(keys).toContain("leo|leo");
    expect(keys).not.toContain("scorpio|aries");
  });

  it("1,176 unique period pairs including self-pairs", () => {
    const keys = periodPairKeys(48);
    expect(keys).toHaveLength(1176);
    expect(new Set(keys).size).toBe(1176);
    expect(keys[0]).toBe("1|1");
    expect(keys.at(-1)).toBe("48|48");
  });
});

describe("expectedKeys", () => {
  const ref = { signCodes, periodCount: 48 };
  const count = (p: Parameters<typeof expectedKeys>[0]) =>
    expectedKeys(p, ref).reduce((n, s) => n + s.keys.length, 0);

  it("matches the content totals from SPEC §3 (366 + 4×12 + 78 + 1,176)", () => {
    expect(count("birthday")).toBe(366);
    for (const p of ["sign", "love", "sex", "dating"] as const) expect(count(p)).toBe(12);
    expect(count("synastry")).toBe(78 + 1176);
  });
});
