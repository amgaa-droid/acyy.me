import { and, count, inArray, isNull } from "drizzle-orm";
import Link from "next/link";

import { Section, Stat, StatsHeader, int, pct } from "@/components/admin/stats-ui";
import { formatMnt, mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";
import { contentCoverage } from "@/server/admin/content";
import { change, countedUser, dashboardStats, parseRange, ratio } from "@/server/admin/stats";
import { db } from "@/server/db";
import { persons, user } from "@/server/db/schema";

const t = mn.admin;
const d = mn.admin.dashboard;

/**
 * Admin overview (SPEC §6.2): users, wallets and content coverage. Money in/out and conversion
 * live on /admin/business.
 */
export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  const range = parseRange((await searchParams).range);
  const [coverage, [{ users }], [{ people }], s] = await Promise.all([
    contentCoverage(db),
    db
      .select({ users: count() })
      .from(user)
      .where(and(isNull(user.deletedAt), countedUser)),
    db
      .select({ people: count() })
      .from(persons)
      .where(
        and(
          isNull(persons.deletedAt),
          inArray(persons.ownerUserId, db.select({ id: user.id }).from(user).where(countedUser)),
        ),
      ),
    dashboardStats(db, range),
  ]);
  const { cur, prev } = s;

  return (
    <div className="flex flex-col gap-8">
      <StatsHeader
        title={t.nav.dashboard}
        basePath="/admin"
        range={range}
        since={s.since}
        until={s.until}
      />

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
