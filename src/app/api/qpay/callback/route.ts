import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/env";
import { db } from "@/server/db";
import { qpay } from "@/server/qpay";
import { verifyTopupSignature } from "@/server/qpay/signature";
import { TopupNotFoundError, settleTopup } from "@/server/topups";

/**
 * QPay payment callback (SPEC §4.3). The request only tells us *which* top-up to look at:
 * we verify our HMAC, then ask QPay (checkPayment) before crediting anything.
 */
async function handle(req: NextRequest) {
  const topupId = req.nextUrl.searchParams.get("topup_id") ?? "";
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  if (!verifyTopupSignature(topupId, sig, env().QPAY_CALLBACK_SECRET)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  try {
    const res = await settleTopup(db, qpay(), topupId, { source: "callback" });
    return NextResponse.json({ status: res.status });
  } catch (err) {
    if (err instanceof TopupNotFoundError)
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    console.error("[qpay:callback]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
