import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/env";
import { db } from "@/server/db";
import { qpay } from "@/server/qpay";
import { checkPendingTopups } from "@/server/topups";

function authorized(req: NextRequest): boolean {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env().CRON_SECRET}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Host crontab every 5 min: `curl -H "Authorization: Bearer $CRON_SECRET" …/api/cron/qpay-check`. */
async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await checkPendingTopups(db, qpay());
  return NextResponse.json(summary);
}

export const GET = handle;
export const POST = handle;
