import { headers } from "next/headers";

import { isoDateSchema, todayIso } from "@/lib/daily";
import { auth } from "@/server/auth";
import { canManageContent } from "@/server/auth/roles";
import { adminRoleOf } from "@/server/auth/session";
import { db } from "@/server/db";
import { DAILY_TEMPLATE_MAX_DAYS, buildDailyTemplate } from "@/server/import/daily";

/**
 * GET /api/admin/daily-template?from=YYYY-MM-DD&days=N → daily horoscope .xlsx for that range,
 * pre-filled with the stored texts (Editor/Owner only).
 */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canManageContent(adminRoleOf(session.user.email))) {
    return new Response("Not found", { status: 404 });
  }
  const params = new URL(req.url).searchParams;
  const parsedFrom = isoDateSchema.safeParse(params.get("from"));
  const from = parsedFrom.success ? parsedFrom.data : todayIso();
  const n = Number(params.get("days"));
  const days = Number.isInteger(n) && n >= 1 ? Math.min(n, DAILY_TEMPLATE_MAX_DAYS) : 30;

  const buf = await buildDailyTemplate(db, from, days);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="daily-${from}-${days}d.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
