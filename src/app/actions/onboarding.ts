"use server";

import { requireOnboardedUser } from "@/server/auth/current";
import { db } from "@/server/db";
import { markOnboarding, onboardingMarkSchema } from "@/server/onboarding";

/** Records a first-run guide step for the signed-in user (only theirs; first time wins). */
export async function markOnboardingAction(mark: unknown): Promise<void> {
  const { user } = await requireOnboardedUser();
  const parsed = onboardingMarkSchema.safeParse(mark);
  if (!parsed.success) return;
  await markOnboarding(db, user.id, parsed.data);
}
