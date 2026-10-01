import { and, count, countDistinct, eq, gte, isNull, lt, sql, sum } from "drizzle-orm";

import type { AppDb } from "@/server/db/types";
import { previewViews, purchases, topupPackages, topups, user, wallets } from "@/server/db/schema";

/**
 * Admin dashboard numbers (/admin). All windows are rolling ("last 7 days" = now − 7×24 h) and
 * every figure is compared with the window just before it.
 * - Top-ups: money actually received (paid QPay invoices, by `paid_at`) — the revenue.
 * - Spending: wallet → readings (`purchases`, by `created_at`).
 * - Conversion: free paywall previews (`preview_views`, first view in the window) that became
 *   a purchase of the same product for the same person(s), at any time since.
 */

export const RANGES = ["1d", "7d", "30d", "90d"] as const;
export type Range = (typeof RANGES)[number];
const RANGE_DAYS: Record<Range, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };
const DAY_MS = 24 * 3600_000;

export function parseRange(v: unknown): Range {
  return RANGES.includes(v as Range) ? (v as Range) : "7d";
}

export function rangeWindow(range: Range, now = new Date()) {
  const len = RANGE_DAYS[range] * DAY_MS;
  const since = new Date(now.getTime() - len);
  return { since, until: now, prevSince: new Date(since.getTime() - len) };
}

/** Chart buckets: hourly for the last day, daily otherwise — aligned to `until`. */
export function bucketsFor(range: Range, until: Date) {
  const size = range === "1d" ? 3600_000 : DAY_MS;
  const n = range === "1d" ? 24 : RANGE_DAYS[range];
  const since = new Date(until.getTime() - n * size);
  return {
    size,
    n,
    since,
    starts: Array.from({ length: n }, (_, i) => new Date(since.getTime() + i * size)),
  };
}

/** a / b, or null when b is 0 (shown as "—"). */
export const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

/** Relative change vs the previous window; null when there is nothing to compare with. */
export const change = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : null);

const num = (v: unknown) => Number(v ?? 0);

async function topupNumbers(db: AppDb, since: Date, until: Date) {
  const paidIn = and(
    eq(topups.status, "paid"),
    gte(topups.paidAt, since),
    lt(topups.paidAt, until),
  );
  const [[paid], [invoices], [firstTime], byPackage] = await Promise.all([
    db
      .select({
        revenue: sum(topups.amount),
        bonus: sum(topups.bonus),
        count: count(),
        payers: countDistinct(topups.userId),
      })
      .from(topups)
      .where(paidIn),
    db
      .select({
        created: count(),
        paid: sql<number>`count(*) filter (where ${topups.status} = 'paid')`.mapWith(Number),
      })
      .from(topups)
      .where(and(gte(topups.createdAt, since), lt(topups.createdAt, until))),
    db
      .select({ n: count() })
      .from(
        db
          .select({ first: sql<Date>`min(${topups.paidAt})`.as("first") })
          .from(topups)
          .where(eq(topups.status, "paid"))
          .groupBy(topups.userId)
          .as("f"),
      )
      .where(sql`"first" >= ${since.toISOString()} and "first" < ${until.toISOString()}`),
    db
      .select({ amount: topups.amount, bonus: topups.bonus, count: count() })
      .from(topups)
      .where(paidIn)
      .groupBy(topups.amount, topups.bonus),
  ]);
  return {
    revenue: num(paid.revenue),
    bonus: num(paid.bonus),
    count: paid.count,
    payers: paid.payers,
    firstTimePayers: firstTime.n,
    invoicesCreated: invoices.created,
    invoicesPaid: invoices.paid,
    /**
     * By the terms actually sold (amount + bonus as copied onto each top-up), not by the package
     * row: a package whose bonus changed shows as separate rows, and edits never relabel history.
     */
    byPackage: byPackage
      .map((r) => ({
        amount: r.amount,
        bonus: r.bonus,
        count: r.count,
        revenue: r.amount * r.count,
      }))
      .sort((a, b) => b.revenue - a.revenue || b.amount - a.amount),
  };
}

async function spendNumbers(db: AppDb, since: Date, until: Date) {
  const inWindow = and(gte(purchases.createdAt, since), lt(purchases.createdAt, until));
  const [[total], byProduct, [repeat]] = await Promise.all([
    db
      .select({
        spent: sum(purchases.pricePaid),
        count: count(),
        buyers: countDistinct(purchases.userId),
      })
      .from(purchases)
      .where(inWindow),
    db
      .select({
        productCode: purchases.productCode,
        count: count(),
        spent: sum(purchases.pricePaid),
        buyers: countDistinct(purchases.userId),
      })
      .from(purchases)
      .where(inWindow)
      .groupBy(purchases.productCode),
    db.select({ n: count() }).from(
      db
        .select({ userId: purchases.userId })
        .from(purchases)
        .where(inWindow)
        .groupBy(purchases.userId)
        .having(sql`count(*) >= 2`)
        .as("r"),
    ),
  ]);
  return {
    spent: num(total.spent),
    count: total.count,
    buyers: total.buyers,
    repeatBuyers: repeat.n,
    byProduct: byProduct.map((r) => ({
      productCode: r.productCode,
      count: r.count,
      spent: num(r.spent),
      buyers: r.buyers,
    })),
  };
}

