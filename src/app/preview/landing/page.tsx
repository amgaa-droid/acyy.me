import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { LandingView } from "@/components/landing/landing-view";
import { mn } from "@/i18n/mn";
import { requireAdmin } from "@/server/admin/guard";
import { loadAstroRefs } from "@/server/astro/refs";
import { listActiveProducts } from "@/server/catalog";
import { db } from "@/server/db";
import { getLandingDraft, getLandingVersion, getPublishedLanding } from "@/server/landing-cms";
import { landingDaily } from "@/server/landing-daily";
import { listActivePackages } from "@/server/topup-packages";

export const metadata: Metadata = {
  title: mn.admin.landing.preview,
  robots: { index: false, follow: false },
};

/**
 * Admin-only preview of the landing: the saved draft (or, with ?v=<id>, a published version).
 * Falls back to the live content when there is no draft.
 */
export default async function LandingPreviewPage({ searchParams }: PageProps<"/preview/landing">) {
  await requireAdmin();
  const { v } = await searchParams;
  let content;
  let label: string;
  if (typeof v === "string") {
    if (!z.uuid().safeParse(v).success) notFound();
    content = await getLandingVersion(db, v);
    if (!content) notFound();
    label = mn.admin.landing.history;
  } else {
    const draft = await getLandingDraft(db);
    content = draft?.content ?? (await getPublishedLanding(db)).content;
    label = draft ? mn.admin.landing.draft : mn.admin.landing.current;
  }
  const [products, packages, refs] = await Promise.all([
    listActiveProducts(db),
    listActivePackages(db),
    loadAstroRefs(db),
  ]);

  return (
    <>
      <LandingView
      content={content}
      products={products}
      packages={packages}
      refs={refs}
      daily={await landingDaily(db, refs)}
    />
      <span className="pointer-events-none fixed bottom-2 left-2 z-50 rounded-full bg-highlight px-3 py-1 text-xs font-semibold text-highlight-fg">
        {mn.admin.landing.preview} · {label}
      </span>
    </>
  );
}
