import net from "node:net";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSelf } from "@/server/persons";
import { adjust, credit, getBalance } from "@/server/wallet";
import { createTestDb, insertUser } from "@/test/db";
import { cleanE2eUsers, e2eUserIds, isPglite, portInUse } from "./dev-cleanup";
import { persons, topups, user, walletEntries } from "./schema";
import type { AppDb } from "./types";

let db: AppDb;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(() => close());

const self = (name: string) => ({ name, birthDate: "1990-05-05", avatarSeed: "Aster" });

describe("cleanE2eUsers", () => {
  it("removes only E2E sign-ups and everything they own", async () => {
    const owner = await insertUser(db, "owner@test.local");
    const keepUser = await insertUser(db, "user@test.local");
    const real = await insertUser(db, "someone@gmail.com");
    const e2e = await insertUser(db, "people-1790000000000-42@test.local");
    const e2e2 = await insertUser(db, "e2e-chromium-1790000000001@test.local");

    for (const u of [keepUser, real, e2e, e2e2]) await createSelf(db, u.id, self(u.name));
    await credit(db, "topup", { userId: e2e.id, amount: 5000, idempotencyKey: "k1" });
    await db
      .insert(topups)
      .values({ userId: e2e.id, amount: 5000, provider: "mock", status: "paid" });
    // An E2E admin adjusting a kept user's wallet: the kept entry stays, its author is cleared.
    await adjust(db, {
      userId: keepUser.id,
      amount: 1000,
      reason: "e2e adjust",
      idempotencyKey: "k2",
      createdBy: e2e2.id,
    });

    expect((await e2eUserIds(db)).sort()).toEqual([e2e.id, e2e2.id].sort());
    expect(await cleanE2eUsers(db)).toBe(2);

    const left = (await db.select({ email: user.email }).from(user)).map((u) => u.email).sort();
    expect(left).toEqual(["owner@test.local", "someone@gmail.com", "user@test.local"]);
    expect(await db.select().from(persons).where(eq(persons.ownerUserId, e2e.id))).toEqual([]);
    expect(await db.select().from(topups)).toEqual([]);
    expect(await getBalance(db, keepUser.id)).toBe(1000);
    const [entry] = await db
      .select()
      .from(walletEntries)
      .where(eq(walletEntries.userId, keepUser.id));
    expect(entry.createdBy).toBeNull();
    expect(owner.id).toBeTruthy();
  });

  it("is a no-op when there is nothing to clean", async () => {
    expect(await cleanE2eUsers(db)).toBe(0);
  });

  it("detects a listening port without needing an HTTP answer", async () => {
    const server = net.createServer(); // accepts, never responds
    await new Promise<void>((r) => server.listen(0, "localhost", r));
    const { port } = server.address() as net.AddressInfo;
    expect(await portInUse(port)).toBe(true);
    await new Promise((r) => server.close(r));
    expect(await portInUse(port)).toBe(false);
  });

  it("recognises PGlite", async () => {
    expect(await isPglite(db)).toBe(true);
  });
});
