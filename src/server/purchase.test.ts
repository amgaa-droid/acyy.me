import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { toIsoDate, todayYmd } from "@/lib/birth-date";
import { offersForPerson, loadViewer } from "@/server/catalog";
import {
  contentEntries,
  persons,
  products,
  purchases,
  user,
  walletEntries,
} from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { createTestDb, insertUser } from "@/test/db";
import { createPerson, createSelf } from "./persons";
import {
  ContentUnavailableError,
  NotEligibleError,
  PersonsInvalidError,
  ProductUnavailableError,
  purchase,
} from "./purchase";
import { ReadingNotFoundError, getPreview, getReading } from "./reading";
import { InsufficientFundsError, credit, getBalance } from "./wallet";

let db: AppDb;
let close: () => Promise<void>;
let seq = 0;

beforeAll(async () => {
  ({ db, close } = await createTestDb({ withContent: true }));
});
afterAll(() => close());

const yearsAgo = (n: number) => toIsoDate({ ...todayYmd(), m: 1, d: 15, y: todayYmd().y - n });

/** A user with "Би", a mother, a partner, optionally 18+ confirmed and some money. */
async function setup(
  opts: { selfAge?: number; confirmed?: boolean; balance?: number; partnerAge?: number } = {},
) {
  const u = await insertUser(db, `p${++seq}@test.local`);
  const self = await createSelf(db, u.id, {
    name: "Би",
    birthDate: yearsAgo(opts.selfAge ?? 30),
    avatarSeed: "Nova",
  });
  const mom = await createPerson(db, u.id, {
    name: "Ээж",
    birthDate: "1968-01-04",
    avatarSeed: "Iris",
    relation: "mother",
  });
  const partner = await createPerson(db, u.id, {
    name: "Хайрт",
    birthDate: yearsAgo(opts.partnerAge ?? 29),
    avatarSeed: "Sage",
    relation: "partner",
  });
  if (opts.confirmed ?? true)
    await db.update(user).set({ adultConfirmedAt: new Date() }).where(eq(user.id, u.id));
  if (opts.balance)
    await credit(db, "topup", {
      userId: u.id,
      amount: opts.balance,
      idempotencyKey: `seed-${u.id}`,
    });
  return { userId: u.id, self, mom, partner };
}

const codes = (offers: { product: { code: string } }[]) => offers.map((o) => o.product.code).sort();

describe("catalog", () => {
  it("family sees birthday, sign and synastry — not love/dating/sex", async () => {
    const { userId, mom } = await setup();
    expect(codes(await offersForPerson(db, await loadViewer(db, userId), mom))).toEqual([
      "birthday",
      "sign",
      "synastry",
    ]);
  });

  it("an adult, confirmed user sees 18+ for self and an adult partner", async () => {
    const { userId, self, partner } = await setup();
    const viewer = await loadViewer(db, userId);
    expect(codes(await offersForPerson(db, viewer, self))).toContain("sex");
    expect(codes(await offersForPerson(db, viewer, partner))).toEqual(
      ["birthday", "dating", "love", "sex", "sign", "synastry"].sort(),
    );
  });

  it("18+ is hidden for a minor user, an unconfirmed user, or a minor partner", async () => {
    const minor = await setup({ selfAge: 16 });
    const v1 = await loadViewer(db, minor.userId);
    expect(codes(await offersForPerson(db, v1, minor.self))).not.toContain("sex");
    expect(codes(await offersForPerson(db, v1, minor.partner))).not.toContain("sex");

    const unconfirmed = await setup({ confirmed: false });
    expect(
      codes(await offersForPerson(db, await loadViewer(db, unconfirmed.userId), unconfirmed.self)),
    ).not.toContain("sex");

    const youngPartner = await setup({ partnerAge: 17 });
    const v3 = await loadViewer(db, youngPartner.userId);
    expect(codes(await offersForPerson(db, v3, youngPartner.partner))).not.toContain("sex");
    expect(codes(await offersForPerson(db, v3, youngPartner.self))).toContain("sex");
  });

  it("inactive products disappear", async () => {
    const { userId, self } = await setup();
    await db.update(products).set({ isActive: false }).where(eq(products.code, "dating"));
    expect(codes(await offersForPerson(db, await loadViewer(db, userId), self))).not.toContain(
      "dating",
    );
    await db.update(products).set({ isActive: true }).where(eq(products.code, "dating"));
  });
});

