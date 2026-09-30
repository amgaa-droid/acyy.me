"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { RangesResult } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";

const t = mn.admin.ranges;

export type RangeRow = {
  id: string;
  name: string;
  startMd: string;
  endMd: string;
  label?: string | null;
};

type Props = {
  rows: RangeRow[];
  withLabel?: boolean;
  onSave: (rows: RangeRow[]) => Promise<RangesResult>;
};

/** Table of MM-DD ranges; the server refuses to save unless all 366 days are covered once. */
export function RangesEditor({ rows: initial, withLabel = false, onSave }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [messages, setMessages] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (i: number, patch: Partial<RangeRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = () =>
    startTransition(async () => {
      const res = await onSave(rows);
      if (res.ok) {
        setMessages({ ok: true, lines: [t.saved] });
        router.refresh();
      } else if ("issues" in res) {
        setMessages({
          ok: false,
          lines: res.issues.map((i) =>
            i.kind === "gap"
              ? t.gap(
                  i.days.length > 8
                    ? `${i.days.slice(0, 8).join(", ")}, … (${i.days.length})`
                    : i.days.join(", "),
                )
              : i.kind === "overlap"
                ? t.overlap(i.day, i.ranges.map((r) => rows[r]?.name ?? r).join(", "))
                : t.invalid(i.value),
          ),
        });
      } else setMessages({ ok: false, lines: [t.generic] });
    });

  const cell =
    "h-11 w-24 rounded-xl bg-subtle px-3 font-mono text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-3xl bg-surface">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-3 font-medium">{t.name}</th>
              <th className="px-2 py-3 font-medium">{t.start}</th>
              <th className="px-2 py-3 font-medium">{t.end}</th>
              {withLabel && <th className="px-2 py-3 font-medium">{t.label}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-1.5 font-medium whitespace-nowrap">{r.name}</td>
                <td className="px-2 py-1.5">
                  <input
                    aria-label={`${r.name} ${t.start}`}
                    className={cell}
                    value={r.startMd}
                    maxLength={5}
                    onChange={(e) => set(i, { startMd: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    aria-label={`${r.name} ${t.end}`}
                    className={cell}
                    value={r.endMd}
                    maxLength={5}
                    onChange={(e) => set(i, { endMd: e.target.value })}
                  />
                </td>
                {withLabel && (
                  <td className="px-2 py-1.5">
                    <input
                      aria-label={`${r.name} ${t.label}`}
                      className={cn(cell, "w-48 font-sans")}
                      value={r.label ?? ""}
                      maxLength={60}
                      onChange={(e) => set(i, { label: e.target.value })}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {messages && (
        <div
          role={messages.ok ? "status" : "alert"}
          className={cn(
            "rounded-2xl px-4 py-3 text-sm",
            messages.ok ? "bg-tint-3" : "bg-destructive/10 text-destructive",
          )}
        >
          {messages.lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}
      <Button size="lg" className="rounded-full lg:w-48" disabled={pending} onClick={save}>
        {t.save}
      </Button>
    </div>
  );
}
