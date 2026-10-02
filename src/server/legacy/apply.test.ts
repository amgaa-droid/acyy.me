import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isAvatarSeed } from "@/lib/avatar-seeds";
import { loadAstroRefs } from "@/server/astro/refs";
import type { AppDb } from "@/server/db/types";
import { account, persons, purchases, user, walletEntries } from "@/server/db/schema";
import {
  SelfAlreadyExistsError,
  getSelf,
  listSelfCandidates,
  promoteToSelf,
} from "@/server/persons";
import { loadProductDefs } from "@/server/products";
import { getBalance } from "@/server/wallet";
import { createTestDb, insertUser } from "@/test/db";
import { applyLegacyUser, legacyAvatar, type ApplyContext } from "./apply";
import type { UserPlan } from "./users";

let db: AppDb;
let close: () => Promise<void>;
let ctx: ApplyContext;

beforeAll(async () => {
  ({ db, close } = await createTestDb({ withContent: true }));
  const defs = await loadProductDefs(db);
  ctx = { refs: await loadAstroRefs(db), products: new Map(defs.map((d) => [d.code, d])) };
});
afterAll(() => close());

let seq = 100;
function plan(extra: Partial<UserPlan> = {}): UserPlan {
  const id = ++seq;
  return {
    legacyUserId: id,
    facebookId: `fb${id}`,
    email: `legacy${id}@gmail.com`,
    name: `Legacy ${id}`,
    createdAt: "2019-06-01T08:00:00.000",
    balance: 13000,
    people: [
      {
        key: "1990-05-12|би",
        name: "Би",
        relation: "other",
        relationLabel: "Би",
        gender: "female",
        birthDate: "1990-05-12",
      },
      {
        key: "1988-01-02|нөхөр",
        name: "Нөхөр",
        relation: "partner",
        relationLabel: null,
        gender: "unspecified",
        birthDate: "1988-01-02",
      },
    ],
    purchases: [
      {
        product: "birthday",
        personKeys: ["1990-05-12|би"],
        pricePaid: 2000,
        createdAt: "2021-02-03T04:05:06.000",
        legacyRef: `action:${id}`,
      },
      {
        product: "synastry",
        personKeys: ["1990-05-12|би", "1988-01-02|нөхөр"],
        pricePaid: 1000,
        createdAt: "2024-05-05T12:00:00.000",
        legacyRef: `relation:${id}`,
      },
    ],
    ...extra,
  };
}

