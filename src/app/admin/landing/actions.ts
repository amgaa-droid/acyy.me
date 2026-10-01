"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { issuesByPath, type IssueCode, type LandingContent } from "@/lib/landing-content";
import { requireAdmin } from "@/server/admin/guard";
import { db } from "@/server/db";
import {
  DraftConflictError,
  NothingToPublishError,
  VersionNotFoundError,
  discardLandingDraft,
  getLandingDraft,
  getPublishedLanding,
  publishLandingDraft,
  restoreIntoDraft,
  saveLandingDraft,
} from "@/server/landing-cms";

/** Landing CMS (Owner + Editor: page copy is content, SPEC §5). */

export type CmsResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: "conflict" | "invalid" | "not_found" | "generic"; issues?: Record<string, IssueCode> };

const revision = z.number().int().min(0);

function fail(err: unknown, where: string): CmsResult<never> {
  if (err instanceof DraftConflictError || err instanceof NothingToPublishError)
    return { ok: false, error: "conflict" };
  if (err instanceof VersionNotFoundError) return { ok: false, error: "not_found" };
  if (err instanceof z.ZodError) return { ok: false, error: "invalid", issues: issuesByPath(err) };
  console.error(`[admin:landing:${where}]`, err);
  return { ok: false, error: "generic" };
}

const refresh = () => {
  revalidatePath("/admin/landing");
  revalidatePath("/preview/landing");
};

export async function saveLandingDraftAction(
  content: unknown,
  expectedRevision: number,
): Promise<CmsResult<{ revision: number }>> {
  const admin = await requireAdmin();
  try {
    const r = await saveLandingDraft(db, admin.userId, content, revision.parse(expectedRevision));
    refresh();
    return { ok: true, revision: r.revision };
  } catch (err) {
    return fail(err, "save");
  }
}

export async function publishLandingAction(
  expectedRevision: number,
  note: string,
): Promise<CmsResult<{ version: number }>> {
  const admin = await requireAdmin();
  try {
    const r = await publishLandingDraft(
      db,
      admin.userId,
      revision.parse(expectedRevision),
      z.string().max(200).parse(note),
    );
    refresh();
    revalidatePath("/");
    return { ok: true, version: r.version };
  } catch (err) {
    return fail(err, "publish");
  }
}

/** Returns the live content, which the editor shows again. */
export async function discardLandingDraftAction(): Promise<CmsResult<{ content: LandingContent }>> {
  const admin = await requireAdmin();
  try {
    await discardLandingDraft(db, admin.userId);
    refresh();
    return { ok: true, content: (await getPublishedLanding(db)).content };
  } catch (err) {
    return fail(err, "discard");
  }
}

/** `versionId` null = the built-in defaults. */
export async function restoreLandingAction(
  versionId: string | null,
  expectedRevision: number,
): Promise<CmsResult<{ revision: number; content: LandingContent }>> {
  const admin = await requireAdmin();
  try {
    const id = versionId === null ? null : z.uuid().parse(versionId);
    const r = await restoreIntoDraft(db, admin.userId, id, revision.parse(expectedRevision));
    refresh();
    const draft = await getLandingDraft(db);
    return { ok: true, revision: r.revision, content: draft!.content };
  } catch (err) {
    return fail(err, "restore");
  }
}
