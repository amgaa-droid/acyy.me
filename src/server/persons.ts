import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { isAvatarSeed } from "@/lib/avatar-seeds";
import { birthDateSchema } from "@/lib/birth-date";
import { GENDERS, RELATIONS } from "@/lib/domain";
import type { AppDb } from "@/server/db/types";
import { persons, productParts, purchases } from "@/server/db/schema";

/**
 * People (SPEC §2.1). Every function takes the acting user's id and only ever touches rows
 * with `owner_user_id = userId` (CLAUDE.md rule 4). Someone else's person behaves exactly
 * like a missing one (PersonNotFoundError → 404), so ids can't be probed.
 * The birth date is set once at creation and can never be updated (rule 2). The gender locks
 * once a bought text depends on it (isGenderLocked).
 */

export type Person = typeof persons.$inferSelect;

export const personNameSchema = z.string().trim().min(1).max(40);
export const avatarSeedSchema = z.string().refine(isAvatarSeed, "invalid_avatar");
const relationLabelSchema = z.string().trim().min(1).max(20);
const otherRelations = RELATIONS.filter((r) => r !== "self") as [
  Exclude<(typeof RELATIONS)[number], "self">,
  ...Exclude<(typeof RELATIONS)[number], "self">[],
];

export const selfInputSchema = z.object({
  name: personNameSchema,
  birthDate: birthDateSchema,
  gender: z.enum(GENDERS).default("unspecified"),
  avatarSeed: avatarSeedSchema,
});
export type SelfInput = z.input<typeof selfInputSchema>;

/** `relation_label` is required for "other" and dropped for every other relation. */
function withRelationLabel<T extends { relation?: string; relationLabel?: string | null }>(
  data: T,
  ctx: z.RefinementCtx,
) {
  if (data.relation === "other" && !data.relationLabel) {
    ctx.addIssue({ code: "custom", path: ["relationLabel"], message: "required" });
  }
}

export const personInputSchema = z
  .object({
    name: personNameSchema,
    birthDate: birthDateSchema,
    gender: z.enum(GENDERS).default("unspecified"),
    avatarSeed: avatarSeedSchema,
    relation: z.enum(otherRelations),
    relationLabel: relationLabelSchema.nullish(),
  })
  .superRefine(withRelationLabel)
  .transform((d) => ({ ...d, relationLabel: d.relation === "other" ? d.relationLabel! : null }));
export type PersonInput = z.input<typeof personInputSchema>;

/** Editable fields only. `strictObject` rejects anything else — notably `birthDate`. */
export const personUpdateSchema = z
  .strictObject({
    name: personNameSchema.optional(),
    gender: z.enum(GENDERS).optional(),
    avatarSeed: avatarSeedSchema.optional(),
    relation: z.enum(otherRelations).optional(),
    relationLabel: relationLabelSchema.nullish(),
  })
  .superRefine(withRelationLabel);
export type PersonUpdate = z.input<typeof personUpdateSchema>;

export class SelfAlreadyExistsError extends Error {
  constructor() {
    super("self_exists");
  }
}
export class PersonNotFoundError extends Error {
  constructor() {
    super("person_not_found");
  }
}
export class SelfRelationError extends Error {
  constructor() {
    super("self_relation_immutable");
  }
}
export class CannotDeleteSelfError extends Error {
  constructor() {
    super("cannot_delete_self");
  }
}
export class GenderLockedError extends Error {
  constructor() {
    super("gender_locked");
  }
}

const uuid = z.uuid();

const owned = (userId: string, personId: string) =>
  and(eq(persons.id, personId), eq(persons.ownerUserId, userId), isNull(persons.deletedAt));

export async function getSelf(db: AppDb, userId: string): Promise<Person | null> {
  const [self] = await db
    .select()
    .from(persons)
    .where(
      and(eq(persons.ownerUserId, userId), eq(persons.isSelf, true), isNull(persons.deletedAt)),
    )
    .limit(1);
  return self ?? null;
}

