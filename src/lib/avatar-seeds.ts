/** 30 predefined avatar seeds (SPEC §2.3). Rendered locally — no external API. */
export const AVATAR_SEEDS = [
  "Aster",
  "Birch",
  "Cedar",
  "Dune",
  "Ember",
  "Fern",
  "Grove",
  "Haze",
  "Iris",
  "Juniper",
  "Kestrel",
  "Lark",
  "Moss",
  "Nova",
  "Onyx",
  "Pine",
  "Quill",
  "Rain",
  "Sage",
  "Tide",
  "Umber",
  "Vale",
  "Willow",
  "Yarrow",
  "Zephyr",
  "Ash",
  "Brook",
  "Clove",
  "Dawn",
  "Echo",
] as const;

export type AvatarSeed = (typeof AVATAR_SEEDS)[number];

export function isAvatarSeed(value: string): value is AvatarSeed {
  return (AVATAR_SEEDS as readonly string[]).includes(value);
}
