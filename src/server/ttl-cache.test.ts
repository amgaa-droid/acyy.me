import { describe, expect, it, vi } from "vitest";

import { ttlCache } from "./ttl-cache";

describe("ttlCache", () => {
  it("serves the cached value until it expires, then reloads", async () => {
    let t = 0;
    const load = vi.fn(async () => `v${load.mock.calls.length}`);
    const c = ttlCache(1000, load, () => t);
    expect(await c.get()).toBe("v1");
    t = 999;
    expect(await c.get()).toBe("v1");
    t = 1000;
    expect(await c.get()).toBe("v2");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one load between concurrent misses and can be cleared", async () => {
    const load = vi.fn(async () => load.mock.calls.length);
    const c = ttlCache(60_000, load);
    expect(await Promise.all([c.get(), c.get(), c.get()])).toEqual([1, 1, 1]);
    c.clear();
    expect(await c.get()).toBe(2);
  });

  it("doesn't cache a failed load", async () => {
    let fail = true;
    const c = ttlCache(60_000, async () => {
      if (fail) throw new Error("db down");
      return "ok";
    });
    await expect(c.get()).rejects.toThrow("db down");
    fail = false;
    expect(await c.get()).toBe("ok");
  });
});
