import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";

import type { ContentSection, Relation } from "@/lib/domain";
import { firstSentences } from "@/lib/preview";
import type { AppDb } from "@/server/db/types";
import {
  contentEntries,
  persons,
  products,
  purchases,
  type PurchaseSnapshot,
} from "@/server/db/schema";

/**
 * Reading access (SPEC §3, §7) and the paywall preview (§3.1, CLAUDE.md rule 3).
 * Full text leaves the server only through getReading(), which checks the viewer.
 */

export class ReadingNotFoundError extends Error {
  constructor() {
    super("reading_not_found");
  }
}

export type ReadingSection = {
  section: ContentSection;
  key: string;
  title: string | null;
  body: string | null; // null = text currently unpublished
  teaser: string | null;
  score: number | null;
};

export type Reading = {
  id: string;
  productCode: string;
  productName: string;
  createdAt: Date;
  snapshot: PurchaseSnapshot;
  personIds: (string | null)[];
  viaLink: boolean;
  /** For a linked viewer: which of the two people they are (for "Намайг хасах"). */
  linkedPersonId: string | null;
  sections: ReadingSection[];
};

const SECTION_ORDER: ContentSection[] = ["main", "sign_pair", "period_pair"];

async function loadSections(db: AppDb, productCode: string, keys: PurchaseSnapshot["keys"]) {
  const wanted = SECTION_ORDER.filter((s) => keys[s]).map((s) => [s, keys[s]!] as const);
  if (wanted.length === 0) return [];
  const rows = await db
    .select()
    .from(contentEntries)
    .where(
      and(
        eq(contentEntries.productCode, productCode),
        eq(contentEntries.status, "published"),
        inArray(
          contentEntries.key,
          wanted.map(([, k]) => k),
        ),
      ),
    );
  return wanted.map(([section, key]) => {
    const row = rows.find((r) => r.section === section && r.key === key);
    return { section, key, row };
  });
}

/**
 * The purchase's full text for its owner — or, for synastry only, for a user linked to one of
 * its two people (free view, SPEC §7). Anyone else: ReadingNotFoundError (→ 404).
 */
export async function getReading(
  db: AppDb,
  viewerId: string,
  purchaseId: string,
): Promise<Reading> {
  if (!z.uuid().safeParse(purchaseId).success) throw new ReadingNotFoundError();
  const [p] = await db.select().from(purchases).where(eq(purchases.id, purchaseId));
  if (!p) throw new ReadingNotFoundError();

  let viaLink = false;
  let linkedPersonId: string | null = null;
  if (p.userId !== viewerId) {
    if (p.productCode !== "synastry") throw new ReadingNotFoundError();
    const ids = [p.personAId, p.personBId].filter((x): x is string => Boolean(x));
    const linked = ids.length
      ? await db
          .select({ id: persons.id })
          .from(persons)
          .where(and(inArray(persons.id, ids), eq(persons.linkedUserId, viewerId)))
      : [];
    if (linked.length === 0) throw new ReadingNotFoundError();
    viaLink = true;
    linkedPersonId = linked[0].id;
  }

  const [product] = await db
    .select({ nameMn: products.nameMn })
    .from(products)
    .where(eq(products.code, p.productCode));
  const sections = await loadSections(db, p.productCode, p.snapshot.keys);
  return {
    id: p.id,
    productCode: p.productCode,
    productName: product?.nameMn ?? p.productCode,
    createdAt: p.createdAt,
    snapshot: p.snapshot,
    personIds: [p.personAId, p.personBId],
    viaLink,
    linkedPersonId,
    sections: sections.map(({ section, key, row }) => ({
      section,
      key,
      title: row?.title ?? null,
      body: row?.body ?? null,
      teaser: row?.teaser ?? null,
      score: row?.score ?? null,
    })),
  };
}

export type Preview = {
  sections: {
    section: ContentSection;
    title: string;
    /** Free by design (SPEC §3.1) — sent for every section. */
    teaser: string | null;
    excerpt: string | null;
  }[];
};

/**
 * Paywall preview: titles and teasers, plus the FIRST 2 SENTENCES of the first section only.
 * Nothing else of the body is returned — the client never receives the full text.
 */
export async function getPreview(
  db: AppDb,
  productCode: string,
  keys: PurchaseSnapshot["keys"],
): Promise<Preview> {
  const sections = await loadSections(db, productCode, keys);
  return {
    sections: sections.map(({ section, row }, i) => ({
      section,
      title: row?.title ?? "",
      teaser: row?.teaser ?? null,
      excerpt: i === 0 && row ? firstSentences(row.body, 2) : null,
    })),
  };
}

/** Synastry purchases where the viewer is one of the linked people ("Надтай хийсэн нийцлүүд", C7). */
export async function linkedSynastryIds(db: AppDb, viewerId: string): Promise<string[]> {
  const mine = await db
    .select({ id: persons.id })
    .from(persons)
    .where(eq(persons.linkedUserId, viewerId));
  if (mine.length === 0) return [];
  const ids = mine.map((m) => m.id);
  const rows = await db
    .select({ id: purchases.id })
    .from(purchases)
    .where(
      and(
        eq(purchases.productCode, "synastry"),
        or(inArray(purchases.personAId, ids), inArray(purchases.personBId, ids)),
      ),
    );
  return rows.map((r) => r.id);
}

export type ReadingPerson = {
  id: string;
  relation: Relation;
  relationLabel: string | null;
  avatarSeed: string;
};

/**
 * Live details (relation, avatar) of a reading's people — only those the viewer owns
 * (CLAUDE.md rule 4). A linked viewer or a deleted person gets null; the snapshot still has the rest.
 */
export async function readingPeople(
  db: AppDb,
  viewerId: string,
  personIds: (string | null)[],
): Promise<(ReadingPerson | null)[]> {
  const ids = personIds.filter((x): x is string => Boolean(x));
  if (ids.length === 0) return personIds.map(() => null);
  const rows = await db
    .select({
      id: persons.id,
      relation: persons.relation,
      relationLabel: persons.relationLabel,
      avatarSeed: persons.avatarSeed,
    })
    .from(persons)
    .where(
      and(inArray(persons.id, ids), eq(persons.ownerUserId, viewerId), isNull(persons.deletedAt)),
    );
  return personIds.map((id) => rows.find((r) => r.id === id) ?? null);
}
