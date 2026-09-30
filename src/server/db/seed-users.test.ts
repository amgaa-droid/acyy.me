import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ageOn, parseIsoDate } from "@/lib/birth-date";
import { createTestDb } from "@/test/db";
import { persons, user } from "./schema";
import { seedTestUsers, testAccounts } from "./seed-users";
import type { AppDb } from "./types";

const today = { y: 2026, m: 9, d: 30 };
let db: AppDb;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(() => close());

describe("seedTestUsers", () => {
  it("creates the 4 accounts once, each with exactly one self", async () => {
    expect(await seedTestUsers(db, "test-password", today)).toHaveLength(4);
    expect(await seedTestUsers(db, "test-password", today)).toHaveLength(0);

    const [u] = await db.select().from(user).where(eq(user.email, "user@test.local"));
    const people = await db.select().from(persons).where(eq(persons.ownerUserId, u.id));
    expect(people).toHaveLength(4);
    expect(people.filter((p) => p.isSelf)).toHaveLength(1);
  });

  it("minor@test.local is 16", () => {
    const minor = testAccounts(today).find((a) => a.email === "minor@test.local")!;
    expect(ageOn(parseIsoDate(minor.people[0].birthDate)!, today)).toBe(16);
  });
});
