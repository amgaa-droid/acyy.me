import { describe, expect, it } from "vitest";

import { SecretBoxError, openSecret, sealSecret } from "./secret-box";

const KEY = "a".repeat(64);

describe("secret box", () => {
  it("round-trips and never contains the plain text", () => {
    const sealed = sealSecret("sk-test-1234", KEY);
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain("sk-test");
    expect(openSecret(sealed, KEY)).toBe("sk-test-1234");
  });

  it("uses a fresh IV every time", () => {
    expect(sealSecret("same", KEY)).not.toBe(sealSecret("same", KEY));
  });

  it("rejects another key, tampering and garbage", () => {
    const sealed = sealSecret("secret", KEY);
    expect(() => openSecret(sealed, "b".repeat(64))).toThrow(SecretBoxError);
    const parts = sealed.split(".");
    parts[3] = Buffer.from("other").toString("base64url");
    expect(() => openSecret(parts.join("."), KEY)).toThrow(SecretBoxError);
    expect(() => openSecret("nope", KEY)).toThrow(SecretBoxError);
  });

  it("needs a key", () => {
    expect(() => sealSecret("x", undefined)).toThrow(new SecretBoxError("no_key"));
  });
});
