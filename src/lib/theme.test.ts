import { describe, expect, it } from "vitest";

import { DEFAULT_THEME, parseTheme } from "./theme";

describe("parseTheme", () => {
  it("accepts known themes", () => {
    expect(parseTheme("white")).toBe("white");
    expect(parseTheme("cosmic")).toBe("cosmic");
  });

  it("falls back to the default for missing or unknown values", () => {
    expect(parseTheme(undefined)).toBe(DEFAULT_THEME);
    expect(parseTheme("pink")).toBe(DEFAULT_THEME);
  });
});
