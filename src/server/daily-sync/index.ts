import "server-only";

import { env } from "@/env";
import { aiCompleter } from "@/server/ai/providers";
import { loadAiRuntime } from "@/server/ai/settings";
import type { AppDb } from "@/server/db/types";
import { runDailySyncOnce, type SyncReport, type SyncTrigger } from "./sync";

/** The daily sync with the provider saved on /admin/ai (button and cron). */
export async function syncWithSavedSettings(
  db: AppDb,
  actorId: string | null,
  trigger: SyncTrigger,
): Promise<SyncReport | { skipped: "auto_sync_off" }> {
  const ai = await loadAiRuntime(db, env().SETTINGS_ENCRYPTION_KEY);
  if (trigger === "cron" && !ai.autoSync) return { skipped: "auto_sync_off" };
  return runDailySyncOnce(db, {
    actorId,
    trigger,
    ai: { provider: ai.provider, model: ai.model, prompt: ai.prompt, complete: aiCompleter(ai) },
  });
}
