import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { purchases, topupPackages, topups } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { deleteAccount } from "@/server/account-deletion";
import { recordPreviewView } from "@/server/preview-views";
import { credit } from "@/server/wallet";
import { createTestDb, insertUser } from "@/test/db";
import { bucketsFor, change, dashboardStats, parseRange, rangeWindow, ratio } from "./stats";

const NOW = new Date("2026-10-01T12:00:00Z");
const ago = (hours: number) => new Date(NOW.getTime() - hours * 3600_000);
const snapshot = { persons: [], keys: {} };

let db: AppDb;
let close: () => Promise<void>;

describe("windows", () => {
  it("parses ranges, defaulting to 7 days", () => {
    expect(parseRange("30d")).toBe("30d");
    expect(parseRange("x")).toBe("7d");
    expect(parseRange(undefined)).toBe("7d");
  });

  it("uses rolling windows with an equally long previous window", () => {
    const w = rangeWindow("7d", NOW);
    expect(w.since.toISOString()).toBe("2026-09-24T12:00:00.000Z");
    expect(w.prevSince.toISOString()).toBe("2026-09-17T12:00:00.000Z");
    expect(rangeWindow("90d", NOW).since.toISOString()).toBe("2026-07-03T12:00:00.000Z");
  });

  it("buckets the last day by hour and longer ranges by day", () => {
    expect(bucketsFor("1d", NOW)).toMatchObject({ n: 24, size: 3600_000 });
    const month = bucketsFor("30d", NOW);
    expect(month.n).toBe(30);
    expect(month.starts[0].toISOString()).toBe("2026-09-01T12:00:00.000Z");
  });

  it("ratio/change return null when there is nothing to divide by", () => {
    expect(ratio(1, 0)).toBeNull();
    expect(ratio(1, 4)).toBe(0.25);
    expect(change(5, 0)).toBeNull();
    expect(change(15, 10)).toBe(0.5);
  });
});

