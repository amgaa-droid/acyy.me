import { RELATION_GROUP, type Relation, type RelationGroup } from "@/lib/domain";
import { subjectKey } from "@/server/purchase";

/** What the home orbit shows about one person's readings. */
export type OrbitReadings = {
  /** Single-person products bought for this person, newest first, each product once. */
  products: string[];
  /** The user × this person pair reading, if bought. */
  pair: { purchaseId: string; productCode: string } | null;
};

type PurchaseRef = { id: string; productCode: string; subjectKey: string };

/**
 * Groups the user's purchases by person: single readings show as icons under the planet, the
 * pair reading with "me" as a badge on the line between us. `purchases` come newest first.
 */
export function orbitReadings(
  selfId: string,
  personIds: readonly string[],
  purchases: readonly PurchaseRef[],
  personCountOf: (productCode: string) => number | undefined,
): Map<string, OrbitReadings> {
  const out = new Map<string, OrbitReadings>();
  for (const id of [selfId, ...personIds]) {
    const single = purchases.filter(
      (p) => p.subjectKey === subjectKey([id]) && personCountOf(p.productCode) === 1,
    );
    const pair =
      id === selfId
        ? undefined
        : purchases.find(
            (p) => p.subjectKey === subjectKey([selfId, id]) && personCountOf(p.productCode) === 2,
          );
    out.set(id, {
      products: [...new Set(single.map((p) => p.productCode))],
      pair: pair ? { purchaseId: pair.id, productCode: pair.productCode } : null,
    });
  }
  return out;
}

const CLOSENESS: Record<RelationGroup, number> = {
  romantic: 0,
  family: 1,
  friend: 2,
  other: 3,
  self: 9,
};

/** Closest people first (romantic → family → friend → other); ties keep their order. */
export function byCloseness<T extends { relation: Relation }>(people: readonly T[]): T[] {
  return people
    .map((p, i) => ({ p, i }))
    .sort(
      (a, b) =>
        CLOSENESS[RELATION_GROUP[a.p.relation]] - CLOSENESS[RELATION_GROUP[b.p.relation]] ||
        a.i - b.i,
    )
    .map(({ p }) => p);
}
