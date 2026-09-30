import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

import { toIsoDate, type Ymd } from "@/lib/birth-date";
import type { Relation } from "@/lib/domain";
import type { AppDb } from "./types";
import { account, persons, user } from "./schema";

type SeedPerson = { name: string; relation: Relation; birthDate: string; avatarSeed: string };

/** Dev test accounts (SPEC §5). Wallet balances are added in C5 through wallet.credit(). */
export function testAccounts(today: Ymd) {
  const sixteenYearsAgo = toIsoDate({ ...today, y: today.y - 16 });
  const self = (name: string, birthDate: string, avatarSeed: string): SeedPerson => ({
    name,
    relation: "self",
    birthDate,
    avatarSeed,
  });

  return [
    { email: "owner@test.local", name: "Owner", people: [self("Owner", "1988-03-25", "Onyx")] },
    { email: "editor@test.local", name: "Editor", people: [self("Editor", "1992-07-14", "Lark")] },
    {
      email: "user@test.local",
      name: "Анар",
      people: [
        self("Анар", "1995-10-30", "Nova"),
        { name: "Сарангэрэл", relation: "mother", birthDate: "1968-01-04", avatarSeed: "Iris" },
        { name: "Тэмүүлэн", relation: "partner", birthDate: "1994-08-05", avatarSeed: "Cedar" },
        { name: "Номин", relation: "friend", birthDate: "1996-06-01", avatarSeed: "Willow" },
      ] satisfies SeedPerson[],
    },
    { email: "minor@test.local", name: "Бага", people: [self("Бага", sixteenYearsAgo, "Pine")] },
  ];
}

/** Creates the test accounts with an email+password credential. Existing emails are left untouched. */
export async function seedTestUsers(db: AppDb, password: string, today: Ymd): Promise<string[]> {
  const created: string[] = [];
  const hash = await hashPassword(password);

  for (const acc of testAccounts(today)) {
    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, acc.email));
    if (existing) continue;

    await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(user)
        .values({ name: acc.name, email: acc.email, emailVerified: true })
        .returning();
      await tx
        .insert(account)
        .values({ userId: u.id, accountId: u.id, providerId: "credential", password: hash });
      await tx
        .insert(persons)
        .values(
          acc.people.map((p) => ({ ...p, ownerUserId: u.id, isSelf: p.relation === "self" })),
        );
    });
    created.push(acc.email);
  }
  return created;
}
