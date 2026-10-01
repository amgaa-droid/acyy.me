import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { like } from "drizzle-orm";

import { dashboardStats } from "@/server/admin/stats";
import { getBalance, ledgerSum } from "@/server/wallet";
import { createTestDb } from "@/test/db";
import { demoUserCount, resetDemoActivity, rng, seedDemoActivity } from "./demo-activity";
import { previewViews, purchases, topups, user } from "./schema";
import type { AppDb } from "./types";

const NOW = new Date("2026-10-01T12:00:00Z");
const DAY = 24 * 3600_000;
let db: AppDb;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb({ withContent: true }));
}, 60_000);
afterAll(() => close());

describe("rng", () => {
  it("is deterministic per seed", () => {
    const a = rng(7);
    const b = rng(7);
    expect([a.next(), a.int(1, 6), a.pick(["x", "y"])]).toEqual([
      b.next(),
      b.int(1, 6),
      b.pick(["x", "y"]),
    ]);
  });
});

describe("seedDemoActivity", () => {
  it("creates spread-out activity through the real ledger", async () => {
    const s = await seedDemoActivity(db, { users: 20, days: 90, seed: 3, now: NOW });
    expect(s.users).toBe(20);
    expect(s.topups).toBeGreaterThan(0);
    expect(s.purchases).toBeGreaterThan(0);
    expect(s.previews).toBeGreaterThan(s.purchases);

    // Every demo wallet balance equals its ledger.
    const users = await db.select().from(user).where(like(user.email, "demo-%"));
    for (const u of users) expect(await ledgerSum(db, u.id)).toBe(await getBalance(db, u.id));

    // Everything happened inside the window, and before "now".
    const since = NOW.getTime() - 90 * DAY;
    const times = [
      ...(await db.select({ t: purchases.createdAt }).from(purchases)).map((r) => r.t),
      ...(await db.select({ t: topups.paidAt }).from(topups)).flatMap((r) => (r.t ? [r.t] : [])),
      ...(await db.select({ t: previewViews.firstViewedAt }).from(previewViews)).map((r) => r.t),
    ];
    for (const t of times) {
      expect(t.getTime()).toBeGreaterThanOrEqual(since);
      expect(t.getTime()).toBeLessThan(NOW.getTime());
    }
    // ...and is spread over the quarter, not bunched up today.
    const days = new Set(times.map((t) => Math.floor((NOW.getTime() - t.getTime()) / DAY)));
    expect(days.size).toBeGreaterThan(10);

    const stats = await dashboardStats(db, "90d", NOW);
    expect(stats.cur.topup.count).toBe(s.topups);
    expect(stats.cur.spend.count).toBe(s.purchases);
    expect(stats.cur.conversion.converted).toBeGreaterThan(0);
  }, 120_000);

  it("reset removes only the demo users", async () => {
    expect(await demoUserCount(db)).toBe(20);
    expect(await resetDemoActivity(db)).toBe(20);
    expect(await demoUserCount(db)).toBe(0);
    expect(await db.select().from(purchases)).toEqual([]);
    expect(await db.select().from(topups)).toEqual([]);
  });
});
