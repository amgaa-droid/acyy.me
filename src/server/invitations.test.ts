import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { invitations, persons, user } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { createTestDb, insertUser } from "@/test/db";
import {
  INVITE_TTL_MS,
  InvitationError,
  acceptInvitation,
  createInvitation,
  hashToken,
  personLinkState,
  revokeInvitation,
  unlinkMe,
  viewInvitation,
} from "./invitations";
import { PersonNotFoundError, createPerson, createSelf } from "./persons";
import { purchase } from "./purchase";
import { ReadingNotFoundError, getReading } from "./reading";
import { credit } from "./wallet";

let db: AppDb;
let close: () => Promise<void>;
let seq = 0;

beforeAll(async () => {
  ({ db, close } = await createTestDb({ withContent: true }));
});
afterAll(() => close());

async function inviter() {
  const u = await insertUser(db, `inv${++seq}@test.local`);
  const self = await createSelf(db, u.id, {
    name: "Анар",
    birthDate: "1995-10-30",
    avatarSeed: "Nova",
  });
  const friend = await createPerson(db, u.id, {
    name: "Бат",
    birthDate: "1994-08-05",
    avatarSeed: "Sage",
    relation: "friend",
  });
  await db.update(user).set({ adultConfirmedAt: new Date() }).where(eq(user.id, u.id));
  await credit(db, "topup", { userId: u.id, amount: 10_000, idempotencyKey: `seed-${u.id}` });
  return { userId: u.id, self, friend };
}
const invitee = async () => (await insertUser(db, `b${++seq}@test.local`)).id;
const reason = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: InvitationError) => e.reason ?? e.message,
  );

describe("createInvitation", () => {
  it("stores only the hash of a 32-byte token, valid for 7 days", async () => {
    const a = await inviter();
    const now = new Date("2026-10-01T00:00:00Z");
    const { invitation, token } = await createInvitation(db, {
      inviterId: a.userId,
      personId: a.friend.id,
      channel: "link",
      now,
    });
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(invitation.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(invitation)).not.toContain(token);
    expect(invitation.expiresAt.getTime() - now.getTime()).toBe(INVITE_TTL_MS);
  });

  it("only for your own, non-self, not-yet-linked people; a new link revokes the old one", async () => {
    const a = await inviter();
    const other = await inviter();
    await expect(
      createInvitation(db, { inviterId: other.userId, personId: a.friend.id, channel: "link" }),
    ).rejects.toBeInstanceOf(PersonNotFoundError);
    expect(
      await reason(
        createInvitation(db, { inviterId: a.userId, personId: a.self.id, channel: "link" }),
      ),
    ).toBe("self_person");
    await expect(
      createInvitation(db, {
        inviterId: a.userId,
        personId: a.friend.id,
        channel: "email",
        email: "not-an-email",
      }),
    ).rejects.toThrow();

    const first = await createInvitation(db, {
      inviterId: a.userId,
      personId: a.friend.id,
      channel: "link",
    });
    await createInvitation(db, {
      inviterId: a.userId,
      personId: a.friend.id,
      channel: "email",
      email: "Bat@Mail.mn",
    });
    expect(await reason(viewInvitation(db, first.token))).toBe("revoked");
  });
});

describe("acceptInvitation", () => {
  it("links the person, is single-use, and shows the inviter's view", async () => {
    const a = await inviter();
    const b = await invitee();
    const { token } = await createInvitation(db, {
      inviterId: a.userId,
      personId: a.friend.id,
      channel: "link",
    });
    expect(await viewInvitation(db, token)).toMatchObject({
      inviterName: "Анар",
      personName: "Бат",
      personBirthDate: "1994-08-05",
    });

    expect(await reason(acceptInvitation(db, token, a.userId))).toBe("own_invitation");
    await acceptInvitation(db, token, b);
    const [p] = await db.select().from(persons).where(eq(persons.id, a.friend.id));
    expect(p.linkedUserId).toBe(b);
    expect(await personLinkState(db, a.userId, p)).toEqual({ kind: "linked" });

    const c = await invitee();
    expect(await reason(acceptInvitation(db, token, c))).toBe("used");
    expect(await reason(viewInvitation(db, token))).toBe("used");
    expect(
      await reason(
        createInvitation(db, { inviterId: a.userId, personId: a.friend.id, channel: "link" }),
      ),
    ).toBe("already_linked");
  });

  it("expired and revoked tokens can't be used; garbage tokens are not found", async () => {
    const a = await inviter();
    const b = await invitee();
    const created = new Date("2026-01-01T00:00:00Z");
    const { token, invitation } = await createInvitation(db, {
      inviterId: a.userId,
      personId: a.friend.id,
      channel: "link",
      now: created,
    });
    const later = new Date(created.getTime() + INVITE_TTL_MS + 1);
    expect(await reason(acceptInvitation(db, token, b, later))).toBe("expired");
    const [row] = await db.select().from(invitations).where(eq(invitations.id, invitation.id));
    expect(row.status).toBe("expired");

    const again = await createInvitation(db, {
      inviterId: a.userId,
      personId: a.friend.id,
      channel: "link",
    });
    await revokeInvitation(db, a.userId, again.invitation.id);
    expect(await reason(acceptInvitation(db, again.token, b))).toBe("revoked");

    expect(await reason(viewInvitation(db, "x".repeat(43)))).toBe("not_found");
    expect(await reason(viewInvitation(db, "short"))).toBe("not_found");
  });

  it("a deleted person makes the link useless", async () => {
    const a = await inviter();
    const { token } = await createInvitation(db, {
      inviterId: a.userId,
      personId: a.friend.id,
      channel: "link",
    });
    await db.update(persons).set({ deletedAt: new Date() }).where(eq(persons.id, a.friend.id));
    expect(await reason(acceptInvitation(db, token, await invitee()))).toBe("person_gone");
  });
});

describe("free view and unlinking", () => {
  it("a linked user reads the synastry free — nothing else — until they unlink", async () => {
    const a = await inviter();
    const b = await invitee();
    const { token } = await createInvitation(db, {
      inviterId: a.userId,
      personId: a.friend.id,
      channel: "link",
    });
    await acceptInvitation(db, token, b);

    const syn = await purchase(db, {
      userId: a.userId,
      productCode: "synastry",
      personIds: [a.self.id, a.friend.id],
    });
    const sign = await purchase(db, {
      userId: a.userId,
      productCode: "sign",
      personIds: [a.friend.id],
    });
    expect((await getReading(db, b, syn.purchase.id)).viaLink).toBe(true);
    await expect(getReading(db, b, sign.purchase.id)).rejects.toBeInstanceOf(ReadingNotFoundError);

    const stranger = await invitee();
    await expect(unlinkMe(db, stranger, a.friend.id)).rejects.toBeInstanceOf(PersonNotFoundError);
    await unlinkMe(db, b, a.friend.id);
    await expect(getReading(db, b, syn.purchase.id)).rejects.toBeInstanceOf(ReadingNotFoundError);

    const [p] = await db.select().from(persons).where(eq(persons.id, a.friend.id));
    expect(await personLinkState(db, a.userId, p)).toEqual({ kind: "unlinked_by_them" });
  });
});
