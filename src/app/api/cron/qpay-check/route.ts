import { NextResponse, type NextRequest } from "next/server";

import { isCronRequest } from "@/server/cron-auth";
import { db } from "@/server/db";
import { qpay } from "@/server/qpay";
import { checkPendingTopups } from "@/server/topups";

/** Host crontab every 5 min: `curl -H "Authorization: Bearer $CRON_SECRET" …/api/cron/qpay-check`. */
async function handle(req: NextRequest) {
  if (!isCronRequest(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await checkPendingTopups(db, qpay());
  return NextResponse.json(summary);
}

export const GET = handle;
export const POST = handle;
