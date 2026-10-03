import { eq } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { appSettings } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { AUTO_SYNC_DEFAULT_TIME, AUTO_SYNC_TIME_RE } from "@/server/daily-sync/schedule";
import { openSecret, sealSecret } from "@/server/secret-box";
import {
  AI_PROVIDERS,
  DEFAULT_MODELS,
  currentModel,
  type AiConfig,
  type AiProviderId,
} from "./providers";

/**
 * AI translation settings (/admin/ai, Owner): which provider the daily sync uses, each
 * provider's model and API key (sealed), the translation instructions and whether the daily
 * cron runs. Stored as one `app_settings` row; keys never leave the server — the page only
 * sees whether a key is set and its last 4 characters.
 */

const KEY = "ai";

/** The translation instructions admins start from (and can reset to). */
export const DEFAULT_TRANSLATION_PROMPT = `Чи монгол хэвлэлд зурхайн булан олон жил хөтөлсөн редактор. Англи хэл дээрх өдрийн зурхайг монгол уншигчдад зориулж монголоор ДАХИН БИЧНЭ — үг үгээр орчуулахгүй.

Хэрхэн бичих
- Эхлээд англи текстийн санааг бүрэн ойлго, дараа нь монгол хүн анхнаасаа монголоор бичсэн мэт бич.
- Утга, зөвлөгөө, гаригийн үйл явдлыг бүгдийг хадгал. Шинэ санаа бүү нэм, юу ч бүү хас.
- Монгол өгүүлбэрийн дараалал (үйл үг төгсгөлд), богино, тод өгүүлбэр. Урт англи өгүүлбэрийг 2–3 болгож хуваа.
- Дулаан, урам өгсөн, энгийн ярианы өнгө. Уншигчид "чи" гэж хандана.
- Англи хэлц, зүйрлэлийг монгол дүйцлээр нь илэрхийл ("stir the pot" → "үймээн дэгдээх", "get off to a good start" → "сайхан эхлүүлэх", "dark clouds brew" → "үүл бүрхэж эхэлнэ").
- "dearest Aries", "Leo" гэх мэт хандлагыг орчуулахгүй, ордын нэрийг шаардлагагүй давтахгүй ("Хонь минь" гэж бүү бич).
- Гадаад үг бүү хэрэглэ: romantic → хайр сэтгэлийн, partner → хань, хамтрагч, energy → эрч хүч, emotion → сэтгэл хөдлөл, drama → хэрүүл маргаан, routine → өдөр тутмын хэв маяг.
- Бичиг үсгийн алдаагүй, утга зүйн хувьд зөв монгол хэл. Бичиж дуусаад нэг уншиж, орчуулга шиг санагдах хэсгийг дахин засаж бич.

Зурхайн нэр томьёо
- Гаригууд: Sun — Нар, Moon — Сар, Mercury — Буд, Venus — Сугар, Mars — Ангараг, Jupiter — Бархасбадь, Saturn — Санчир, Uranus — Тэнгэрийн ван, Neptune — Далай ван, Pluto — Плутон.
- retrograde, rx, stations retrograde — ухрах, ухралт ("Сугар ухарч эхэлнэ", "Сугарын ухралтын үед"); stations direct — ухралтаас гарна.
- ruling planet — ордны эзэн гариг.
- trine, sextile — ээлтэй байрлал; square, opposition — зөрчилтэй байрлал; conjunction — нийлэлт; aligns with, links with — харьцаанд орно.
- full moon — тэргэл сар; new moon — шинэ сар; quarter moon — хагас сар; eclipse — хиртэлт.
- Cancer Moon, Moon in Cancer — Мэлхий ордонд байгаа Сар.

Хэв маягийн жишээ
EN: Venus stations retrograde just after midnight, stirring the pot within professional and romantic partnerships. The closer you are to someone, the more likely your connection is to be tested.
MN: Шөнө дундаас хойш Сугар ухарч эхэлнэ. Энэ нь ажил хэрэг болон хайр сэтгэлийн харилцаанд үймээн дэгдээнэ. Хэн нэгэнтэй хэдий чинээ дотно байна, тэр холбоо төдий чинээ сорилтод орох магадлалтай.`;

const sealedKey = z.object({ sealed: z.string(), hint: z.string() }).nullable();

const keysSchema = z
  .object({ gemini: sealedKey.default(null), openai: sealedKey.default(null) })
  .default({ gemini: null, openai: null });

const storedSchema = z.object({
  provider: z.enum(AI_PROVIDERS).default("gemini"),
  models: z.object({ gemini: z.string(), openai: z.string() }).default({ ...DEFAULT_MODELS }),
  keys: keysSchema,
  /** "" = the default prompt. */
  prompt: z.string().default(""),
  autoSync: z.boolean().default(false),
  /** "HH:MM", Mongolia time. */
  autoSyncTime: z.string().regex(AUTO_SYNC_TIME_RE).default(AUTO_SYNC_DEFAULT_TIME),
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
  autoSyncTime: string;
};

export class AiSettingsError extends Error {
  constructor(readonly code: "no_encryption_key" | "not_configured" | "bad_key") {
    super(code);
  }
}

async function loadStored(db: AppDb): Promise<Stored> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, KEY));
  const parsed = storedSchema.safeParse(row?.value ?? {});
  let s: Stored;
  if (parsed.success) s = parsed.data;
  else {
    // A stored field no longer fits (an older shape): fall back to defaults but keep the sealed
    // keys, so the next save doesn't silently throw them away.
    console.error("[ai:settings] stored settings don't match the schema; using defaults");
    const keys = keysSchema.safeParse((row?.value as { keys?: unknown } | undefined)?.keys);
    s = storedSchema.parse(keys.success ? { keys: keys.data } : {});
  }
  return {
    ...s,
    models: {
      gemini: currentModel("gemini", s.models.gemini),
      openai: currentModel("openai", s.models.openai),
    },
  };
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
    autoSyncTime: s.autoSyncTime,
  };
}

const keyInput = z.object({
  /** A new key; empty = keep the saved one. */
  apiKey: z.string().trim().max(500).default(""),
  /** Forget the saved key. */
  clear: z.boolean().default(false),
});

const saveAiSettingsSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  models: z.object({
    gemini: z.string().trim().min(1).max(100),
    openai: z.string().trim().min(1).max(100),
  }),
  keys: z.object({ gemini: keyInput, openai: keyInput }),
  prompt: z.string().trim().max(8000),
  autoSync: z.boolean(),
  autoSyncTime: z.string().regex(AUTO_SYNC_TIME_RE),
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
    autoSyncTime: data.autoSyncTime,
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
        autoSyncTime: value.autoSyncTime,
      },
    });
  });
  return getAiSettingsView(db);
}

type AiRuntime = AiConfig & { prompt: string };

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
  const model = currentModel(provider, override.model?.trim() || s.models[provider]);
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
  };
}

/** Whether and when the daily cron syncs. */
export async function getAutoSync(db: AppDb): Promise<{ on: boolean; time: string }> {
  const s = await loadStored(db);
  return { on: s.autoSync, time: s.autoSyncTime };
}