describe("dashboardStats", () => {
  beforeAll(async () => {
    ({ db, close } = await createTestDb());
    const [a, b, c] = await Promise.all(
      ["a", "b", "c"].map((n) => insertUser(db, `${n}@stats.test`)),
    );
    const pkgs = await db.select().from(topupPackages);
    const pkg = (amount: number) => pkgs.find((p) => p.amount === amount)!.id;
    const paid = (userId: string, amount: number, bonus: number, hoursAgo: number) => ({
      userId,
      packageId: pkg(amount),
      amount,
      bonus,
      status: "paid" as const,
      provider: "mock",
      createdAt: ago(hoursAgo),
      paidAt: ago(hoursAgo),
    });
    await db.insert(topups).values([
      paid(a.id, 10_000, 1_000, 2), // last day
      paid(b.id, 5_000, 300, 30), // this week
      paid(b.id, 5_000, 300, 50), // this week
      paid(c.id, 2_000, 0, 24 * 10), // previous week → c is not a first-time payer this week
      { userId: c.id, amount: 20_000, bonus: 3_000, provider: "mock", createdAt: ago(5) }, // pending
    ]);
    const buy = (
      userId: string,
      productCode: string,
      price: number,
      hoursAgo: number,
      subject: string,
    ) => ({
      userId,
      productCode,
      pricePaid: price,
      subjectKey: subject,
      snapshot,
      createdAt: ago(hoursAgo),
    });
    await db
      .insert(purchases)
      .values([
        buy(a.id, "birthday", 2000, 1, "p1"),
        buy(a.id, "sign", 1000, 3, "p1"),
        buy(b.id, "birthday", 2000, 40, "p2"),
      ]);
    // Previews: a saw birthday/p1 (bought) and love/p1 (not); b saw birthday/p2 (bought) and
    // birthday/p3 (not); c saw sign/p4 two weeks ago (outside the window).
    await recordPreviewView(
      db,
      { userId: a.id, productCode: "birthday", subjectKey: "p1" },
      ago(1.5),
    );
    await recordPreviewView(
      db,
      { userId: a.id, productCode: "birthday", subjectKey: "p1" },
      ago(1.2),
    );
    await recordPreviewView(db, { userId: a.id, productCode: "love", subjectKey: "p1" }, ago(4));
    await recordPreviewView(
      db,
      { userId: b.id, productCode: "birthday", subjectKey: "p2" },
      ago(41),
    );
    await recordPreviewView(
      db,
      { userId: b.id, productCode: "birthday", subjectKey: "p3" },
      ago(42),
    );
    await recordPreviewView(
      db,
      { userId: c.id, productCode: "sign", subjectKey: "p4" },
      ago(24 * 14),
    );
  });
  afterAll(() => close());

  it("sums paid top-ups in the window, by package", async () => {
    const s = await dashboardStats(db, "7d", NOW);
    expect(s.cur.topup).toMatchObject({
      revenue: 20_000,
      bonus: 1_600,
      count: 3,
      payers: 2,
      firstTimePayers: 2,
      invoicesCreated: 4,
      invoicesPaid: 3,
    });
    expect(s.cur.topup.byPackage).toEqual([
      { amount: 10_000, bonus: 1_000, count: 1, revenue: 10_000 },
      { amount: 5_000, bonus: 300, count: 2, revenue: 10_000 },
    ]);
    expect(s.prev.topup).toMatchObject({ revenue: 2_000, count: 1, firstTimePayers: 1 });
  });

  it("splits package rows by the terms sold, not by the package's current terms", async () => {
    // Same 5,000₮ package, sold earlier with a 500₮ promo bonus.
    const [p] = await db.select().from(topupPackages);
    await db.insert(topups).values({
      userId: (await insertUser(db, "promo@stats.test")).id,
      packageId: p.id,
      amount: 5_000,
      bonus: 500,
      status: "paid",
      provider: "mock",
      createdAt: ago(24 * 50),
      paidAt: ago(24 * 50),
    });
    const s = await dashboardStats(db, "90d", NOW);
    const fives = s.cur.topup.byPackage.filter((r) => r.amount === 5_000);
    expect(fives).toEqual([
      { amount: 5_000, bonus: 300, count: 2, revenue: 10_000 },
      { amount: 5_000, bonus: 500, count: 1, revenue: 5_000 },
    ]);
  });

  it("narrows to the last day", async () => {
    const s = await dashboardStats(db, "1d", NOW);
    expect(s.cur.topup.revenue).toBe(10_000);
    expect(s.cur.spend).toMatchObject({ spent: 3000, count: 2, buyers: 1, repeatBuyers: 1 });
    expect(s.chart).toHaveLength(24);
    expect(s.chart.reduce((n, b) => n + b.revenue, 0)).toBe(10_000);
    expect(s.chart.at(-2)!.revenue).toBe(10_000); // paid 2 h ago → second-to-last hour
  });

  it("sums spending by product", async () => {
    const s = await dashboardStats(db, "7d", NOW);
    expect(s.cur.spend).toMatchObject({ spent: 5000, count: 3, buyers: 2 });
    const birthday = s.cur.spend.byProduct.find((r) => r.productCode === "birthday")!;
    expect(birthday).toMatchObject({ count: 2, spent: 4000, buyers: 2 });
    expect(s.chart.reduce((n, b) => n + b.spent, 0)).toBe(5000);
  });

  it("measures free preview → purchase conversion", async () => {
    const s = await dashboardStats(db, "7d", NOW);
    expect(s.cur.conversion).toMatchObject({ views: 4, converted: 2, viewers: 2, buyers: 2 });
    const birthday = s.cur.conversion.byProduct.find((r) => r.productCode === "birthday")!;
    expect(birthday).toMatchObject({ views: 3, converted: 2 });
    expect(s.prev.conversion.views).toBe(1);
  });

  it("reports unspent wallet money, leaving out deleted accounts", async () => {
    const s = await dashboardStats(db, "7d", NOW);
    expect(s.liability).toEqual({ total: 0, holders: 0 }); // top-ups inserted directly, no ledger

    const [kept, gone] = await Promise.all(
      ["kept", "gone"].map((n) => insertUser(db, `${n}@liability.test`)),
    );
    await credit(db, "topup", { userId: kept.id, amount: 3000, idempotencyKey: `liab-${kept.id}` });
    await credit(db, "topup", { userId: gone.id, amount: 5000, idempotencyKey: `liab-${gone.id}` });
    await deleteAccount(db, gone.id);
    expect((await dashboardStats(db, "7d", NOW)).liability).toEqual({ total: 3000, holders: 1 });
  });
});
