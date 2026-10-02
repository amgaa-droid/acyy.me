import { and, asc, eq, inArray } from "drizzle-orm";

import { ageOn, parseIsoDate, todayYmd, type Ymd } from "@/lib/birth-date";
import { RELATION_GROUP, type Relation } from "@/lib/domain";
import type { AppDb } from "@/server/db/types";
import { products, purchases, user } from "@/server/db/schema";
import { getSelf, type Person } from "@/server/persons";

/**
 * Which products a person may be offered (SPEC §3):
 * - product is active,
 * - every chosen person's relation group is in `allowed_groups`,
 * - 18+ (`adult_only`): the user's "Би" is ≥ 18, the user confirmed "I am 18+",
 *   and every chosen person is ≥ 18.
 * Ineligible products are not shown at all (not greyed out).
 */

export type Product = typeof products.$inferSelect;

export type Viewer = {
  userId: string;
  selfBirthDate: string | null;
  adultConfirmedAt: Date | null;
};

const isAdult = (birthDate: string | null, today: Ymd) => {
  const ymd = birthDate ? parseIsoDate(birthDate) : null;
  return ymd !== null && ageOn(ymd, today) >= 18;
};

/** The user may see 18+ products at all. */
export function viewerIsAdult(viewer: Viewer, today: Ymd = todayYmd()): boolean {
  return viewer.adultConfirmedAt !== null && isAdult(viewer.selfBirthDate, today);
}

export function isEligible(
  product: Pick<Product, "isActive" | "allowedGroups" | "adultOnly" | "personCount">,
  people: Pick<Person, "relation" | "birthDate">[],
  viewer: Viewer,
  today: Ymd = todayYmd(),
): boolean {
  if (!product.isActive) return false;
  if (people.length !== product.personCount) return false;
  if (!people.every((p) => product.allowedGroups.includes(RELATION_GROUP[p.relation as Relation])))
    return false;
  if (product.adultOnly) {
    if (!viewerIsAdult(viewer, today)) return false;
    if (!people.every((p) => isAdult(p.birthDate, today))) return false;
  }
  return true;
}

export async function loadViewer(db: AppDb, userId: string): Promise<Viewer> {
  const [u] = await db
    .select({ adultConfirmedAt: user.adultConfirmedAt })
    .from(user)
    .where(eq(user.id, userId));
  const self = await getSelf(db, userId);
  return {
    userId,
    selfBirthDate: self?.birthDate ?? null,
    adultConfirmedAt: u?.adultConfirmedAt ?? null,
  };
}

export async function listActiveProducts(db: AppDb): Promise<Product[]> {
  return db.select().from(products).where(eq(products.isActive, true)).orderBy(asc(products.sort));
}

/** Every product (incl. inactive), by code — names and icons of already-bought readings. */
export async function productsByCode(db: AppDb): Promise<Map<string, Product>> {
  const rows = await db.select().from(products);
  return new Map(rows.map((p) => [p.code, p]));
}

export type PersonOffer = {
  product: Product;
  /** Single-person products: the existing purchase id, if already bought. */
  purchaseId: string | null;
};

/**
 * Products to show on a person's page. Synastry is offered if the person could be one half of a pair.
 * A product already bought for the person always stays — even after an edit (e.g. the relation)
 * makes it ineligible, or the product is deactivated — so a paid reading never loses its entry.
 */
export async function offersForPerson(
  db: AppDb,
  viewer: Viewer,
  person: Person,
): Promise<PersonOffer[]> {
  return (await offersForPeople(db, viewer, [person]))[0];
}

/** offersForPerson for several people (same order), in two queries however many they are. */
export async function offersForPeople(
  db: AppDb,
  viewer: Viewer,
  people: readonly Person[],
): Promise<PersonOffer[][]> {
  if (people.length === 0) return [];
  const [all, owned] = await Promise.all([
    db.select().from(products).orderBy(asc(products.sort)),
    // Single-person purchases are keyed by the person id (pairs use "a|b").
    db
      .select({
        id: purchases.id,
        productCode: purchases.productCode,
        subjectKey: purchases.subjectKey,
      })
      .from(purchases)
      .where(
        and(
          eq(purchases.userId, viewer.userId),
          inArray(
            purchases.subjectKey,
            people.map((p) => p.id),
          ),
        ),
      ),
  ]);
  const today = todayYmd();
  return people.map((person) => {
    const byCode = new Map(
      owned.filter((o) => o.subjectKey === person.id).map((o) => [o.productCode, o.id]),
    );
    return all
      .filter(
        (p) =>
          byCode.has(p.code) ||
          (p.personCount === 1
            ? isEligible(p, [person], viewer, today)
            : isEligible({ ...p, personCount: 1 }, [person], viewer, today)),
      )
      .map((product) => ({
        product,
        purchaseId: product.personCount === 1 ? (byCode.get(product.code) ?? null) : null,
      }));
  });
}
