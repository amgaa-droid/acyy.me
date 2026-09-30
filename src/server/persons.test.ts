import { beforeAll, afterAll, describe, expect, it } from "vitest";

import { createTestDb, insertUser } from "@/test/db";
import type { AppDb } from "@/server/db/types";
import {
  CannotDeleteSelfError,
  PersonNotFoundError,
  SelfAlreadyExistsError,
  SelfRelationError,
  createPerson,
  createSelf,
  deletePerson,
  getPerson,
  getSelf,
  listPeople,
  updatePerson,
} from "./persons";

let db: AppDb;
let close: () => Promise<void>;
let seq = 0;
const newUser = () => insertUser(db, `u${++seq}@test.local`);

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(() => close());

const self = { name: "  Анар ", birthDate: "1995-10-30", avatarSeed: "Nova" };
const mom = {
  name: "Сарангэрэл",
  birthDate: "1968-01-04",
  avatarSeed: "Iris",
  relation: "mother" as const,
};

describe("createSelf", () => {
  it("creates exactly one self person, trimming the name", async () => {
    const u = await newUser();
    const s = await createSelf(db, u.id, self);
    expect(s).toMatchObject({
      name: "Анар",
      isSelf: true,
      relation: "self",
      gender: "unspecified",
    });
    expect((await getSelf(db, u.id))?.id).toBe(s.id);
    await expect(createSelf(db, u.id, self)).rejects.toBeInstanceOf(SelfAlreadyExistsError);
  });

  it("rejects invalid input", async () => {
    const u = await newUser();
    await expect(createSelf(db, u.id, { ...self, name: "" })).rejects.toThrow();
    await expect(createSelf(db, u.id, { ...self, name: "x".repeat(41) })).rejects.toThrow();
    await expect(createSelf(db, u.id, { ...self, birthDate: "2999-01-01" })).rejects.toThrow();
    await expect(createSelf(db, u.id, { ...self, birthDate: "1899-12-31" })).rejects.toThrow();
    await expect(createSelf(db, u.id, { ...self, avatarSeed: "evil" })).rejects.toThrow();
    expect(await getSelf(db, u.id)).toBeNull();
  });
});

describe("createPerson", () => {
  it("adds a relative and lists self first", async () => {
    const u = await newUser();
    await createSelf(db, u.id, self);
    const m = await createPerson(db, u.id, mom);
    expect(m).toMatchObject({ isSelf: false, relation: "mother", relationLabel: null });
    const list = await listPeople(db, u.id);
    expect(list.map((p) => p.relation)).toEqual(["self", "mother"]);
  });

  it("requires a label for 'other' and drops it for other relations", async () => {
    const u = await newUser();
    await expect(createPerson(db, u.id, { ...mom, relation: "other" })).rejects.toThrow();
    const o = await createPerson(db, u.id, { ...mom, relation: "other", relationLabel: " Багш " });
    expect(o.relationLabel).toBe("Багш");
    const f = await createPerson(db, u.id, { ...mom, relation: "friend", relationLabel: "x" });
    expect(f.relationLabel).toBeNull();
    await expect(
      createPerson(db, u.id, { ...mom, relation: "other", relationLabel: "x".repeat(21) }),
    ).rejects.toThrow();
  });

  it("cannot create a second 'self' through createPerson", async () => {
    const u = await newUser();
    // @ts-expect-error — "self" is not an allowed relation here
    await expect(createPerson(db, u.id, { ...mom, relation: "self" })).rejects.toThrow();
  });
});

describe("ownership", () => {
  it("another user's person is not found for read, update or delete", async () => {
    const owner = await newUser();
    const intruder = await newUser();
    const m = await createPerson(db, owner.id, mom);

    await expect(getPerson(db, intruder.id, m.id)).rejects.toBeInstanceOf(PersonNotFoundError);
    await expect(updatePerson(db, intruder.id, m.id, { name: "Hacked" })).rejects.toBeInstanceOf(
      PersonNotFoundError,
    );
    await expect(deletePerson(db, intruder.id, m.id)).rejects.toBeInstanceOf(PersonNotFoundError);

    const still = await getPerson(db, owner.id, m.id);
    expect(still.name).toBe("Сарангэрэл");
    expect(still.deletedAt).toBeNull();
    expect(await listPeople(db, intruder.id)).toHaveLength(0);
  });

  it("malformed ids are just 'not found'", async () => {
    const u = await newUser();
    await expect(getPerson(db, u.id, "not-a-uuid")).rejects.toBeInstanceOf(PersonNotFoundError);
    await expect(getPerson(db, u.id, "'; drop table persons; --")).rejects.toBeInstanceOf(
      PersonNotFoundError,
    );
  });
});

describe("updatePerson", () => {
  it("changes name, gender, avatar and relation", async () => {
    const u = await newUser();
    const m = await createPerson(db, u.id, mom);
    const up = await updatePerson(db, u.id, m.id, {
      name: " Ээжээ ",
      gender: "female",
      avatarSeed: "Sage",
      relation: "other",
      relationLabel: "Хадам ээж",
    });
    expect(up).toMatchObject({
      name: "Ээжээ",
      gender: "female",
      avatarSeed: "Sage",
      relation: "other",
      relationLabel: "Хадам ээж",
      birthDate: "1968-01-04",
    });
    const back = await updatePerson(db, u.id, m.id, { relation: "mother" });
    expect(back.relationLabel).toBeNull();
  });

  it("rejects any attempt to change the birth date and leaves the row untouched", async () => {
    const u = await newUser();
    const m = await createPerson(db, u.id, mom);
    for (const key of ["birthDate", "birth_date"]) {
      await expect(
        updatePerson(db, u.id, m.id, { name: "X", [key]: "2000-01-01" } as never),
      ).rejects.toThrow();
    }
    const after = await getPerson(db, u.id, m.id);
    expect(after.birthDate).toBe("1968-01-04");
    expect(after.name).toBe("Сарангэрэл");
  });

  it("'Би' can be renamed but its relation is fixed", async () => {
    const u = await newUser();
    const s = await createSelf(db, u.id, self);
    expect((await updatePerson(db, u.id, s.id, { name: "Анараа" })).name).toBe("Анараа");
    await expect(updatePerson(db, u.id, s.id, { relation: "friend" })).rejects.toBeInstanceOf(
      SelfRelationError,
    );
  });

  it("switching to 'other' without a label is rejected", async () => {
    const u = await newUser();
    const m = await createPerson(db, u.id, mom);
    await expect(updatePerson(db, u.id, m.id, { relation: "other" })).rejects.toThrow();
  });
});

describe("deletePerson", () => {
  it("soft-deletes: hidden from list and lookups, row kept", async () => {
    const u = await newUser();
    await createSelf(db, u.id, self);
    const m = await createPerson(db, u.id, mom);
    await deletePerson(db, u.id, m.id);
    expect((await listPeople(db, u.id)).map((p) => p.id)).not.toContain(m.id);
    await expect(getPerson(db, u.id, m.id)).rejects.toBeInstanceOf(PersonNotFoundError);
    await expect(updatePerson(db, u.id, m.id, { name: "x" })).rejects.toBeInstanceOf(
      PersonNotFoundError,
    );
    await expect(deletePerson(db, u.id, m.id)).rejects.toBeInstanceOf(PersonNotFoundError);
  });

  it("'Би' cannot be deleted", async () => {
    const u = await newUser();
    const s = await createSelf(db, u.id, self);
    await expect(deletePerson(db, u.id, s.id)).rejects.toBeInstanceOf(CannotDeleteSelfError);
  });
});
