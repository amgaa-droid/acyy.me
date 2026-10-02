import type { Metadata } from "next";
import Link from "next/link";

import { mn } from "@/i18n/mn";
import { addDays, dayLabel, isoDateSchema, shortDayLabel, todayIso } from "@/lib/daily";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/admin/guard";
import { getAiSettingsView } from "@/server/ai/settings";
import { loadAstroRefs } from "@/server/astro/refs";
import { DAILY_TEXT_MAX, dailyCoverage, dailyDay, listDailyKinds } from "@/server/daily";
import { db } from "@/server/db";
import { lastDailySync } from "@/server/daily-sync/sync";
import { DAILY_TEMPLATE_MAX_DAYS } from "@/server/import/daily";
import { DailyEditor, KindsManager } from "./daily-editor";
import { DailyImport } from "./daily-import";
import { DailySync } from "./daily-sync";

export const metadata: Metadata = { title: mn.admin.nav.daily };

const t = mn.admin.daily;
const STRIP_DAYS = 14;
const fmtTime = new Intl.DateTimeFormat("mn-MN", {
  timeZone: "Asia/Ulaanbaatar",
  dateStyle: "short",
  timeStyle: "short",
});

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Daily horoscopes: pick a day and a kind, write the 12 signs' texts; Owner also manages kinds. */
export default async function AdminDailyPage({ searchParams }: PageProps<"/admin/daily">) {
  const admin = await requireAdmin();
  const raw = await searchParams;
  const today = todayIso();
  const parsedDate = isoDateSchema.safeParse(first(raw.date));
  const date = parsedDate.success ? parsedDate.data : today;

  const [kinds, refs, texts, prevTexts, coverage, ai, lastSync] = await Promise.all([
    listDailyKinds(db),
    loadAstroRefs(db),
    dailyDay(db, date),
    dailyDay(db, addDays(date, -1)),
    dailyCoverage(db, today, STRIP_DAYS),
    getAiSettingsView(db),
    lastDailySync(db),
  ]);
  const kind =
    kinds.find((k) => k.code === first(raw.kind)) ?? kinds.find((k) => k.isActive) ?? kinds[0];
  const href = (patch: { date?: string; kind?: string }) => {
    const p = new URLSearchParams({ date: patch.date ?? date });
    const k = patch.kind ?? kind?.code;
    if (k) p.set("kind", k);
    return `/admin/daily?${p}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[40px] leading-none font-semibold">{t.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t.intro}</p>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{t.days}</h2>
          <form action="/admin/daily" className="flex items-center gap-2">
            {kind && <input type="hidden" name="kind" value={kind.code} />}
            <label className="sr-only" htmlFor="daily-date">
              {t.jump}
            </label>
            <input
              id="daily-date"
              type="date"
              name="date"
              defaultValue={date}
              className="h-11 rounded-2xl bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              className="h-11 rounded-full bg-surface px-4 text-sm font-semibold"
            >
              {t.go}
            </button>
          </form>
        </div>
        <ul className="-mx-1 scrollbar-none flex gap-2 overflow-x-auto px-1 pb-1">
          {coverage.map((c) => {
            const complete = c.total > 0 && c.filled >= c.total;
            return (
              <li key={c.date}>
                <Link
                  href={href({ date: c.date })}
                  aria-current={c.date === date ? "page" : undefined}
                  aria-label={`${dayLabel(c.date)} · ${t.dayStatus(c.filled, c.total)}`}
                  className={cn(
                    "flex w-[84px] shrink-0 flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-xs",
                    c.date === date
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface hover:ring-2 hover:ring-border",
                  )}
                >
                  <span className="font-semibold">
                    {c.date === today ? t.today : shortDayLabel(c.date)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-semibold tabular-nums",
                      c.date === date
                        ? "bg-primary-foreground/15"
                        : complete
                          ? "bg-tint-3 text-fg"
                          : c.filled === 0
                            ? "bg-destructive/10 text-destructive"
                            : "bg-tint-2 text-fg",
                    )}
                  >
                    {t.dayStatus(c.filled, c.total)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <DailySync
        ready={ai.keys[ai.provider].set}
        providerName={`${mn.admin.ai.providers[ai.provider].name} (${ai.models[ai.provider]})`}
        autoSync={ai.autoSync}
        isOwner={admin.role === "owner"}
        last={
          lastSync
            ? `${t.sync.last(fmtTime.format(lastSync.at), lastSync.report.saved, lastSync.report.total)}${lastSync.report.trigger === "cron" ? ` (${t.sync.cron})` : ""}`
            : null
        }
        kindNames={Object.fromEntries(kinds.map((k) => [k.code, k.nameMn]))}
        signNames={Object.fromEntries(refs.signs.map((s) => [s.code, s.nameMn]))}
      />

      {kind ? (
        <>
          <div className="scrollbar-none flex gap-2 overflow-x-auto">
            {kinds.map((k) => (
              <Link
                key={k.code}
                href={href({ kind: k.code })}
                aria-current={k.code === kind.code ? "page" : undefined}
                className={cn(
                  "flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap",
                  k.code === kind.code
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface hover:ring-2 hover:ring-border",
                  !k.isActive && "opacity-60",
                )}
              >
                {k.nameMn}
                <span className="text-xs font-normal tabular-nums opacity-80">
                  {Object.keys(texts[k.code] ?? {}).length}/12
                  {!k.isActive && ` · ${t.inactive}`}
                </span>
              </Link>
            ))}
          </div>
          <DailyEditor
            key={`${date}:${kind.code}`}
            date={date}
            heading={t.editing(dayLabel(date), kind.nameMn)}
            kind={kind.code}
            max={DAILY_TEXT_MAX}
            signs={refs.signs.map((s) => ({
              code: s.code,
              name: s.nameMn,
              range: `${s.startMd} – ${s.endMd}`,
            }))}
            initial={texts[kind.code] ?? {}}
            previous={prevTexts[kind.code] ?? {}}
          />
        </>
      ) : (
        <p className="rounded-3xl bg-surface p-5 text-sm font-semibold text-destructive">
          {t.noKinds}
        </p>
      )}

      <DailyImport today={today} maxDays={DAILY_TEMPLATE_MAX_DAYS} />

      {admin.role === "owner" && <KindsManager kinds={kinds} />}
    </div>
  );
}
