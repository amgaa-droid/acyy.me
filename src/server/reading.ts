import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";

import { KEY_TYPE_ARITY, type FieldKind, type KeyType, type Relation } from "@/lib/domain";
import { fieldValue } from "@/lib/fields";
import { firstSentences } from "@/lib/preview";
import { monthDayOf } from "@/server/astro/zodiac";
import { GenderRequiredError, partKeyFor, shownKeys, type KeyPerson } from "@/server/content/keys";
import type { AppDb } from "@/server/db/types";
import {
  contentEntries,
  persons,
  products,
  purchases,
  type PurchaseSnapshot,
} from "@/server/db/schema";
import { activeFields, loadProductDef, type PartDef, type ProductDef } from "@/server/products";

/**
 * Reading access (SPEC §3, §7) and the paywall preview (§3.1, CLAUDE.md rule 3).
 * Full text leaves the server only through getReading(), which checks the viewer.
 */

export class ReadingNotFoundError extends Error {
  constructor() {
    super("reading_not_found");
  }
}

/** One sub-section of a text with its value (only non-empty, non-archived ones). */
export type ReadingField = {
  code: string;
  name: string;
  kind: FieldKind;
  isFree: boolean;
  value: string;
};

export type ReadingSection = {
  /** Part code. */
  section: string;
  /** Part name — shown only when the product has several parts. */
  name: string;
  keyType: KeyType;
  key: string;
  title: string | null;
  /** null = text currently unpublished */
  fields: ReadingField[] | null;
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

type Loaded = { part: PartDef; key: string; row: typeof contentEntries.$inferSelect | undefined };

/**
 * Which part texts a purchase shows (SPEC §3): every part in its snapshot — archived ones too,
 * it was bought with them — plus active parts added later, keyed from the snapshot's people
 * (free for earlier buyers). A later gender-split part needs a known gender, else it's skipped.
 */
function readingKeys(
  product: Pick<ProductDef, "parts">,
  snapshot: PurchaseSnapshot,
): Record<string, string> {
  const people: KeyPerson[] = snapshot.persons.map((p) => ({
    monthDay: monthDayOf(p.birthDate),
    sign: p.sign,
    period: p.period,
    gender: p.gender,
  }));
  const keys: Record<string, string> = {};
  for (const part of product.parts) {
    const bought = snapshot.keys[part.code];
    if (bought) keys[part.code] = bought;
    else if (part.archivedAt === null && people.length === KEY_TYPE_ARITY[part.keyType]) {
      try {
        keys[part.code] = partKeyFor(part, people);
      } catch (err) {
        if (!(err instanceof GenderRequiredError)) throw err;
      }
    }
  }
  return keys;
}

/** The published texts of a product's parts for these keys, in part order. */
async function loadSections(
  db: AppDb,
  product: ProductDef,
  keys: PurchaseSnapshot["keys"],
): Promise<Loaded[]> {
  const wanted = product.parts.flatMap((part) =>
    keys[part.code] ? shownKeys(part.keyType, keys[part.code]).map((key) => ({ part, key })) : [],
  );
  if (wanted.length === 0) return [];
  const rows = await db
    .select()
    .from(contentEntries)
    .where(
      and(
        eq(contentEntries.productCode, product.code),
        eq(contentEntries.status, "published"),
        inArray(
          contentEntries.key,
          wanted.map((w) => w.key),
        ),
      ),
    );
  return wanted.map(({ part, key }) => ({
    part,
    key,
    row: rows.find((r) => r.section === part.code && r.key === key),
  }));
}

function readingFields(part: PartDef, stored: Record<string, string>): ReadingField[] {
  return activeFields(part).flatMap((f) => {
    const value = fieldValue(stored, f.code);
    return value ? [{ code: f.code, name: f.nameMn, kind: f.kind, isFree: f.isFree, value }] : [];
  });
}

/**
 * Two-person readings can be viewed free by a user linked to one of the two (SPEC §7). Deleting
 * the person ends that: the owner cut the tie, and the reading carries the owner's own data.
 */
async function linkedViewerPerson(
  db: AppDb,
  viewerId: string,
  p: typeof purchases.$inferSelect,
): Promise<string | null> {
  if (p.snapshot.persons.length !== 2) return null;
  const ids = [p.personAId, p.personBId].filter((x): x is string => Boolean(x));
  if (ids.length === 0) return null;
  const linked = await db
    .select({ id: persons.id })
    .from(persons)
    .where(
      and(inArray(persons.id, ids), eq(persons.linkedUserId, viewerId), isNull(persons.deletedAt)),
    );
  return linked[0]?.id ?? null;
}

/**
 * The purchase's full text for its owner — or, for two-person products, for a user linked to
 * one of its two people (free view, SPEC §7). Anyone else: ReadingNotFoundError (→ 404).
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
    linkedPersonId = await linkedViewerPerson(db, viewerId, p);
    if (!linkedPersonId) throw new ReadingNotFoundError();
    viaLink = true;
  }

  const product = await loadProductDef(db, p.productCode);
  const sections = product ? await loadSections(db, product, readingKeys(product, p.snapshot)) : [];
  return {
    id: p.id,
    productCode: p.productCode,
    productName: product?.nameMn ?? p.productCode,
    createdAt: p.createdAt,
    snapshot: p.snapshot,
    personIds: [p.personAId, p.personBId],
    viaLink,
    linkedPersonId,
    sections: sections.map(({ part, key, row }) => ({
      section: part.code,
      name: part.nameMn,
      keyType: part.keyType,
      key,
      title: row?.title ?? null,
      fields: row ? readingFields(part, row.fields) : null,
      teaser: row?.teaser ?? null,
      score: row?.score ?? null,
    })),
  };
}

type PreviewSection = {
  section: string;
  keyType: KeyType;
  key: string;
  name: string;
  title: string;
  /** Free by design (SPEC §3.1) — sent for every section. */
  teaser: string | null;
  /** Fields marked free, in full. */
  free: ReadingField[];
  excerpt: string | null;
};

