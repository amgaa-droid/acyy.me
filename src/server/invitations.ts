import { createHash, randomBytes } from "node:crypto";

import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import type { AppDb } from "@/server/db/types";
import { invitations, persons } from "@/server/db/schema";
import { getPerson, getSelf, PersonNotFoundError } from "@/server/persons";

/**
 * Invitations (SPEC §7). A 32-byte random token goes into the link; only its SHA-256 hash is
 * stored. Valid for 7 days, single use. Accepting links the invited person to the new user
 * (`persons.linked_user_id`), which unlocks free reading of synastries with that person.
 */

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export type Invitation = typeof invitations.$inferSelect;

export class InvitationError extends Error {
  constructor(
    readonly reason:
      | "not_found"
      | "expired"
      | "used"
      | "revoked"
      | "own_invitation"
      | "self_person"
      | "already_linked"
      | "person_gone",
  ) {
    super(reason);
  }
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");
const tokenShape = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export function inviteUrl(appUrl: string, token: string): string {
  return new URL(`/invite/${token}`, appUrl).toString();
}

/**
 * Creates a fresh invitation for one of the inviter's people and revokes older pending ones,
 * so only the newest link works. Returns the raw token (never stored).
 */
export async function createInvitation(
  db: AppDb,
  opts: {
    inviterId: string;
    personId: string;
    channel: "link" | "email";
    email?: string | null;
    now?: Date;
  },
): Promise<{ invitation: Invitation; token: string }> {
  const person = await getPerson(db, opts.inviterId, opts.personId); // ownership (throws PersonNotFoundError)
  if (person.isSelf) throw new InvitationError("self_person");
  if (person.linkedUserId) throw new InvitationError("already_linked");
  const email = opts.channel === "email" ? z.email().parse(opts.email?.trim().toLowerCase()) : null;

  const token = newToken();
  const now = opts.now ?? new Date();
  const invitation = await db.transaction(async (tx) => {
    await tx
      .update(invitations)
      .set({ status: "revoked" })
      .where(and(eq(invitations.personId, person.id), eq(invitations.status, "pending")));
    const [row] = await tx
      .insert(invitations)
      .values({
        personId: person.id,
        inviterUserId: opts.inviterId,
        channel: opts.channel,
        email,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
      })
      .returning();
    return row;
  });
  return { invitation, token };
}

export type InvitationView = {
  id: string;
  inviterName: string;
  personName: string;
  personBirthDate: string;
  inviterUserId: string;
};

/** Looks a token up for the /invite page. Throws InvitationError when unusable. */
export async function viewInvitation(
  db: AppDb,
  token: string,
  now = new Date(),
): Promise<InvitationView> {
  if (!tokenShape.safeParse(token).success) throw new InvitationError("not_found");
  const [inv] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, hashToken(token)));
  if (!inv) throw new InvitationError("not_found");
  assertUsable(inv, now);

  const [person] = await db
    .select()
    .from(persons)
    .where(and(eq(persons.id, inv.personId), isNull(persons.deletedAt)));
  if (!person) throw new InvitationError("person_gone");
  const inviterSelf = await getSelf(db, inv.inviterUserId);
  return {
    id: inv.id,
    inviterName: inviterSelf?.name ?? "",
    personName: person.name,
    personBirthDate: person.birthDate,
    inviterUserId: inv.inviterUserId,
  };
}

function assertUsable(inv: Invitation, now: Date) {
  if (inv.status === "accepted") throw new InvitationError("used");
  if (inv.status === "revoked") throw new InvitationError("revoked");
  if (inv.status === "expired" || inv.expiresAt <= now) throw new InvitationError("expired");
}

