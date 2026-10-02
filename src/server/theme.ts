import "server-only";

import { cookies } from "next/headers";

import { THEME_COOKIE, parseTheme, type Theme } from "@/lib/theme";

/** The colour mode this visitor picked (cookie `theme`), or the default. */
export async function readTheme(): Promise<Theme> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}