/**
 * What the paywall hides, without any of it: the headings of the paid fields (their names in the
 * product definition, not reading text) and how many words they hold.
 */
export type LockedSummary = { headings: string[]; words: number };

export type Preview = { sections: PreviewSection[]; locked: LockedSummary };

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Headings (each once, in order) and word count of the paid fields behind the paywall. */
export function lockedSummary(sectionsFields: ReadingField[][]): LockedSummary {
  const headings: string[] = [];
  let words = 0;
  for (const fields of sectionsFields)
    for (const f of fields) {
      if (f.isFree) continue;
      words += countWords(f.value);
      if (f.name && !headings.includes(f.name)) headings.push(f.name);
    }
  return { headings, words };
}

/** The first 2 sentences of the first paid prose field — all of the paid text a preview shows. */
function paidExcerpt(fields: ReadingField[]): string | null {
  const first = fields.find((f) => !f.isFree && (f.kind === "text" || f.kind === "quote"));
  return first ? firstSentences(first.value, 2) || null : null;
}

/**
 * Paywall preview: titles, teasers and free fields, plus the FIRST 2 SENTENCES of the first
 * paid prose field of the first section only. No other paid text is returned — the client
 * never receives the full text.
 */
export async function getPreview(
  db: AppDb,
  productCode: string,
  keys: PurchaseSnapshot["keys"],
): Promise<Preview> {
  const product = await loadProductDef(db, productCode);
  if (!product) return { sections: [], locked: { headings: [], words: 0 } };
  const sections = await loadSections(db, product, keys);
  const all = sections.map(({ part, row }) => (row ? readingFields(part, row.fields) : []));
  return {
    locked: lockedSummary(all),
    sections: sections.map(({ part, key, row }, i) => {
      const fields = all[i];
      return {
        section: part.code,
        keyType: part.keyType,
        key,
        name: part.nameMn,
        title: row?.title ?? "",
        teaser: row?.teaser ?? null,
        free: fields.filter((f) => f.isFree),
        excerpt: i === 0 ? paidExcerpt(fields) : null,
      };
    }),
  };
}

/** Two-person purchases where the viewer is one of the linked people ("Надтай хийсэн нийцлүүд", C7). */
export async function linkedPairReadings(
  db: AppDb,
  viewerId: string,
): Promise<{ id: string; productCode: string }[]> {
  const mine = await db
    .select({ id: persons.id })
    .from(persons)
    .where(and(eq(persons.linkedUserId, viewerId), isNull(persons.deletedAt)));
  if (mine.length === 0) return [];
  const ids = mine.map((m) => m.id);
  const rows = await db
    .select({ id: purchases.id, productCode: purchases.productCode })
    .from(purchases)
    .innerJoin(products, eq(products.code, purchases.productCode))
    .where(
      and(
        eq(products.personCount, 2),
        or(inArray(purchases.personAId, ids), inArray(purchases.personBId, ids)),
      ),
    );
  return rows;
}

type ReadingPerson = {
  id: string;
  name: string;
  relation: Relation;
  relationLabel: string | null;
  avatarSeed: string;
};

/**
 * Live details (name, relation, avatar) of a reading's people — only those the viewer owns
 * (CLAUDE.md rule 4). A linked viewer or a deleted person gets null; the snapshot still has the rest.
 * The bought text itself never follows edits: it is keyed from the snapshot (birth date, gender).
 */
export async function readingPeople(
  db: AppDb,
  viewerId: string,
  personIds: (string | null)[],
): Promise<(ReadingPerson | null)[]> {
  const ids = [...new Set(personIds.filter((x): x is string => Boolean(x)))];
  if (ids.length === 0) return personIds.map(() => null);
  const rows = await db
    .select({
      id: persons.id,
      name: persons.name,
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

/**
 * Names to show for each purchase's people: the current name of a person the viewer still owns
 * (a fixed typo shows everywhere), else the name at purchase time.
 */
export async function readingNames(
  db: AppDb,
  viewerId: string,
  list: Pick<typeof purchases.$inferSelect, "id" | "personAId" | "personBId" | "snapshot">[],
): Promise<Map<string, string[]>> {
  const cast = await readingCast(db, viewerId, list);
  return new Map([...cast].map(([id, people]) => [id, people.map((p) => p.name)]));
}

/**
 * Who each purchase is about, to list it by: the name as in `readingNames`, and the avatar of
 * a person the viewer still owns (null otherwise — a deleted or someone else's person has no
 * face to show).
 */
export async function readingCast(
  db: AppDb,
  viewerId: string,
  list: Pick<typeof purchases.$inferSelect, "id" | "personAId" | "personBId" | "snapshot">[],
): Promise<Map<string, { name: string; avatarSeed: string | null }[]>> {
  const live = await readingPeople(
    db,
    viewerId,
    list.flatMap((p) => [p.personAId, p.personBId]),
  );
  return new Map(
    list.map((p, i) => [
      p.id,
      p.snapshot.persons.map((x, j) => ({
        name: live[i * 2 + j]?.name ?? x.name,
        avatarSeed: live[i * 2 + j]?.avatarSeed ?? null,
      })),
    ]),
  );
}
