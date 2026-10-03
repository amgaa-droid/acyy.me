"use server";

import { APP_NAME, env } from "@/env";
import { AiError, aiCompleteWithUsage } from "@/server/ai/providers";
import { loadAiRuntime } from "@/server/ai/settings";
import { requireOnboardedUser } from "@/server/auth/current";
import { adminRoleOf } from "@/server/auth/session";
import { db } from "@/server/db";
import { HelpError, askHelp, rateAnswer, type HelpExchange } from "@/server/help/chat";
import { getHelpSettings } from "@/server/help/settings";
import { createThrottle } from "@/server/throttle";

const throttle = createThrottle(3000);

export type AskResult =
  | { ok: true; exchange: HelpExchange }
  | {
      ok: false;
      error: HelpError["code"] | "too_fast" | "busy" | "generic";
      /** The daily cap, for the "limit" message. */
      limit?: number;
    };

/** One question to the help assistant (SPEC §3.3). */
export async function askHelpAction(input: unknown): Promise<AskResult> {
  const { user } = await requireOnboardedUser();
  if (!throttle(user.id)) return { ok: false, error: "too_fast" };
  try {
    const exchange = await askHelp(db, user.id, input, {
      config: async (s) => {
        const ai = await loadAiRuntime(db, env().SETTINGS_ENCRYPTION_KEY, {
          provider: s.provider || undefined,
          model: s.model || undefined,
        });
        return { provider: ai.provider, model: ai.model, apiKey: ai.apiKey };
      },
      complete: (cfg, req) => aiCompleteWithUsage(cfg, req),
      appName: APP_NAME,
      host: new URL(env().APP_URL).host,
      unlimited: !!adminRoleOf(user),
    });
    return { ok: true, exchange };
  } catch (err) {
    if (err instanceof HelpError) {
      if (err.code === "limit")
        return { ok: false, error: "limit", limit: (await getHelpSettings(db)).dailyLimit };
      return { ok: false, error: err.code };
    }
    if (err instanceof AiError) {
      console.error("[help:ask]", err.message);
      return { ok: false, error: "busy" };
    }
    console.error("[help:ask]", err);
    return { ok: false, error: "generic" };
  }
}

/** 👍 / 👎 on an answer (null = take it back). */
export async function rateHelpAction(id: string, value: 1 | -1 | null): Promise<void> {
  const { user } = await requireOnboardedUser();
  if (value !== 1 && value !== -1 && value !== null) return;
  await rateAnswer(db, user.id, id, value).catch(() => undefined);
}
