import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { TopupNotFoundError, getTopupForUser } from "@/server/topups";
import { getBalance } from "@/server/wallet";

/** Polled every 3 s by the invoice screen. Read-only; owner only. */
export async function GET(_req: Request, ctx: RouteContext<"/api/topups/[id]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const t = await getTopupForUser(db, session.user.id, id);
    return NextResponse.json(
      {
        status: t.status,
        amount: t.amount,
        bonus: t.bonus,
        balance: await getBalance(db, session.user.id),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof TopupNotFoundError)
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    throw err;
  }
}
