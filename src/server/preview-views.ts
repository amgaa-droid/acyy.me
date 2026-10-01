import { sql } from "drizzle-orm";

import type { AppDb } from "@/server/db/types";
import { previewViews } from "@/server/db/schema";

/**
 * Records that a user saw the free paywall preview of a product for a subject (SPEC §3.1),
 * for the admin "free views → purchases" conversion. Analytics only: never throws.
 */
export async function recordPreviewView(
  db: AppDb,
  view: { userId: string; productCode: string; subjectKey: string },
  now = new Date(),
): Promise<void> {
  try {
    await db
      .insert(previewViews)
      .values({ ...view, firstViewedAt: now, lastViewedAt: now })
      .onConflictDoUpdate({
        target: [previewViews.userId, previewViews.productCode, previewViews.subjectKey],
        set: { viewCount: sql`${previewViews.viewCount} + 1`, lastViewedAt: now },
      });
  } catch (err) {
    console.error("[preview-views]", err);
  }
}
