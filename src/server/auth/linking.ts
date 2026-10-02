/**
 * Facebook doesn't vouch for the emails it returns, yet it is a trusted provider so a signed-in
 * user can link it from /me. A Facebook sign-in must therefore never attach itself to an existing
 * verified account just because the address matches (that would hand the account — and an admin
 * role — to whoever put the address on a Facebook profile): only the account's own signed-in
 * user may link it.
 */

/** A brand-new user row and its first account are written within the same request. */
const SIGN_UP_WINDOW_MS = 10_000;

export function mayAttachFacebook(opts: {
  /** The user the Facebook account would be attached to; null = not stored yet (a sign-up). */
  owner: { id: string; emailVerified: boolean; createdAt: Date } | null;
  /** The user signed in on this request, if any. */
  sessionUserId: string | null;
  now?: Date;
}): boolean {
  const { owner, sessionUserId, now = new Date() } = opts;
  if (!owner || !owner.emailVerified) return true; // sign-up, or a row Better Auth won't link into
  if (now.getTime() - owner.createdAt.getTime() < SIGN_UP_WINDOW_MS) return true; // sign-up
  return sessionUserId === owner.id;
}
