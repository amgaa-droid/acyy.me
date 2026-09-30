import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { todayYmd } from "@/lib/birth-date";
import type { ContentSection, ProductCode } from "@/lib/domain";
import { describeBirthDate, loadAstroRefs, type AstroRefs } from "@/server/astro/refs";
import { monthDayOf } from "@/server/astro/zodiac";
import { getProduct, isEligible, loadViewer } from "@/server/catalog";
import { periodPairKey, signPairKey } from "@/server/content/keys";
import type { AppDb } from "@/server/db/types";
import { contentEntries, persons, purchases, type PurchaseSnapshot } from "@/server/db/schema";
import { debit } from "@/server/wallet";

/**
 * Buying a reading (SPEC §3, §4.2). One transaction: insert the purchase (UNIQUE
 * user+product+subject) and debit the wallet. Insufficient funds or a duplicate roll the
 * whole thing back. Buying something already owned (incl. B×A after A×B) returns the
 * existing purchase without charging.
 */

export type Purchase = typeof purchases.$inferSelect;

export class ProductUnavailableError extends Error {
  constructor() {
    super("product_unavailable");
  }
}
export class NotEligibleError extends Error {
  constructor() {
    super("not_eligible");
  }
}
export class PersonsInvalidError extends Error {
  constructor() {
    super("persons_invalid");
  }
}
export class ContentUnavailableError extends Error {
  constructor(readonly keys: string[]) {
    super("content_unavailable");
  }
}

type SubjectPerson = typeof persons.$inferSelect;

/** "{id}" or "{minId}|{maxId}" — A×B and B×A share one subject. */
export function subjectKey(personIds: string[]): string {
  return [...personIds].sort().join("|");
}

/** Content keys for a product and its people (what the reading will show). */
export function contentKeysFor(
  product: ProductCode,
  people: Pick<SubjectPerson, "birthDate">[],
  refs: AstroRefs,
): Partial<Record<ContentSection, string>> {
  const d = people.map((p) => describeBirthDate(p.birthDate, refs));
  switch (product) {
    case "birthday":
      return { main: monthDayOf(people[0].birthDate) };
    case "synastry":
      return {
        sign_pair: signPairKey(d[0].sign.code, d[1].sign.code),
        period_pair: periodPairKey(d[0].period.no, d[1].period.no),
      };
    default:
      return { main: d[0].sign.code };
  }
}

export function buildSnapshot(
  product: ProductCode,
  people: SubjectPerson[],
  refs: AstroRefs,
): PurchaseSnapshot {
  return {
    persons: people.map((p) => {
      const { sign, period } = describeBirthDate(p.birthDate, refs);
      return {
        name: p.name,
        birthDate: p.birthDate,
        gender: p.gender,
        sign: sign.code,
        period: period.no,
      };
    }),
    keys: contentKeysFor(product, people, refs),
  };
}

export async function loadOwnPeople(
  db: AppDb,
  userId: string,
  personIds: string[],
): Promise<SubjectPerson[]> {
  if (!personIds.every((id) => z.uuid().safeParse(id).success)) throw new PersonsInvalidError();
  const rows = await db
    .select()
    .from(persons)
    .where(
      and(
        eq(persons.ownerUserId, userId),
        isNull(persons.deletedAt),
        inArray(persons.id, personIds),
      ),
    );
  // Keep the caller's order (A, B); every id must belong to the user.
  const people = personIds.map((id) => rows.find((r) => r.id === id));
  if (people.some((p) => !p)) throw new PersonsInvalidError();
  return people as SubjectPerson[];
}

export async function findPurchase(db: AppDb, userId: string, product: string, subject: string) {
  const [p] = await db
    .select()
    .from(purchases)
    .where(
      and(
        eq(purchases.userId, userId),
        eq(purchases.productCode, product),
        eq(purchases.subjectKey, subject),
      ),
    );
  return p ?? null;
}

/** Checks everything a purchase needs, without charging. Used by the buy screen and purchase(). */
export async function preparePurchase(
  db: AppDb,
  userId: string,
  productCode: string,
  personIds: string[],
) {
  const product = await getProduct(db, productCode);
  if (!product || !product.isActive) throw new ProductUnavailableError();
  if (new Set(personIds).size !== personIds.length || personIds.length !== product.personCount) {
    throw new PersonsInvalidError();
  }
  const people = await loadOwnPeople(db, userId, personIds);
  const viewer = await loadViewer(db, userId);
  if (!isEligible(product, people, viewer, todayYmd())) throw new NotEligibleError();

  const refs = await loadAstroRefs(db);
  const snapshot = buildSnapshot(product.code as ProductCode, people, refs);
  return { product, people, snapshot, subject: subjectKey(personIds) };
}

async function assertContentPublished(db: AppDb, product: string, keys: PurchaseSnapshot["keys"]) {
  const wanted = Object.entries(keys) as [ContentSection, string][];
  const rows = await db
    .select({ section: contentEntries.section, key: contentEntries.key })
    .from(contentEntries)
    .where(
      and(
        eq(contentEntries.productCode, product),
        eq(contentEntries.status, "published"),
        inArray(
          contentEntries.key,
          wanted.map(([, k]) => k),
        ),
      ),
    );
  const missing = wanted
    .filter(([s, k]) => !rows.some((r) => r.section === s && r.key === k))
    .map(([, k]) => k);
  if (missing.length) throw new ContentUnavailableError(missing);
}

function isUniqueViolation(err: unknown): boolean {
  for (let e = err as { code?: string; cause?: unknown } | undefined; e; e = e.cause as typeof e) {
    if (e.code === "23505") return true;
  }
  return false;
}

export async function purchase(
  db: AppDb,
  input: { userId: string; productCode: string; personIds: string[] },
): Promise<{ purchase: Purchase; alreadyOwned: boolean }> {
  const { product, people, snapshot, subject } = await preparePurchase(
    db,
    input.userId,
    input.productCode,
    input.personIds,
  );

  const owned = await findPurchase(db, input.userId, product.code, subject);
  if (owned) return { purchase: owned, alreadyOwned: true };

  // Never take money for a text that isn't there.
  await assertContentPublished(db, product.code, snapshot.keys);

  try {
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(purchases)
        .values({
          userId: input.userId,
          productCode: product.code,
          pricePaid: product.price,
          personAId: people[0].id,
          personBId: people[1]?.id ?? null,
          subjectKey: subject,
          snapshot,
        })
        .returning();
      if (product.price > 0) {
        await debit(tx as AppDb, "purchase", {
          userId: input.userId,
          amount: product.price,
          idempotencyKey: `purchase:${row.id}`,
          refType: "purchase",
          refId: row.id,
          note: product.nameMn,
        });
      }
      return row;
    });
    return { purchase: created, alreadyOwned: false };
  } catch (err) {
    // A concurrent request bought the same subject first: its purchase wins, nothing charged here.
    if (isUniqueViolation(err)) {
      const winner = await findPurchase(db, input.userId, product.code, subject);
      if (winner) return { purchase: winner, alreadyOwned: true };
    }
    throw err;
  }
}

export async function listPurchases(db: AppDb, userId: string, limit = 200): Promise<Purchase[]> {
  return db
    .select()
    .from(purchases)
    .where(eq(purchases.userId, userId))
    .orderBy(desc(purchases.createdAt))
    .limit(limit);
}
