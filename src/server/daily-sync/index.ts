import "server-only";

import { env } from "@/env";
import { aiCompleter } from "@/server/ai/providers";
import { getAutoSync, loadAiRuntime } from "@/server/ai/settings";
import type { AppDb } from "@/server/db/types";
import { autoSyncDecision, todayAt, type AutoSyncDecision } from "./schedule";
import { runDailySyncOnce, syncRunsSince, type SyncReport, type SyncTrigger } from "./sync";

/** The daily sync with the provider saved on /admin/ai. */
export async function syncWithSavedSettings(
  db: AppDb,
  actorId: string | null,
  trigger: SyncTrigger,
): Promise<SyncReport> {
  const ai = await loadAiRuntime(db, env().SETTINGS_ENCRYPTION_KEY);
  return runDailySyncOnce(db, {
    actorId,
    trigger,
    ai: { provider: ai.provider, model: ai.model, prompt: ai.prompt, complete: aiCompleter(ai) },
  });
}

/** The cron's tick: syncs only if auto sync is on and today's run is due (see schedule.ts). */
export async function autoSyncIfDue(
  db: AppDb,
  now: Date = new Date(),
): Promise<SyncReport | { skipped: "auto_sync_off" | Exclude<AutoSyncDecision, "due"> }> {
  const auto = await getAutoSync(db);
  if (!auto.on) return { skipped: "auto_sync_off" };
  const runs = await syncRunsSince(db, todayAt(auto.time, now));
  const decision = autoSyncDecision({ now, time: auto.time, runs });
  if (decision !== "due") return { skipped: decision };
  return syncWithSavedSettings(db, null, "cron");
}
