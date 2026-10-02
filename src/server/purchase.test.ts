import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { toIsoDate, todayYmd } from "@/lib/birth-date";
import { offersForPerson, loadViewer } from "@/server/catalog";
import { addPart, createProduct, setPartArchived } from "@/server/admin/catalog";
import { GenderRequiredError } from "@/server/content/keys";
import {
  contentEntries,
  persons,
  productFields,
  products,
  purchases,
  user,
  walletEntries,
} from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { createTestDb, insertUser } from "@/test/db";
import {
  GenderLockedError,
  createPerson,
  createSelf,
  deletePerson,
  isGenderLocked,
  updatePerson,
} from "./persons";
import {
  ContentUnavailableError,
  NotEligibleError,
  PersonsInvalidError,
  ProductUnavailableError,
  purchase,
} from "./purchase";
import { ReadingNotFoundError, getPreview, getReading, readingNames } from "./reading";
import { InsufficientFundsError, credit, getBalance } from "./wallet";

let db: AppDb;
let close: () => Promise<void>;
let seq = 0;

let adminId: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb({ withContent: true }));
  adminId = (await insertUser(db, "owner@test.local")).id;
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
    expect(r.sections[0].fields?.[0]).toMatchObject({ code: "general", kind: "text" });
    expect(r.sections[0].fields?.[0].value).toContain("Гурав дахь өгүүлбэр");
    await expect(getReading(db, b.userId, p.id)).rejects.toBeInstanceOf(ReadingNotFoundError);
    await expect(getReading(db, b.userId, "not-a-uuid")).rejects.toBeInstanceOf(
      ReadingNotFoundError,
    );
  });

  it("a user linked to one of the two people reads a pair reading for free — not single ones", async () => {
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
    expect(r.sections.map((s) => s.section)).toEqual(["period_pair", "sign_pair"]);
    await expect(getReading(db, friend.id, sign.purchase.id)).rejects.toBeInstanceOf(
      ReadingNotFoundError,
    );
  });

  it("the preview never contains more than the first 2 sentences", async () => {
    const preview = await getPreview(db, "synastry", {
      sign_pair: "aries|leo",
      period_pair: "1|2",
    });
    // The period pair (relationship advice, migration 0016), then both sign-pair directions.
    expect(preview.sections.map((s) => s.key)).toEqual(["1|2", "aries|leo", "leo|aries"]);
    const first = preview.sections[0];
    expect(first.excerpt).toContain("Энэ бол жинхэнэ текст ирэх хүртэлх түр бичвэр юм!");
    expect(first.excerpt).not.toContain("Гурав дахь");
    expect(preview.sections.slice(1).every((s) => s.excerpt === null)).toBe(true);
    expect(JSON.stringify(preview)).not.toContain("Гурав дахь");
  });

  it("the preview adds the teaser and free sub-sections, never paid ones beyond 2 sentences", async () => {
    await db
      .update(contentEntries)
      .set({
        fields: {
          strengths: "Тайван\nБодлоготой",
          general: "## Дэд\n\nНэг. Хоёр. Гурав.",
          meditation: "Нууц ишлэл.",
          advice: "Нууц зөвлөгөө.",
        },
        teaser: "Тизер",
      })
      .where(
        and(
          eq(contentEntries.productCode, "birthday"),
          eq(contentEntries.section, "main"),
          eq(contentEntries.key, "02-29"),
        ),
      );
    const preview = await getPreview(db, "birthday", { main: "02-29" });
    expect(preview.sections[0]).toMatchObject({ teaser: "Тизер", excerpt: "Нэг. Хоёр." });
    expect(preview.sections[0].free.map((f) => [f.code, f.value])).toEqual([
      ["strengths", "Тайван\nБодлоготой"],
    ]);
    const json = JSON.stringify(preview);
    expect(json).not.toContain("Дэд");
    expect(json).not.toContain("Гурав");
    expect(json).not.toContain("Нууц");
  });

  it("archived sub-sections are hidden from the reading", async () => {
    const a = await setup({ balance: 5_000 });
    const { purchase: p } = await purchase(db, {
      userId: a.userId,
      productCode: "birthday",
      personIds: [a.mom.id],
    });
    await db
      .update(contentEntries)
      .set({ fields: { general: "Текст.", tarot: "Таро." } })
      .where(and(eq(contentEntries.productCode, "birthday"), eq(contentEntries.key, "01-04")));
    const codes = async () =>
      (await getReading(db, a.userId, p.id)).sections[0].fields?.map((f) => f.code);
    expect(await codes()).toEqual(["general", "tarot"]);
    await db
      .update(productFields)
      .set({ archivedAt: new Date() })
      .where(and(eq(productFields.productCode, "birthday"), eq(productFields.code, "tarot")));
    expect(await codes()).toEqual(["general"]);
    await db
      .update(productFields)
      .set({ archivedAt: null })
      .where(and(eq(productFields.productCode, "birthday"), eq(productFields.code, "tarot")));
  });
});

