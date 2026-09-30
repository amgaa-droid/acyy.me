import { describe, expect, it } from "vitest";

import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps relative paths", () => {
    expect(safeNext("/people/1")).toBe("/people/1");
  });

  it.each([
    undefined,
    null,
    "",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
  ])("falls back for %s", (v) => {
    expect(safeNext(v)).toBe("/home");
  });
});
