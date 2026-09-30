import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";

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
