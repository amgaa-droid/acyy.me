import { eq } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { appSettings } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { openSecret, sealSecret } from "@/server/secret-box";
import { AI_PROVIDERS, DEFAULT_MODELS, type AiConfig, type AiProviderId } from "./providers";

/**
 * AI translation settings (/admin/ai, Owner): which provider the daily sync uses, each
 * provider's model and API key (sealed), the translation instructions and whether the daily
 * cron runs. Stored as one `app_settings` row; keys never leave the server — the page only
 * sees whether a key is set and its last 4 characters.
 */

const KEY = "ai";

/** The translation instructions admins start from (and can reset to). */
export const DEFAULT_TRANSLATION_PROMPT = `Чи англи хэлнээс монгол хэл рүү зурхайн текст орчуулдаг мэргэжлийн орчуулагч.

- Утгыг нь бүрэн, үнэн зөв хадгалж, монгол хүн бичсэн мэт уран, энгийн, ойлгомжтой кирилл монгол хэлээр орчуул. Үг үсгийн шууд орчуулгаас зайлсхий.
- Уншигчид "чи" гэж хандана. Нэмж тайлбар, гарчиг, emoji, хашилт бүү нэм; юу ч хасахгүй.
- Гаригууд: Sun — Нар, Moon — Сар, Mercury — Буд, Venus — Сугар, Mars — Ангараг, Jupiter — Бархасбадь, Saturn — Санчир, Uranus — Тэнгэрийн ван, Neptune — Далай ван, Pluto — Плутон. Retrograde — ухрах (жишээ нь "Сугар ухарч эхэлнэ"). Full/New Moon — тэргэл/шинэ сар. Trine, square, opposition зэрэг нэр томьёог энгийн үгээр илэрхийл.
- Ордны нэрийг доорх жагсаалтаар ашигла.`;

const sealedKey = z.object({ sealed: z.string(), hint: z.string() }).nullable();

const storedSchema = z.object({
  provider: z.enum(AI_PROVIDERS).default("gemini"),
  models: z.object({ gemini: z.string(), openai: z.string() }).default({ ...DEFAULT_MODELS }),
  keys: z
    .object({ gemini: sealedKey.default(null), openai: sealedKey.default(null) })
    .default({ gemini: null, openai: null }),
  /** "" = the default prompt. */
  prompt: z.string().default(""),
  autoSync: z.boolean().default(false),
});
type Stored = z.infer<typeof storedSchema>;

/** What the settings page may see. */
export type AiSettingsView = {
  provider: AiProviderId;
  models: Record<AiProviderId, string>;
  keys: Record<AiProviderId, { set: boolean; hint: string | null }>;
  prompt: string;
  defaultPrompt: string;
  autoSync: boolean;
};

export class AiSettingsError extends Error {
  constructor(readonly code: "no_encryption_key" | "not_configured" | "bad_key") {
    super(code);
  }
}

async function loadStored(db: AppDb): Promise<Stored> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, KEY));
  const parsed = storedSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : storedSchema.parse({});
}

export async function getAiSettingsView(db: AppDb): Promise<AiSettingsView> {
  const s = await loadStored(db);
  return {
    provider: s.provider,
    models: s.models,
    keys: {
      gemini: { set: !!s.keys.gemini, hint: s.keys.gemini?.hint ?? null },
      openai: { set: !!s.keys.openai, hint: s.keys.openai?.hint ?? null },
    },
    prompt: s.prompt || DEFAULT_TRANSLATION_PROMPT,
    defaultPrompt: DEFAULT_TRANSLATION_PROMPT,
    autoSync: s.autoSync,
  };
}

const keyInput = z.object({
  /** A new key; empty = keep the saved one. */
  apiKey: z.string().trim().max(500).default(""),
  /** Forget the saved key. */
  clear: z.boolean().default(false),
});

export const saveAiSettingsSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  models: z.object({
    gemini: z.string().trim().min(1).max(100),
    openai: z.string().trim().min(1).max(100),
  }),
  keys: z.object({ gemini: keyInput, openai: keyInput }),
  prompt: z.string().trim().max(8000),
  autoSync: z.boolean(),
});

function hintOf(key: string): string {
  return `…${key.slice(-4)}`;
}

export async function saveAiSettings(
  db: AppDb,
  actorId: string,
  input: z.input<typeof saveAiSettingsSchema>,
  secret: string | undefined,
): Promise<AiSettingsView> {
  const data = saveAiSettingsSchema.parse(input);
  const prev = await loadStored(db);
  const keys = { ...prev.keys };
  const changedKeys: string[] = [];
  for (const p of AI_PROVIDERS) {
    const k = data.keys[p];
    if (k.apiKey) {
      if (!secret) throw new AiSettingsError("no_encryption_key");
      keys[p] = { sealed: sealSecret(k.apiKey, secret), hint: hintOf(k.apiKey) };
      changedKeys.push(`${p}:set`);
    } else if (k.clear && keys[p]) {
      keys[p] = null;
      changedKeys.push(`${p}:cleared`);
    }
  }
  const value: Stored = {
    provider: data.provider,
    models: data.models,
    keys,
    prompt: data.prompt === DEFAULT_TRANSLATION_PROMPT ? "" : data.prompt,
    autoSync: data.autoSync,
  };
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
      action: "settings.ai",
      entity: "app_settings",
      entityId: KEY,
      // Never the keys themselves.
      data: {
        provider: value.provider,
        models: value.models,
        keys: changedKeys,
        customPrompt: !!value.prompt,
        autoSync: value.autoSync,
      },
    });
  });
  return getAiSettingsView(db);
}

export type AiRuntime = AiConfig & { prompt: string; autoSync: boolean };

/**
 * The provider the sync should use right now, with its key opened. `override` lets the
 * settings page try unsaved choices (a typed-in key wins over the saved one).
 */
export async function loadAiRuntime(
  db: AppDb,
  secret: string | undefined,
  override: { provider?: AiProviderId; model?: string; apiKey?: string; prompt?: string } = {},
): Promise<AiRuntime> {
  const s = await loadStored(db);
  const provider = override.provider ?? s.provider;
  const model = override.model?.trim() || s.models[provider];
  let apiKey = override.apiKey?.trim() ?? "";
  if (!apiKey) {
    const sealed = s.keys[provider];
    if (!sealed) throw new AiSettingsError("not_configured");
    if (!secret) throw new AiSettingsError("no_encryption_key");
    try {
      apiKey = openSecret(sealed.sealed, secret);
    } catch {
      // Sealed with another SETTINGS_ENCRYPTION_KEY: the key has to be entered again.
      throw new AiSettingsError("bad_key");
    }
  }
  return {
    provider,
    model,
    apiKey,
    prompt: override.prompt?.trim() || s.prompt || DEFAULT_TRANSLATION_PROMPT,
    autoSync: s.autoSync,
  };
}
