import "server-only";

import type { PersonSummary } from "@/components/people/person-card";
import { loadAstroRefs } from "@/server/astro/refs";
import { getSign } from "@/server/astro/zodiac";
import { db } from "@/server/db";
import { listPeople } from "@/server/persons";

/** People of the user with their sign name, for list screens. */
export async function listPeopleWithSigns(userId: string): Promise<PersonSummary[]> {
  const [people, refs] = await Promise.all([listPeople(db, userId), loadAstroRefs(db)]);
  return people.map((p) => ({
    id: p.id,
    name: p.name,
    relation: p.relation,
    relationLabel: p.relationLabel,
    avatarSeed: p.avatarSeed,
    signName: getSign(p.birthDate, refs.signs).nameMn,
  }));
}
