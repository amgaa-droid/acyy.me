import { headers } from "next/headers";

import { loadAstroRefs } from "@/server/astro/refs";
import { auth } from "@/server/auth";
import { canManageContent } from "@/server/auth/roles";
import { adminRoleOf } from "@/server/auth/session";
import { db } from "@/server/db";
import { findKind } from "@/server/import/kinds";
import { buildTemplate } from "@/server/import/template";
import { loadProductDefs } from "@/server/products";

/** GET /api/admin/templates/:kind → pre-filled .xlsx template (Editor/Owner only). */
export async function GET(_req: Request, ctx: RouteContext<"/api/admin/templates/[kind]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canManageContent(adminRoleOf(session.user.email))) {
    return new Response("Not found", { status: 404 });
  }
  const { kind } = await ctx.params;
  const spec = findKind(await loadProductDefs(db), kind);
  if (!spec) return new Response("Not found", { status: 404 });

  const buf = await buildTemplate(spec, await loadAstroRefs(db));
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${spec.file}"`,
      "Cache-Control": "no-store",
    },
  });
}
