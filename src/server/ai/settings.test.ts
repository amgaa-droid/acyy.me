import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { appSettings, auditLogs } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { createTestDb, insertUser } from "@/test/db";
import {
  AiSettingsError,
  DEFAULT_TRANSLATION_PROMPT,
  getAiSettingsView,
  getAutoSync,
  loadAiRuntime,
  saveAiSettings,
} from "./settings";

let db: AppDb;
let close: () => Promise<void>;
let actor: string;

const SECRET = "s".repeat(64);
const noKeys = { gemini: { apiKey: "" }, openai: { apiKey: "" } };
const base = {
  provider: "gemini" as const,
  models: { gemini: "gemini-3.8-flash", openai: "gpt-5-mini" },
  keys: noKeys,
  prompt: DEFAULT_TRANSLATION_PROMPT,
  autoSync: false,
  autoSyncTime: "20:00",
};

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  actor = (await insertUser(db, "owner@test.local")).id;
});
afterAll(() => close());
beforeEach(async () => {
  await db.delete(appSettings);
  await db.delete(auditLogs);
});

describe("AI settings", () => {
  it("starts with Gemini, default models and prompt, no keys, cron off", async () => {
    expect(await getAiSettingsView(db)).toEqual({
      provider: "gemini",
      models: { gemini: "gemini-3.8-flash", openai: "gpt-5-mini" },
      keys: { gemini: { set: false, hint: null }, openai: { set: false, hint: null } },
      prompt: DEFAULT_TRANSLATION_PROMPT,
      defaultPrompt: DEFAULT_TRANSLATION_PROMPT,
      autoSync: false,
      autoSyncTime: "20:00",
    });
    await expect(loadAiRuntime(db, SECRET)).rejects.toEqual(new AiSettingsError("not_configured"));
  });

  it("seals keys: the DB, the view and the audit log never hold them in plain text", async () => {
    const view = await saveAiSettings(
      db,
      actor,
      { ...base, keys: { ...noKeys, gemini: { apiKey: "AIza-secret-9876" } } },
      SECRET,
    );
    expect(view.keys.gemini).toEqual({ set: true, hint: "…9876" });
    expect(view.keys.openai.set).toBe(false);
    expect(JSON.stringify(view)).not.toContain("AIza");

    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "ai"));
    expect(JSON.stringify(row.value)).not.toContain("AIza");
    const audits = await db.select().from(auditLogs);
    expect(audits.map((a) => a.action)).toEqual(["settings.ai"]);
    expect(JSON.stringify(audits[0].data)).not.toContain("AIza");

    const rt = await loadAiRuntime(db, SECRET);
    expect(rt).toMatchObject({
      provider: "gemini",
      model: "gemini-3.8-flash",
      apiKey: "AIza-secret-9876",
      prompt: DEFAULT_TRANSLATION_PROMPT,
    });
  });

  it("keeps a saved key when the field is left empty, forgets it on clear", async () => {
    await saveAiSettings(
      db,
      actor,
      { ...base, keys: { ...noKeys, openai: { apiKey: "sk-abc-1234" } } },
      SECRET,
    );
    const kept = await saveAiSettings(
      db,
      actor,
      { ...base, provider: "openai", prompt: "Custom.", autoSync: true, autoSyncTime: "21:30" },
      SECRET,
    );
    expect(kept.keys.openai).toEqual({ set: true, hint: "…1234" });
    expect(kept).toMatchObject({
      provider: "openai",
      prompt: "Custom.",
      autoSync: true,
      autoSyncTime: "21:30",
    });
    expect(await getAutoSync(db)).toEqual({ on: true, time: "21:30" });
    expect((await loadAiRuntime(db, SECRET)).apiKey).toBe("sk-abc-1234");

    const cleared = await saveAiSettings(
      db,
      actor,
      { ...base, keys: { ...noKeys, openai: { apiKey: "", clear: true } } },
      SECRET,
    );
    expect(cleared.keys.openai.set).toBe(false);
  });

  it("needs SETTINGS_ENCRYPTION_KEY to save or open a key", async () => {
    await expect(
      saveAiSettings(
        db,
        actor,
        { ...base, keys: { ...noKeys, gemini: { apiKey: "k" } } },
        undefined,
      ),
    ).rejects.toEqual(new AiSettingsError("no_encryption_key"));
    await saveAiSettings(
      db,
      actor,
      { ...base, keys: { ...noKeys, gemini: { apiKey: "k" } } },
      SECRET,
    );
    await expect(loadAiRuntime(db, undefined)).rejects.toEqual(
      new AiSettingsError("no_encryption_key"),
    );
    await expect(loadAiRuntime(db, "x".repeat(64))).rejects.toEqual(new AiSettingsError("bad_key"));
  });

  it("lets the test button override provider, model, key and prompt", async () => {
    const rt = await loadAiRuntime(db, undefined, {
      provider: "openai",
      model: " gpt-test ",
      apiKey: "typed",
      prompt: "P",
    });
    expect(rt).toMatchObject({
      provider: "openai",
      model: "gpt-test",
      apiKey: "typed",
      prompt: "P",
    });
  });

  it("upgrades a retired model saved earlier", async () => {
    await db.insert(appSettings).values({
      key: "ai",
      value: { provider: "gemini", models: { gemini: "gemini-2.5-flash", openai: "gpt-5-mini" } },
    });
    expect((await getAiSettingsView(db)).models.gemini).toBe("gemini-3.8-flash");
    const rt = await loadAiRuntime(db, undefined, { apiKey: "typed", model: "gemini-2.5-flash" });
    expect(rt.model).toBe("gemini-3.8-flash");
  });

  it("keeps the sealed keys when another stored field no longer fits the schema", async () => {
    await saveAiSettings(
      db,
      actor,
      { ...base, keys: { ...noKeys, gemini: { apiKey: "AIza-secret-9999" } } },
      SECRET,
    );
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "ai"));
    await db
      .update(appSettings)
      .set({ value: { ...(row.value as object), autoSyncTime: "25:99" } })
      .where(eq(appSettings.key, "ai"));

    const view = await getAiSettingsView(db);
    expect(view.keys.gemini).toEqual({ set: true, hint: "…9999" });
    expect((await loadAiRuntime(db, SECRET)).apiKey).toBe("AIza-secret-9999");
  });

  it("validates input", async () => {
    await expect(
      saveAiSettings(db, actor, { ...base, models: { gemini: "", openai: "x" } }, SECRET),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      saveAiSettings(db, actor, { ...base, provider: "claude" as never }, SECRET),
    ).rejects.toBeInstanceOf(ZodError);
    for (const autoSyncTime of ["24:00", "9:00", "20:60", ""]) {
      await expect(
        saveAiSettings(db, actor, { ...base, autoSyncTime }, SECRET),
      ).rejects.toBeInstanceOf(ZodError);
    }
  });
});
