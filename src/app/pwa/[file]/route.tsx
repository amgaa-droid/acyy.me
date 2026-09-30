import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";

import { BrandIcon } from "@/lib/brand-icon";

// Maskable icons keep the mark inside the 80% safe zone.
const ICONS: Record<string, { size: number; padding: number }> = {
  "icon-192.png": { size: 192, padding: 0 },
  "icon-512.png": { size: 512, padding: 0 },
  "maskable-512.png": { size: 512, padding: 0.12 },
};

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONS).map((file) => ({ file }));
}

export async function GET(_req: Request, ctx: RouteContext<"/pwa/[file]">) {
  const { file } = await ctx.params;
  const icon = ICONS[file];
  if (!icon) notFound();
  return new ImageResponse(<BrandIcon size={icon.size} padding={icon.padding} />, {
    width: icon.size,
    height: icon.size,
  });
}
