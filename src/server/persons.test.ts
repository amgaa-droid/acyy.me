import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDb, insertUser } from "@/test/db";
import type { AppDb } from "@/server/db/types";
import { SelfAlreadyExistsError, createSelf, getSelf } from "./persons";

let db: AppDb;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(() => close());

const valid = { name: "  Анар ", birthDate: "1995-10-30", avatarSeed: "Nova" };

describe("createSelf", () => {
  it("creates exactly one self person, trimming the name", async () => {
    const u = await insertUser(db, "a@test.local");
    const self = await createSelf(db, u.id, valid);
    expect(self).toMatchObject({
      name: "Анар",
      isSelf: true,
      relation: "self",
      gender: "unspecified",
    });
    expect((await getSelf(db, u.id))?.id).toBe(self.id);
    await expect(createSelf(db, u.id, valid)).rejects.toBeInstanceOf(SelfAlreadyExistsError);
  });

  it("keeps users' selves separate", async () => {
    const u1 = await insertUser(db, "b@test.local");
    const u2 = await insertUser(db, "c@test.local");
    await createSelf(db, u1.id, valid);
    expect(await getSelf(db, u2.id)).toBeNull();
  });

  it("rejects invalid input", async () => {
    const u = await insertUser(db, "d@test.local");
    await expect(createSelf(db, u.id, { ...valid, name: "" })).rejects.toThrow();
    await expect(createSelf(db, u.id, { ...valid, name: "x".repeat(41) })).rejects.toThrow();
    await expect(createSelf(db, u.id, { ...valid, birthDate: "2999-01-01" })).rejects.toThrow();
    await expect(createSelf(db, u.id, { ...valid, birthDate: "1899-12-31" })).rejects.toThrow();
    await expect(createSelf(db, u.id, { ...valid, avatarSeed: "evil" })).rejects.toThrow();
    expect(await getSelf(db, u.id)).toBeNull();
  });
});
