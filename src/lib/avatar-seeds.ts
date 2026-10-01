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

export type AvatarGender = "female" | "male";

/**
 * How each seed's drawing reads (checked by eye against the rendered notionists art):
 * long hair, buns and ponytails → female; two ambiguous ones fit either.
 */
const FEMALE_SEEDS: readonly AvatarSeed[] = ["Cedar", "Fern", "Lark", "Nova", "Umber", "Zephyr", "Clove"];
const NEUTRAL_SEEDS: readonly AvatarSeed[] = ["Quill", "Dawn"];

export function avatarGender(seed: AvatarSeed): AvatarGender | "neutral" {
  if (FEMALE_SEEDS.includes(seed)) return "female";
  if (NEUTRAL_SEEDS.includes(seed)) return "neutral";
  return "male";
}

/** Indexes into AVATAR_SEEDS that suit a gender: that gender's seeds, then the neutral ones. */
export function avatarIndexesFor(gender: AvatarGender): number[] {
  const own = AVATAR_SEEDS.flatMap((s, i) => (avatarGender(s) === gender ? [i] : []));
  const neutral = AVATAR_SEEDS.flatMap((s, i) => (avatarGender(s) === "neutral" ? [i] : []));
  return [...own, ...neutral];
}

export function avatarFits(index: number, gender: AvatarGender): boolean {
  const seed = AVATAR_SEEDS[index];
  return seed !== undefined && [gender, "neutral"].includes(avatarGender(seed));
}
