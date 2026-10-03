import { describe, expect, it } from "vitest";

import { clampPage, pageWindow } from "./pagination";

describe("pageWindow", () => {
  it("shows every page when there are few", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps first, last and the neighbours, with gaps", () => {
    expect(pageWindow(6, 130)).toEqual([1, "gap", 5, 6, 7, "gap", 130]);
    expect(pageWindow(1, 130)).toEqual([1, 2, "gap", 130]);
    expect(pageWindow(130, 130)).toEqual([1, "gap", 129, 130]);
  });

  it("never hides a single page behind a gap", () => {
    expect(pageWindow(4, 20)).toEqual([1, 2, 3, 4, 5, "gap", 20]);
    expect(pageWindow(17, 20)).toEqual([1, "gap", 16, 17, 18, 19, 20]);
  });
});

describe("clampPage", () => {
  it("clamps into range and ignores garbage", () => {
    expect(clampPage("3", 10)).toBe(3);
    expect(clampPage("99", 10)).toBe(10);
    expect(clampPage("0", 10)).toBe(1);
    expect(clampPage("abc", 10)).toBe(1);
    expect(clampPage(undefined, 10)).toBe(1);
    expect(clampPage("5", 0)).toBe(1);
  });
});
