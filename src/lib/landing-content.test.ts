import { describe, expect, it } from "vitest";

import {
  BODY_SECTIONS,
  LANDING_DEFAULTS,
  fillTokens,
  issuesByPath,
  landingContentSchema,
  mergeLandingContent,
} from "./landing-content";

const clone = () => structuredClone(LANDING_DEFAULTS);

describe("LANDING_DEFAULTS", () => {
  it("passes its own schema", () => {
    expect(landingContentSchema.safeParse(LANDING_DEFAULTS).success).toBe(true);
  });

  it("shows no compatibility scores", () => {
    expect(JSON.stringify(LANDING_DEFAULTS)).not.toMatch(/score|оноо/i);
  });
});

describe("landingContentSchema", () => {
  it("rejects a link to an unknown person", () => {
    const c = clone();
    c.demo.links[0].b = "nobody";
    const res = landingContentSchema.safeParse(c);
    expect(res.success).toBe(false);
    expect(issuesByPath(res.error!)).toHaveProperty("demo.links.0.b", "bad_pair");
  });

  it("rejects a self-link, duplicate ids and impossible birth dates", () => {
    const self = clone();
    self.demo.links[0].b = self.demo.links[0].a;
    expect(landingContentSchema.safeParse(self).success).toBe(false);

    const dup = clone();
    dup.demo.people[1].id = dup.demo.people[0].id;
    expect(landingContentSchema.safeParse(dup).success).toBe(false);

    const date = clone();
    date.demo.people[0].birthDate = "2001-02-29";
    expect(issuesByPath(landingContentSchema.safeParse(date).error!)).toHaveProperty(
      "demo.people.0.birthDate",
    );
  });

  it("caps demo people at 5 and enforces lengths", () => {
    const many = clone();
    many.demo.people.push({ ...many.demo.people[0], id: "x" });
    expect(landingContentSchema.safeParse(many).success).toBe(false);

    const long = clone();
    long.hero.title = "а".repeat(500);
    expect(issuesByPath(landingContentSchema.safeParse(long).error!)).toHaveProperty("hero.title");
  });

  it("rejects an empty required title", () => {
    const c = clone();
    c.faq.title = "   ";
    expect(landingContentSchema.safeParse(c).success).toBe(false);
  });
});

describe("example avatars match gender", () => {
  it("every default avatar suits its person's gender", () => {
    const res = landingContentSchema.safeParse(LANDING_DEFAULTS);
    expect(res.success).toBe(true);
    expect(LANDING_DEFAULTS.demo.people.find((p) => p.id === "mom")?.gender).toBe("female");
  });

  it("rejects a male drawing on a woman, wherever avatars are chosen", () => {
    const person = clone();
    person.demo.people[0] = { ...person.demo.people[0], gender: "female", seed: 1 }; // Birch
    expect(issuesByPath(landingContentSchema.safeParse(person).error!)).toHaveProperty(
      "demo.people.0.seed",
      "avatar_gender",
    );

    const relation = clone();
    relation.people.relations[0] = { label: "Ээж", gender: "female", seed: 9 }; // Juniper (beard)
    expect(landingContentSchema.safeParse(relation).success).toBe(false);

    const pair = clone();
    pair.synastry.pair[1] = { ...pair.synastry.pair[1], gender: "male", seed: 5 }; // Fern
    expect(landingContentSchema.safeParse(pair).success).toBe(false);
  });

  it("accepts a neutral drawing for either gender", () => {
    const c = clone();
    c.demo.people[0] = { ...c.demo.people[0], gender: "female", seed: 28 }; // Dawn
    c.demo.people[1] = { ...c.demo.people[1], gender: "male", seed: 16 }; // Quill
    expect(landingContentSchema.safeParse(c).success).toBe(true);
  });
});

describe("mergeLandingContent", () => {
  it("falls back to defaults for missing or broken input", () => {
    expect(mergeLandingContent(null)).toEqual(LANDING_DEFAULTS);
    expect(mergeLandingContent("x")).toEqual(LANDING_DEFAULTS);
  });

  it("keeps valid sections and replaces only the broken one", () => {
    const c = clone();
    c.hero.title = "Шинэ гарчиг";
    const raw = { ...c, faq: { title: 5 } };
    const merged = mergeLandingContent(raw);
    expect(merged.hero.title).toBe("Шинэ гарчиг");
    expect(merged.faq).toEqual(LANDING_DEFAULTS.faq);
  });

  it("keeps layout order, drops junk and appends missing sections", () => {
    const merged = mergeLandingContent({
      layout: [
        { key: "faq", visible: false },
        { key: "faq", visible: true },
        { key: "nope", visible: true },
        { key: "stats", visible: true },
      ],
    });
    expect(merged.layout.slice(0, 2)).toEqual([
      { key: "faq", visible: false },
      { key: "stats", visible: true },
    ]);
    expect(merged.layout.map((l) => l.key).sort()).toEqual([...BODY_SECTIONS].sort());
  });
});

describe("legacy content (saved before avatars had a gender)", () => {
  // The shape the first CMS version stored (JSON → untyped on purpose).
  const legacy = () => {
    const c = JSON.parse(JSON.stringify(LANDING_DEFAULTS));
    c.demo.people.forEach((p: Record<string, unknown>, i: number) => {
      delete p.gender;
      p.seed = [2, 4, 7, 10, 13][i];
    });
    c.people.relations = ["Ээж", "Аав"];
    c.synastry.pair = ["Та", "Хайрт"];
    c.layout = [{ key: "stats", visible: false }];
    return c;
  };

  it("keeps the admin's edits instead of falling back to defaults", () => {
    const merged = mergeLandingContent(legacy());
    // Genders come from the drawings: Cedar is female, Haze (Хайрт) male.
    expect(merged.demo.people.map((p) => [p.seed, p.gender])).toEqual([
      [2, "female"],
      [4, "male"],
      [7, "male"],
      [10, "male"],
      [13, "female"],
    ]);
    expect(merged.people.relations.map((r) => r.label)).toEqual(["Ээж", "Аав"]);
    expect(merged.people.relations[0].gender).toBe("female");
    expect(merged.synastry.pair.map((p) => p.label)).toEqual(["Та", "Хайрт"]);
    expect(merged.layout[0]).toEqual({ key: "stats", visible: false });
    expect(landingContentSchema.safeParse(merged).success).toBe(true);
  });
});

describe("fillTokens", () => {
  const tokens = { minPrice: "1,000₮", birthdayPrice: "2,000₮", synastryPrice: "1,500₮" };

  it("fills known price tokens", () => {
    expect(fillTokens("{minPrice}-өөс · {synastryPrice}", tokens)).toBe("1,000₮-өөс · 1,500₮");
  });

  it("leaves unknown tokens as typed", () => {
    expect(fillTokens("{nope} {minPrice}", tokens)).toBe("{nope} 1,000₮");
  });
});
