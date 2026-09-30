"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { APP_NAME, env } from "@/env";
import { requireOnboardedUser } from "@/server/auth/current";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email";
import { invitationEmail } from "@/server/email/templates";
import {
  InvitationError,
  createInvitation,
  inviteUrl,
  revokeInvitation,
  unlinkMe,
} from "@/server/invitations";
import { PersonNotFoundError } from "@/server/persons";

type Result = { ok: true; url?: string } | { ok: false; error: string };

function fail(err: unknown): Result {
  if (err instanceof InvitationError) return { ok: false, error: err.reason };
  if (err instanceof PersonNotFoundError) return { ok: false, error: "not_found" };
  if (err instanceof z.ZodError) return { ok: false, error: "invalid_email" };
  console.error("[invite]", err);
  return { ok: false, error: "generic" };
}

/** New invite link for "Линк хуулах" / Web Share. */
export async function createInviteLinkAction(personId: string): Promise<Result> {
  const { user } = await requireOnboardedUser();
  try {
    const { token } = await createInvitation(db, { inviterId: user.id, personId, channel: "link" });
    revalidatePath(`/people/${personId}`);
    return { ok: true, url: inviteUrl(env().APP_URL, token) };
  } catch (err) {
    return fail(err);
  }
}

export async function sendInviteEmailAction(personId: string, email: string): Promise<Result> {
  const { user, self } = await requireOnboardedUser();
  try {
    const { token } = await createInvitation(db, {
      inviterId: user.id,
      personId,
      channel: "email",
      email,
    });
    const msg = invitationEmail(APP_NAME, self.name, inviteUrl(env().APP_URL, token));
    await sendEmail({ to: email.trim().toLowerCase(), ...msg });
    revalidatePath(`/people/${personId}`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function revokeInviteAction(personId: string, invitationId: string): Promise<Result> {
  const { user } = await requireOnboardedUser();
  try {
    await revokeInvitation(db, user.id, invitationId);
    revalidatePath(`/people/${personId}`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** "Намайг хасах" — called by the linked user (from /me or a shared reading). */
export async function unlinkMeAction(personId: string): Promise<Result> {
  const { user } = await requireOnboardedUser();
  try {
    await unlinkMe(db, user.id, personId);
    revalidatePath("/me");
    revalidatePath("/readings");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
