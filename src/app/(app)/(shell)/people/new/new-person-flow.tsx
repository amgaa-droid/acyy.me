"use client";

import { ChevronLeft, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { DatePicker } from "@/components/app/date-picker";
import { useCloseAllModals } from "@/components/app/modal-scope";
import { BirthDateConfirm } from "@/components/people/birth-date-confirm";
import {
  AvatarPicker,
  GenderPicker,
  RelationPicker,
  type AvatarOption,
} from "@/components/people/pickers";
import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import type { Gender, Relation } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { createPersonAction } from "../actions";

const t = mn.people;
type OtherRelation = Exclude<Relation, "self">;

/** One of the list, by chance. Only ever called from an event handler (a tap), never in render. */
const anyOf = <T,>(list: readonly T[]): T | undefined => list[Math.floor(Math.random() * list.length)];

/** /people/new: relation → avatar → name, birth date, gender (SPEC §6.1). */
export function NewPersonFlow({
  avatars,
  returnTo,
  initialRelation = null,
  returnHome = false,
}: {
  avatars: AvatarOption[];
  returnTo?: { next: string; slot: "a" | "b" } | null;
  /** Pre-picked relation (from the home guide's ghost planets). */
  initialRelation?: OtherRelation | null;
  /** Go back to home after saving, to see the new planet arrive. */
  returnHome?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [relation, setRelation] = useState<OtherRelation | null>(initialRelation);
  const [relationLabel, setRelationLabel] = useState("");
  const [avatarSeed, setAvatarSeed] = useState("");
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("1990-01-01");
  const [gender, setGender] = useState<Gender>("unspecified");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // One tap saves once: a quick double tap fires before the button re-renders as disabled, and
  // after saving it stays locked while the navigation that follows takes its moment.
  const saving = useRef(false);
  const [saved, setSaved] = useState(false);
  // The birth date can't be changed later and the wheel moves easily (a scroll over it turns
  // it), so it is read back, spelled out, before anything is saved.
  const [confirming, setConfirming] = useState(false);
  const closeAll = useCloseAllModals();

  /** On to the avatars, with one already picked (a different one each time) so the step can be passed. */
  const toAvatars = () => {
    if (!avatarSeed) setAvatarSeed(anyOf(avatars)?.seed ?? "");
    setStep(1);
  };

  const labelOk = relation !== "other" || relationLabel.trim().length >= 1;
  const nameOk = name.trim().length >= 1 && name.trim().length <= 40;

  const save = () => {
    if (saving.current) return;
    saving.current = true;
    startTransition(async () => {
      setError(null);
      const res = await createPersonAction({
        relation,
        relationLabel: relation === "other" ? relationLabel : null,
        avatarSeed,
        name,
        birthDate,
        gender,
      });
      if (res.ok) {
        setSaved(true);
        if (returnTo) {
          const url = new URL(returnTo.next, window.location.origin);
          url.searchParams.set(returnTo.slot, res.id);
          router.push(`${url.pathname}${url.search}`);
        } else if (returnHome) {
          // In the home popup: close it (back to /home) — pushing /home would keep the popup open.
          if (closeAll) closeAll();
          else router.push("/home", { scroll: false });
        } else router.push(`/people/${res.id}`);
        return;
      }
      saving.current = false;
      setConfirming(false);
      setError(t.errors[res.error]);
      if (res.error === "relationLabel") setStep(0);
    });
  };

  const primary = [
    { label: mn.common.next, disabled: !relation || !labelOk, onClick: toAvatars },
    { label: mn.common.next, disabled: !avatarSeed, onClick: () => setStep(2) },
    {
      label: t.save,
      disabled: !nameOk || pending || saved,
      onClick: () => {
        setError(null);
        setConfirming(true);
      },
    },
  ][step];

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-12rem)] max-w-xl flex-col lg:min-h-0">
      <div className="flex h-11 items-center gap-3">
        {step === 0 ? (
          <Link
            href="/people"
            aria-label={mn.common.back}
            className="flex size-11 items-center justify-center rounded-full bg-surface"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
        ) : (
          <button
            type="button"
            aria-label={mn.common.back}
            onClick={() => setStep(step - 1)}
            className="flex size-11 items-center justify-center rounded-full bg-surface"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
        )}
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

      <div className="flex flex-1 flex-col pt-6">
        {step === 0 && (
          <Section title={t.relationTitle}>
            <RelationPicker
              value={relation}
              label={relationLabel}
              // A tap is the answer: move on. "Бусад" stays, it needs its own name typed.
              onChange={(r) => {
                setRelation(r);
                if (r !== "other") toAvatars();
              }}
              onLabelChange={setRelationLabel}
            />
          </Section>
        )}

        {step === 1 && (
          <Section title={t.avatarTitle}>
            <AvatarPicker
              avatars={avatars}
              value={avatarSeed}
              onChange={setAvatarSeed}
              label={t.avatarTitle}
            />
          </Section>
        )}

        {step === 2 && (
          <Section title={t.infoTitle}>
            <div className="flex flex-col gap-5">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                {t.name}
                <input
                  autoFocus
                  maxLength={40}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-13 rounded-2xl bg-surface px-4 text-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t.birthDate}</span>
                <div className="rounded-3xl bg-surface p-3">
                  <DatePicker value={birthDate} onChange={setBirthDate} />
                </div>
                <p className="mt-1 flex items-start gap-2.5 rounded-2xl bg-tint-2 px-4 py-3 text-sm">
                  <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {mn.onboarding.birthWarning}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t.gender}</span>
                <GenderPicker value={gender} onChange={setGender} compact />
              </div>
            </div>
          </Section>
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
        busy={pending || saved}
        onConfirm={save}
        onFix={() => setConfirming(false)}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 pb-6">
      <h1 className="text-[34px] leading-none font-semibold lg:text-[44px]">{title}</h1>
      {children}
    </section>
  );
}
