"use server";

import { cookies } from "next/headers";

import { THEME_COOKIE, themeSchema } from "@/lib/theme";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setTheme(formData: FormData): Promise<void> {
  const theme = themeSchema.parse(formData.get("theme"));
  (await cookies()).set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: false,
  });
}
