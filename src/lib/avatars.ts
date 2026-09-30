import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";

import { AVATAR_SEEDS } from "./avatar-seeds";

export { AVATAR_SEEDS, isAvatarSeed, type AvatarSeed } from "./avatar-seeds";

const cache = new Map<string, string>();

/** SVG data URI for a seed. Black line art on transparent background. */
export function avatarDataUri(seed: string): string {
  let uri = cache.get(seed);
  if (!uri) {
    uri = createAvatar(notionists, { seed }).toDataUri();
    cache.set(seed, uri);
  }
  return uri;
}

/** All selectable avatars, pre-rendered (call on the server, pass to client pickers). */
export function avatarOptions(): { seed: string; uri: string }[] {
  return AVATAR_SEEDS.map((seed) => ({ seed, uri: avatarDataUri(seed) }));
}

/** Base64 SVG data URI — for next/og share cards, which can't read DiceBear's utf8 URIs. */
export function avatarBase64Uri(seed: string): string {
  const svg = createAvatar(notionists, { seed }).toString();
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
