"use client";

import { ExternalLink, FlaskConical, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";
import type { AiProviderId } from "@/server/ai/providers";
import type { AiSettingsView } from "@/server/ai/settings";
import { Field, Status, Toggle, inputClass, type Msg } from "../products/ui";
import { saveAiSettingsAction, testAiAction, type TestAiResult } from "./actions";

const t = mn.admin.ai;
const PROVIDERS: AiProviderId[] = ["gemini", "openai"];

type KeyDraft = { apiKey: string; clear: boolean };

/** Provider choice, per-provider model + key, translation prompt, daily cron switch, test. */
export function AiSettingsForm({
  initial,
  defaultModels,
  encryptionReady,
}: {
  initial: AiSettingsView;
  defaultModels: Record<AiProviderId, string>;
  encryptionReady: boolean;
}) {
  const [saved, setSaved] = useState(initial);
  const [provider, setProvider] = useState(initial.provider);
  const [models, setModels] = useState(initial.models);
  const [keys, setKeys] = useState<Record<AiProviderId, KeyDraft>>({
    gemini: { apiKey: "", clear: false },
    openai: { apiKey: "", clear: false },
  });
  const [prompt, setPrompt] = useState(initial.prompt);
  const [autoSync, setAutoSync] = useState(initial.autoSync);
  const [msg, setMsg] = useState<Msg>(null);
  const [test, setTest] = useState<TestAiResult | null>(null);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();

  const save = () =>
    startSave(async () => {
      setMsg(null);
      const res = await saveAiSettingsAction({ provider, models, keys, prompt, autoSync });
      if (res.ok) {
        setSaved(res.settings);
        setKeys({ gemini: { apiKey: "", clear: false }, openai: { apiKey: "", clear: false } });
        setMsg({ ok: true, text: t.saved });
      } else {
        setMsg({ ok: false, text: t.errors[res.error] ?? t.errors.generic });
      }
    });

  const runTest = () =>
    startTest(async () => {
      setTest(null);
      setTest(
        await testAiAction({
          provider,
          model: models[provider],
          apiKey: keys[provider].apiKey,
          prompt,
        }),
      );
    });

  return (
    <div className="grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 lg:col-span-2">
        <h2 className="font-semibold">{t.provider}</h2>
        <div role="radiogroup" aria-label={t.provider} className="grid grid-cols-2 gap-3">
          {PROVIDERS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={provider === p}
              onClick={() => setProvider(p)}
              className={cn(
                "flex min-h-16 flex-col items-start justify-center rounded-2xl px-4 py-3 text-left",
                provider === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-subtle hover:ring-2 hover:ring-border",
              )}
            >
              <span className="font-semibold">{t.providers[p].name}</span>
              <span className="text-xs opacity-80">
                {t.providers[p].by} · {models[p]}
              </span>
            </button>
          ))}
        </div>
      </section>

      {PROVIDERS.map((p) => {
        const key = saved.keys[p];
        return (
          <section key={p} className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{t.providers[p].name}</h2>
              {provider === p && (
                <span className="rounded-full bg-tint-1 px-2.5 py-1 text-xs font-semibold text-highlight">
                  {t.inUse}
                </span>
              )}
            </div>
            <Field label={t.model} hint={t.modelHint(defaultModels[p])}>
              <input
                className={inputClass}
                value={models[p]}
                spellCheck={false}
                onChange={(e) => setModels({ ...models, [p]: e.target.value })}
              />
            </Field>
            <Field label={t.apiKey} hint={key.set && key.hint ? t.keySaved(key.hint) : t.keyNone}>
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                className={inputClass}
                placeholder={t.keyPlaceholder}
                disabled={!encryptionReady}
                value={keys[p].apiKey}
                onChange={(e) =>
                  setKeys({ ...keys, [p]: { apiKey: e.target.value, clear: false } })
                }
              />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              {key.set && (
                <Toggle
                  label={t.clearKey}
                  on={keys[p].clear}
                  onChange={(v) => setKeys({ ...keys, [p]: { apiKey: "", clear: v } })}
                />
              )}
              <a
                href={t.providers[p].keyUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-10 items-center gap-1.5 text-sm font-semibold text-highlight"
              >
                {t.getKey} <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </div>
          </section>
        );
      })}

      <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5 lg:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{t.prompt}</h2>
          <button
            type="button"
            onClick={() => setPrompt(initial.defaultPrompt)}
            disabled={prompt === initial.defaultPrompt}
            className="flex h-10 items-center gap-1.5 rounded-full bg-subtle px-3.5 text-sm font-semibold disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" aria-hidden /> {t.resetPrompt}
          </button>
        </div>
        <textarea
          aria-label={t.prompt}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={10}
          maxLength={8000}
          className="w-full rounded-2xl bg-subtle p-4 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">{t.promptHint}</p>
      </section>

      <section className="flex flex-col gap-2 rounded-3xl bg-surface p-5 lg:col-span-2">
        <Toggle label={t.autoSync} on={autoSync} onChange={setAutoSync} />
        <p className="text-xs text-muted-foreground">{t.autoSyncHint}</p>
      </section>

      <div className="flex flex-col gap-3 lg:col-span-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="lg"
            className="rounded-full sm:w-auto sm:min-w-44"
            disabled={saving}
            onClick={save}
          >
            {saving ? t.saving : t.save}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-full sm:w-auto sm:min-w-44"
            disabled={testing}
            onClick={runTest}
          >
            <FlaskConical aria-hidden /> {testing ? t.testing : t.test}
          </Button>
        </div>
        <Status msg={msg} />
        <p className="text-xs text-muted-foreground">{t.testHint}</p>
        {test && (
          <div
            role="status"
            className={cn(
              "rounded-2xl p-4 text-sm",
              test.ok ? "bg-tint-3 text-fg" : "bg-destructive/10 text-destructive",
            )}
          >
            {test.ok ? (
              <>
                <p className="mb-1 text-xs font-semibold">{t.testOk(test.ms)}</p>
                <p className="whitespace-pre-line">{test.text}</p>
              </>
            ) : (
              <p>
                {t.errors[test.error] ?? t.errors.generic}
                {test.detail && <span className="block text-xs opacity-80">{test.detail}</span>}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
