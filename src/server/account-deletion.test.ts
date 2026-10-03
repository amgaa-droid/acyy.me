import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  account,
  auditLogs,
  invitations,
  persons,
  purchases,
  session,
  user,
  walletEntries,
} from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { createTestDb, insertUser } from "@/test/db";
import {
  DELETED_USER_NAME,
  accountDeletionSummary,
  deleteAccount,
  deletedEmail,
} from "./account-deletion";
import { acceptInvitation, createInvitation } from "./invitations";
import { createPerson, createSelf } from "./persons";
import { purchase } from "./purchase";
import { credit, getBalance, ledgerSum } from "./wallet";

let db: AppDb;
let close: () => Promise<void>;
let seq = 0;

beforeAll(async () => {
  ({ db, close } = await createTestDb({ withContent: true }));
});
afterAll(() => close());

/** A user with "Би", a friend, a synastry reading, money left, a login and a session. */
async function owner() {
  const u = await insertUser(db, `del${++seq}@test.local`);
  const self = await createSelf(db, u.id, { name: "Анар", birthDate: "1995-10-30", avatarSeed: "Nova" });
  const friend = await createPerson(db, u.id, {
    name: "Бат",
    birthDate: "1994-08-05",
    avatarSeed: "Sage",
    relation: "friend",
  });
  await credit(db, "topup", { userId: u.id, amount: 10_000, idempotencyKey: `seed-${u.id}` });
  const syn = await purchase(db, {
    userId: u.id,
    productCode: "synastry",
    personIds: [self.id, friend.id],
  });
  await db.insert(account).values({ providerId: "google", accountId: `g${seq}`, userId: u.id });
  await db.insert(session).values({
    token: `t${seq}`,
    userId: u.id,
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  return { userId: u.id, self, friend, purchaseId: syn.purchase.id };
}

describe("accountDeletionSummary", () => {
  it("counts the balance, readings, people besides Би and linked users", async () => {
    const a = await owner();
    const b = await insertUser(db, `link${seq}@test.local`);
    const { token } = await createInvitation(db, {
      inviterId: a.userId,
      personId: a.friend.id,
      channel: "link",
    });
    await acceptInvitation(db, token, b.id);

    expect(await accountDeletionSummary(db, a.userId)).toEqual({
      balance: await getBalance(db, a.userId),
      readings: 1,
      people: 1,
      linkedOthers: 1,
    });
  });
});

describe("deleteAccount", () => {
  it("removes personal data and keeps an anonymised money trail", async () => {
    const a = await owner();
    const balance = await getBalance(db, a.userId);
    await createInvitation(db, { inviterId: a.userId, personId: a.friend.id, channel: "link" });

    await deleteAccount(db, a.userId);

    const [u] = await db.select().from(user).where(eq(user.id, a.userId));
    expect(u).toMatchObject({
      name: DELETED_USER_NAME,
      email: deletedEmail(a.userId),
      emailVerified: false,
      image: null,
      adultConfirmedAt: null,
    });
    expect(u.deletedAt).toBeInstanceOf(Date);

    expect(await db.select().from(persons).where(eq(persons.ownerUserId, a.userId))).toEqual([]);
    expect(await db.select().from(invitations).where(eq(invitations.inviterUserId, a.userId))).toEqual([]);
    expect(await db.select().from(session).where(eq(session.userId, a.userId))).toEqual([]);
    expect(await db.select().from(account).where(eq(account.userId, a.userId))).toEqual([]);

    // The sale stays, without the people's names or links.
    const [p] = await db.select().from(purchases).where(eq(purchases.id, a.purchaseId));
    expect(p.personAId).toBeNull();
    expect(p.personBId).toBeNull();
    expect(p.snapshot.persons.map((x) => x.name)).toEqual(["", ""]);
    expect(p.snapshot.persons.map((x) => x.birthDate).sort()).toEqual(["1994-08-05", "1995-10-30"]);

    // The ledger is untouched and still adds up.
    expect(await getBalance(db, a.userId)).toBe(balance);
    expect(await ledgerSum(db, a.userId)).toBe(balance);
    expect(
      (await db.select().from(walletEntries).where(eq(walletEntries.userId, a.userId))).length,
    ).toBe(2);

    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.entityId, a.userId));
    expect(log).toMatchObject({ action: "account.delete", actorId: a.userId });
    expect(JSON.stringify(log.data)).not.toContain("@");
  });

  it("unlinks the user from other owners' people, who keep their person", async () => {
    const a = await owner();
    const b = await owner();
    const { token } = await createInvitation(db, {
      inviterId: a.userId,
      personId: a.friend.id,
      channel: "link",
    });
    await acceptInvitation(db, token, b.userId);

    await deleteAccount(db, b.userId);

    const [friend] = await db.select().from(persons).where(eq(persons.id, a.friend.id));
    expect(friend.linkedUserId).toBeNull();
    expect(friend.deletedAt).toBeNull();
  });

  it("is idempotent and frees the email for a new sign-up", async () => {
    const a = await owner();
    const [{ email }] = await db.select({ email: user.email }).from(user).where(eq(user.id, a.userId));
    await deleteAccount(db, a.userId);
    await deleteAccount(db, a.userId);

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, a.userId));
    expect(logs).toHaveLength(1);
    await expect(insertUser(db, email)).resolves.toMatchObject({ email });
  });
});
