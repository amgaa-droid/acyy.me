import { eq, sql } from "drizzle-orm";

import type { OnboardingMark, OnboardingProgress } from "@/lib/onboarding";
import type { AppDb } from "@/server/db/types";
import { user } from "@/server/db/schema";

export {
  guideState,
  onboardingMarkSchema,
  type GuideStep,
  type OnboardingMark,
  type OnboardingProgress,
} from "@/lib/onboarding";

export async function getOnboarding(db: AppDb, userId: string): Promise<OnboardingProgress> {
  const [row] = await db.select({ onboarding: user.onboarding }).from(user).where(eq(user.id, userId));
  return (row?.onboarding ?? {}) as OnboardingProgress;
}

/** Records a mark once (the first time wins); returns the progress after. */
export async function markOnboarding(
  db: AppDb,
  userId: string,
  mark: OnboardingMark,
): Promise<OnboardingProgress> {
  const [row] = await db
    .update(user)
    .set({
      onboarding: sql`jsonb_build_object(${mark}::text, to_jsonb(now())) || ${user.onboarding}`,
    })
    .where(eq(user.id, userId))
    .returning({ onboarding: user.onboarding });
  return (row?.onboarding ?? {}) as OnboardingProgress;
}