/** Single-use: the row is locked, re-checked, then marked accepted in the same transaction. */
export async function acceptInvitation(
  db: AppDb,
  token: string,
  userId: string,
  now = new Date(),
): Promise<{ personId: string; inviterUserId: string }> {
  if (!tokenShape.safeParse(token).success) throw new InvitationError("not_found");
  const result = await db.transaction(async (tx) => {
    const [inv] = await tx
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, hashToken(token)))
      .for("update");
    if (!inv) throw new InvitationError("not_found");
    if (inv.status === "pending" && inv.expiresAt <= now) {
      // Commit the status change, then report the error outside the transaction.
      await tx.update(invitations).set({ status: "expired" }).where(eq(invitations.id, inv.id));
      return { expired: true as const };
    }
    assertUsable(inv, now);
    if (inv.inviterUserId === userId) throw new InvitationError("own_invitation");

    const [person] = await tx
      .select()
      .from(persons)
      .where(and(eq(persons.id, inv.personId), isNull(persons.deletedAt)))
      .for("update");
    if (!person) throw new InvitationError("person_gone");
    if (person.linkedUserId && person.linkedUserId !== userId)
      throw new InvitationError("already_linked");

    await tx.update(persons).set({ linkedUserId: userId }).where(eq(persons.id, person.id));
    await tx
      .update(invitations)
      .set({ status: "accepted", acceptedBy: userId, acceptedAt: now })
      .where(eq(invitations.id, inv.id));
    return { expired: false as const, personId: person.id, inviterUserId: inv.inviterUserId };
  });
  if (result.expired) throw new InvitationError("expired");
  return { personId: result.personId, inviterUserId: result.inviterUserId };
}

export async function revokeInvitation(
  db: AppDb,
  inviterId: string,
  invitationId: string,
): Promise<void> {
  if (!z.uuid().safeParse(invitationId).success) throw new InvitationError("not_found");
  const res = await db
    .update(invitations)
    .set({ status: "revoked" })
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.inviterUserId, inviterId),
        eq(invitations.status, "pending"),
      ),
    )
    .returning({ id: invitations.id });
  if (res.length === 0) throw new InvitationError("not_found");
}

/** Latest invitation for a person (inviter's view on the person page). */
export async function latestInvitation(db: AppDb, inviterId: string, personId: string) {
  const [inv] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.personId, personId), eq(invitations.inviterUserId, inviterId)))
    .orderBy(desc(invitations.createdAt))
    .limit(1);
  return inv ?? null;
}

/** People (in other users' lists) that this user is linked to — "Намайг холбосон". */
export async function peopleLinkedTo(db: AppDb, userId: string) {
  return db
    .select({ id: persons.id, name: persons.name, ownerUserId: persons.ownerUserId })
    .from(persons)
    .where(and(eq(persons.linkedUserId, userId), isNull(persons.deletedAt)));
}

/**
 * "Намайг хасах": the linked user removes the link. The inviter then sees a suggestion to
 * delete that person (accepted invitation + no link, see personLinkState).
 */
export async function unlinkMe(db: AppDb, userId: string, personId: string): Promise<void> {
  if (!z.uuid().safeParse(personId).success) throw new PersonNotFoundError();
  const res = await db
    .update(persons)
    .set({ linkedUserId: null })
    .where(and(eq(persons.id, personId), eq(persons.linkedUserId, userId)))
    .returning({ id: persons.id });
  if (res.length === 0) throw new PersonNotFoundError();
}

export type PersonLinkState =
  | { kind: "linked" }
  | {
      kind: "pending";
      invitationId: string;
      expiresAt: Date;
      channel: "link" | "email";
      email: string | null;
    }
  | { kind: "unlinked_by_them" }
  | { kind: "none" };

export async function personLinkState(
  db: AppDb,
  inviterId: string,
  person: { id: string; linkedUserId: string | null },
  now = new Date(),
): Promise<PersonLinkState> {
  if (person.linkedUserId) return { kind: "linked" };
  const inv = await latestInvitation(db, inviterId, person.id);
  if (!inv) return { kind: "none" };
  if (inv.status === "pending" && inv.expiresAt > now) {
    return {
      kind: "pending",
      invitationId: inv.id,
      expiresAt: inv.expiresAt,
      channel: inv.channel,
      email: inv.email,
    };
  }
  if (inv.status === "accepted") return { kind: "unlinked_by_them" };
  return { kind: "none" };
}

/** Name + date of the person this user was invited as — to pre-fill onboarding (SPEC §7). */
export async function invitationPrefill(db: AppDb, token: string, userId: string) {
  if (!tokenShape.safeParse(token).success) return null;
  const [row] = await db
    .select({ name: persons.name, birthDate: persons.birthDate })
    .from(invitations)
    .innerJoin(persons, eq(persons.id, invitations.personId))
    .where(and(eq(invitations.tokenHash, hashToken(token)), eq(invitations.acceptedBy, userId)));
  return row ?? null;
}
