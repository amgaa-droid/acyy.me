import { z } from "zod";

/** User-selectable colour modes. Each follows the OS light/dark setting on its own. */
export const THEMES = ["cosmic", "white"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "cosmic";
export const THEME_COOKIE = "theme";

export const themeSchema = z.enum(THEMES);

export function parseTheme(value: string | undefined): Theme {
  const parsed = themeSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_THEME;
}
