import { describe, expect, it } from "vitest";

import { createThrottle } from "./throttle";

describe("createThrottle", () => {
  it("lets a key through once per interval, each key on its own", () => {
    const may = createThrottle(3_000);
    expect(may("a", 0)).toBe(true);
    expect(may("a", 2_999)).toBe(false);
    expect(may("b", 2_999)).toBe(true);
    expect(may("a", 3_000)).toBe(true);
  });

  it("forgets everything rather than grow without bound", () => {
    const may = createThrottle(1_000, 2);
    expect(may("a", 0)).toBe(true);
    expect(may("b", 0)).toBe(true);
    expect(may("c", 0)).toBe(true); // table full → cleared
    expect(may("a", 1)).toBe(true);
  });
});
