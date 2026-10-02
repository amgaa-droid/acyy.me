import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { THEME_GROUND } from "./theme";

/**
 * The colour tokens in globals.css, checked for contrast (WCAG 2.1): text pairs AA (4.5:1),
 * a meaningful graphic against what it sits on 3:1, in each of the five palettes.
 */
const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");

type Palette = Record<string, string>;

/** Every `{ … }` block that sets `--bg`, in file order, as `{ bg: "#f5f1eb", … }`. */
const blocks: Palette[] = [...css.matchAll(/\{([^{}]*--bg:[^{}]*)\}/g)].map((m) =>
  Object.fromEntries(
    [...m[1].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/g)].map((t) => [t[1], t[2]]),
  ),
);
const [cosmic, white, cosmicNight, cosmicOsDark, whiteOsDark] = blocks;
const palettes: [string, Palette][] = [
  ["cosmic", cosmic],
  ["white", white],
  ["cosmic-dark", cosmicNight],
  ["cosmic, OS dark", cosmicOsDark],
  ["white, OS dark", whiteOsDark],
];

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** [text, ground] */
const TEXT_PAIRS: [string, string][] = [
  ["fg", "bg"],
  ["fg", "surface"],
  ["fg", "tint-1"],
  ["fg", "tint-2"],
  ["fg", "tint-3"],
  ["muted", "bg"],
  ["muted", "surface"],
  ["muted", "subtle"],
  ["muted", "tint-1"],
  ["muted", "tint-2"],
  ["muted", "tint-3"],
  ["highlight", "bg"],
  ["highlight", "surface"],
  ["highlight", "tint-1"],
  ["highlight-fg", "highlight"],
  ["pair-fg", "pair"],
  ["nav-fg", "nav-bg"],
  ["nav-active-fg", "nav-active-bg"],
  ["danger", "bg"],
  ["danger", "surface"],
  ["ring-2", "surface"],
];

/** [graphic, what it is drawn on]: the second score ring on its track. */
const GRAPHIC_PAIRS: [string, string][] = [["ring-2", "tint-2"]];

describe("contrast", () => {
  it("is 21:1 for black on white and 1:1 for a colour on itself", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#4a44b5", "#4a44b5")).toBe(1);
  });
});

describe("theme tokens (globals.css)", () => {
  it("finds the five palettes, each with the same tokens", () => {
    expect(blocks).toHaveLength(5);
    for (const [, p] of palettes) expect(Object.keys(p).sort()).toEqual(Object.keys(cosmic).sort());
  });

  it("keeps the two cosmic night blocks the same", () => {
    expect(cosmicOsDark).toEqual(cosmicNight);
  });

  it("THEME_GROUND (browser chrome, manifest) is each mode's --bg", () => {
    expect(THEME_GROUND).toEqual({
      cosmic: { light: cosmic.bg, dark: cosmicOsDark.bg },
      "cosmic-dark": { light: cosmicNight.bg, dark: cosmicNight.bg },
      white: { light: white.bg, dark: whiteOsDark.bg },
    });
  });

  describe.each(palettes)("%s", (_name, p) => {
    it.each(TEXT_PAIRS)("--%s on --%s reads as text (≥ 4.5:1)", (text, ground) => {
      expect(contrast(p[text], p[ground])).toBeGreaterThanOrEqual(4.5);
    });

    it.each(GRAPHIC_PAIRS)("--%s on --%s shows as a graphic (≥ 3:1)", (mark, ground) => {
      expect(contrast(p[mark], p[ground])).toBeGreaterThanOrEqual(3);
    });
  });

  it("white: every tint stands off the page ground and the card surface", () => {
    for (const p of [white, whiteOsDark]) {
      for (const tint of ["tint-1", "tint-2", "tint-3"]) {
        expect(contrast(p[tint], p.bg)).toBeGreaterThanOrEqual(1.1);
      }
      // "Давуу тал" (tint-3) and "Сул тал" (tint-2) sit side by side: no hue to tell them apart.
      expect(contrast(p["tint-2"], p["tint-3"])).toBeGreaterThanOrEqual(1.15);
    }
  });
});
