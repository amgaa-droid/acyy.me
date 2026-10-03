import { and, asc, desc, eq, ilike, isNull, max, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { AppDb } from "@/server/db/types";
import { persons, topups, user, wallets } from "@/server/db/schema";

export const USER_SORTS = ["joined", "topup"] as const;
export type UserSort = (typeof USER_SORTS)[number];
export type SortDir = "asc" | "desc";

export const userListQuerySchema = z.object({
  q: z.string().trim().max(100).catch(""),
  sort: z.enum(USER_SORTS).catch("joined"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
});
export type UserListQuery = z.infer<typeof userListQuerySchema>;

/**
 * Owner-only user directory (SPEC §6.2): search by email/name, sorted by join date or by the
 * latest paid top-up. Users who never topped up sort last in both directions.
 */
export async function searchUsers(
  db: AppDb,
  query: Partial<UserListQuery> | string = {},
  limit = 50,
) {
  const { q, sort, dir } = userListQuerySchema.parse(
    typeof query === "string" ? { q: query } : query,
  );
  const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  const lastTopup = db
    .select({ userId: topups.userId, at: max(topups.paidAt).as("last_topup_at") })
    .from(topups)
    .where(eq(topups.status, "paid"))
    .groupBy(topups.userId)
    .as("last_topup");
  const order = dir === "asc" ? asc : desc;
  return db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      lastTopupAt: lastTopup.at,
      balance: wallets.balance,
    })
    .from(user)
    .leftJoin(wallets, eq(wallets.userId, user.id))
    .leftJoin(lastTopup, eq(lastTopup.userId, user.id))
    .where(
      and(
        isNull(user.deletedAt),
        q ? or(ilike(user.email, like), ilike(user.name, like)) : undefined,
      ),
    )
    .orderBy(
      ...(sort === "topup"
        ? [sql`${lastTopup.at} ${sql.raw(dir)} nulls last`, desc(user.createdAt)]
        : [order(user.createdAt)]),
      asc(user.id),
    )
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
