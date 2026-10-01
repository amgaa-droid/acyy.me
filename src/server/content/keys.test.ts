import { describe, expect, it } from "vitest";

import { PRODUCTS, ZODIAC_SIGNS } from "@/server/db/seed-data";
import {
  GenderRequiredError,
  expectedPartKeys,
  needsGender,
  orderedSignPairKeys,
  partKeyFor,
  periodPairKey,
  periodPairKeys,
  signPairKey,
  shownKeys,
  signPairKeys,
  type KeyPerson,
} from "./keys";

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

describe("expectedPartKeys", () => {
  const ref = { signCodes, periodCount: 48 };
  const count = (code: string) =>
    PRODUCTS.find((p) => p.code === code)!.parts.reduce(
      (n, part) =>
        n +
        expectedPartKeys({ keyType: part.keyType, byGender: part.byGender ?? false }, ref).length,
      0,
    );

  it("matches the content totals from SPEC §3 (366 + 4×12 + 144 + 1,176)", () => {
    expect(count("birthday")).toBe(366);
    for (const p of ["sign", "love", "sex", "dating"]) expect(count(p)).toBe(12);
    expect(count("synastry")).toBe(144 + 1176);
  });

  it("covers the new key types: periods, ordered sign pairs, gender split", () => {
    expect(expectedPartKeys({ keyType: "period", byGender: false }, ref)).toHaveLength(48);
    const ordered = expectedPartKeys({ keyType: "sign_pair_ordered", byGender: false }, ref);
    expect(ordered).toHaveLength(144);
    expect(ordered).toContain("scorpio|aries");
    expect(ordered).toContain("aries|scorpio");
    expect(orderedSignPairKeys(signCodes)).toEqual(ordered);

    const gendered = expectedPartKeys({ keyType: "sign", byGender: true }, ref);
    expect(gendered).toHaveLength(24);
    expect(gendered.slice(0, 2)).toEqual(["aries|male", "aries|female"]);
    expect(expectedPartKeys({ keyType: "month_day", byGender: true }, ref)).toHaveLength(732);
    // Gender split only applies to one-person keys.
    expect(expectedPartKeys({ keyType: "sign_pair", byGender: true }, ref)).toHaveLength(78);
  });
});

describe("partKeyFor", () => {
  const leo: KeyPerson = { monthDay: "08-01", sign: "leo", period: 20, gender: "female" };
  const aries: KeyPerson = { monthDay: "03-25", sign: "aries", period: 12, gender: "unspecified" };

  it("computes each key type from the people in order", () => {
    expect(partKeyFor({ keyType: "month_day", byGender: false }, [leo])).toBe("08-01");
    expect(partKeyFor({ keyType: "sign", byGender: false }, [leo])).toBe("leo");
    expect(partKeyFor({ keyType: "period", byGender: false }, [leo])).toBe("20");
    expect(partKeyFor({ keyType: "sign_pair", byGender: false }, [leo, aries])).toBe("aries|leo");
    expect(partKeyFor({ keyType: "period_pair", byGender: false }, [leo, aries])).toBe("12|20");
    expect(partKeyFor({ keyType: "sign_pair_ordered", byGender: false }, [leo, aries])).toBe(
      "leo|aries",
    );
  });

  it("appends the gender, and refuses an unspecified one", () => {
    expect(partKeyFor({ keyType: "sign", byGender: true }, [leo])).toBe("leo|female");
    expect(() => partKeyFor({ keyType: "sign", byGender: true }, [aries])).toThrow(
      GenderRequiredError,
    );
  });

  it("ordered pairs show both directions; gender split needs a gender", () => {
    expect(shownKeys("sign_pair_ordered", "leo|aries")).toEqual(["leo|aries", "aries|leo"]);
    expect(shownKeys("sign_pair_ordered", "leo|leo")).toEqual(["leo|leo"]);
    expect(shownKeys("sign_pair", "aries|leo")).toEqual(["aries|leo"]);
    expect(needsGender([{ keyType: "sign", byGender: true }])).toBe(true);
    expect(needsGender([{ keyType: "sign_pair", byGender: true }])).toBe(false);
  });
});
