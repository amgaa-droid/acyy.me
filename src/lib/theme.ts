import { z } from "zod";

/**
 * User-selectable colour modes. "cosmic" and "white" follow the OS light/dark setting;
 * "cosmic-dark" is the cosmic palette, always dark.
 */
export const THEMES = ["cosmic", "cosmic-dark", "white"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "cosmic";
export const THEME_COOKIE = "theme";

export const themeSchema = z.enum(THEMES);

export function parseTheme(value: string | undefined): Theme {
  const parsed = themeSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_THEME;
}

/** Themes that are dark whatever the OS says (mirrors the `dark` variant in globals.css). */
export function isAlwaysDark(theme: Theme): boolean {
  return theme === "cosmic-dark";
}