describe("editing a person after a purchase", () => {
  it("a bought reading stays on the person's page after a relation change makes it ineligible", async () => {
    const { userId, partner } = await setup({ balance: 5_000 });
    const viewer = await loadViewer(db, userId);
    const { purchase: p } = await purchase(db, {
      userId,
      productCode: "love",
      personIds: [partner.id],
    });
    const asMother = await updatePerson(db, userId, partner.id, { relation: "mother" });
    const offers = await offersForPerson(db, viewer, asMother);
    expect(offers.find((o) => o.product.code === "love")?.purchaseId).toBe(p.id);
    // Unbought romantic products are still hidden for family.
    expect(codes(offers)).not.toContain("dating");
  });

  it("a bought reading stays on the person's page after its product is deactivated", async () => {
    const { userId, mom } = await setup({ balance: 5_000 });
    const { purchase: p } = await purchase(db, {
      userId,
      productCode: "birthday",
      personIds: [mom.id],
    });
    await db.update(products).set({ isActive: false }).where(eq(products.code, "birthday"));
    try {
      const offers = await offersForPerson(db, await loadViewer(db, userId), mom);
      expect(offers.find((o) => o.product.code === "birthday")?.purchaseId).toBe(p.id);
    } finally {
      await db.update(products).set({ isActive: true }).where(eq(products.code, "birthday"));
    }
  });

  it("a rename shows on bought readings; the text and snapshot stay as bought", async () => {
    const a = await setup({ balance: 5_000 });
    const { purchase: p } = await purchase(db, {
      userId: a.userId,
      productCode: "synastry",
      personIds: [a.self.id, a.mom.id],
    });
    const before = await getReading(db, a.userId, p.id);
    await updatePerson(db, a.userId, a.mom.id, { name: "Ээжээ", gender: "female" });
    const after = await getReading(db, a.userId, p.id);
    expect(after.sections).toEqual(before.sections);
    expect(after.snapshot.persons[1]).toMatchObject({ name: "Ээж", gender: "unspecified" });
    expect((await readingNames(db, a.userId, [p])).get(p.id)).toEqual(["Би", "Ээжээ"]);

    // A linked viewer doesn't own the people: they see the names as bought.
    const friend = await insertUser(db, `linked${++seq}@test.local`);
    expect((await readingNames(db, friend.id, [p])).get(p.id)).toEqual(["Би", "Ээж"]);

    // A deleted person falls back to the snapshot name.
    await deletePerson(db, a.userId, a.mom.id);
    expect((await readingNames(db, a.userId, [p])).get(p.id)).toEqual(["Би", "Ээж"]);
  });
});

