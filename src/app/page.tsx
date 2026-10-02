import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LandingView } from "@/components/landing/landing-view";
import { APP_NAME } from "@/env";
import { loadAstroRefs } from "@/server/astro/refs";
import { getSession } from "@/server/auth/session";
import { listActiveProducts } from "@/server/catalog";
import { db } from "@/server/db";
import { getPublishedLanding } from "@/server/landing-cms";
import { landingDaily } from "@/server/landing-daily";
import { listActivePackages } from "@/server/topup-packages";

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getPublishedLanding(db);
  return {
    title: { absolute: `${APP_NAME} — ${content.seo.title}` },
    description: content.seo.description,
  };
}

/** Signed-out landing: the published CMS content (/admin/landing). Signed in → /home. */
export default async function LandingPage() {
  if (await getSession()) redirect("/home");

  const [{ content }, products, packages, refs] = await Promise.all([
    getPublishedLanding(db),
    listActiveProducts(db),
    listActivePackages(db),
    loadAstroRefs(db),
  ]);

  return <LandingView
      content={content}
      products={products}
      packages={packages}
      refs={refs}
      daily={await landingDaily(db, refs)}
    />;
}
