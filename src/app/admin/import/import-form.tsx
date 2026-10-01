"use client";

import { CheckCircle2, Download, TriangleAlert, Upload } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";
import type { ImportError } from "@/server/import/validate";
import { importAction, type ImportActionResult } from "../actions";

const t = mn.admin.import;

type KindOption = { kind: string; label: string; file: string; columns: string[] };

function errorLine(e: ImportError): string {
  const parts = [
    e.row ? `${e.row}-р мөр` : null,
    e.column ? `[${e.column}]` : null,
    t.errors[e.code] ?? e.code,
    e.value ? `«${e.value}»` : null,
    e.code === "duplicate" && e.detail
      ? `(${e.detail}-р мөртэй)`
      : e.detail
        ? `: ${e.detail}`
        : null,
  ];
  return parts.filter(Boolean).join(" ");
}

export function ImportForm({ kinds, initialKind }: { kinds: KindOption[]; initialKind?: string }) {
  const [kind, setKind] = useState(
    kinds.some((k) => k.kind === initialKind) ? initialKind! : kinds[0].kind,
  );
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<"check" | "commit">("check");
  const current = kinds.find((k) => k.kind === kind)!;

  const submit = (commit: boolean) =>
    startTransition(async () => {
      if (!file) return;
      setPhase(commit ? "commit" : "check");
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("file", file);
      fd.set("commit", commit ? "1" : "0");
      setResult(await importAction(fd));
    });

  const report = result?.ok ? result.report : null;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t.kind}
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setResult(null);
            }}
            className="h-12 rounded-2xl bg-subtle px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {kinds.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">
          {current.file}: {current.columns.join(" · ")}
        </p>
        <a
          href={`/api/admin/templates/${kind}`}
          className="flex h-11 items-center gap-2 self-start rounded-full bg-subtle px-4 text-sm font-semibold hover:ring-2 hover:ring-border"
        >
          <Download className="size-4" aria-hidden /> {t.download}
        </a>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
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
        <div className="flex flex-wrap gap-2">
          <Button
            size="lg"
            variant="outline"
            className="rounded-full"
            disabled={!file || pending}
            onClick={() => submit(false)}
          >
            <Upload aria-hidden /> {pending && phase === "check" ? t.checking : t.check}
          </Button>
          <Button
            size="lg"
            className="rounded-full"
            disabled={!file || pending || !report?.valid || report.committed}
            onClick={() => submit(true)}
          >
            {pending && phase === "commit" ? t.committing : t.commit}
          </Button>
        </div>
      </section>

      {result && !result.ok && (
        <p
          role="alert"
          className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {t[result.error]}
        </p>
      )}

      {report && (
        <section
          className="flex flex-col gap-4 rounded-3xl bg-surface p-5"
          aria-label={t.reportTitle}
        >
          <div
            role="status"
            className={cn(
              "flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold",
              report.committed || report.valid ? "bg-tint-3" : "bg-destructive/10 text-destructive",
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
            <Num label={t.errorsCount} value={report.errorCount} bad={report.errorCount > 0} />
            <Num label={t.missingCount} value={report.missing.length} />
          </dl>
          {Object.keys(report.mapping).length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t.mapping}:{" "}
              {Object.entries(report.mapping)
                .map(([k, v]) => `${k} ← «${v}»`)
                .join(", ")}
            </p>
          )}
          {report.errors.length > 0 && (
            <ul
              className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-2xl bg-subtle p-3 text-sm"
              data-testid="import-errors"
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
          {report.missing.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold">
                {t.missingCount} ({report.missing.length})
              </summary>
              <p className="mt-2 break-words text-muted-foreground">{report.missing.join(", ")}</p>
            </details>
          )}
        </section>
      )}
    </div>
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
