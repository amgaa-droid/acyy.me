import { and, desc, eq, gte, sql, type SQL } from "drizzle-orm";

import { helpChats, user } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";

/** What the admins see of the help assistant (/admin/ai/history, Owner). */

export type HelpStats = {
  questions: number;
  ai: number;
  faq: number;
  users: number;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  up: number;
  down: number;
};

export async function helpStats(db: AppDb, since: Date): Promise<HelpStats> {
  const n = (expr: SQL) => sql<number>`coalesce(${expr}, 0)`.mapWith(Number);
  const [row] = await db
    .select({
      questions: n(sql`count(*)`),
      ai: n(sql`count(*) filter (where ${helpChats.source} = 'ai')`),
      faq: n(sql`count(*) filter (where ${helpChats.source} = 'faq')`),
      users: n(sql`count(distinct ${helpChats.userId})`),
      inputTokens: n(sql`sum(${helpChats.inputTokens})`),
      cachedTokens: n(sql`sum(${helpChats.cachedTokens})`),
      outputTokens: n(sql`sum(${helpChats.outputTokens})`),
      up: n(sql`count(*) filter (where ${helpChats.feedback} = 1)`),
      down: n(sql`count(*) filter (where ${helpChats.feedback} = -1)`),
    })
    .from(helpChats)
    .where(gte(helpChats.createdAt, since));
  return row;
}

export const HISTORY_FILTERS = ["all", "down", "ai", "faq"] as const;
export type HistoryFilter = (typeof HISTORY_FILTERS)[number];

export async function listHelpChats(db: AppDb, filter: HistoryFilter, limit = 100) {
  const where =
    filter === "down"
      ? eq(helpChats.feedback, -1)
      : filter === "ai" || filter === "faq"
        ? eq(helpChats.source, filter)
        : undefined;
  return db
    .select({
      id: helpChats.id,
      userId: helpChats.userId,
      email: user.email,
      question: helpChats.question,
      answer: helpChats.answer,
      source: helpChats.source,
      model: helpChats.model,
      inputTokens: helpChats.inputTokens,
      cachedTokens: helpChats.cachedTokens,
      outputTokens: helpChats.outputTokens,
      ms: helpChats.ms,
      feedback: helpChats.feedback,
      createdAt: helpChats.createdAt,
    })
    .from(helpChats)
    .leftJoin(user, eq(user.id, helpChats.userId))
    .where(where ? and(where) : undefined)
    .orderBy(desc(helpChats.createdAt))
    .limit(limit);
}

/** A logged question by id ("FAQ болгох" links carry the id, not the user's words). */
export async function chatQuestion(db: AppDb, id: unknown): Promise<string> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return "";
  const [row] = await db
    .select({ question: helpChats.question })
    .from(helpChats)
    .where(eq(helpChats.id, id));
  return row?.question ?? "";
}
