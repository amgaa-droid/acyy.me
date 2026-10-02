import { and, asc, desc, eq, gte, sql } from "drizzle-orm";

import { addDays, todayIso } from "@/lib/daily";
import { AiError, type AiComplete, type AiProviderId } from "@/server/ai/providers";
import { logAudit } from "@/server/audit";
import { DAILY_TEXT_MAX, listDailyKinds } from "@/server/daily";
import { auditLogs, dailyEntries, zodiacSigns } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import {
  SOURCE_NAMES,
  SOURCE_PATHS,
  SourceError,
  fetchSourcePage,
  loadSourcePage,
  type FetchPage,
} from "./astrology";
import { buildTranslationRequest, parseTranslation } from "./translate";

/**
 * Daily sync (SPEC §3.2): astrology.com's "tomorrow" general / love / work horoscopes for all
 * 12 signs → translated to Mongolian by the configured AI → saved as that day's daily texts,
 * overwriting what is there. Runs from the [Sync] button on /admin/daily and the daily cron.
 * A page or a translation that fails is reported and skipped; everything else is still saved.
 */

export type SyncTrigger = "manual" | "cron";

export type SyncIssueCode =
  "fetch" | "parse" | "wrong_sign" | "stale_date" | "ai" | "bad_answer" | "missing" | "too_long";

export type SyncIssue = { kind: string; sign?: string; code: SyncIssueCode; detail?: string };

export type SyncReport = {
  trigger: SyncTrigger;
  provider: AiProviderId;
  model: string;
  /** The days written (normally one: tomorrow). */
  dates: string[];
  saved: number;
  total: number;
  byKind: { kind: string; name: string; saved: number }[];
  issues: SyncIssue[];
  ms: number;
};

export class SyncError extends Error {
  constructor(readonly code: "no_kinds" | "busy") {
    super(code);
  }
}

export type SyncOptions = {
  actorId: string | null;
  trigger: SyncTrigger;
  ai: { provider: AiProviderId; model: string; prompt: string; complete: AiComplete };
  fetchPage?: FetchPage;
  now?: Date;
  /** Pauses between AI retries (tests pass zeros). */
  retryDelaysMs?: number[];
};

const FETCH_CONCURRENCY = 4;

/** Runs `fn` over `items` with at most `n` at a time, keeping order. */
async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Waits before the 2nd and 3rd try when the AI is busy (429 / 5xx / network). */
export const AI_RETRY_DELAYS_MS = [5_000, 20_000];
/** Longest wait a provider's own "retry after" may ask for. */
const MAX_WAIT_MS = 60_000;

/** The AI can't answer anything this run (wrong key or model, used-up quota): stop asking. */
function isFatal(err: unknown): err is AiError {
  if (!(err instanceof AiError) || !err.status) return false;
  return err.limit.quota === true || (err.status >= 400 && err.status < 500 && err.status !== 429);
}

/**
 * A fatal error is thrown at once. A busy provider (rate limit, 5xx, network) is retried after
 * a pause — the provider's own "retry after" if it gave one; a bad answer (not our JSON) is
 * retried at once.
 */
async function withRetries<R>(fn: () => Promise<R>, delaysMs: number[]): Promise<R> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (isFatal(err) || attempt >= delaysMs.length) throw err;
      if (err instanceof AiError) {
        const wait = Math.max(
          delaysMs[attempt],
          Math.min(err.limit.retryAfterMs ?? 0, MAX_WAIT_MS),
        );
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
}

