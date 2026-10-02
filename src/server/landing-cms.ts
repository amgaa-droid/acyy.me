import { and, desc, eq, sql } from "drizzle-orm";

import {
  LANDING_DEFAULTS,
  landingContentSchema,
  mergeLandingContent,
  type LandingContent,
} from "@/lib/landing-content";
import { logAudit } from "@/server/audit";
import { pageDrafts, pageVersions, user } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";

/**
 * Landing page CMS (/admin/landing): one working draft → preview → publish as a new,
 * append-only version. Restoring an old version copies it into the draft (review, then publish).
 * Saves carry the draft revision they were based on; a stale one is rejected (two admins at once).
 */

const LANDING_PAGE = "landing";

export class DraftConflictError extends Error {
  constructor() {
    super("draft_conflict");
  }
}
export class NothingToPublishError extends Error {
  constructor() {
    super("nothing_to_publish");
  }
}
export class VersionNotFoundError extends Error {
  constructor() {
    super("version_not_found");
  }
}

type Published = { content: LandingContent; version: number | null; publishedAt: Date | null };

/** What visitors see: the newest published version, or the built-in defaults if none yet. */
export async function getPublishedLanding(db: AppDb): Promise<Published> {
  const [row] = await db
    .select()
    .from(pageVersions)
    .where(eq(pageVersions.page, LANDING_PAGE))
    .orderBy(desc(pageVersions.version))
    .limit(1);
  if (!row) return { content: LANDING_DEFAULTS, version: null, publishedAt: null };
  return { content: mergeLandingContent(row.content), version: row.version, publishedAt: row.publishedAt };
}

export type Draft = {
  content: LandingContent;
  revision: number;
  baseVersion: number | null;
  updatedAt: Date;
  updatedBy: string | null;
};

export async function getLandingDraft(db: AppDb): Promise<Draft | null> {
  const [row] = await db
    .select({
      content: pageDrafts.content,
      revision: pageDrafts.revision,
      baseVersion: pageDrafts.baseVersion,
      updatedAt: pageDrafts.updatedAt,
      updatedBy: user.email,
    })
    .from(pageDrafts)
    .leftJoin(user, eq(user.id, pageDrafts.updatedBy))
    .where(eq(pageDrafts.page, LANDING_PAGE));
  if (!row) return null;
  return { ...row, content: mergeLandingContent(row.content) };
}

/**
 * Saves the draft. `expectedRevision` is the revision the editor loaded (0 = there was no draft).
 * Throws ZodError for invalid content and DraftConflictError if someone saved in between.
 */
export async function saveLandingDraft(
  db: AppDb,
  actorId: string,
  input: unknown,
  expectedRevision: number,
): Promise<{ revision: number }> {
  const content = landingContentSchema.parse(input);
  return db.transaction(async (tx) => {
    if (expectedRevision === 0) {
      const live = await latestVersion(tx as unknown as AppDb);
      const inserted = await tx
        .insert(pageDrafts)
        .values({ page: LANDING_PAGE, content, revision: 1, baseVersion: live, updatedBy: actorId })
        .onConflictDoNothing()
        .returning({ revision: pageDrafts.revision });
      if (inserted.length === 0) throw new DraftConflictError();
      return inserted[0];
    }
    const updated = await tx
      .update(pageDrafts)
      .set({
        content,
        revision: sql`${pageDrafts.revision} + 1`,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(and(eq(pageDrafts.page, LANDING_PAGE), eq(pageDrafts.revision, expectedRevision)))
      .returning({ revision: pageDrafts.revision });
    if (updated.length === 0) throw new DraftConflictError();
    return updated[0];
  });
}

async function latestVersion(db: AppDb): Promise<number | null> {
  const [row] = await db
    .select({ v: sql<number | null>`max(${pageVersions.version})` })
    .from(pageVersions)
    .where(eq(pageVersions.page, LANDING_PAGE));
  return row?.v == null ? null : Number(row.v);
}

/** Publishes the draft at exactly `expectedRevision` as the next version and clears the draft. */
export async function publishLandingDraft(
  db: AppDb,
  actorId: string,
  expectedRevision: number,
  note: string | null,
): Promise<{ version: number }> {
  return db.transaction(async (tx) => {
    const [draft] = await tx
      .select()
      .from(pageDrafts)
      .where(eq(pageDrafts.page, LANDING_PAGE))
      .for("update");
    if (!draft) throw new NothingToPublishError();
    if (draft.revision !== expectedRevision) throw new DraftConflictError();
    const content = landingContentSchema.parse(draft.content);
    const version = ((await latestVersion(tx as unknown as AppDb)) ?? 0) + 1;
    const [row] = await tx
      .insert(pageVersions)
      .values({
        page: LANDING_PAGE,
        version,
        content,
        note: note?.trim().slice(0, 200) || null,
        publishedBy: actorId,
      })
      .returning({ id: pageVersions.id });
    await tx.delete(pageDrafts).where(eq(pageDrafts.page, LANDING_PAGE));
    await logAudit(tx, {
      actorId,
      action: "page.publish",
      entity: "page",
      entityId: LANDING_PAGE,
      data: { version, versionId: row.id, note },
    });
    return { version };
  });
}

/** Throws the draft away (the live page is untouched). */
export async function discardLandingDraft(db: AppDb, actorId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(pageDrafts)
      .where(eq(pageDrafts.page, LANDING_PAGE))
      .returning({ revision: pageDrafts.revision });
    if (deleted.length > 0)
      await logAudit(tx, { actorId, action: "page.discard_draft", entity: "page", entityId: LANDING_PAGE });
  });
}

