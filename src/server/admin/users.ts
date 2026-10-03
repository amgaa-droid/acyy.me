import { and, asc, count, desc, eq, ilike, isNull, max, or, sql } from "drizzle-orm";
import { z } from "zod";

import { clampPage } from "@/lib/pagination";
import type { AppDb } from "@/server/db/types";
import { persons, topups, user, wallets } from "@/server/db/schema";

export const USER_SORTS = ["joined", "topup"] as const;
export type UserSort = (typeof USER_SORTS)[number];
export type SortDir = "asc" | "desc";

export const userListQuerySchema = z.object({
  q: z.string().trim().max(100).catch(""),
  sort: z.enum(USER_SORTS).catch("joined"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
  /** Requested page; clamped to the last page once the total is known. */
  page: z.coerce.number().int().min(1).catch(1),
});
export type UserListQuery = z.infer<typeof userListQuerySchema>;

export const USERS_PAGE_SIZE = 50;

/**
 * Owner-only user directory (SPEC §6.2): search by email/name, sorted by join date or by the
 * latest paid top-up (users who never topped up sort last in both directions), one page at a
 * time. A page past the end shows the last page.
 */
export async function searchUsers(
  db: AppDb,
  query: Partial<UserListQuery> | string = {},
  pageSize = USERS_PAGE_SIZE,
) {
  const {
    q,
    sort,
    dir,
    page: requested,
  } = userListQuerySchema.parse(typeof query === "string" ? { q: query } : query);
  const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  const lastTopup = db
    .select({ userId: topups.userId, at: max(topups.paidAt).as("last_topup_at") })
    .from(topups)
    .where(eq(topups.status, "paid"))
    .groupBy(topups.userId)
    .as("last_topup");
  const order = dir === "asc" ? asc : desc;
  const where = and(
    isNull(user.deletedAt),
    q ? or(ilike(user.email, like), ilike(user.name, like)) : undefined,
  );
  const [{ total }] = await db.select({ total: count() }).from(user).where(where);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = clampPage(requested, pages);
  const rows = await db
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
    .where(where)
    .orderBy(
      ...(sort === "topup"
        ? [sql`${lastTopup.at} ${sql.raw(dir)} nulls last`, desc(user.createdAt)]
        : [order(user.createdAt)]),
      asc(user.id),
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { rows, total, page, pages };
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
