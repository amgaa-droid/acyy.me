import { and, count, desc, eq, gte, isNull } from "drizzle-orm";
import { z } from "zod";

import { formatMnt } from "@/i18n/mn";
import { formatDateTime } from "@/lib/birth-date";
import { todayIso } from "@/lib/daily";
import { faqAnswerFor, pickChunks } from "@/lib/help-search";
import type { AiConfig, AiRequest, AiUsage } from "@/server/ai/providers";
import { describeBirthDate, loadAstroRefs } from "@/server/astro/refs";
import { helpChats, persons, purchases, topups, user } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { getSelf } from "@/server/persons";
import { getBalance } from "@/server/wallet";
import { listPublishedFaqs } from "./faq";
import { assistantRules, buildSystemPrompt, loadKnowledge } from "./knowledge";
import { getHelpSettings, type HelpSettings } from "./settings";

/**
 * The help assistant (/help): one question in, one answer out, every exchange logged.
 *
 * Token budget, cheapest first:
 * 1. a new question that is nearly an FAQ's question is answered by that FAQ — no AI call;
 * 2. per-user daily cap, question ≤ 500 characters, only the last few exchanges as history
 *    (answers clipped), loaded from the database — the client can't plant fake turns;
 * 3. the knowledge is sent whole while it fits the budget (a stable prefix the provider's
 *    prompt cache bills at a fraction), else only the chunks that match the question;
 * 4. "think little" and a hard cap on the reply.
 */

export const QUESTION_MAX = 500;
/** Earlier answers are clipped to this in the history: the gist is enough for a follow-up. */
const HISTORY_ANSWER_MAX = 600;

export type HelpExchange = {
  id: string;
  question: string;
  answer: string;
  source: "ai" | "faq";
  feedback: number | null;
};

export class HelpError extends Error {
  constructor(readonly code: "disabled" | "limit" | "not_configured" | "invalid") {
    super(code);
  }
}

export type HelpDeps = {
  /** The provider to call (keys opened); throws when none is set up. */
  config: (settings: HelpSettings) => Promise<AiConfig>;
  complete: (cfg: AiConfig, req: AiRequest) => Promise<{ text: string; usage: AiUsage }>;
  appName: string;
  host: string;
  /** Admins testing the assistant aren't held to the daily cap. */
  unlimited?: boolean;
  now?: Date;
};

const askSchema = z.object({
  conversationId: z.uuid(),
  question: z.string().trim().min(2).max(QUESTION_MAX),
});

/** Start of today in Mongolia (UTC+8, no daylight saving). */
function mongoliaDayStart(now: Date): Date {
  return new Date(`${todayIso(now)}T00:00:00+08:00`);
}

/** Questions the user put to the AI today (FAQ answers are free and not counted). */
export async function aiQuestionsToday(db: AppDb, userId: string, now = new Date()) {
  const [row] = await db
    .select({ n: count() })
    .from(helpChats)
    .where(
      and(
        eq(helpChats.userId, userId),
        eq(helpChats.source, "ai"),
        gte(helpChats.createdAt, mongoliaDayStart(now)),
      ),
    );
  return row?.n ?? 0;
}

async function history(db: AppDb, userId: string, conversationId: string, turns: number) {
  if (turns === 0) return [];
  const rows = await db
    .select({ question: helpChats.question, answer: helpChats.answer })
    .from(helpChats)
    .where(and(eq(helpChats.userId, userId), eq(helpChats.conversationId, conversationId)))
    .orderBy(desc(helpChats.createdAt))
    .limit(turns);
  return rows.reverse();
}

/**
 * One line about the asker, so "where is my money?" can be answered for them: name, sign,
 * balance, counts, the latest top-up. A few dozen tokens, sent after the shared prefix.
 */
export async function describeUser(db: AppDb, userId: string): Promise<string> {
  const [self, balance, [people], [bought], [lastTopup], [u]] = await Promise.all([
    getSelf(db, userId),
    getBalance(db, userId),
    db
      .select({ n: count() })
      .from(persons)
      .where(and(eq(persons.ownerUserId, userId), isNull(persons.deletedAt))),
    db.select({ n: count() }).from(purchases).where(eq(purchases.userId, userId)),
    db
      .select({
        amount: topups.amount,
        bonus: topups.bonus,
        status: topups.status,
        at: topups.createdAt,
      })
      .from(topups)
      .where(eq(topups.userId, userId))
      .orderBy(desc(topups.createdAt))
      .limit(1),
    db.select({ adult: user.adultConfirmedAt }).from(user).where(eq(user.id, userId)),
  ]);
  const parts: string[] = [];
  if (self) {
    const { sign } = describeBirthDate(self.birthDate, await loadAstroRefs(db));
    parts.push(`Нэр: ${self.name}`, `орд: ${sign.nameMn}`);
  }
  parts.push(
    `хэтэвчний үлдэгдэл: ${formatMnt(balance)}`,
    `нэмсэн хүн: ${Math.max(0, (people?.n ?? 0) - (self ? 1 : 0))}`,
    `авсан зурхай: ${bought?.n ?? 0}`,
    `18+ баталгаажуулсан: ${u?.adult ? "тийм" : "үгүй"}`,
  );
  if (lastTopup) {
    const status = {
      pending: "төлөгдөөгүй/хүлээгдэж буй",
      paid: "төлөгдсөн",
      expired: "хугацаа дууссан",
      failed: "амжилтгүй",
    }[lastTopup.status];
    parts.push(
      `сүүлийн цэнэглэлт: ${formatMnt(lastTopup.amount)} — ${status} (${formatDateTime(lastTopup.at)})`,
    );
  }
  return parts.join("; ") + ".";
}

