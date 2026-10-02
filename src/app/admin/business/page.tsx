import type { Metadata } from "next";

import { ColumnChart } from "@/components/admin/column-chart";
import {
  Section,
  Stat,
  StatsHeader,
  Table,
  dayFmt,
  hourFmt,
  int,
  pct,
  pointsChange,
} from "@/components/admin/stats-ui";
import { formatMnt, mn } from "@/i18n/mn";
import { requireAdmin } from "@/server/admin/guard";
import { change, dashboardStats, parseRange, ratio } from "@/server/admin/stats";
import { db } from "@/server/db";
import { products } from "@/server/db/schema";

export const metadata: Metadata = { title: mn.admin.nav.business };

const d = mn.admin.dashboard;

/** Business numbers (SPEC §6.2): money in, money spent, free → paid conversion, per period. */
export default async function BusinessPage({ searchParams }: PageProps<"/admin/business">) {
  await requireAdmin();
  const range = parseRange((await searchParams).range);
  const [s, productRows] = await Promise.all([
    dashboardStats(db, range),
    db.select({ code: products.code, nameMn: products.nameMn }).from(products),
  ]);

  const names = new Map(productRows.map((p) => [p.code, p.nameMn]));
  const { cur, prev } = s;
  const hourly = range === "1d";
  const chart = (key: "revenue" | "spent") =>
    s.chart.map((b) => ({
      label: (hourly ? hourFmt : dayFmt).format(b.start),
      value: b[key],
    }));

  // Terms currently offered in the wallet sheet; older terms (changed bonus, retired package) are marked.
  const offered = new Set(
    s.packages.filter((p) => p.isActive).map((p) => `${p.amount}|${p.bonus}`),
  );

  const productSpend = [...cur.spend.byProduct].sort((a, b) => b.spent - a.spent);
  const conversionRows = [...cur.conversion.byProduct].sort((a, b) => b.views - a.views);

  return (
    <div className="flex flex-col gap-8">
      <StatsHeader
        title={mn.admin.nav.business}
        basePath="/admin/business"
        range={range}
        since={s.since}
        until={s.until}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ColumnChart title={d.trendRevenue} points={chart("revenue")} />
        <ColumnChart title={d.trendSpent} points={chart("spent")} />
      </div>

      {/* ---- Top-ups ---- */}
      <Section title={d.topups}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <Stat
            label={d.revenue}
            value={formatMnt(cur.topup.revenue)}
            delta={change(cur.topup.revenue, prev.topup.revenue)}
            big
          />
          <Stat
            label={d.topupCount}
            value={int(cur.topup.count)}
            delta={change(cur.topup.count, prev.topup.count)}
          />
          <Stat
            label={d.payers}
            value={int(cur.topup.payers)}
            delta={change(cur.topup.payers, prev.topup.payers)}
            hint={d.firstTime(cur.topup.firstTimePayers)}
          />
          <Stat
            label={d.avgTopup}
            value={
              cur.topup.count ? formatMnt(Math.round(cur.topup.revenue / cur.topup.count)) : "—"
            }
          />
          <Stat
            label={d.bonusGiven}
            value={formatMnt(cur.topup.bonus)}
            hint={pct(ratio(cur.topup.bonus, cur.topup.revenue))}
          />
          <Stat
            label={d.invoiceRate}
            value={pct(ratio(cur.topup.invoicesPaid, cur.topup.invoicesCreated))}
            hint={d.invoiceRateHint(cur.topup.invoicesPaid, cur.topup.invoicesCreated)}
          />
        </div>
        <Table
          title={d.byPackage}
          cols={[d.packageCol, d.soldCol, d.amountCol, d.shareCol]}
          rows={cur.topup.byPackage.map((r) => ({
            key: `${r.amount}|${r.bonus}`,
            name: `${formatMnt(r.amount)}${r.bonus ? ` +${formatMnt(r.bonus)}` : ""}`,
            note: offered.has(`${r.amount}|${r.bonus}`) ? undefined : d.notOffered,
            cells: [int(r.count), formatMnt(r.revenue)],
            share: ratio(r.revenue, cur.topup.revenue),
          }))}
        />
      </Section>

      {/* ---- Spending ---- */}
      <Section title={d.spend}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label={d.spent}
            value={formatMnt(cur.spend.spent)}
            delta={change(cur.spend.spent, prev.spend.spent)}
            big
          />
          <Stat
            label={d.purchases}
            value={int(cur.spend.count)}
            delta={change(cur.spend.count, prev.spend.count)}
          />
          <Stat
            label={d.buyers}
            value={int(cur.spend.buyers)}
            delta={change(cur.spend.buyers, prev.spend.buyers)}
            hint={d.repeatBuyers(cur.spend.repeatBuyers)}
          />
          <Stat
            label={d.avgOrder}
            value={cur.spend.count ? formatMnt(Math.round(cur.spend.spent / cur.spend.count)) : "—"}
          />
        </div>
        <Table
          title={d.byProduct}
          cols={[d.productCol, d.soldCol, d.amountCol, d.shareCol]}
          rows={productSpend.map((r) => ({
            key: r.productCode,
            name: names.get(r.productCode) ?? r.productCode,
            cells: [int(r.count), formatMnt(r.spent)],
            share: ratio(r.spent, cur.spend.spent),
          }))}
        />
      </Section>

      {/* ---- Free → paid ---- */}
      <Section title={d.conversion} hint={d.conversionHint}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label={d.views}
            value={int(cur.conversion.views)}
            delta={change(cur.conversion.views, prev.conversion.views)}
          />
          <Stat
            label={d.converted}
            value={int(cur.conversion.converted)}
            delta={change(cur.conversion.converted, prev.conversion.converted)}
          />
          <Stat
            label={d.conversionRate}
            value={pct(ratio(cur.conversion.converted, cur.conversion.views))}
            delta={pointsChange(
              ratio(cur.conversion.converted, cur.conversion.views),
              ratio(prev.conversion.converted, prev.conversion.views),
            )}
            deltaIsPoints
            big
          />
          <Stat
            label={d.userConversion}
            value={pct(ratio(cur.conversion.buyers, cur.conversion.viewers))}
            hint={d.userConversionHint(cur.conversion.buyers, cur.conversion.viewers)}
          />
        </div>
        <Table
          title={d.byProduct}
          cols={[d.productCol, d.viewsCol, d.convertedCol, d.rateCol]}
          rows={conversionRows.map((r) => ({
            key: r.productCode,
            name: names.get(r.productCode) ?? r.productCode,
            cells: [int(r.views), int(r.converted)],
            share: ratio(r.converted, r.views),
          }))}
        />
      </Section>
    </div>
  );
}
