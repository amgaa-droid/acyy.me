import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";

import { AVATAR_SEEDS, isAvatarSeed, type AvatarSeed } from "./avatar-seeds";

export { AVATAR_SEEDS, isAvatarSeed, type AvatarSeed } from "./avatar-seeds";

/** Bump when the DiceBear style or options change, so browsers drop their year-long copies. */
const AVATAR_VERSION = 1;

/**
 * The pickable seed to draw for any stored seed. Avatars are always one of the 30 pickable ones;
 * the odd other value (a deleted person's reading falls back to their name) maps to one of them
 * by a stable hash — so no name ever ends up in an image URL.
 */
export function avatarSeedFor(seed: string): AvatarSeed {
  if (isAvatarSeed(seed)) return seed;
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return AVATAR_SEEDS[h % AVATAR_SEEDS.length];
}

/**
 * Image URL of a seed's avatar (src/app/api/avatar/[seed]/route.ts). Pages carry this short link
 * instead of the 15–90 KB SVG itself, and browsers cache the image for a year.
 */
export function avatarUrl(seed: string): string {
  return `/api/avatar/${avatarSeedFor(seed)}?v=${AVATAR_VERSION}`;
}

const svgCache = new Map<string, string>();

/** The SVG of a pickable seed (black line art on transparent), rendered once per process. */
export function avatarSvg(seed: AvatarSeed): string {
  let svg = svgCache.get(seed);
  if (!svg) {
    svg = createAvatar(notionists, { seed }).toString();
    svgCache.set(seed, svg);
  }
  return svg;
}

/** All selectable avatars (call on the server, pass to client pickers). */
export function avatarOptions(): { seed: string; uri: string }[] {
  return AVATAR_SEEDS.map((seed) => ({ seed, uri: avatarUrl(seed) }));
}

/** Base64 SVG data URI — for next/og share cards, which can't load URLs or utf8 URIs. */
export function avatarBase64Uri(seed: string): string {
  const svg = avatarSvg(avatarSeedFor(seed));
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
