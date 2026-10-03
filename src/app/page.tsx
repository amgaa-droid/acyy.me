import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LandingView } from "@/components/landing/landing-view";
import { APP_NAME } from "@/env";
import { getSession } from "@/server/auth/session";
import { landingData } from "@/server/landing-data";

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await landingData.get();
  return {
    title: { absolute: `${APP_NAME} — ${content.seo.title}` },
    description: content.seo.description,
  };
}

/** Signed-out landing: the published CMS content (/admin/landing). Signed in → /home. */
export default async function LandingPage() {
  if (await getSession()) redirect("/home");

  const { content, products, packages, refs, daily } = await landingData.get();
  return (
    <LandingView
      content={content}
      products={products}
      packages={packages}
      refs={refs}
      daily={daily}
    />
  );
}
