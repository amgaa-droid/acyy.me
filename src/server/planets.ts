import { formatBirthDate } from "@/lib/birth-date";
import { RELATION_GROUP, isOffOrbit, type Relation, type RelationGroup } from "@/lib/domain";
import { avatarDataUri } from "@/lib/avatars";
import { relationText } from "@/lib/people";
import { pairKey, type PairLink } from "@/lib/planet-system";
import { loadAstroRefs } from "@/server/astro/refs";
import { getSign } from "@/server/astro/zodiac";
import { loadViewer, offersForPerson, productsByCode } from "@/server/catalog";
import type { AppDb } from "@/server/db/types";
import { listPeople, type Person } from "@/server/persons";
import type { OnboardingProgress } from "@/lib/onboarding";
import { getOnboarding } from "@/server/onboarding";
import { listPurchases } from "@/server/purchase";

/** A single-person reading offered for someone: bought (purchaseId) or not yet. */
export type PlanetReading = { code: string; purchaseId: string | null };

export type PlanetPerson = {
  id: string;
  name: string;
  relation: Relation;
  relationText: string;
  signName: string;
  avatarUri: string;
  readings: PlanetReading[];
};

export type PlanetSystemData = {
  me: Omit<PlanetPerson, "relation" | "relationText"> & { birthDate: string };
  /** Closest first. */
  people: PlanetPerson[];
  /** Bought pair readings with me: person id → purchase id. */
  mePairs: Record<string, string>;
  /** Bought pair readings between two of my people. */
  pairs: PairLink[];
  /** The two-person product a new pair opens, if any is on sale. */
  pairProduct: string | null;
  products: Record<string, { name: string; icon: string }>;
  /** First-run guide progress (src/server/onboarding.ts). */
  onboarding: OnboardingProgress;
};

const CLOSENESS: Record<RelationGroup, number> = {
  romantic: 0,
  family: 1,
  friend: 2,
  other: 3,
  self: 9,
};

const closeness = (r: Relation) => (isOffOrbit(r) ? 10 : CLOSENESS[RELATION_GROUP[r]]);

/**
 * Closest people first (romantic → family → friend → other → "Хэн ч биш"); ties keep their
 * order.
 */
export function byCloseness<T extends { relation: Relation }>(people: readonly T[]): T[] {
  return people
    .map((p, i) => ({ p, i }))
    .sort((a, b) => closeness(a.p.relation) - closeness(b.p.relation) || a.i - b.i)
    .map(({ p }) => p);
}

type PurchaseRef = {
  id: string;
  productCode: string;
  personAId: string | null;
  personBId: string | null;
};

/**
 * Bought pair readings among me and my people, newest first wins per pair. Pairs with someone
 * deleted (person id gone) are left out.
 */
export function pairsFromPurchases(
  selfId: string,
  personIds: readonly string[],
  purchases: readonly PurchaseRef[],
  personCountOf: (code: string) => number | undefined,
): { mePairs: Record<string, string>; pairs: PairLink[] } {
  const known = new Set([selfId, ...personIds]);
  const mePairs: Record<string, string> = {};
  const pairs: PairLink[] = [];
  const seen = new Set<string>();
  for (const p of purchases) {
    if (personCountOf(p.productCode) !== 2 || !p.personAId || !p.personBId) continue;
    if (!known.has(p.personAId) || !known.has(p.personBId)) continue;
    const key = pairKey(p.personAId, p.personBId);
    if (seen.has(key)) continue;
    seen.add(key);
    if (p.personAId === selfId) mePairs[p.personBId] = p.id;
    else if (p.personBId === selfId) mePairs[p.personAId] = p.id;
    else pairs.push({ a: p.personAId, b: p.personBId, purchaseId: p.id });
  }
  return { mePairs, pairs };
}

/** Everything the home planet system needs, for the signed-in user (their own data only). */
export async function loadPlanetSystem(
  db: AppDb,
  userId: string,
  self: Person,
): Promise<PlanetSystemData> {
  const [refs, persons, viewer, purchases, products, onboarding] = await Promise.all([
    loadAstroRefs(db),
    listPeople(db, userId),
    loadViewer(db, userId),
    listPurchases(db, userId, 500),
    productsByCode(db),
    getOnboarding(db, userId),
  ]);
  const others = byCloseness(persons.filter((p) => p.id !== self.id && !p.isSelf));
  const offers = await Promise.all(
    [self, ...others].map((p) => offersForPerson(db, viewer, p)),
  );
  const readingsOf = (i: number): PlanetReading[] =>
    offers[i]
      .filter((o) => o.product.personCount === 1)
      .map((o) => ({ code: o.product.code, purchaseId: o.purchaseId }));
  const signOf = (p: Person) => getSign(p.birthDate, refs.signs).nameMn;

  const { mePairs, pairs } = pairsFromPurchases(
    self.id,
    others.map((p) => p.id),
    purchases,
    (code) => products.get(code)?.personCount,
  );
  const pairCandidates = [...products.values()].filter((p) => p.personCount === 2 && p.isActive);
  const pairProduct =
    pairCandidates.find((p) => p.code === "synastry")?.code ?? pairCandidates[0]?.code ?? null;

  return {
    me: {
      id: self.id,
      name: self.name,
      signName: signOf(self),
      birthDate: formatBirthDate(self.birthDate),
      avatarUri: avatarDataUri(self.avatarSeed),
      readings: readingsOf(0),
    },
    people: others.map((p, i) => ({
      id: p.id,
      name: p.name,
      relation: p.relation,
      relationText: relationText(p),
      signName: signOf(p),
      avatarUri: avatarDataUri(p.avatarSeed),
      readings: readingsOf(i + 1),
    })),
    mePairs,
    pairs,
    pairProduct,
    products: Object.fromEntries(
      [...products.values()].map((p) => [p.code, { name: p.nameMn, icon: p.icon }]),
    ),
    onboarding,
  };
}
