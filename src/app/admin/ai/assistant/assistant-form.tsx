"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";
import type { AiProviderId } from "@/server/ai/providers";
import type { HelpSettings } from "@/server/help/settings";
import { Field, Status, Toggle, inputClass, type Msg } from "../../products/ui";
import { saveHelpSettingsAction } from "../actions";

const t = mn.admin.ai.assistant;
const providers = mn.admin.ai.providers;
const PROVIDERS: AiProviderId[] = ["gemini", "openai"];

const textareaClass =
  "field-sizing-content min-h-24 w-full rounded-2xl bg-subtle p-4 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring";

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

type NumberKey = "dailyLimit" | "maxAnswerTokens" | "historyTurns" | "contextBudget";

/** The help assistant: on/off, which AI, what it says, and how much it may spend. */
export function AssistantForm({
  initial,
  translationProvider,
  models,
  knowledgeTokens,
}: {
  initial: HelpSettings;
  translationProvider: AiProviderId;
  models: Record<AiProviderId, string>;
  knowledgeTokens: number;
}) {
  const [s, setS] = useState(initial);
  const [nums, setNums] = useState<Record<NumberKey, string>>({
    dailyLimit: String(initial.dailyLimit),
    maxAnswerTokens: String(initial.maxAnswerTokens),
    historyTurns: String(initial.historyTurns),
    contextBudget: String(initial.contextBudget),
  });
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const effectiveProvider = s.provider || translationProvider;

  const save = () =>
    start(async () => {
      setMsg(null);
      const res = await saveHelpSettingsAction({
        ...s,
        ...Object.fromEntries(Object.entries(nums).map(([k, v]) => [k, Number(v)])),
      });
      setMsg(
        res.ok
          ? { ok: true, text: mn.admin.ai.saved }
          : { ok: false, text: mn.admin.ai.errors[res.error] ?? mn.admin.ai.errors.generic },
      );
    });

  const num = (key: NumberKey, label: string, hint: string) => (
    <Field label={label} hint={hint}>
      <input
        className={inputClass}
        inputMode="numeric"
        value={nums[key]}
        onChange={(e) => setNums({ ...nums, [key]: digits(e.target.value) })}
      />
    </Field>
  );

  return (
    <div className="grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Toggle label={t.enabled} on={s.enabled} onChange={(v) => setS({ ...s, enabled: v })} />
          <Link
            href="/help"
            target="_blank"
            className="flex h-10 items-center gap-1.5 text-sm font-semibold text-highlight"
          >
            {t.tryIt} <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </div>
        <div role="radiogroup" aria-label={t.provider} className="grid gap-3 sm:grid-cols-3">
          {(["", ...PROVIDERS] as const).map((p) => (
            <button
              key={p || "same"}
              type="button"
              role="radio"
              aria-checked={s.provider === p}
              onClick={() => setS({ ...s, provider: p })}
              className={cn(
                "flex min-h-14 flex-col items-start justify-center rounded-2xl px-4 py-2 text-left text-sm",
                s.provider === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-subtle hover:ring-2 hover:ring-border",
              )}
            >
              <span className="font-semibold">
                {p ? providers[p].name : t.sameAsTranslation(providers[translationProvider].name)}
              </span>
            </button>
          ))}
        </div>
        <Field label={t.model} hint={t.modelHint(models[effectiveProvider])}>
          <input
            className={inputClass}
            spellCheck={false}
            placeholder={models[effectiveProvider]}
            value={s.model}
            onChange={(e) => setS({ ...s, model: e.target.value })}
          />
        </Field>
      </section>

      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
        <Field label={t.greeting} hint={t.greetingHint}>
          <textarea
            className={textareaClass}
            maxLength={300}
            value={s.greeting}
            onChange={(e) => setS({ ...s, greeting: e.target.value })}
          />
        </Field>
        <Field label={t.supportContact} hint={t.supportContactHint}>
          <input
            className={inputClass}
            maxLength={300}
            value={s.supportContact}
            onChange={(e) => setS({ ...s, supportContact: e.target.value })}
          />
        </Field>
      </section>

      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
        <Field label={t.instructions} hint={t.instructionsHint}>
          <textarea
            className={cn(textareaClass, "min-h-40")}
            maxLength={4000}
            value={s.instructions}
            onChange={(e) => setS({ ...s, instructions: e.target.value })}
          />
        </Field>
      </section>

      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 lg:col-span-2">
        <h2 className="font-semibold">{t.costTitle}</h2>
        <Toggle
          label={t.faqShortcut}
          on={s.faqShortcut}
          onChange={(v) => setS({ ...s, faqShortcut: v })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {num("dailyLimit", t.dailyLimit, t.dailyLimitHint)}
          {num("maxAnswerTokens", t.maxAnswerTokens, t.maxAnswerTokensHint)}
          {num("historyTurns", t.historyTurns, t.historyTurnsHint)}
          {num("contextBudget", t.contextBudget, t.contextBudgetHint(knowledgeTokens))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
        <Button size="lg" className="rounded-full sm:min-w-44" disabled={pending} onClick={save}>
          {pending ? mn.admin.ai.saving : mn.admin.ai.save}
        </Button>
        <Status msg={msg} />
      </div>
    </div>
  );
}
