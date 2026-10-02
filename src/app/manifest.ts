import type { MetadataRoute } from "next";

import { APP_NAME } from "@/env";
import { mn } from "@/i18n/mn";
import { DEFAULT_THEME, THEME_GROUND } from "@/lib/theme";

export default function manifest(): MetadataRoute.Manifest {
  // The splash screen and the window bar of the installed app: the default mode's ground, so
  // the app doesn't flash white (or black) before its first paint.
  const ground = THEME_GROUND[DEFAULT_THEME].light;
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: mn.landing.tagline,
    lang: "mn",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: ground,
    theme_color: ground,
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
