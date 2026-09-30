import { createHmac, timingSafeEqual } from "node:crypto";

/** HMAC-SHA256(topupId) for the callback URL (SPEC §4.3). */
export function signTopup(topupId: string, secret: string): string {
  return createHmac("sha256", secret).update(topupId).digest("hex");
}

export function verifyTopupSignature(topupId: string, sig: string, secret: string): boolean {
  const expected = Buffer.from(signTopup(topupId, secret), "hex");
  const given = Buffer.from(/^[0-9a-f]{64}$/i.test(sig) ? sig : "", "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
