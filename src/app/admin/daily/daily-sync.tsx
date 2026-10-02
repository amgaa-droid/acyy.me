"use client";

import { CheckCircle2, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { dayLabel } from "@/lib/daily";
import { cn } from "@/lib/utils";
import type { SyncIssue } from "@/server/daily-sync/sync";
import { syncDailyAction, type DailySyncResult } from "./actions";

const t = mn.admin.daily.sync;

/** [Sync]: astrology.com's tomorrow → AI translation → saved for that day, then a short report. */
export function DailySync({
  ready,
  providerName,
  autoSync,
  isOwner,
  last,
  kindNames,
  signNames,
}: {
  ready: boolean;
  providerName: string;
  autoSync: boolean;
  isOwner: boolean;
  /** Pre-formatted "when · n/total" of the latest sync. */
  last: string | null;
  kindNames: Record<string, string>;
  signNames: Record<string, string>;
}) {
  const router = useRouter();
  const [result, setResult] = useState<DailySyncResult | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      setResult(null);
      const res = await syncDailyAction();
      setResult(res);
      if (res.ok) router.refresh();
    });

  const issueLine = (i: SyncIssue) =>
    [
      kindNames[i.kind] ?? i.kind,
      i.sign ? (signNames[i.sign] ?? i.sign) : null,
      t.issues[i.code] ?? i.code,
      i.detail ? `(${i.detail})` : null,
    ]
      .filter(Boolean)
      .join(" · ");

  const report = result?.ok ? result.report : null;

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 font-semibold">
          <RefreshCw className="size-5" aria-hidden /> {t.title}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">{t.intro(providerName)}</p>
        <p className="text-xs text-muted-foreground">
          {[last, autoSync ? t.autoOn : t.autoOff].filter(Boolean).join(" · ")}
        </p>
      </div>

      {!ready && (
        <p className="text-sm font-semibold text-destructive">
          {t.notConfigured}{" "}
          {isOwner ? (
            <Link href="/admin/ai" className="text-highlight underline underline-offset-4">
              {t.configure}
            </Link>
          ) : (
            t.askOwner
          )}
        </p>
      )}

      <Button
        size="lg"
        className="rounded-full sm:w-auto sm:min-w-44"
        disabled={!ready || pending}
        onClick={run}
      >
        <RefreshCw className={cn(pending && "animate-spin")} aria-hidden />
        {pending ? t.running : t.button}
      </Button>

      {result && !result.ok && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {t.errors[result.error] ?? t.errors.generic}
        </p>
      )}

      {report && (
        <div role="status" className="flex flex-col gap-3 rounded-2xl bg-subtle p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            {report.saved > 0 ? (
              <CheckCircle2 className="size-4 text-highlight" aria-hidden />
            ) : (
              <TriangleAlert className="size-4 text-destructive" aria-hidden />
            )}
            {t.done(report.saved, report.total)}
          </p>
          <ul className="flex flex-wrap gap-2">
            {report.byKind.map((k) => (
              <li key={k.kind} className="rounded-full bg-surface px-3 py-1 text-xs tabular-nums">
                {k.name} · {k.saved}/12
              </li>
            ))}
          </ul>
          {report.dates.map((d) => (
            <Link
              key={d}
              href={`/admin/daily?date=${d}`}
              className="font-semibold text-highlight underline underline-offset-4"
            >
              {t.view(dayLabel(d))}
            </Link>
          ))}
          {report.issues.length > 0 && (
            <details>
              <summary className="cursor-pointer font-semibold text-destructive">
                {t.issuesTitle(report.issues.length)}
              </summary>
              <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                {report.issues.map((i, n) => (
                  <li key={n}>{issueLine(i)}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
