import { describe, expect, it } from "vitest";

import {
  canManageContent,
  canManageMoney,
  getAdminRole,
  getUserAdminRole,
  parseEmailList,
} from "./roles";

const lists = { owners: "Owner@Test.local, boss@x.mn", editors: "editor@test.local,," };

describe("admin roles", () => {
  it("parses comma-separated lists, trimming and lower-casing", () => {
    expect([...parseEmailList(" A@x.mn ,b@x.mn,, ")]).toEqual(["a@x.mn", "b@x.mn"]);
    expect(parseEmailList(undefined).size).toBe(0);
  });

  it("resolves owner before editor, case-insensitively", () => {
    expect(getAdminRole("owner@test.local", lists)).toBe("owner");
    expect(getAdminRole("EDITOR@test.local", lists)).toBe("editor");
    expect(getAdminRole("user@test.local", lists)).toBeNull();
    expect(getAdminRole(null, lists)).toBeNull();
  });

  it("gives a role only to a verified email", () => {
    const owner = { email: "owner@test.local", emailVerified: true };
    expect(getUserAdminRole(owner, lists)).toBe("owner");
    expect(getUserAdminRole({ ...owner, emailVerified: false }, lists)).toBeNull();
    expect(getUserAdminRole(null, lists)).toBeNull();
  });

  it("owner-only money, owner+editor content", () => {
    expect(canManageMoney("owner")).toBe(true);
    expect(canManageMoney("editor")).toBe(false);
    expect(canManageContent("editor")).toBe(true);
    expect(canManageContent(null)).toBe(false);
  });
});
