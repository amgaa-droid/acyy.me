import type { Metadata } from "next";
import Link from "next/link";

import { mn } from "@/i18n/mn";
import { formatDateTime } from "@/lib/birth-date";
import { todayIso } from "@/lib/daily";
import { cn } from "@/lib/utils";
import { requireOwner } from "@/server/admin/guard";
import { db } from "@/server/db";
import { HISTORY_FILTERS, helpStats, listHelpChats, type HistoryFilter } from "@/server/help/admin";
import { AiHeader } from "../ai-tabs";

export const metadata: Metadata = { title: mn.admin.ai.tabs.history };

const t = mn.admin.ai.history;
const PERIODS = [1, 7, 30];
const fmt = (n: number) => n.toLocaleString("en-US");

/** Owner only: what users ask the help assistant, what it costs, what they disliked. */
export default async function HelpHistoryPage({ searchParams }: PageProps<"/admin/ai/history">) {
  await requireOwner();
  const sp = await searchParams;
  const days = PERIODS.includes(Number(sp.days)) ? Number(sp.days) : 7;
  const filter: HistoryFilter = HISTORY_FILTERS.includes(sp.filter as HistoryFilter)
    ? (sp.filter as HistoryFilter)
    : "all";
  // Periods start at midnight in Mongolia: "today" = since 00:00.
  const since = new Date(`${todayIso()}T00:00:00+08:00`);
  since.setUTCDate(since.getUTCDate() - (days - 1));
  const [stats, rows] = await Promise.all([helpStats(db, since), listHelpChats(db, filter)]);
  const cachedPct = stats.inputTokens
    ? Math.round((stats.cachedTokens / stats.inputTokens) * 100)
    : 0;
  const perQuestion = stats.ai
    ? Math.round((stats.inputTokens + stats.outputTokens) / stats.ai)
    : 0;
  const href = (p: { days?: number; filter?: string }) =>
    `/admin/ai/history?days=${p.days ?? days}&filter=${p.filter ?? filter}`;

  const tiles = [
    { label: t.questions, value: fmt(stats.questions), sub: `${t.users}: ${fmt(stats.users)}` },
    { label: t.aiCalls, value: fmt(stats.ai), sub: `${t.faqHits}: ${fmt(stats.faq)}` },
    { label: t.tokensIn, value: fmt(stats.inputTokens), sub: t.cached(cachedPct) },
    { label: t.tokensOut, value: fmt(stats.outputTokens), sub: t.perQuestion(perQuestion) },
    { label: t.feedback, value: `👍 ${fmt(stats.up)} · 👎 ${fmt(stats.down)}`, sub: "" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <AiHeader intro={t.intro} />
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((d) => (
          <Pill key={d} href={href({ days: d })} active={d === days}>
            {t.periods[d]}
          </Pill>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map((tile) => (
          <li key={tile.label} className="flex flex-col gap-1 rounded-3xl bg-surface p-4">
            <span className="text-xs text-muted-foreground">{tile.label}</span>
            <span className="text-xl font-semibold tabular-nums">{tile.value}</span>
            {tile.sub && <span className="text-xs text-muted-foreground">{tile.sub}</span>}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        {HISTORY_FILTERS.map((f) => (
          <Pill key={f} href={href({ filter: f })} active={f === filter}>
            {t.filters[f]}
          </Pill>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-3xl bg-surface p-5 text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <ul className="flex max-w-5xl flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 rounded-3xl bg-surface p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
                <span>{formatDateTime(r.createdAt)}</span>
                <Link href={`/admin/users/${r.userId}`} className="font-semibold text-highlight">
                  {r.email ?? r.userId.slice(0, 8)}
                </Link>
                {r.source === "faq" ? (
                  <span className="rounded-full bg-tint-2 px-2 py-0.5 font-semibold text-fg">
                    {t.fromFaq}
                  </span>
                ) : (
                  <span>
                    {r.model} · {fmt(r.inputTokens)}
                    {r.cachedTokens > 0 && ` (${fmt(r.cachedTokens)} cache)`} →{" "}
                    {fmt(r.outputTokens)}
                    {r.ms != null && ` · ${(r.ms / 1000).toFixed(1)}с`}
                  </span>
                )}
                {r.feedback != null && <span>{r.feedback > 0 ? "👍" : "👎"}</span>}
              </div>
              <p className="font-semibold">{r.question}</p>
              <p className="text-sm leading-relaxed whitespace-pre-line text-fg/80">{r.answer}</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/faq?from=${r.id}`}
                  className="flex h-10 items-center rounded-full bg-subtle px-3.5 text-sm font-semibold"
                >
                  {t.toFaq}
                </Link>
                <Link
                  href={`/admin/ai/knowledge?from=${r.id}`}
                  className="flex h-10 items-center rounded-full bg-subtle px-3.5 text-sm font-semibold"
                >
                  {t.toNote}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Pill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex h-10 items-center rounded-full px-4 text-sm font-semibold",
        active ? "bg-primary text-primary-foreground" : "bg-surface",
      )}
    >
      {children}
    </Link>
  );
}
