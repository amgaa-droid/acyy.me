import { describe, expect, it } from "vitest";

import { DEFAULT_THEME, isAlwaysDark, parseTheme } from "./theme";

describe("parseTheme", () => {
  it("accepts known themes", () => {
    expect(parseTheme("white")).toBe("white");
    expect(parseTheme("cosmic")).toBe("cosmic");
    expect(parseTheme("cosmic-dark")).toBe("cosmic-dark");
  });

  it("falls back to the default for missing or unknown values", () => {
    expect(parseTheme(undefined)).toBe(DEFAULT_THEME);
    expect(parseTheme("pink")).toBe(DEFAULT_THEME);
  });
});

describe("isAlwaysDark", () => {
  it("is true only for cosmic-dark; the others follow the OS", () => {
    expect(isAlwaysDark("cosmic-dark")).toBe(true);
    expect(isAlwaysDark("cosmic")).toBe(false);
    expect(isAlwaysDark("white")).toBe(false);
  });
});
