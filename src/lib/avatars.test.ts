import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/avatar/[seed]/route";
import { AVATAR_SEEDS, avatarBase64Uri, avatarSeedFor, avatarSvg, avatarUrl } from "./avatars";

describe("avatar URLs", () => {
  it("links a pickable seed by name, with a cache-busting version", () => {
    expect(avatarUrl("Nova")).toBe("/api/avatar/Nova?v=1");
  });

  it("maps any other value to a pickable seed, stably — never a name in the URL", () => {
    const seed = avatarSeedFor("Сарангэрэл");
    expect(AVATAR_SEEDS).toContain(seed);
    expect(avatarSeedFor("Сарангэрэл")).toBe(seed);
    expect(avatarUrl("Сарангэрэл")).toBe(`/api/avatar/${seed}?v=1`);
    expect(avatarBase64Uri("Сарангэрэл")).toBe(avatarBase64Uri(seed));
  });

  it("renders the same SVG every time", () => {
    expect(avatarSvg("Nova")).toBe(avatarSvg("Nova"));
    expect(avatarSvg("Nova")).toMatch(/^<svg/);
  });
});

describe("GET /api/avatar/:seed", () => {
  const call = (seed: string) =>
    GET(new Request("http://x/api/avatar/" + seed), { params: Promise.resolve({ seed }) });

  it("serves a pickable avatar as an immutable SVG", async () => {
    const res = await call("Nova");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(await res.text()).toBe(avatarSvg("Nova"));
  });

  it("404s anything else", async () => {
    expect((await call("Сарангэрэл")).status).toBe(404);
    expect((await call("../etc")).status).toBe(404);
  });
});
