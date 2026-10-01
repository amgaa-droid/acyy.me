import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { count, isNull } from "drizzle-orm";
import Link from "next/link";

import { ColumnChart } from "@/components/admin/column-chart";
import { formatMnt, mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";
import { contentCoverage } from "@/server/admin/content";
import { RANGES, change, dashboardStats, parseRange, ratio } from "@/server/admin/stats";
import { db } from "@/server/db";
import { persons, products, user } from "@/server/db/schema";

const t = mn.admin;
const d = mn.admin.dashboard;

const dayFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Ulaanbaatar",
  month: "2-digit",
  day: "2-digit",
});
const hourFmt = new Intl.DateTimeFormat("mn-MN", {
  timeZone: "Asia/Ulaanbaatar",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const fullFmt = new Intl.DateTimeFormat("mn-MN", {
  timeZone: "Asia/Ulaanbaatar",
  dateStyle: "short",
  timeStyle: "short",
});

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 1000) / 10}%`);
const int = (n: number) => n.toLocaleString("en-US");

/** Business dashboard (SPEC §6.2): money in, money spent, free → paid conversion, per period. */
export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  const range = parseRange((await searchParams).range);
  const [coverage, [{ users }], [{ people }], s, productRows] = await Promise.all([
    contentCoverage(db),
    db.select({ users: count() }).from(user).where(isNull(user.deletedAt)),
    db.select({ people: count() }).from(persons).where(isNull(persons.deletedAt)),
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[40px] leading-none font-semibold">{t.nav.dashboard}</h1>
          <p className="mt-2 text-sm text-muted-foreground tabular-nums">
            {d.rangeHint(fullFmt.format(s.since), fullFmt.format(s.until))}
          </p>
        </div>
        <nav className="flex gap-1 self-start rounded-full bg-surface p-1" aria-label={d.vsPrev}>
          {RANGES.map((r) => (
            <Link
              key={r}
              href={r === "7d" ? "/admin" : `/admin?range=${r}`}
              aria-current={r === range ? "page" : undefined}
              className={cn(
                "flex h-11 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap",
                r === range
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-fg",
              )}
            >
              {d.ranges[r]}
            </Link>
          ))}
        </nav>
      </div>

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

      {/* ---- Users & wallet ---- */}
      <Section title={d.growth}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <Stat label={d.users} value={int(users)} />
          <Stat label={d.people} value={int(people)} />
          <Stat
            label={d.signups}
            value={int(cur.signups)}
            delta={change(cur.signups, prev.signups)}
          />
          <Stat
            label={d.arppu}
            value={
              cur.topup.payers ? formatMnt(Math.round(cur.topup.revenue / cur.topup.payers)) : "—"
            }
          />
          <Stat
            label={d.spendRatio}
            value={pct(ratio(cur.spend.spent, cur.topup.revenue))}
            hint={d.spendRatioHint}
          />
          <Stat
            label={d.liability}
            value={formatMnt(s.liability.total)}
            hint={d.liabilityHint(s.liability.holders)}
          />
        </div>
      </Section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">{t.dashboard.coverage}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {coverage.map((c) => {
            const done = c.published - c.placeholder;
            const pct = c.expected ? Math.round((done / c.expected) * 100) : 0;
            return (
              <Link
                key={`${c.product}-${c.section}`}
                href={`/admin/content?product=${c.product}&section=${c.section}`}
                className="flex flex-col gap-3 rounded-3xl bg-surface p-5 hover:ring-2 hover:ring-border"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    {c.productName}
                    {c.sectionName && (
                      <span className="text-muted-foreground"> · {c.sectionName}</span>
                    )}
                    {!c.isActive && (
                      <span className="text-muted-foreground"> · {t.productsPage.inactive}</span>
                    )}
                  </span>
                  <span className="text-lg font-semibold tabular-nums">
                    {done.toLocaleString("en-US")}/{c.expected.toLocaleString("en-US")}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-subtle" aria-hidden>
                  <div
                    className={cn(
                      "h-full rounded-full",
                      pct === 100 ? "bg-highlight" : "bg-ring-2",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {c.placeholder > 0 && (
                    <span className="font-semibold text-ring-2">
                      {t.dashboard.placeholders(c.placeholder)}
                    </span>
                  )}
                  {c.missing === 0 && c.draft === 0 && c.placeholder === 0 ? (
                    <span>{t.dashboard.complete}</span>
                  ) : c.missing === 0 && c.draft === 0 ? null : (
                    <>
                      {c.missing > 0 && <span>{t.dashboard.missing(c.missing)}</span>}
                      {c.draft > 0 && <span>{t.dashboard.drafts(c.draft)}</span>}
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** Change of a rate, in percentage points (e.g. 12% → 15% = +3). */
function pointsChange(cur: number | null, prev: number | null) {
  return cur === null || prev === null ? null : cur - prev;
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-2xl font-semibold">{title}</h2>
        {hint && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  delta,
  deltaIsPoints,
  hint,
  big,
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaIsPoints?: boolean;
  hint?: string;
  big?: boolean;
}) {
  const shown = delta !== undefined && delta !== null && Math.abs(delta) >= 0.0005;
  const up = (delta ?? 0) > 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={cn("flex flex-col gap-1 rounded-3xl p-5", big ? "bg-tint-1" : "bg-surface")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums lg:text-[26px]">{value}</div>
      {shown && (
        <div
          className={cn(
            "flex items-center gap-0.5 text-xs font-semibold tabular-nums",
            up ? "text-highlight" : "text-destructive",
          )}
          title={d.vsPrev}
        >
          <Arrow className="size-3.5" aria-hidden />
          {up ? "+" : "−"}
          {deltaIsPoints
            ? `${Math.round(Math.abs(delta!) * 1000) / 10} н.`
            : `${Math.round(Math.abs(delta!) * 1000) / 10}%`}
          <span className="sr-only"> {d.vsPrev}</span>
        </div>
      )}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Ranked breakdown with an inline share bar (single hue; the number is always printed). */
function Table({
  title,
  cols,
  rows,
}: {
  title: string;
  cols: [string, string, string, string];
  rows: {
    key: string;
    name: string;
    note?: string;
    cells: [string, string];
    share: number | null;
  }[];
}) {
  return (
    <div className="overflow-hidden rounded-3xl bg-surface">
      <div className="px-5 pt-4 text-sm font-semibold">{title}</div>
      {rows.length === 0 ? (
        <p className="px-5 pt-2 pb-5 text-sm text-muted-foreground">{d.noData}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-2 pr-2 pl-4 font-medium sm:px-5">{cols[0]}</th>
                <th className="px-2 py-2 text-right font-medium sm:px-3">{cols[1]}</th>
                <th className="px-2 py-2 text-right font-medium sm:px-3">{cols[2]}</th>
                <th className="py-2 pr-4 pl-2 text-right font-medium sm:w-[40%] sm:px-5 sm:text-left">
                  {cols[3]}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-border">
                  <td className="py-3 pr-2 pl-4 font-medium sm:px-5 sm:whitespace-nowrap">
                    {r.name}
                    {r.note && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {r.note}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums sm:px-3">{r.cells[0]}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                    {r.cells[1]}
                  </td>
                  <td className="py-3 pr-4 pl-2 sm:px-5">
                    <div className="flex items-center gap-2">
                      <div
                        className="hidden h-2 flex-1 overflow-hidden rounded-full bg-subtle sm:block"
                        aria-hidden
                      >
                        <div
                          className="h-full rounded-full bg-highlight"
                          style={{ width: `${Math.round((r.share ?? 0) * 100)}%` }}
                        />
                      </div>
                      <span className="ml-auto w-11 text-right text-xs tabular-nums">
                        {pct(r.share)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
