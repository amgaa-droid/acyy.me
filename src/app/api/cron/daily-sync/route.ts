import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/env";
import { AiSettingsError } from "@/server/ai/settings";
import { db } from "@/server/db";
import { syncWithSavedSettings } from "@/server/daily-sync";
import { SyncError } from "@/server/daily-sync/sync";

function authorized(req: NextRequest): boolean {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env().CRON_SECRET}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Host crontab once a day, 20:00 Mongolia (12:00 UTC):
 * `curl -H "Authorization: Bearer $CRON_SECRET" …/api/cron/daily-sync`.
 * Does nothing unless "Өдөр бүр автоматаар" is on in /admin/ai.
 */
async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await syncWithSavedSettings(db, null, "cron");
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
