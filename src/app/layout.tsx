import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Golos_Text } from "next/font/google";

import { APP_NAME } from "@/env";
import { mn } from "@/i18n/mn";
import { THEME_GROUND, isAlwaysDark } from "@/lib/theme";
import { readTheme } from "@/server/theme";
import "./globals.css";

// Mongolian Ө/ү live in the cyrillic-ext subset, not cyrillic — without it they fall back.
// Golos Text (Cyrillic-first sans) pairs with Cormorant; serif is for display sizes only (≥ 22px).
const sans = Golos_Text({
  variable: "--font-golos",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
});

const serif = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: mn.landing.tagline,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
};

export async function generateViewport(): Promise<Viewport> {
  const theme = await readTheme();
  const ground = THEME_GROUND[theme];
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    // Browser chrome colour: the mode's page ground. It follows the OS, except a theme that is
    // always dark.
    themeColor: isAlwaysDark(theme)
      ? ground.dark
      : [
          { media: "(prefers-color-scheme: light)", color: ground.light },
          { media: "(prefers-color-scheme: dark)", color: ground.dark },
        ],
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read on the server so the first paint already has the right colours (no flash).
  const theme = await readTheme();

  return (
    <html lang="mn" data-theme={theme} className={`${sans.variable} ${serif.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
