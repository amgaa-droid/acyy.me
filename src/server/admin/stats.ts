import { and, count, eq, gte, sql, sum } from "drizzle-orm";

import type { AppDb } from "@/server/db/types";
import { purchases, topups } from "@/server/db/schema";

/** Start of "today" and "this month" in Ulaanbaatar (UTC+8, no DST). */
export function ubPeriodStarts(now = new Date()) {
  const ub = new Date(now.getTime() + 8 * 3600_000);
  const day = Date.UTC(ub.getUTCFullYear(), ub.getUTCMonth(), ub.getUTCDate()) - 8 * 3600_000;
  const month = Date.UTC(ub.getUTCFullYear(), ub.getUTCMonth(), 1) - 8 * 3600_000;
  return { today: new Date(day), month: new Date(month) };
}

/** Revenue = paid top-ups (money actually received); sales = purchases per product. */
export async function salesStats(db: AppDb, now = new Date()) {
  const { today, month } = ubPeriodStarts(now);
  const revenue = async (since: Date) => {
    const [r] = await db
      .select({ total: sum(topups.amount) })
      .from(topups)
      .where(and(eq(topups.status, "paid"), gte(topups.paidAt, since)));
    return Number(r.total ?? 0);
  };
  const [revenueToday, revenueMonth, byProduct] = await Promise.all([
    revenue(today),
    revenue(month),
    db
      .select({
        productCode: purchases.productCode,
        count: count(),
        spent: sql<string>`coalesce(sum(${purchases.pricePaid}), 0)`,
      })
      .from(purchases)
      .groupBy(purchases.productCode),
  ]);
  return {
    revenueToday,
    revenueMonth,
    byProduct: byProduct.map((r) => ({
      productCode: r.productCode,
      count: r.count,
      spent: Number(r.spent),
    })),
  };
}
