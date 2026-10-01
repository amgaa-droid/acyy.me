import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { auditLogs, topupPackages, topups } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { MockQPayProvider } from "@/server/qpay/mock";
import { createTestDb, insertUser, offerFor } from "@/test/db";
import {
  PackageError,
  bestValueIndex,
  createPackage,
  deletePackage,
  listActivePackages,
  listPackages,
  updatePackage,
} from "./topup-packages";
import { InvalidTierError, PackageChangedError, createTopup } from "./topups";

let db: AppDb;
let close: () => Promise<void>;
let actor: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  actor = (await insertUser(db, "owner@pkg.test")).id;
});
afterAll(() => close());

/** A top-up from the sheet as the user saw the package with this price (or `seen` terms). */
const topup = async (userId: string, amount: number, seen?: { bonus: number }) =>
  createTopup(db, new MockQPayProvider("http://localhost:3000"), {
    userId,
    offer: { ...(await offerFor(db, amount)), ...seen },
    appUrl: "http://localhost:3000",
    callbackSecret: "x".repeat(64),
    description: "test",
  });

describe("topup packages", () => {
  it("are seeded by the migration with the SPEC §4.1 tiers", async () => {
    const rows = await listActivePackages(db);
    expect(rows.map((r) => [r.amount, r.bonus])).toEqual([
      [2000, 0],
      [5000, 300],
      [10000, 1000],
      [20000, 3000],
    ]);
  });

  it("picks the best bonus ratio", () => {
    expect(
      bestValueIndex([
        { amount: 2000, bonus: 0 },
        { amount: 20000, bonus: 3000 },
      ]),
    ).toBe(1);
    expect(bestValueIndex([{ amount: 2000, bonus: 0 }])).toBe(-1);
  });

  it("creates, validates and audits", async () => {
    const p = await createPackage(db, actor, { amount: 50_000, bonus: 10_000, sort: 5 });
    expect(p).toMatchObject({ amount: 50_000, bonus: 10_000, isActive: true });
    await expect(createPackage(db, actor, { amount: 50_000, bonus: 0 })).rejects.toMatchObject({
      code: "amount_taken",
    });
    await expect(createPackage(db, actor, { amount: 1.5, bonus: 0 })).rejects.toBeInstanceOf(
      ZodError,
    );
    await expect(createPackage(db, actor, { amount: 3000, bonus: -1 })).rejects.toBeInstanceOf(
      ZodError,
    );
    const log = await db.select().from(auditLogs).where(eq(auditLogs.entityId, p.id));
    expect(log.map((l) => l.action)).toEqual(["topup_package.create"]);
  });

  it("top-ups only accept active packages and remember which one", async () => {
    const user = (await insertUser(db, "buyer@pkg.test")).id;
    const p = await createPackage(db, actor, { amount: 7_000, bonus: 700 });
    const t = await topup(user, 7_000);
    expect(t).toMatchObject({ packageId: p.id, amount: 7_000, bonus: 700 });

    await updatePackage(db, actor, { id: p.id, amount: 7_000, bonus: 700, isActive: false });
    await expect(topup(user, 7_000)).rejects.toBeInstanceOf(InvalidTierError);
    expect((await listActivePackages(db)).some((x) => x.id === p.id)).toBe(false);
    expect((await listPackages(db)).some((x) => x.id === p.id)).toBe(true);

    // Bought once → can't be deleted (history keeps pointing at it).
    await expect(deletePackage(db, actor, p.id)).rejects.toMatchObject({ code: "has_topups" });
  });

  it("editing a package doesn't rewrite past top-ups; a sold package keeps its price", async () => {
    const user = (await insertUser(db, "hist@pkg.test")).id;
    const p = await createPackage(db, actor, { amount: 8_000, bonus: 0 });
    const t = await topup(user, 8_000);

    // Bonus may change (promotion); the earlier top-up keeps its terms.
    await updatePackage(db, actor, { id: p.id, amount: 8_000, bonus: 2_000, isActive: true });
    const [again] = await db.select().from(topups).where(eq(topups.id, t.id));
    expect(again).toMatchObject({ amount: 8_000, bonus: 0 });

    // Price is locked once sold (even while the top-up is still pending).
    await expect(
      updatePackage(db, actor, { id: p.id, amount: 9_000, bonus: 2_000, isActive: true }),
    ).rejects.toMatchObject({ code: "amount_locked" });

    // An unsold package's price can still be fixed.
    const q = await createPackage(db, actor, { amount: 4_000, bonus: 0 });
    await updatePackage(db, actor, { id: q.id, amount: 4_500, bonus: 0, isActive: true });
    await expect(
      updatePackage(db, actor, { id: q.id, amount: 5_000, bonus: 0, isActive: true }),
    ).rejects.toMatchObject({ code: "amount_taken" });
  });

  it("refuses a top-up whose package changed after the user saw it", async () => {
    const user = (await insertUser(db, "stale@pkg.test")).id;
    const p = await createPackage(db, actor, { amount: 12_000, bonus: 1_500 });
    const seen = { bonus: 1_500 };
    await updatePackage(db, actor, { id: p.id, amount: 12_000, bonus: 1_000, isActive: true });

    await expect(topup(user, 12_000, seen)).rejects.toBeInstanceOf(PackageChangedError);
    expect(await db.select().from(topups).where(eq(topups.userId, user))).toEqual([]);

    // With the fresh terms it goes through, at those terms.
    expect(await topup(user, 12_000)).toMatchObject({ packageId: p.id, bonus: 1_000 });
  });

  it("deletes unused packages", async () => {
    const p = await createPackage(db, actor, { amount: 99_000, bonus: 0 });
    await deletePackage(db, actor, p.id);
    expect(await db.select().from(topupPackages).where(eq(topupPackages.id, p.id))).toEqual([]);
    await expect(deletePackage(db, actor, p.id)).rejects.toBeInstanceOf(PackageError);
    await expect(deletePackage(db, actor, "nope")).rejects.toMatchObject({ code: "not_found" });
  });
});
