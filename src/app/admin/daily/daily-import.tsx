"use client";

import { CheckCircle2, Download, FileSpreadsheet, TriangleAlert, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";
import type { DailyImportError } from "@/server/import/daily";
import { Field, inputClass } from "../products/ui";
import { importDailyAction, type DailyImportResult } from "./actions";

const t = mn.admin.daily.excel;

function errorLine(e: DailyImportError): string {
  const limit = e.code === "too_long" || e.code === "too_many_rows";
  return [
    e.row ? t.row(e.row) : null,
    e.column ? `[${e.column}]` : null,
    limit && e.detail ? `${t.errors[e.code]} ${e.detail})` : (t.errors[e.code] ?? e.code),
    e.value ? `«${e.value}»` : null,
    e.code === "duplicate" && e.detail ? `(${t.row(Number(e.detail))}тэй)` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Many days at once: download a pre-filled template for a range, upload, dry run, import. */
export function DailyImport({ today, maxDays }: { today: string; maxDays: number }) {
  const router = useRouter();
  const [from, setFrom] = useState(today);
  const [days, setDays] = useState("30");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<DailyImportResult | null>(null);
  const [phase, setPhase] = useState<"check" | "commit">("check");
  const [pending, startTransition] = useTransition();
  const n = Math.min(maxDays, Math.max(1, Number(days) || 1));

  const submit = (commit: boolean) =>
    startTransition(async () => {
      if (!file) return;
      setPhase(commit ? "commit" : "check");
      const fd = new FormData();
      fd.set("file", file);
      fd.set("commit", commit ? "1" : "0");
      const res = await importDailyAction(fd);
      setResult(res);
      if (res.ok && res.report.committed) router.refresh();
    });
  const report = result?.ok ? result.report : null;

  return (
    <details id="excel" className="group rounded-3xl bg-surface p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
        <FileSpreadsheet className="size-5" aria-hidden /> {t.title}
      </summary>
      <div className="mt-4 flex flex-col gap-5">
        <p className="max-w-2xl text-sm text-muted-foreground">{t.intro}</p>

        <div className="flex flex-wrap items-end gap-3">
          <Field label={t.from} className="w-44">
            <input
              type="date"
              className={inputClass}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label={t.days} className="w-28">
            <input
              className={inputClass}
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 3))}
            />
          </Field>
          <a
            href={`/api/admin/daily-template?${new URLSearchParams({ from: from || today, days: String(n) })}`}
            className="flex h-11 items-center gap-2 rounded-full bg-subtle px-4 text-sm font-semibold hover:ring-2 hover:ring-border"
          >
            <Download className="size-4" aria-hidden /> {t.download}
          </a>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium lg:max-w-xl">
          {t.file}
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
            }}
            className="rounded-2xl bg-subtle p-3 text-sm file:mr-3 file:h-9 file:rounded-full file:border-0 file:bg-primary file:px-4 file:text-sm file:font-semibold file:text-primary-foreground"
          />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="lg"
            variant="outline"
            className="rounded-full sm:w-auto sm:min-w-44"
            disabled={!file || pending}
            onClick={() => submit(false)}
          >
            <Upload aria-hidden /> {pending && phase === "check" ? t.checking : t.check}
          </Button>
          <Button
            size="lg"
            className="rounded-full sm:w-auto sm:min-w-44"
            disabled={!file || pending || !report?.valid || report.committed}
            onClick={() => submit(true)}
          >
            {pending && phase === "commit" ? t.committing : t.commit}
          </Button>
        </div>

        {result && !result.ok && (
          <p
            role="alert"
            className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {t[result.error]}
          </p>
        )}

        {report && (
          <section className="flex flex-col gap-4" aria-label={t.reportTitle}>
            <div
              role="status"
              className={cn(
                "flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold",
                report.valid ? "bg-tint-3" : "bg-destructive/10 text-destructive",
              )}
            >
              {report.valid ? (
                <CheckCircle2 className="size-5" aria-hidden />
              ) : (
                <TriangleAlert className="size-5" aria-hidden />
              )}
              {report.committed ? t.done : report.valid ? t.ok : t.notOk}
            </div>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Num label={t.rows} value={report.rows} />
              <Num label={t.insert} value={report.toInsert} />
              <Num label={t.update} value={report.toUpdate} />
              <Num label={t.unchanged} value={report.unchanged} />
              <Num label={t.errorsCount} value={report.errorCount} bad={report.errorCount > 0} />
            </dl>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              {report.from && report.to && <p>{t.range(report.from, report.to)}</p>}
              {report.kinds.length > 0 && <p>{t.kinds(report.kinds.join(", "))}</p>}
              {report.ignoredColumns.length > 0 && (
                <p>{t.ignored(report.ignoredColumns.join(", "))}</p>
              )}
            </div>
            {report.errors.length > 0 && (
              <ul
                className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-2xl bg-subtle p-3 text-sm"
                data-testid="daily-import-errors"
              >
                {report.errors.map((e, i) => (
                  <li key={i}>{errorLine(e)}</li>
                ))}
                {report.errorCount > report.errors.length && (
                  <li className="text-muted-foreground">
                    {t.moreErrors(report.errorCount - report.errors.length)}
                  </li>
                )}
              </ul>
            )}
            {report.incomplete.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold">
                  {t.incomplete(report.incomplete.length)}
                </summary>
                <p className="mt-2 text-muted-foreground tabular-nums">
                  {report.incomplete
                    .map((d) => t.incompleteDay(d.date, d.filled, d.total))
                    .join(" · ")}
                </p>
              </details>
            )}
          </section>
        )}
      </div>
    </details>
  );
}

function Num({ label, value, bad }: { label: string; value: number; bad?: boolean }) {
  return (
    <div className="rounded-2xl bg-subtle p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-2xl font-semibold tabular-nums", bad && "text-destructive")}>
        {value.toLocaleString("en-US")}
      </dd>
    </div>
  );
}