export async function runDailySync(db: AppDb, opts: SyncOptions): Promise<SyncReport> {
  const started = Date.now();
  const fetchPage = opts.fetchPage ?? fetchSourcePage;
  const today = todayIso(opts.now);
  const [kinds, signs] = await Promise.all([
    listDailyKinds(db).then((ks) => ks.filter((k) => SOURCE_PATHS[k.code])),
    db
      .select({ code: zodiacSigns.code, nameMn: zodiacSigns.nameMn })
      .from(zodiacSigns)
      .orderBy(asc(zodiacSigns.sort)),
  ]);
  if (!kinds.length) throw new SyncError("no_kinds");

  const issues: SyncIssue[] = [];

  // 1. Fetch every kind × sign page.
  const jobs = kinds.flatMap((k) => signs.map((s) => ({ kind: k.code, sign: s.code })));
  const pages = await pool(jobs, FETCH_CONCURRENCY, async (job) => {
    try {
      const page = await loadSourcePage(fetchPage, job.kind, job.sign);
      // A cached or broken page could carry an old day; never write those.
      if (page.date < addDays(today, -1) || page.date > addDays(today, 2)) {
        issues.push({ ...job, code: "stale_date", detail: page.date });
        return null;
      }
      return { ...job, date: page.date, text: page.text };
    } catch (err) {
      issues.push({ ...job, code: err instanceof SourceError ? err.code : "fetch" });
      return null;
    }
  });

  // 2. Translate per kind × day: one request with the 12 signs.
  const groups = new Map<string, { kind: string; date: string; texts: Record<string, string> }>();
  for (const p of pages) {
    if (!p) continue;
    const key = `${p.kind}:${p.date}`;
    if (!groups.has(key)) groups.set(key, { kind: p.kind, date: p.date, texts: {} });
    groups.get(key)!.texts[p.sign] = p.text;
  }
  // One kind after another (not at once) to stay under per-minute limits.
  let stopped: AiError | null = null;
  const translated = await pool([...groups.values()], 1, async (g) => {
    if (stopped) {
      issues.push({ kind: g.kind, code: "ai", detail: stopped.message });
      return { ...g, texts: {} };
    }
    const codes = Object.keys(g.texts);
    const req = buildTranslationRequest({
      prompt: opts.ai.prompt,
      kindName: SOURCE_NAMES[g.kind] ?? g.kind,
      signs: signs.filter((s) => codes.includes(s.code)),
      texts: g.texts,
    });
    try {
      const parsed = await withRetries(
        async () => parseTranslation(await opts.ai.complete(req), codes, DAILY_TEXT_MAX),
        opts.retryDelaysMs ?? AI_RETRY_DELAYS_MS,
      );
      for (const sign of parsed.missing) issues.push({ kind: g.kind, sign, code: "missing" });
      for (const sign of parsed.tooLong) issues.push({ kind: g.kind, sign, code: "too_long" });
      return { ...g, texts: parsed.texts };
    } catch (err) {
      if (isFatal(err)) stopped = err;
      issues.push(
        err instanceof AiError
          ? { kind: g.kind, code: "ai", detail: err.message }
          : { kind: g.kind, code: "bad_answer" },
      );
      return { ...g, texts: {} };
    }
  });

  // 3. Save (overwrite) in one transaction, with one audit entry.
  const rows = translated.flatMap((g) =>
    Object.entries(g.texts).map(([signCode, text]) => ({
      kindCode: g.kind,
      date: g.date,
      signCode,
      text,
      updatedBy: opts.actorId,
    })),
  );
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const report: SyncReport = {
    trigger: opts.trigger,
    provider: opts.ai.provider,
    model: opts.ai.model,
    dates,
    saved: rows.length,
    total: jobs.length,
    byKind: kinds.map((k) => ({
      kind: k.code,
      name: k.nameMn,
      saved: rows.filter((r) => r.kindCode === k.code).length,
    })),
    issues: issues.sort((a, b) =>
      `${a.kind}:${a.sign ?? ""}`.localeCompare(`${b.kind}:${b.sign ?? ""}`),
    ),
    ms: 0,
  };
  await db.transaction(async (tx) => {
    if (rows.length) {
      await tx
        .insert(dailyEntries)
        .values(rows)
        .onConflictDoUpdate({
          target: [dailyEntries.kindCode, dailyEntries.date, dailyEntries.signCode],
          set: {
            text: sql.raw("excluded.text"),
            updatedBy: sql.raw("excluded.updated_by"),
            updatedAt: new Date(),
          },
        });
    }
    report.ms = Date.now() - started;
    await logAudit(tx, {
      actorId: opts.actorId,
      action: "daily.sync",
      entity: "daily_entries",
      entityId: dates.join(",") || null,
      data: report,
    });
  });
  return report;
}

let running: Promise<SyncReport> | null = null;

/** One sync at a time per server (the button and the cron could overlap). */
export async function runDailySyncOnce(db: AppDb, opts: SyncOptions): Promise<SyncReport> {
  if (running) throw new SyncError("busy");
  running = runDailySync(db, opts);
  try {
    return await running;
  } finally {
    running = null;
  }
}

export type SyncRun = { at: Date; trigger: SyncTrigger; saved: number; total: number };

/** Syncs logged since `since`, oldest first (for the daily cron's schedule). */
export async function syncRunsSince(db: AppDb, since: Date): Promise<SyncRun[]> {
  const rows = await db
    .select({ at: auditLogs.createdAt, data: auditLogs.data })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, "daily.sync"), gte(auditLogs.createdAt, since)))
    .orderBy(asc(auditLogs.createdAt));
  return rows.map((r) => {
    const d = r.data as SyncReport;
    return { at: r.at, trigger: d.trigger, saved: d.saved, total: d.total };
  });
}

/** The latest sync (from the audit log), for the admin pages. */
export async function lastDailySync(db: AppDb): Promise<{ at: Date; report: SyncReport } | null> {
  const [row] = await db
    .select({ at: auditLogs.createdAt, data: auditLogs.data })
    .from(auditLogs)
    .where(eq(auditLogs.action, "daily.sync"))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);
  return row ? { at: row.at, report: row.data as SyncReport } : null;
}
