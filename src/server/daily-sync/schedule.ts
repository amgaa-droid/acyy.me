import { todayIso } from "@/lib/daily";

/**
 * When the daily cron syncs (SPEC §3.2). The host crontab calls /api/cron/daily-sync every few
 * minutes; this decides whether that call should run a sync: once a day after the time set on
 * /admin/ai (Mongolia time), retried an hour later — at most 3 tries — if a run left texts out.
 */

export const AUTO_SYNC_DEFAULT_TIME = "20:00";
export const AUTO_SYNC_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const AUTO_SYNC_MAX_RUNS = 3;
const AUTO_SYNC_RETRY_GAP_MS = 60 * 60_000;
/**
 * astrology.com's "tomorrow" turns over at US Eastern midnight = 12:00–13:00 in Mongolia; a sync
 * earlier in the day gets today's horoscopes, not tomorrow's.
 */
export const AUTO_SYNC_EARLIEST_TOMORROW = "13:00";

/** Today at `time` in Mongolia (UTC+8 all year, no daylight saving). */
export function todayAt(time: string, now: Date = new Date()): Date {
  return new Date(`${todayIso(now)}T${time}:00+08:00`);
}

export type AutoSyncRun = { at: Date; trigger: "manual" | "cron"; saved: number; total: number };

export type AutoSyncDecision = "due" | "before_time" | "done" | "retry_later" | "max_runs";

/** `runs` = syncs since today's start time (manual ones count as done when complete). */
export function autoSyncDecision(opts: {
  now: Date;
  time: string;
  runs: AutoSyncRun[];
}): AutoSyncDecision {
  const start = todayAt(opts.time, opts.now);
  if (opts.now < start) return "before_time";
  const runs = opts.runs.filter((r) => r.at >= start);
  if (runs.some((r) => r.total > 0 && r.saved >= r.total)) return "done";
  const cron = runs.filter((r) => r.trigger === "cron");
  if (cron.length >= AUTO_SYNC_MAX_RUNS) return "max_runs";
  const last = cron.at(-1);
  if (last && opts.now.getTime() - last.at.getTime() < AUTO_SYNC_RETRY_GAP_MS) return "retry_later";
  return "due";
}
