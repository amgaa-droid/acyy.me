import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { safeNext } from "@/lib/safe-next";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { topups } from "@/server/db/schema";
import { mockQPay } from "@/server/qpay";

/**
 * Mock "bank app" buttons (QPAY_MODE=mock, never in production). A plain form POST → 303,
 * so it works before hydration too. "pay" marks the mock invoice paid and then calls our
 * REAL callback URL, exactly like QPay would.
 */
export async function POST(req: NextRequest) {
  const mock = process.env.NODE_ENV === "production" ? null : mockQPay();
  if (!mock) return new NextResponse("Not found", { status: 404 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const form = await req.formData();
  const invoiceId = String(form.get("invoiceId") ?? "");
  const op = String(form.get("op") ?? "");
  const inv = mock.get(invoiceId);
  const [topup] = await db.select().from(topups).where(eq(topups.invoiceId, invoiceId));
  if (!inv || !topup || topup.userId !== session.user.id) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (op === "pay") {
    mock.markPaid(invoiceId);
    const res = await fetch(inv.callbackUrl, { method: "POST" });
    if (!res.ok) console.error("[mock-qpay] callback failed", res.status, await res.text());
  } else if (op === "cancel") {
    await db.update(topups).set({ status: "failed" }).where(eq(topups.id, topup.id));
  } else {
    return new NextResponse("Bad request", { status: 400 });
  }
  const next = safeNext(String(form.get("next") ?? ""), "/wallet");
  const target = new URL(`/wallet/topup/${topup.id}`, req.url);
  target.searchParams.set("next", next);
  return NextResponse.redirect(target, 303);
}
