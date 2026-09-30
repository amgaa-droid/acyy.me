import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { birthDateSchema } from "@/lib/birth-date";
import { GENDERS } from "@/lib/domain";
import { isAvatarSeed } from "@/lib/avatar-seeds";
import type { AppDb } from "@/server/db/types";
import { persons } from "@/server/db/schema";

/** Person input rules (SPEC §2.1). Names are trimmed; the birth date is validated once, at creation. */
export const personNameSchema = z.string().trim().min(1).max(40);
export const avatarSeedSchema = z.string().refine(isAvatarSeed, "invalid_avatar");

export const selfInputSchema = z.object({
  name: personNameSchema,
  birthDate: birthDateSchema,
  gender: z.enum(GENDERS).default("unspecified"),
  avatarSeed: avatarSeedSchema,
});
export type SelfInput = z.input<typeof selfInputSchema>;

export class SelfAlreadyExistsError extends Error {
  constructor() {
    super("self_exists");
  }
}

export async function getSelf(db: AppDb, userId: string) {
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
export async function createSelf(db: AppDb, userId: string, input: SelfInput) {
  const data = selfInputSchema.parse(input);
  if (await getSelf(db, userId)) throw new SelfAlreadyExistsError();
  const [self] = await db
    .insert(persons)
    .values({ ownerUserId: userId, isSelf: true, relation: "self", ...data })
    .returning();
  return self;
}
