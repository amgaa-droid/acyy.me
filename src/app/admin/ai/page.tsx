import type { Metadata } from "next";

import { env } from "@/env";
import { mn } from "@/i18n/mn";
import { requireOwner } from "@/server/admin/guard";
import { DEFAULT_MODELS } from "@/server/ai/providers";
import { getAiSettingsView } from "@/server/ai/settings";
import { db } from "@/server/db";
import { AUTO_SYNC_EARLIEST_TOMORROW } from "@/server/daily-sync/schedule";
import { AiSettingsForm } from "./ai-settings-form";
import { AiHeader } from "./ai-tabs";

export const metadata: Metadata = { title: mn.admin.nav.ai };

const t = mn.admin.ai;

/** Owner only: AI keys and the daily-sync translation (SPEC §3.2); tabs lead to the assistant. */
export default async function AiSettingsPage() {
  await requireOwner();
  const settings = await getAiSettingsView(db);
  const encryptionReady = !!env().SETTINGS_ENCRYPTION_KEY;

  return (
    <div className="flex flex-col gap-5">
      <AiHeader intro={t.intro} />
      {!encryptionReady && (
        <p
          role="alert"
          className="max-w-3xl rounded-3xl bg-destructive/10 p-5 text-sm font-semibold text-destructive"
        >
          {t.noEncryption}
        </p>
      )}
      <AiSettingsForm
        initial={settings}
        defaultModels={DEFAULT_MODELS}
        encryptionReady={encryptionReady}
        earliestTomorrow={AUTO_SYNC_EARLIEST_TOMORROW}
      />
    </div>
  );
}