async function log(db: AppDb, row: typeof helpChats.$inferInsert): Promise<HelpExchange> {
  const [saved] = await db.insert(helpChats).values(row).returning();
  return {
    id: saved.id,
    question: saved.question,
    answer: saved.answer,
    source: saved.source as HelpExchange["source"],
    feedback: saved.feedback,
  };
}

export async function askHelp(
  db: AppDb,
  userId: string,
  input: unknown,
  deps: HelpDeps,
): Promise<HelpExchange> {
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) throw new HelpError("invalid");
  const { conversationId, question } = parsed.data;
  const settings = await getHelpSettings(db);
  if (!settings.enabled) throw new HelpError("disabled");

  const past = await history(db, userId, conversationId, settings.historyTurns);

  // A follow-up ("then what?") leans on the conversation, so only a fresh question may be
  // answered by an FAQ.
  if (settings.faqShortcut && past.length === 0) {
    const faq = faqAnswerFor(question, await listPublishedFaqs(db));
    if (faq)
      return log(db, {
        userId,
        conversationId,
        question,
        answer: faq.answer,
        source: "faq",
        faqId: faq.id,
      });
  }

  if (!deps.unlimited && (await aiQuestionsToday(db, userId, deps.now)) >= settings.dailyLimit)
    throw new HelpError("limit");

  let cfg: AiConfig;
  try {
    cfg = await deps.config(settings);
  } catch {
    throw new HelpError("not_configured");
  }

  const query = [past.at(-1)?.question, question].filter(Boolean).join(" ");
  const chunks = pickChunks(await loadKnowledge(db), query, settings.contextBudget);
  const rules = assistantRules({
    appName: deps.appName,
    host: deps.host,
    supportContact: settings.supportContact,
    instructions: settings.instructions,
  });
  const system = buildSystemPrompt(rules, chunks, await describeUser(db, userId));

  const started = Date.now();
  const { text, usage } = await deps.complete(cfg, {
    system,
    history: past.flatMap((t) => [
      { role: "user" as const, text: t.question },
      { role: "assistant" as const, text: t.answer.slice(0, HISTORY_ANSWER_MAX) },
    ]),
    user: question,
    maxTokens: settings.maxAnswerTokens,
    effort: "low",
  });

  return log(db, {
    userId,
    conversationId,
    question,
    answer: text.slice(0, 4000),
    source: "ai",
    provider: cfg.provider,
    model: cfg.model,
    inputTokens: usage.input,
    cachedTokens: usage.cached,
    outputTokens: usage.output,
    ms: Date.now() - started,
  });
}

/** 👍 / 👎 on one of the user's own answers (again = take it back). */
export async function rateAnswer(
  db: AppDb,
  userId: string,
  id: string,
  value: 1 | -1 | null,
): Promise<void> {
  if (!z.uuid().safeParse(id).success) throw new HelpError("invalid");
  await db
    .update(helpChats)
    .set({ feedback: value })
    .where(and(eq(helpChats.id, id), eq(helpChats.userId, userId)));
}

/** The user's latest conversation if it is still fresh (reopening help continues it). */
export async function recentConversation(
  db: AppDb,
  userId: string,
  { now = new Date(), withinHours = 6 } = {},
): Promise<{ conversationId: string; exchanges: HelpExchange[] } | null> {
  const [last] = await db
    .select({ conversationId: helpChats.conversationId, at: helpChats.createdAt })
    .from(helpChats)
    .where(eq(helpChats.userId, userId))
    .orderBy(desc(helpChats.createdAt))
    .limit(1);
  if (!last || now.getTime() - last.at.getTime() > withinHours * 3600_000) return null;
  const rows = await db
    .select()
    .from(helpChats)
    .where(and(eq(helpChats.userId, userId), eq(helpChats.conversationId, last.conversationId)))
    .orderBy(desc(helpChats.createdAt))
    .limit(20);
  return {
    conversationId: last.conversationId,
    exchanges: rows.reverse().map((r) => ({
      id: r.id,
      question: r.question,
      answer: r.answer,
      source: r.source as HelpExchange["source"],
      feedback: r.feedback,
    })),
  };
}
