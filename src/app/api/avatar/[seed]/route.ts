import { avatarSvg, isAvatarSeed } from "@/lib/avatars";

/**
 * GET /api/avatar/:seed → one of the 30 pickable DiceBear avatars as SVG (src/lib/avatars.ts
 * avatarUrl). Immutable: the URL carries a version, so browsers keep it for a year.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/avatar/[seed]">) {
  const { seed } = await ctx.params;
  if (!isAvatarSeed(seed)) return new Response("Not found", { status: 404 });
  return new Response(avatarSvg(seed), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      // Served as an image only: nothing in it may run or load anything.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
