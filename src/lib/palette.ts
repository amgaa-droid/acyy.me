/**
 * The cosmic palette (light) as plain hex — for what CSS variables can't reach: the share-card
 * image, e-mails, the app icon. The values are the `cosmic` tokens of globals.css;
 * theme-tokens.test.ts keeps the two the same.
 */
export const COSMIC = {
  bg: "#f5f1eb",
  surface: "#ffffff",
  fg: "#1d1b3f",
  muted: "#666379",
  highlight: "#4a44b5",
  "tint-1": "#e6e3fb",
  "tint-2": "#f9e0db",
  "ring-2": "#c4533f",
} as const;
