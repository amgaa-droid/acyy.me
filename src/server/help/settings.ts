import { eq } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { AI_PROVIDERS } from "@/server/ai/providers";
import { appSettings } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";

/**
 * Help assistant settings (/admin/ai/assistant, Owner), one `app_settings` row ("help"). The
 * provider keys live with the translation settings ("ai"); here: whether the chat is on, which
 * provider/model it uses ("" = the same as translation), extra instructions, the support
 * contact it hands out, and the cost guards (daily questions per user, reply length, history,
 * knowledge budget, FAQ shortcut).
 */

const KEY = "help";

export const HELP_LIMITS = {
  dailyLimit: { min: 1, max: 200 },
  maxAnswerTokens: { min: 200, max: 4000 },
  historyTurns: { min: 0, max: 10 },
  contextBudget: { min: 1000, max: 30000 },
} as const;

const settingsSchema = z.object({
  enabled: z.boolean().default(true),
  /** "" = the provider the translation uses. */
  provider: z.enum(["", ...AI_PROVIDERS]).default(""),
  /** "" = that provider's model from the translation settings. */
  model: z.string().trim().max(100).default(""),
  greeting: z
    .string()
    .trim()
    .max(300)
    .default("Сайн байна уу! Апп ашиглах, цэнэглэлт, зурхайн талаар юу ч асуугаарай."),
  /** Extra rules for the assistant, after the built-in ones. */
  instructions: z.string().trim().max(4000).default(""),
  /** How to reach a person (Facebook page, email, phone) — said when the AI can't help. */
  supportContact: z.string().trim().max(300).default(""),
  dailyLimit: z.coerce
    .number()
    .int()
    .min(HELP_LIMITS.dailyLimit.min)
    .max(HELP_LIMITS.dailyLimit.max)
    .default(20),
  maxAnswerTokens: z.coerce
    .number()
    .int()
    .min(HELP_LIMITS.maxAnswerTokens.min)
    .max(HELP_LIMITS.maxAnswerTokens.max)
    .default(1200),
  historyTurns: z.coerce
    .number()
    .int()
    .min(HELP_LIMITS.historyTurns.min)
    .max(HELP_LIMITS.historyTurns.max)
    .default(3),
  contextBudget: z.coerce
    .number()
    .int()
    .min(HELP_LIMITS.contextBudget.min)
    .max(HELP_LIMITS.contextBudget.max)
    .default(8000),
  faqShortcut: z.boolean().default(true),
});

export type HelpSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_HELP_SETTINGS: HelpSettings = settingsSchema.parse({});

export async function getHelpSettings(db: AppDb): Promise<HelpSettings> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, KEY));
  const parsed = settingsSchema.safeParse(row?.value ?? {});
  if (parsed.success) return parsed.data;
  console.error("[help:settings] stored settings don't match the schema; using defaults");
  return DEFAULT_HELP_SETTINGS;
}

export async function saveHelpSettings(
  db: AppDb,
  actorId: string,
  input: unknown,
): Promise<HelpSettings> {
  const value = settingsSchema.parse(input);
  await db.transaction(async (tx) => {
    await tx
      .insert(appSettings)
      .values({ key: KEY, value, updatedBy: actorId })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedBy: actorId, updatedAt: new Date() },
      });
    await logAudit(tx, {
      actorId,
      action: "settings.help",
      entity: "app_settings",
      entityId: KEY,
      data: value,
    });
  });
  return value;
}
