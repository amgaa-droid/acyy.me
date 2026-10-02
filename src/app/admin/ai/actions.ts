"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { env } from "@/env";
import { requireOwner } from "@/server/admin/guard";
import { AI_PROVIDERS, AiError, aiComplete } from "@/server/ai/providers";
import {
  AiSettingsError,
  loadAiRuntime,
  saveAiSettings,
  type AiSettingsView,
} from "@/server/ai/settings";
import { db } from "@/server/db";

type ErrorCode = AiSettingsError["code"] | "invalid" | "generic";

export type SaveAiResult = { ok: true; settings: AiSettingsView } | { ok: false; error: ErrorCode };

/** Owner only: provider, models, API keys (sealed), translation prompt, daily cron on/off. */
export async function saveAiSettingsAction(input: unknown): Promise<SaveAiResult> {
  const admin = await requireOwner();
  try {
    const settings = await saveAiSettings(
      db,
      admin.userId,
      input as never,
      env().SETTINGS_ENCRYPTION_KEY,
    );
    revalidatePath("/admin/ai");
    revalidatePath("/admin/daily");
    return { ok: true, settings };
  } catch (err) {
    if (err instanceof AiSettingsError) return { ok: false, error: err.code };
    if (err instanceof z.ZodError) return { ok: false, error: "invalid" };
    console.error("[admin:ai]", err);
    return { ok: false, error: "generic" };
  }
}

const testSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  model: z.string().trim().max(100),
  apiKey: z.string().trim().max(500),
  prompt: z.string().trim().max(8000),
});

const SAMPLE =
  "Venus stations retrograde just after midnight, Aries, stirring the pot within your partnerships. Show compassion and your bond will deepen.";

export type TestAiResult =
  { ok: true; text: string; ms: number } | { ok: false; error: ErrorCode; detail?: string };

/** Translates one sample sentence with the form's (possibly unsaved) choices. */
export async function testAiAction(input: unknown): Promise<TestAiResult> {
  await requireOwner();
  const parsed = testSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const ai = await loadAiRuntime(db, env().SETTINGS_ENCRYPTION_KEY, parsed.data);
    const started = Date.now();
    const text = await aiComplete(ai, {
      system: `${ai.prompt}\n\nОрдны нэр: Aries — Хонь. Зөвхөн орчуулгыг бич.`,
      user: SAMPLE,
    });
    return { ok: true, text: text.slice(0, 1000), ms: Date.now() - started };
  } catch (err) {
    if (err instanceof AiSettingsError) return { ok: false, error: err.code };
    if (err instanceof AiError) return { ok: false, error: "generic", detail: err.message };
    console.error("[admin:ai:test]", err);
    return { ok: false, error: "generic" };
  }
}
