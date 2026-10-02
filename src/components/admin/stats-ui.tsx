import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";
import { RANGES, type Range } from "@/server/admin/stats";

/** Building blocks shared by the admin dashboard (/admin) and business numbers (/admin/business). */

const d = mn.admin.dashboard;

export const dayFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Ulaanbaatar",
  month: "2-digit",
  day: "2-digit",
});
export const hourFmt = new Intl.DateTimeFormat("mn-MN", {
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

export const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 1000) / 10}%`);
export const int = (n: number) => n.toLocaleString("en-US");

/** Page title, the window it covers, and the 1 day / 7 days / month / 3 months switch. */
export function StatsHeader({
  title,
  basePath,
  range,
  since,
  until,
}: {
  title: string;
  basePath: string;
  range: Range;
  since: Date;
  until: Date;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-4xl leading-none font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground tabular-nums">
          {d.rangeHint(fullFmt.format(since), fullFmt.format(until))}
        </p>
      </div>
      <nav className="flex gap-1 self-start rounded-full bg-surface p-1" aria-label={d.vsPrev}>
        {RANGES.map((r) => (
          <Link
            key={r}
            href={r === "7d" ? basePath : `${basePath}?range=${r}`}
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
  );
}

/** Change of a rate, in percentage points (e.g. 12% → 15% = +3). */
export function pointsChange(cur: number | null, prev: number | null) {
  return cur === null || prev === null ? null : cur - prev;
}

export function Section({
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

export function Stat({
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
      <div className="text-2xl font-semibold tabular-nums lg:text-3xl">{value}</div>
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
export function Table({
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
