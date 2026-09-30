import { count, isNull } from "drizzle-orm";
import Link from "next/link";

import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";
import { contentCoverage } from "@/server/admin/content";
import { salesStats } from "@/server/admin/stats";
import { formatMnt } from "@/i18n/mn";
import { db } from "@/server/db";
import { persons, user } from "@/server/db/schema";

const t = mn.admin;

// Revenue and sales per product are added once wallets/purchases exist (C5/C6, C10).
export default async function AdminDashboard() {
  const [coverage, [{ users }], [{ people }], stats] = await Promise.all([
    contentCoverage(db),
    db.select({ users: count() }).from(user).where(isNull(user.deletedAt)),
    db.select({ people: count() }).from(persons).where(isNull(persons.deletedAt)),
    salesStats(db),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-[40px] leading-none font-semibold">{t.nav.dashboard}</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.dashboard.users} value={users} />
        <Stat label={t.dashboard.people} value={people} />
        <Stat label={t.dashboard.revenueToday} value={formatMnt(stats.revenueToday)} />
        <Stat label={t.dashboard.revenueMonth} value={formatMnt(stats.revenueMonth)} />
      </div>

      {stats.byProduct.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">{t.dashboard.sales}</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            {stats.byProduct.map((r) => (
              <div key={r.productCode} className="rounded-3xl bg-surface p-4">
                <div className="text-xs text-muted-foreground">
                  {t.products[r.productCode] ?? r.productCode}
                </div>
                <div className="text-xl font-semibold tabular-nums">{formatMnt(r.spent)}</div>
                <div className="text-xs text-muted-foreground">
                  {t.dashboard.salesCount(r.count)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">{t.dashboard.coverage}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {coverage.map((c) => {
            const done = c.published - c.placeholder;
            const pct = Math.round((done / c.expected) * 100);
            return (
              <Link
                key={`${c.product}-${c.section}`}
                href={`/admin/content?product=${c.product}&section=${c.section}`}
                className="flex flex-col gap-3 rounded-3xl bg-surface p-5 hover:ring-2 hover:ring-border"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    {t.products[c.product]}
                    {c.section !== "main" && (
                      <span className="text-muted-foreground"> · {t.sections[c.section]}</span>
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

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-3xl bg-surface p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">
        {typeof value === "number" ? value.toLocaleString("en-US") : value}
      </div>
    </div>
  );
}
