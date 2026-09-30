import { desc, eq, ilike, isNull, or, and } from "drizzle-orm";
import { z } from "zod";

import type { AppDb } from "@/server/db/types";
import { persons, user, wallets } from "@/server/db/schema";

/** Owner-only user directory (SPEC §6.2). */
export async function searchUsers(db: AppDb, q: string, limit = 50) {
  const term = q.trim().slice(0, 100);
  const like = `%${term.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  return db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      balance: wallets.balance,
    })
    .from(user)
    .leftJoin(wallets, eq(wallets.userId, user.id))
    .where(
      and(
        isNull(user.deletedAt),
        term ? or(ilike(user.email, like), ilike(user.name, like)) : undefined,
      ),
    )
    .orderBy(desc(user.createdAt))
    .limit(limit);
}

export async function getUserDetail(db: AppDb, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [u] = await db.select().from(user).where(eq(user.id, id));
  if (!u) return null;
  const people = await db
    .select()
    .from(persons)
    .where(and(eq(persons.ownerUserId, id), isNull(persons.deletedAt)));
  return { user: u, people };
}
