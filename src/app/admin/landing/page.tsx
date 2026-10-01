import type { Metadata } from "next";

import { mn } from "@/i18n/mn";
import { avatarOptions } from "@/lib/avatars";
import { requireAdmin } from "@/server/admin/guard";
import { listActiveProducts } from "@/server/catalog";
import { db } from "@/server/db";
import {
  getLandingDraft,
  getPublishedLanding,
  listLandingVersions,
  relationSuggestions,
} from "@/server/landing-cms";
import { LandingEditor } from "./landing-editor";

export const metadata: Metadata = { title: mn.admin.nav.landing };

/** Owner + Editor: edit the signed-out landing page (draft → preview → publish, history). */
export default async function LandingCmsPage() {
  await requireAdmin();
  const [draft, live, versions, products, suggestions] = await Promise.all([
    getLandingDraft(db),
    getPublishedLanding(db),
    listLandingVersions(db),
    listActiveProducts(db),
    relationSuggestions(db),
  ]);

  return (
    <LandingEditor
      initial={draft?.content ?? live.content}
      revision={draft?.revision ?? 0}
      draftInfo={draft ? { updatedAt: draft.updatedAt.toISOString(), updatedBy: draft.updatedBy } : null}
      live={{
        version: live.version,
        publishedAt: live.publishedAt?.toISOString() ?? null,
        publishedBy: versions[0]?.publishedBy ?? null,
      }}
      versions={versions.map((v) => ({ ...v, publishedAt: v.publishedAt.toISOString() }))}
      products={products.map((p) => ({ code: p.code, name: p.nameMn }))}
      avatars={avatarOptions().map((a) => a.uri)}
      suggestions={suggestions}
    />
  );
}