/** Creates the user's "Би". Exactly one per user (also enforced by a partial unique index). */
export async function createSelf(db: AppDb, userId: string, input: SelfInput): Promise<Person> {
  const data = selfInputSchema.parse(input);
  if (await getSelf(db, userId)) throw new SelfAlreadyExistsError();
  const [self] = await db
    .insert(persons)
    .values({ ownerUserId: userId, isSelf: true, relation: "self", ...data })
    .returning();
  return self;
}

/** "Би" first, then everyone else newest first. Deleted people are hidden. */
export async function listPeople(db: AppDb, userId: string): Promise<Person[]> {
  return db
    .select()
    .from(persons)
    .where(and(eq(persons.ownerUserId, userId), isNull(persons.deletedAt)))
    .orderBy(desc(persons.isSelf), desc(persons.createdAt), asc(persons.name));
}

export async function getPerson(db: AppDb, userId: string, personId: string): Promise<Person> {
  if (!uuid.safeParse(personId).success) throw new PersonNotFoundError();
  const [person] = await db.select().from(persons).where(owned(userId, personId)).limit(1);
  if (!person) throw new PersonNotFoundError();
  return person;
}

export async function createPerson(db: AppDb, userId: string, input: PersonInput): Promise<Person> {
  const data = personInputSchema.parse(input);
  const [person] = await db
    .insert(persons)
    .values({ ownerUserId: userId, isSelf: false, ...data })
    .returning();
  return person;
}

/**
 * The gender is locked once a bought text depends on it (SPEC §2.1): a single-person purchase for
 * the person whose snapshot has a gender, of a product with a gender-split part (archived ones
 * too — the buyer still reads them). Like the birth date, a wrong one means delete and re-add.
 */
export async function isGenderLocked(
  db: AppDb,
  userId: string,
  personId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: purchases.id })
    .from(purchases)
    .innerJoin(
      productParts,
      and(eq(productParts.productCode, purchases.productCode), eq(productParts.byGender, true)),
    )
    .where(
      and(
        eq(purchases.userId, userId),
        // Single-person purchases are keyed by the person id; gender-split parts are 1-person only.
        eq(purchases.subjectKey, personId),
        sql`${purchases.snapshot} -> 'persons' -> 0 ->> 'gender' <> 'unspecified'`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Name, gender (until locked), avatar and (not for "Би") relation. Never the birth date. */
export async function updatePerson(
  db: AppDb,
  userId: string,
  personId: string,
  input: PersonUpdate,
): Promise<Person> {
  const data = personUpdateSchema.parse(input);
  const current = await getPerson(db, userId, personId);
  if (current.isSelf && (data.relation !== undefined || data.relationLabel != null)) {
    throw new SelfRelationError();
  }
  if (
    data.gender !== undefined &&
    data.gender !== current.gender &&
    (await isGenderLocked(db, userId, personId))
  ) {
    throw new GenderLockedError();
  }

  // Switching to "other" requires a label (schema); any other relation clears it.
  const relation = data.relation ?? current.relation;
  const relationChanged = data.relation !== undefined || data.relationLabel !== undefined;
  const patch = {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.gender !== undefined && { gender: data.gender }),
    ...(data.avatarSeed !== undefined && { avatarSeed: data.avatarSeed }),
    ...(data.relation !== undefined && { relation: data.relation }),
    ...(relationChanged && {
      relationLabel: relation === "other" ? (data.relationLabel ?? current.relationLabel) : null,
    }),
  };
  if (Object.keys(patch).length === 0) return current;

  const [updated] = await db.update(persons).set(patch).where(owned(userId, personId)).returning();
  if (!updated) throw new PersonNotFoundError();
  return updated;
}

/**
 * Soft delete (SPEC §2.1). Past purchases keep their snapshot and stay readable.
 * "Би" can't be deleted here — it anchors the account (account deletion is C10).
 */
export async function deletePerson(db: AppDb, userId: string, personId: string): Promise<void> {
  const person = await getPerson(db, userId, personId);
  if (person.isSelf) throw new CannotDeleteSelfError();
  const res = await db
    .update(persons)
    .set({ deletedAt: new Date() })
    .where(owned(userId, personId))
    .returning({ id: persons.id });
  if (res.length === 0) throw new PersonNotFoundError();
}
