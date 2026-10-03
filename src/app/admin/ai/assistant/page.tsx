import type { Metadata } from "next";

import { env } from "@/env";
import { mn } from "@/i18n/mn";
import { chunkText, estimateTokens } from "@/lib/help-search";
import { requireOwner } from "@/server/admin/guard";
import { getAiSettingsView, loadAiRuntime } from "@/server/ai/settings";
import { db } from "@/server/db";
import { loadKnowledge } from "@/server/help/knowledge";
import { getHelpSettings } from "@/server/help/settings";
import { AiHeader } from "../ai-tabs";
import { AssistantForm } from "./assistant-form";

export const metadata: Metadata = { title: mn.admin.ai.tabs.assistant };

const t = mn.admin.ai.assistant;

/** Owner only: the help assistant's settings (SPEC §3.3). */
export default async function AssistantPage() {
  await requireOwner();
  const [settings, ai, chunks] = await Promise.all([
    getHelpSettings(db),
    getAiSettingsView(db),
    loadKnowledge(db),
  ]);
  const configured = await loadAiRuntime(db, env().SETTINGS_ENCRYPTION_KEY, {
    provider: settings.provider || undefined,
  }).then(
    () => true,
    () => false,
  );
  const knowledgeTokens = chunks.reduce((n, c) => n + estimateTokens(chunkText(c)), 0);

  return (
    <div className="flex flex-col gap-5">
      <AiHeader intro={t.intro} />
      {settings.enabled && !configured && (
        <p
          role="alert"
          className="max-w-3xl rounded-3xl bg-destructive/10 p-5 text-sm font-semibold text-destructive"
        >
          {t.notConfigured}
        </p>
      )}
      <AssistantForm
        initial={settings}
        translationProvider={ai.provider}
        models={ai.models}
        knowledgeTokens={knowledgeTokens}
      />
    </div>
  );
}
