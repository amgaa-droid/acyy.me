import { describe, expect, it } from "vitest";

import { scrollStep } from "./scroll-hide";

/** Feeds scroll positions one by one, as the scroll events would. */
function run(ys: number[], hidden = false) {
  let state = { hidden, anchor: ys[0] };
  for (const y of ys.slice(1)) state = scrollStep(state.anchor, y, state.hidden);
  return state.hidden;
}

describe("scrollStep", () => {
  it("hides on scrolling down and shows on scrolling up", () => {
    expect(run([100, 200])).toBe(true);
    expect(run([200, 150], true)).toBe(false);
  });

  it("always shows near the top, even scrolling down", () => {
    expect(run([0, 20])).toBe(false);
    expect(run([300, 10], true)).toBe(false);
  });

  it("keeps the state for tiny moves", () => {
    expect(run([300, 302], true)).toBe(true);
    expect(run([300, 298], true)).toBe(true);
    expect(run([300, 303])).toBe(false);
  });

  it("adds up smooth scrolling of a few px a frame", () => {
    expect(run([300, 302, 304, 306, 308])).toBe(true);
    expect(run([500, 497, 494, 491, 488], true)).toBe(false);
  });
});