async function conversionNumbers(db: AppDb, since: Date, until: Date) {
  const rows = await db
    .select({
      productCode: previewViews.productCode,
      views: count(),
      converted: count(purchases.id),
      viewers: countDistinct(previewViews.userId),
      buyers:
        sql<number>`count(distinct ${previewViews.userId}) filter (where ${purchases.id} is not null)`.mapWith(
          Number,
        ),
    })
    .from(previewViews)
    .leftJoin(
      purchases,
      and(
        eq(purchases.userId, previewViews.userId),
        eq(purchases.productCode, previewViews.productCode),
        eq(purchases.subjectKey, previewViews.subjectKey),
      ),
    )
    .where(and(gte(previewViews.firstViewedAt, since), lt(previewViews.firstViewedAt, until)))
    .groupBy(previewViews.productCode);

  const [users] = await db
    .select({
      viewers: countDistinct(previewViews.userId),
      buyers:
        sql<number>`count(distinct ${previewViews.userId}) filter (where ${purchases.id} is not null)`.mapWith(
          Number,
        ),
    })
    .from(previewViews)
    .leftJoin(
      purchases,
      and(
        eq(purchases.userId, previewViews.userId),
        eq(purchases.productCode, previewViews.productCode),
        eq(purchases.subjectKey, previewViews.subjectKey),
      ),
    )
    .where(and(gte(previewViews.firstViewedAt, since), lt(previewViews.firstViewedAt, until)));

  return {
    views: rows.reduce((n, r) => n + r.views, 0),
    converted: rows.reduce((n, r) => n + r.converted, 0),
    viewers: users.viewers,
    buyers: users.buyers,
    byProduct: rows,
  };
}

async function newUsers(db: AppDb, since: Date, until: Date) {
  const [r] = await db
    .select({ n: count() })
    .from(user)
    .where(and(isNull(user.deletedAt), gte(user.createdAt, since), lt(user.createdAt, until)));
  return r.n;
}

/** Revenue and spending per chart bucket. */
async function series(db: AppDb, range: Range, until: Date) {
  const b = bucketsFor(range, until);
  const bucket = (col: typeof topups.paidAt | typeof purchases.createdAt) =>
    sql<number>`floor(extract(epoch from (${col} - ${b.since.toISOString()}::timestamptz)) / ${b.size / 1000})::int`.mapWith(
      Number,
    );
  const [rev, spend] = await Promise.all([
    db
      .select({ i: bucket(topups.paidAt), v: sum(topups.amount) })
      .from(topups)
      .where(and(eq(topups.status, "paid"), gte(topups.paidAt, b.since), lt(topups.paidAt, until)))
      .groupBy(sql`1`),
    db
      .select({ i: bucket(purchases.createdAt), v: sum(purchases.pricePaid) })
      .from(purchases)
      .where(and(gte(purchases.createdAt, b.since), lt(purchases.createdAt, until)))
      .groupBy(sql`1`),
  ]);
  const fill = (rows: { i: number; v: string | null }[]) => {
    const out = new Array<number>(b.n).fill(0);
    for (const r of rows) if (r.i >= 0 && r.i < b.n) out[r.i] += num(r.v);
    return out;
  };
  const revenue = fill(rev);
  const spent = fill(spend);
  return b.starts.map((start, i) => ({ start, revenue: revenue[i], spent: spent[i] }));
}

async function periodNumbers(db: AppDb, since: Date, until: Date) {
  const [topup, spend, conversion, signups] = await Promise.all([
    topupNumbers(db, since, until),
    spendNumbers(db, since, until),
    conversionNumbers(db, since, until),
    newUsers(db, since, until),
  ]);
  return { topup, spend, conversion, signups };
}

export type PeriodNumbers = Awaited<ReturnType<typeof periodNumbers>>;

export async function dashboardStats(db: AppDb, range: Range, now = new Date()) {
  const { since, until, prevSince } = rangeWindow(range, now);
  const [cur, prev, chart, [liability], packages] = await Promise.all([
    periodNumbers(db, since, until),
    periodNumbers(db, prevSince, since),
    series(db, range, until),
    db
      .select({ total: sum(wallets.balance), holders: count() })
      .from(wallets)
      .where(sql`${wallets.balance} > 0`),
    db.select().from(topupPackages),
  ]);
  return {
    range,
    since,
    until,
    cur,
    prev,
    chart,
    /** Unspent wallet money right now (received, not yet delivered as readings). */
    liability: { total: num(liability.total), holders: liability.holders },
    packages,
  };
}

export type DashboardStats = Awaited<ReturnType<typeof dashboardStats>>;
