"use client";

import { ArrowRight, ChevronLeft, Lock } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { ConstellationArt } from "@/components/app/constellation";
import { DatePicker } from "@/components/app/date-picker";
import { BirthDateConfirm } from "@/components/people/birth-date-confirm";
import { AvatarPicker, GenderPicker, type AvatarOption } from "@/components/people/pickers";
import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { formatBirthDate } from "@/lib/birth-date";
import type { Gender } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { createSelfAction, promoteSelfAction, type OnboardingResult } from "./actions";

type Done = Extract<OnboardingResult, { ok: true }>;

/** A person migrated from the old acyy.me site that may be the user (src/server/legacy). */
export type SelfCandidate = {
  id: string;
  name: string;
  birthDate: string;
  gender: Gender;
  avatarSeed: string;
};

/** Placeholder names given on migration ("Би", "Хүн · 1990.05.12") — ask for a real one. */
const isPlaceholderName = (name: string) => name === "Би" || name.startsWith("Хүн · ");

const t = mn.onboarding;

export function OnboardingFlow({
  avatars,
  prefill,
  candidates = [],
}: {
  avatars: AvatarOption[];
  prefill?: { name: string; birthDate: string } | null;
  candidates?: SelfCandidate[];
}) {
  // undefined = not asked yet; null = "none of these" → a new "Би" as usual.
  const [picked, setPicked] = useState<string | null | undefined>(
    candidates.length ? undefined : null,
  );
  const [step, setStep] = useState(0);
  const [name, setName] = useState(prefill?.name ?? "");
  const [birthDate, setBirthDate] = useState(prefill?.birthDate ?? "2000-01-01");
  const [gender, setGender] = useState<Gender>("unspecified");
  const [avatarSeed, setAvatarSeed] = useState(avatars[0]?.seed ?? "");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Done | null>(null);
  const [pending, startTransition] = useTransition();
  // "Би" can be neither deleted nor given another birth date, so a new one is read back,
  // spelled out, before it is saved. (A migrated person's date isn't picked here: no question.)
  const [confirming, setConfirming] = useState(false);

  const back = () => {
    setError(null);
    if (step === 0 && candidates.length) setPicked(undefined);
    else setStep((s) => Math.max(0, s - 1));
  };

  const pick = (c: SelfCandidate | null) => {
    setPicked(c?.id ?? null);
    if (c) {
      setName(isPlaceholderName(c.name) ? "" : c.name);
      setBirthDate(c.birthDate);
      setGender(c.gender);
      setAvatarSeed(c.avatarSeed);
    }
    setStep(0);
  };

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const res = picked
        ? await promoteSelfAction({ personId: picked, name, gender, avatarSeed })
        : await createSelfAction({ name, birthDate, gender, avatarSeed });
      if (res.ok) setResult(res);
      else {
        setConfirming(false);
        setError(t.errors[res.error]);
        if (res.error === "name") setStep(0);
        if (res.error === "birthDate") setStep(1);
      }
    });

  if (result) return <ResultStep result={result} name={name.trim()} />;
  if (picked === undefined)
    return <PickSelfStep candidates={candidates} avatars={avatars} onPick={pick} />;

  const nameValid = name.trim().length >= 1 && name.trim().length <= 40;
  const primary = [
    { label: mn.common.next, disabled: !nameValid, onClick: () => setStep(1) },
    { label: mn.common.next, disabled: false, onClick: () => setStep(2) },
    { label: mn.common.next, disabled: false, onClick: () => setStep(3) },
    {
      label: t.finish,
      disabled: !avatarSeed || pending,
      onClick: picked ? submit : () => setConfirming(true),
    },
  ][step];

  return (
    <div className="flex flex-1 flex-col px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] lg:p-8">
      <div className="flex h-11 items-center gap-3">
        <button
          type="button"
          aria-label={mn.common.back}
          onClick={back}
          disabled={step === 0 && !candidates.length}
          className="flex size-11 items-center justify-center rounded-full bg-surface disabled:opacity-0 lg:bg-subtle"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <ol className="flex flex-1 gap-1.5" aria-label={`${step + 1} / ${t.steps.length}`}>
          {t.steps.map((label, i) => (
            <li
              key={label}
              className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-highlight" : "bg-border")}
            >
              <span className="sr-only">{label}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-1 flex-col pt-8">
        {step === 0 && (
          <Step title={t.nameTitle} hint={t.nameHint}>
            <input
              autoFocus
              aria-label={t.namePlaceholder}
              placeholder={t.namePlaceholder}
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && nameValid && setStep(1)}
              className="h-14 w-full rounded-2xl bg-surface px-5 text-xl outline-none focus-visible:ring-2 focus-visible:ring-ring lg:bg-subtle"
            />
          </Step>
        )}

        {step === 1 && (
          <Step title={t.birthTitle}>
            {picked ? (
              <>
                <p className="rounded-3xl bg-surface px-5 py-4 font-heading text-4xl font-semibold tabular-nums lg:bg-subtle">
                  {formatBirthDate(birthDate)}
                </p>
                <p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-tint-2 px-4 py-3 text-sm">
                  <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {t.legacy.birthLocked}
                </p>
              </>
            ) : (
              <>
                {prefill && (
                  <p className="mb-3 rounded-2xl bg-tint-1 px-4 py-3 text-sm" role="note">
                    {mn.invite.prefillNote}
                  </p>
                )}
                <div className="rounded-3xl bg-surface p-3 lg:bg-subtle">
                  <DatePicker value={birthDate} onChange={setBirthDate} />
                </div>
                <p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-tint-2 px-4 py-3 text-sm">
                  <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {t.birthWarning}
                </p>
              </>
            )}
          </Step>
        )}

        {step === 2 && (
          <Step title={t.genderTitle} hint={t.genderHint}>
            <GenderPicker value={gender} onChange={setGender} />
            <button
              type="button"
              className="mt-2 h-11 self-start text-sm font-semibold text-muted-foreground"
              onClick={() => {
                setGender("unspecified");
                setStep(3);
              }}
            >
              {t.skip}
            </button>
          </Step>
        )}

        {step === 3 && (
          <Step title={t.avatarTitle}>
            <AvatarPicker
              avatars={avatars}
              value={avatarSeed}
              onChange={setAvatarSeed}
              label={t.avatarTitle}
            />
          </Step>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <Button
          size="lg"
          className="mt-auto rounded-full lg:mt-8"
          disabled={primary.disabled}
          onClick={primary.onClick}
        >
          {primary.label}
        </Button>
      </div>

      <BirthDateConfirm
        open={confirming}
        onOpenChange={setConfirming}
        name={name}
        birthDate={birthDate}
        busy={pending}
        onConfirm={submit}
        onFix={() => {
          setConfirming(false);
          setStep(1);
        }}
      />
    </div>
  );
}

function PickSelfStep({
  candidates,
  avatars,
  onPick,
}: {
  candidates: SelfCandidate[];
  avatars: AvatarOption[];
  onPick: (c: SelfCandidate | null) => void;
}) {
  const uri = (seed: string) => avatars.find((a) => a.seed === seed)?.uri;
  return (
    <div className="flex flex-1 flex-col px-5 pt-15 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] lg:p-8">
      <Step title={t.legacy.title} hint={t.legacy.hint}>
        <ul className="flex flex-col gap-2">
          {candidates.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(c)}
                className="flex min-h-16 w-full items-center gap-3 rounded-3xl bg-surface px-4 py-2.5 text-left lg:bg-subtle"
              >
                {uri(c.avatarSeed) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={uri(c.avatarSeed)} alt="" className="size-11 rounded-full bg-bg" />
                ) : (
                  <span className="size-11 rounded-full bg-bg" aria-hidden />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{c.name}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatBirthDate(c.birthDate)}
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => onPick(null)}
          className="mt-3 h-12 self-start rounded-full px-4 text-sm font-semibold ring-1 ring-border"
        >
          {t.legacy.none}
        </button>
      </Step>
    </div>
  );
}

function Step({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col">
      <h1 className="text-[40px] leading-none font-semibold">{title}</h1>
      {hint && <p className="mt-2 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-6 flex flex-col">{children}</div>
    </section>
  );
}

function ResultStep({ result, name }: { result: Done; name: string }) {
  const { sign, period } = result;
  return (
    <div className="flex flex-1 flex-col gap-5 px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] lg:p-8">
      <section className="relative flex h-96 flex-col justify-end overflow-hidden rounded-3xl bg-tint-1 p-6">
        <ConstellationArt sign={sign.code} className="absolute -top-4 -right-12 size-80" />
        <span className="relative text-xs font-semibold tracking-widest text-highlight uppercase">
          {name} · {t.resultLabel}
        </span>
        <span className="relative font-heading text-7xl leading-[0.95] font-semibold">
          {sign.nameMn}
        </span>
        <span className="relative mt-2 text-sm text-muted-foreground">
          {sign.startMd} – {sign.endMd} · {period.no}-р {t.periodLabel}
        </span>
      </section>
      {/* No "add someone?" here: the home guide walks them through it, one step at a time. */}
      <div className="flex flex-col gap-1.5 px-1">
        <h2 className="text-[30px] leading-[1.05] font-semibold">{t.readyTitle}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t.readyHint}</p>
      </div>
      <Button
        size="lg"
        className="mt-auto h-14 gap-2.5 rounded-full text-base"
        render={<Link href="/home" />}
        nativeButton={false}
      >
        {t.enter}
        <ArrowRight className="size-4.5" aria-hidden />
      </Button>
    </div>
  );
}