describe("purchase", () => {
  it("charges the price, stores a snapshot and returns the same purchase on repeat", async () => {
    const { userId, mom } = await setup({ balance: 5_000 });
    const { purchase: p, alreadyOwned } = await purchase(db, {
      userId,
      productCode: "birthday",
      personIds: [mom.id],
    });
    expect(alreadyOwned).toBe(false);
    expect(p).toMatchObject({ pricePaid: 2_000, subjectKey: mom.id, personAId: mom.id });
    expect(p.snapshot).toEqual({
      persons: [
        {
          name: "Ээж",
          birthDate: "1968-01-04",
          gender: "unspecified",
          sign: "capricorn",
          period: 2,
        },
      ],
      keys: { main: "01-04" },
    });
    expect(await getBalance(db, userId)).toBe(3_000);

    const again = await purchase(db, { userId, productCode: "birthday", personIds: [mom.id] });
    expect(again).toMatchObject({ alreadyOwned: true, purchase: { id: p.id } });
    expect(await getBalance(db, userId)).toBe(3_000);
  });

  it("A×B then B×A is one purchase, charged once", async () => {
    const { userId, self, mom } = await setup({ balance: 5_000 });
    const ab = await purchase(db, {
      userId,
      productCode: "synastry",
      personIds: [self.id, mom.id],
    });
    const ba = await purchase(db, {
      userId,
      productCode: "synastry",
      personIds: [mom.id, self.id],
    });
    expect(ba).toMatchObject({ alreadyOwned: true, purchase: { id: ab.purchase.id } });
    expect(ab.purchase.snapshot.keys).toEqual({
      sign_pair: expect.stringMatching(/\|/),
      period_pair: expect.stringMatching(/^\d+\|\d+$/),
    });
    expect(await getBalance(db, userId)).toBe(4_000);
  });

  it("insufficient funds rolls everything back", async () => {
    const { userId, mom } = await setup({ balance: 1_500 });
    await expect(
      purchase(db, { userId, productCode: "birthday", personIds: [mom.id] }),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
    expect(await db.select().from(purchases).where(eq(purchases.userId, userId))).toHaveLength(0);
    expect(await getBalance(db, userId)).toBe(1_500);
    expect(
      await db.select().from(walletEntries).where(eq(walletEntries.userId, userId)),
    ).toHaveLength(1);
  });

  it("refuses products not allowed for the person", async () => {
    const { userId, mom, partner } = await setup({ balance: 5_000 });
    await expect(
      purchase(db, { userId, productCode: "dating", personIds: [mom.id] }),
    ).rejects.toBeInstanceOf(NotEligibleError);
    await expect(
      purchase(db, { userId, productCode: "sex", personIds: [mom.id] }),
    ).rejects.toBeInstanceOf(NotEligibleError);
    expect(
      (await purchase(db, { userId, productCode: "sex", personIds: [partner.id] })).alreadyOwned,
    ).toBe(false);
    expect(await getBalance(db, userId)).toBe(4_000);
  });

  it("refuses 18+ for a minor user even if the person is an adult", async () => {
    const { userId, partner } = await setup({ selfAge: 16, balance: 5_000 });
    await expect(
      purchase(db, { userId, productCode: "sex", personIds: [partner.id] }),
    ).rejects.toBeInstanceOf(NotEligibleError);
    expect(await getBalance(db, userId)).toBe(5_000);
  });

  it("validates people: someone else's, deleted, duplicated or wrong count", async () => {
    const a = await setup({ balance: 5_000 });
    const b = await setup({ balance: 5_000 });
    await expect(
      purchase(db, { userId: a.userId, productCode: "sign", personIds: [b.mom.id] }),
    ).rejects.toBeInstanceOf(PersonsInvalidError);
    await expect(
      purchase(db, { userId: a.userId, productCode: "synastry", personIds: [a.mom.id, a.mom.id] }),
    ).rejects.toBeInstanceOf(PersonsInvalidError);
    await expect(
      purchase(db, { userId: a.userId, productCode: "synastry", personIds: [a.mom.id] }),
    ).rejects.toBeInstanceOf(PersonsInvalidError);
    await db.update(persons).set({ deletedAt: new Date() }).where(eq(persons.id, a.partner.id));
    await expect(
      purchase(db, { userId: a.userId, productCode: "love", personIds: [a.partner.id] }),
    ).rejects.toBeInstanceOf(PersonsInvalidError);
    await expect(
      purchase(db, { userId: a.userId, productCode: "nope", personIds: [a.mom.id] }),
    ).rejects.toBeInstanceOf(ProductUnavailableError);
    expect(await getBalance(db, a.userId)).toBe(5_000);
  });

  it("won't charge for an unpublished text", async () => {
    const { userId, mom } = await setup({ balance: 5_000 });
    await db
      .update(contentEntries)
      .set({ status: "draft" })
      .where(and(eq(contentEntries.productCode, "sign"), eq(contentEntries.key, "capricorn")));
    await expect(
      purchase(db, { userId, productCode: "sign", personIds: [mom.id] }),
    ).rejects.toBeInstanceOf(ContentUnavailableError);
    expect(await getBalance(db, userId)).toBe(5_000);
    await db
      .update(contentEntries)
      .set({ status: "published" })
      .where(and(eq(contentEntries.productCode, "sign"), eq(contentEntries.key, "capricorn")));
  });
});

describe("reading & preview", () => {
  it("owner reads the full text; others get not-found", async () => {
    const a = await setup({ balance: 5_000 });
    const b = await setup();
    const { purchase: p } = await purchase(db, {
      userId: a.userId,
      productCode: "sign",
      personIds: [a.mom.id],
    });
    const r = await getReading(db, a.userId, p.id);
    expect(r.sections).toHaveLength(1);
    expect(r.sections[0].body).toContain("Гурав дахь өгүүлбэр");
    await expect(getReading(db, b.userId, p.id)).rejects.toBeInstanceOf(ReadingNotFoundError);
    await expect(getReading(db, b.userId, "not-a-uuid")).rejects.toBeInstanceOf(
      ReadingNotFoundError,
    );
  });

  it("a user linked to one of the two people reads that synastry for free — only synastry", async () => {
    const a = await setup({ balance: 5_000 });
    const friend = await insertUser(db, `linked${++seq}@test.local`);
    await db.update(persons).set({ linkedUserId: friend.id }).where(eq(persons.id, a.mom.id));
    const syn = await purchase(db, {
      userId: a.userId,
      productCode: "synastry",
      personIds: [a.self.id, a.mom.id],
    });
    const sign = await purchase(db, {
      userId: a.userId,
      productCode: "sign",
      personIds: [a.mom.id],
    });
    const r = await getReading(db, friend.id, syn.purchase.id);
    expect(r.viaLink).toBe(true);
    expect(r.sections.map((s) => s.section)).toEqual(["sign_pair", "period_pair"]);
    await expect(getReading(db, friend.id, sign.purchase.id)).rejects.toBeInstanceOf(
      ReadingNotFoundError,
    );
  });

  it("the preview never contains more than the first 2 sentences", async () => {
    const preview = await getPreview(db, "synastry", {
      sign_pair: "aries|leo",
      period_pair: "1|2",
    });
    expect(preview.sections).toHaveLength(2);
    const first = preview.sections[0];
    expect(first.excerpt).toContain("Энэ бол жинхэнэ текст ирэх хүртэлх түр бичвэр юм!");
    expect(first.excerpt).not.toContain("Гурав дахь");
    expect(preview.sections[1].excerpt).toBeNull();
    expect(JSON.stringify(preview)).not.toContain("Гурав дахь");
  });

  it("the preview adds the free teaser and skips sub-headings, but never later sections", async () => {
    await db
      .update(contentEntries)
      .set({
        body: "## Ерөнхий шинж\n\nНэг. Хоёр. Гурав.\n\n## Зөвлөгөө\n\nНууц зөвлөгөө.",
        teaser: "Давуу тал: Тайван\nСул тал: Удаан",
      })
      .where(
        and(
          eq(contentEntries.productCode, "birthday"),
          eq(contentEntries.section, "main"),
          eq(contentEntries.key, "02-29"),
        ),
      );
    const preview = await getPreview(db, "birthday", { main: "02-29" });
    expect(preview.sections[0]).toMatchObject({
      teaser: "Давуу тал: Тайван\nСул тал: Удаан",
      excerpt: "Нэг. Хоёр.",
    });
    const json = JSON.stringify(preview);
    expect(json).not.toContain("Ерөнхий шинж");
    expect(json).not.toContain("Гурав");
    expect(json).not.toContain("Нууц зөвлөгөө");
  });
});