/** Copies a published version (by id) — or the built-in defaults (`null`) — into the draft. */
export async function restoreIntoDraft(
  db: AppDb,
  actorId: string,
  versionId: string | null,
  expectedRevision: number,
): Promise<{ revision: number }> {
  let content: LandingContent = LANDING_DEFAULTS;
  let from: number | "defaults" = "defaults";
  if (versionId) {
    const [row] = await db
      .select()
      .from(pageVersions)
      .where(and(eq(pageVersions.id, versionId), eq(pageVersions.page, LANDING_PAGE)));
    if (!row) throw new VersionNotFoundError();
    content = mergeLandingContent(row.content);
    from = row.version;
  }
  const saved = await saveLandingDraft(db, actorId, content, expectedRevision);
  await logAudit(db, {
    actorId,
    action: "page.restore",
    entity: "page",
    entityId: LANDING_PAGE,
    data: { from },
  });
  return saved;
}

type VersionRow = {
  id: string;
  version: number;
  note: string | null;
  publishedAt: Date;
  publishedBy: string | null;
};

export async function listLandingVersions(db: AppDb, limit = 30): Promise<VersionRow[]> {
  return db
    .select({
      id: pageVersions.id,
      version: pageVersions.version,
      note: pageVersions.note,
      publishedAt: pageVersions.publishedAt,
      publishedBy: user.email,
    })
    .from(pageVersions)
    .leftJoin(user, eq(user.id, pageVersions.publishedBy))
    .where(eq(pageVersions.page, LANDING_PAGE))
    .orderBy(desc(pageVersions.version))
    .limit(limit);
}

/** One version's content, for previewing it before restoring. */
export async function getLandingVersion(db: AppDb, id: string): Promise<LandingContent | null> {
  const [row] = await db
    .select({ content: pageVersions.content })
    .from(pageVersions)
    .where(and(eq(pageVersions.id, id), eq(pageVersions.page, LANDING_PAGE)));
  return row ? mergeLandingContent(row.content) : null;
}

/**
 * Relation chips that real synastry texts use ("Гэрлэлт", "Ах дүү", …), most common first —
 * offered as suggestions so the landing's examples match the product.
 */
export async function relationSuggestions(db: AppDb, limit = 24): Promise<string[]> {
  const rows = await db.execute<{ chip: string; n: number }>(sql`
    select trim(chip) as chip, count(*)::int as n
    from content_entries,
      lateral regexp_split_to_table(
        coalesce(fields->>'good_for', '') || ',' || coalesce(fields->>'caution_for', ''),
        E'[,\\n]'
      ) as chip
    where product_code = 'synastry' and trim(chip) <> ''
    group by 1
    order by 2 desc
    limit ${limit}`);
  const list = Array.isArray(rows) ? rows : (rows as { rows: { chip: string }[] }).rows;
  return list.map((r) => r.chip);
}