describe("new key types", () => {
  it("gender-split products need the person's gender, then key by it", async () => {
    await createProduct(db, adminId, {
      code: "career",
      nameMn: "Ажил",
      personCount: 1,
      price: 500,
      keyType: "sign",
      byGender: true,
    });
    await db.update(products).set({ isActive: true }).where(eq(products.code, "career"));
    await db.insert(contentEntries).values(
      ["capricorn|female", "capricorn|male"].map((key) => ({
        productCode: "career",
        section: "main",
        key,
        title: key,
        fields: { general: `Текст ${key}.` },
        status: "published" as const,
      })),
    );
    const a = await setup({ balance: 5_000 });
    // Ээж (1968-01-04, Матар) has no gender yet.
    await expect(
      purchase(db, { userId: a.userId, productCode: "career", personIds: [a.mom.id] }),
    ).rejects.toBeInstanceOf(GenderRequiredError);
    expect(await getBalance(db, a.userId)).toBe(5_000);

    await db.update(persons).set({ gender: "female" }).where(eq(persons.id, a.mom.id));
    const { purchase: p } = await purchase(db, {
      userId: a.userId,
      productCode: "career",
      personIds: [a.mom.id],
    });
    expect(p.snapshot.keys).toEqual({ main: "capricorn|female" });

    // The bought text depends on the gender now: it locks, the rest stays editable.
    expect(await isGenderLocked(db, a.userId, a.mom.id)).toBe(true);
    await expect(updatePerson(db, a.userId, a.mom.id, { gender: "male" })).rejects.toBeInstanceOf(
      GenderLockedError,
    );
    const renamed = await updatePerson(db, a.userId, a.mom.id, { name: "Ээжээ", gender: "female" });
    expect(renamed).toMatchObject({ name: "Ээжээ", gender: "female" });

    // A text that doesn't depend on the gender doesn't lock it.
    await updatePerson(db, a.userId, a.partner.id, { gender: "male" });
    await purchase(db, { userId: a.userId, productCode: "birthday", personIds: [a.partner.id] });
    expect(await isGenderLocked(db, a.userId, a.partner.id)).toBe(false);
    await updatePerson(db, a.userId, a.partner.id, { gender: "female" });
  });

  it("ordered pairs: one purchase for the pair, the reading shows both directions", async () => {
    await createProduct(db, adminId, {
      code: "crush",
      nameMn: "Сэтгэл",
      personCount: 2,
      price: 100,
      keyType: "sign_pair_ordered",
    });
    await db.update(products).set({ isActive: true }).where(eq(products.code, "crush"));
    const a = await setup({ balance: 5_000 });
    const leo = await createPerson(db, a.userId, {
      name: "Найз",
      birthDate: "1990-08-01",
      avatarSeed: "Sage",
      relation: "friend",
    });
    const text = (key: string) =>
      db.insert(contentEntries).values({
        productCode: "crush",
        section: "main",
        key,
        title: key,
        fields: { general: `Текст ${key}.` },
        status: "published" as const,
      });
    await text("leo|capricorn");
    // Both directions must be there before anyone is charged.
    await expect(
      purchase(db, { userId: a.userId, productCode: "crush", personIds: [leo.id, a.mom.id] }),
    ).rejects.toBeInstanceOf(ContentUnavailableError);
    await text("capricorn|leo");
    const ab = await purchase(db, {
      userId: a.userId,
      productCode: "crush",
      personIds: [leo.id, a.mom.id],
    });
    const ba = await purchase(db, {
      userId: a.userId,
      productCode: "crush",
      personIds: [a.mom.id, leo.id],
    });
    // B×A is the same purchase — charged once.
    expect(ba.alreadyOwned).toBe(true);
    expect(ba.purchase.id).toBe(ab.purchase.id);
    expect(ab.purchase.snapshot.keys.main).toBe("leo|capricorn");
    expect(await getBalance(db, a.userId)).toBe(4_900);
    const r = await getReading(db, a.userId, ab.purchase.id);
    expect(r.sections.map((s) => [s.section, s.key, s.title])).toEqual([
      ["main", "leo|capricorn", "leo|capricorn"],
      ["main", "capricorn|leo", "capricorn|leo"],
    ]);
  });
});

describe("parts added or archived after a sale", () => {
  it("earlier buyers get new parts free and keep archived ones; new buyers get only active", async () => {
    await createProduct(db, adminId, {
      code: "later",
      nameMn: "Хожим",
      personCount: 1,
      price: 100,
      keyType: "sign",
    });
    await db.update(products).set({ isActive: true }).where(eq(products.code, "later"));
    const text = (section: string, key: string) =>
      db
        .insert(contentEntries)
        .values({
          productCode: "later",
          section,
          key,
          title: `${section} ${key}`,
          fields: { general: "Текст." },
          status: "published",
        })
        .onConflictDoNothing();
    await text("main", "capricorn");

    const a = await setup({ balance: 5_000 });
    const { purchase: p } = await purchase(db, {
      userId: a.userId,
      productCode: "later",
      personIds: [a.mom.id],
    });
    expect(Object.keys(p.snapshot.keys)).toEqual(["main"]);

    // A part added after the sale: keyed from the snapshot's person, free for the buyer.
    await addPart(db, adminId, {
      productCode: "later",
      code: "period",
      nameMn: "Үе",
      keyType: "period",
    });
    const period = String(p.snapshot.persons[0].period);
    await text("period", period);
    const sections = async (userId: string, id: string) =>
      (await getReading(db, userId, id)).sections.map((s) => [s.section, s.key]);
    expect(await sections(a.userId, p.id)).toEqual([
      ["main", "capricorn"],
      ["period", period],
    ]);

    // Archive the original part: the buyer still reads it, a new buyer doesn't get it.
    await setPartArchived(db, adminId, { productCode: "later", partCode: "main", archived: true });
    expect(await sections(a.userId, p.id)).toEqual([
      ["main", "capricorn"],
      ["period", period],
    ]);
    const b = await setup({ balance: 5_000 });
    const { purchase: q } = await purchase(db, {
      userId: b.userId,
      productCode: "later",
      personIds: [b.mom.id],
    });
    expect(Object.keys(q.snapshot.keys)).toEqual(["period"]);
    expect(await sections(b.userId, q.id)).toEqual([["period", period]]);
  });
});
