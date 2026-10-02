import { describe, expect, it } from "vitest";

import { mayAttachFacebook } from "./linking";

const now = new Date("2026-10-03T00:00:00Z");
const old = new Date("2026-09-01T00:00:00Z");
const owner = { id: "u1", emailVerified: true, createdAt: old };

describe("mayAttachFacebook", () => {
  it("refuses a Facebook sign-in that would join an existing verified account", () => {
    expect(mayAttachFacebook({ owner, sessionUserId: null, now })).toBe(false);
  });

  it("refuses it for someone signed in as another user", () => {
    expect(mayAttachFacebook({ owner, sessionUserId: "u2", now })).toBe(false);
  });

  it("lets the account's own signed-in user link Facebook", () => {
    expect(mayAttachFacebook({ owner, sessionUserId: "u1", now })).toBe(true);
  });

  it("lets a new Facebook sign-up through", () => {
    expect(mayAttachFacebook({ owner: null, sessionUserId: null, now })).toBe(true);
    expect(
      mayAttachFacebook({ owner: { ...owner, emailVerified: false }, sessionUserId: null, now }),
    ).toBe(true);
    const justCreated = { ...owner, createdAt: new Date(now.getTime() - 500) };
    expect(mayAttachFacebook({ owner: justCreated, sessionUserId: null, now })).toBe(true);
  });
});
