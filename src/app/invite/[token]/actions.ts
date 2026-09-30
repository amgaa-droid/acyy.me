"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { InvitationError, acceptInvitation } from "@/server/invitations";
import { getSelf } from "@/server/persons";

export async function acceptInviteAction(token: string): Promise<{ error: string }> {
  const user = await requireUser();
  try {
    await acceptInvitation(db, token, user.id);
  } catch (err) {
    if (err instanceof InvitationError) return { error: err.reason };
    console.error("[invite:accept]", err);
    return { error: "generic" };
  }
  // No "Би" yet → onboarding pre-filled with the invited person's name and date (SPEC §7).
  if (!(await getSelf(db, user.id))) redirect(`/onboarding?invite=${encodeURIComponent(token)}`);
  redirect("/readings?tab=mine");
}
