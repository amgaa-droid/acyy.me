import { NextResponse, type NextRequest } from "next/server";

import { AiSettingsError } from "@/server/ai/settings";
import { isCronRequest } from "@/server/cron-auth";
import { db } from "@/server/db";
import { autoSyncIfDue } from "@/server/daily-sync";
import { SyncError } from "@/server/daily-sync/sync";

/**
 * Host crontab every 5 min: `curl -H "Authorization: Bearer $CRON_SECRET" …/api/cron/daily-sync`.
 * Syncs once a day after the time set in /admin/ai (retries a partial run an hour later, up to
 * 3 tries); otherwise answers `{ skipped }` without touching astrology.com or the AI.
 */
async function handle(req: NextRequest) {
  if (!isCronRequest(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await autoSyncIfDue(db);
    if ("skipped" in res) return NextResponse.json(res);
    const { dates, saved, total, issues } = res;
    return NextResponse.json({ dates, saved, total, issues: issues.length });
  } catch (err) {
    if (err instanceof AiSettingsError || err instanceof SyncError) {
      return NextResponse.json({ error: err.code }, { status: 409 });
    }
    throw err;
  }
}

export const GET = handle;
export const POST = handle;
