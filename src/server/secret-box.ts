import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Seals small secrets (API keys saved on /admin/ai) with AES-256-GCM before they go into the
 * database. The key is SHA-256 of SETTINGS_ENCRYPTION_KEY, so any long random string works.
 * Format: `v1.<iv>.<tag>.<ciphertext>` (base64url).
 */

const VERSION = "v1";

export class SecretBoxError extends Error {
  constructor(readonly code: "no_key" | "corrupt") {
    super(code);
  }
}

function keyOf(secret: string | undefined): Buffer {
  if (!secret) throw new SecretBoxError("no_key");
  return createHash("sha256").update(secret).digest();
}

export function sealSecret(plain: string, secret: string | undefined): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyOf(secret), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), body]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(".");
}

/** Throws `corrupt` if the text was tampered with or sealed with another key. */
export function openSecret(sealed: string, secret: string | undefined): string {
  const key = keyOf(secret);
  const [version, iv, tag, body] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || body === undefined) {
    throw new SecretBoxError("corrupt");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(body, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new SecretBoxError("corrupt");
  }
}
