import { describe, expect, it } from "vitest";

import { AVATAR_SEEDS, avatarFits, avatarGender, avatarIndexesFor } from "./avatar-seeds";

describe("avatar genders", () => {
  it("splits the 30 seeds into 7 female, 21 male and 2 neutral", () => {
    const count = (g: string) => AVATAR_SEEDS.filter((s) => avatarGender(s) === g).length;
    expect([count("female"), count("male"), count("neutral")]).toEqual([7, 21, 2]);
  });

  it("offers a gender its own seeds first, then the neutral ones", () => {
    const female = avatarIndexesFor("female");
    expect(female).toHaveLength(9);
    expect(female.slice(0, 7).every((i) => avatarGender(AVATAR_SEEDS[i]) === "female")).toBe(true);
    expect(avatarIndexesFor("male")).toHaveLength(23);
  });

  it("checks a seed index against a gender", () => {
    expect(avatarFits(2, "female")).toBe(true); // Cedar
    expect(avatarFits(1, "female")).toBe(false); // Birch
    expect(avatarFits(16, "male")).toBe(true); // Quill, neutral
    expect(avatarFits(99, "male")).toBe(false);
  });
});