describe("applyLegacyUser", () => {
  it("creates the account, its Facebook login, people, paid readings and balance", async () => {
    const p = plan();
    const res = await applyLegacyUser(db, p, ctx);
    expect(res).toMatchObject({
      ok: true,
      createdUser: true,
      newPeople: 2,
      newPurchases: 2,
      credited: 13000,
    });
    if (!res.ok) return;

    const [u] = await db.select().from(user).where(eq(user.id, res.userId));
    expect(u).toMatchObject({
      email: p.email,
      legacyUserId: p.legacyUserId,
      legacyClaimedAt: null,
      emailVerified: false,
    });
    expect(u.createdAt.toISOString()).toBe("2019-06-01T08:00:00.000Z");

    const accounts = await db.select().from(account).where(eq(account.userId, res.userId));
    expect(accounts).toMatchObject([{ providerId: "facebook", accountId: p.facebookId }]);

    const people = await db.select().from(persons).where(eq(persons.ownerUserId, res.userId));
    expect(people.every((x) => !x.isSelf && isAvatarSeed(x.avatarSeed))).toBe(true);

    const bought = await db.select().from(purchases).where(eq(purchases.userId, res.userId));
    const birthday = bought.find((x) => x.productCode === "birthday")!;
    expect(birthday).toMatchObject({ pricePaid: 2000, legacyRef: `action:${p.legacyUserId}` });
    expect(birthday.snapshot.keys).toEqual({ main: "05-12" });
    expect(birthday.createdAt.toISOString()).toBe("2021-02-03T04:05:06.000Z");
    const synastry = bought.find((x) => x.productCode === "synastry")!;
    expect(synastry.personBId).not.toBeNull();
    expect(Object.keys(synastry.snapshot.keys).sort()).toEqual(["period_pair", "sign_pair"]);

    // The balance is the only wallet movement — legacy readings were paid on the old site.
    const entries = await db
      .select()
      .from(walletEntries)
      .where(eq(walletEntries.userId, res.userId));
    expect(entries).toMatchObject([
      { type: "adjust", amount: 13000, idempotencyKey: `legacy:balance:${p.legacyUserId}` },
    ]);
    expect(await getBalance(db, res.userId)).toBe(13000);
  });

  it("is idempotent: a second run adds nothing and credits nothing", async () => {
    const p = plan();
    const first = await applyLegacyUser(db, p, ctx);
    const again = await applyLegacyUser(db, p, ctx);
    expect(again).toMatchObject({
      ok: true,
      userId: first.ok ? first.userId : "",
      createdUser: false,
      newPeople: 0,
      newPurchases: 0,
      credited: 0,
    });
    if (again.ok) expect(await getBalance(db, again.userId)).toBe(13000);
  });

  it("adopts an existing account with the same email", async () => {
    const p = plan({ balance: 0 });
    const existing = await insertUser(db, p.email);
    const res = await applyLegacyUser(db, p, ctx);
    expect(res).toMatchObject({
      ok: true,
      userId: existing.id,
      createdUser: false,
      newPurchases: 2,
    });
    const [u] = await db.select().from(user).where(eq(user.id, existing.id));
    expect(u.legacyUserId).toBe(p.legacyUserId);
  });

  it("rolls back when the Facebook id already belongs to someone else", async () => {
    const other = await insertUser(db, `taken${seq}@test.local`);
    const p = plan();
    await db
      .insert(account)
      .values({ providerId: "facebook", accountId: p.facebookId, userId: other.id });
    expect(await applyLegacyUser(db, p, ctx)).toEqual({ ok: false, reason: "facebook_id_taken" });
    expect(await db.select().from(user).where(eq(user.legacyUserId, p.legacyUserId))).toEqual([]);
  });

  it("refuses an account that already has a different Facebook login", async () => {
    const p = plan();
    const existing = await insertUser(db, p.email);
    await db
      .insert(account)
      .values({ providerId: "facebook", accountId: "someone-else", userId: existing.id });
    expect(await applyLegacyUser(db, p, ctx)).toEqual({
      ok: false,
      reason: "user_has_other_facebook",
    });
    const [u] = await db.select().from(user).where(eq(user.id, existing.id));
    expect(u.legacyUserId).toBeNull();
  });
});

describe("legacyAvatar", () => {
  it("is stable per person and always a valid seed", () => {
    const p = { key: "1990-05-12|би", gender: "female" as const };
    expect(legacyAvatar(p)).toBe(legacyAvatar(p));
    expect(isAvatarSeed(legacyAvatar(p))).toBe(true);
  });
});

describe("choosing 'Би' after migration", () => {
  it("lists migrated people ('Би' first) and promotes the chosen one", async () => {
    const res = await applyLegacyUser(db, plan(), ctx);
    if (!res.ok) throw new Error("apply failed");
    const candidates = await listSelfCandidates(db, res.userId);
    expect(candidates.map((c) => c.name)).toEqual(["Би", "Нөхөр"]);
    expect(await getSelf(db, res.userId)).toBeNull();

    const self = await promoteToSelf(db, res.userId, {
      personId: candidates[0].id,
      name: "Сараа",
      gender: "female",
      avatarSeed: "Nova",
    });
    expect(self).toMatchObject({
      isSelf: true,
      relation: "self",
      relationLabel: null,
      name: "Сараа",
      birthDate: "1990-05-12",
    });
    expect(await listSelfCandidates(db, res.userId)).toHaveLength(1);

    // Bought readings keep pointing at the same person.
    const [bday] = await db
      .select()
      .from(purchases)
      .where(and(eq(purchases.userId, res.userId), eq(purchases.productCode, "birthday")));
    expect(bday.personAId).toBe(self.id);

    await expect(
      promoteToSelf(db, res.userId, {
        personId: candidates[1].id,
        name: "Дахин",
        avatarSeed: "Nova",
      }),
    ).rejects.toBeInstanceOf(SelfAlreadyExistsError);
  });

  it("can't promote someone else's person", async () => {
    const a = await applyLegacyUser(db, plan(), ctx);
    const b = await applyLegacyUser(db, plan(), ctx);
    if (!a.ok || !b.ok) throw new Error("apply failed");
    const [theirs] = await listSelfCandidates(db, b.userId);
    await expect(
      promoteToSelf(db, a.userId, { personId: theirs.id, name: "X", avatarSeed: "Nova" }),
    ).rejects.toThrow("person_not_found");
  });
});
