"use client";

import { mn } from "@/i18n/mn";
import { GENDERS, RELATIONS, type Gender, type Relation } from "@/lib/domain";
import { cn } from "@/lib/utils";

export type AvatarOption = { seed: string; uri: string };

/** 30 avatars in a 5-column grid (SPEC §2.3). Images are pre-rendered on the server. */
export function AvatarPicker({
  avatars,
  value,
  onChange,
  label,
}: {
  avatars: AvatarOption[];
  value: string;
  onChange: (seed: string) => void;
  label: string;
}) {
  return (
    <div className="grid grid-cols-5 gap-2.5 sm:grid-cols-6" role="radiogroup" aria-label={label}>
      {avatars.map((a) => (
        <button
          key={a.seed}
          type="button"
          role="radio"
          aria-checked={value === a.seed}
          aria-label={a.seed}
          onClick={() => onChange(a.seed)}
          className={cn(
            "aspect-square overflow-hidden rounded-full bg-surface ring-offset-2 ring-offset-bg transition-shadow",
            value === a.seed ? "ring-2 ring-highlight" : "ring-1 ring-border hover:ring-2",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URI */}
          <img src={a.uri} alt="" className="size-full dark:invert" />
        </button>
      ))}
    </div>
  );
}

const PICKABLE_RELATIONS = RELATIONS.filter((r) => r !== "self") as Exclude<Relation, "self">[];

/** Relation chips; "Бусад" reveals a free-text label (≤ 20). */
export function RelationPicker({
  value,
  label,
  onChange,
  onLabelChange,
}: {
  value: Exclude<Relation, "self"> | null;
  label: string;
  onChange: (r: Exclude<Relation, "self">) => void;
  onLabelChange: (label: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className="grid grid-cols-3 gap-2"
        role="radiogroup"
        aria-label={mn.people.relationTitle}
      >
        {PICKABLE_RELATIONS.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={value === r}
            onClick={() => onChange(r)}
            className={cn(
              "h-12 rounded-2xl bg-surface px-2 text-sm font-semibold transition-shadow",
              value === r ? "ring-2 ring-highlight" : "ring-1 ring-border hover:ring-2",
            )}
          >
            {mn.relations[r]}
          </button>
        ))}
      </div>
      {value === "other" && (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {mn.people.relationLabel}
          <input
            autoFocus
            maxLength={20}
            value={label}
            placeholder={mn.people.relationLabelPlaceholder}
            onChange={(e) => onLabelChange(e.target.value)}
            className="h-12 rounded-2xl bg-surface px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      )}
    </div>
  );
}

const GENDER_ORDER: Gender[] = ["female", "male", "unspecified"];

export function GenderPicker({
  value,
  onChange,
  compact = false,
}: {
  value: Gender;
  onChange: (g: Gender) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(compact ? "grid grid-cols-3 gap-2" : "flex flex-col gap-2")}
      role="radiogroup"
      aria-label={mn.onboarding.genderTitle}
    >
      {GENDER_ORDER.filter((g) => GENDERS.includes(g)).map((g) => (
        <button
          key={g}
          type="button"
          role="radio"
          aria-checked={value === g}
          onClick={() => onChange(g)}
          className={cn(
            "rounded-2xl bg-surface font-medium transition-shadow",
            compact ? "h-12 text-sm" : "h-14 px-5 text-left text-lg",
            value === g ? "ring-2 ring-highlight" : "ring-1 ring-border hover:ring-2",
          )}
        >
          {mn.onboarding.genders[g]}
        </button>
      ))}
    </div>
  );
}
