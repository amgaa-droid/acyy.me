"use client";

import { Lock, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BottomSheet } from "@/components/app/bottom-sheet";
import {
  AvatarPicker,
  GenderPicker,
  RelationPicker,
  type AvatarOption,
} from "@/components/people/pickers";
import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import type { Gender, Relation } from "@/lib/domain";
import { deletePersonAction, updatePersonAction } from "../actions";

const t = mn.people;

type EditablePerson = {
  id: string;
  isSelf: boolean;
  name: string;
  gender: Gender;
  avatarSeed: string;
  relation: Relation;
  relationLabel: string | null;
};

/** Edit sheet: name, relation (not for "Би"), gender, avatar. The birth date is not editable. */
export function EditPersonButton({
  person,
  avatars,
}: {
  person: EditablePerson;
  avatars: AvatarOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(person.name);
  const [relation, setRelation] = useState(person.relation);
  const [relationLabel, setRelationLabel] = useState(person.relationLabel ?? "");
  const [gender, setGender] = useState(person.gender);
  const [avatarSeed, setAvatarSeed] = useState(person.avatarSeed);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await updatePersonAction(person.id, {
        name,
        gender,
        avatarSeed,
        ...(!person.isSelf && {
          relation,
          relationLabel: relation === "other" ? relationLabel : null,
        }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else setError(t.errors[res.error]);
    });

  return (
    <BottomSheet
      open={open}
      onOpenChange={setOpen}
      title={t.editTitle}
      trigger={
        <Button variant="outline" size="lg" className="flex-1 rounded-full sm:flex-none">
          <Pencil aria-hidden /> {t.edit}
        </Button>
      }
      footer={
        <Button
          size="lg"
          className="rounded-full"
          disabled={pending || !name.trim()}
          onClick={save}
        >
          {t.save}
        </Button>
      }
    >
      <div className="flex max-h-[60dvh] flex-col gap-5 overflow-y-auto lg:max-h-[65dvh]">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t.name}
          <input
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-12 rounded-2xl bg-subtle px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        {!person.isSelf && relation !== "self" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t.relationTitle}</span>
            <RelationPicker
              value={relation}
              label={relationLabel}
              onChange={setRelation}
              onLabelChange={setRelationLabel}
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t.gender}</span>
          <GenderPicker value={gender} onChange={setGender} compact />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t.avatarTitle}</span>
          <AvatarPicker
            avatars={avatars}
            value={avatarSeed}
            onChange={setAvatarSeed}
            label={t.avatarTitle}
          />
        </div>
        <p className="flex items-start gap-2.5 rounded-2xl bg-subtle px-4 py-3 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t.birthDateLocked}
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

export function DeletePersonButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <BottomSheet
      title={t.deleteTitle}
      description={`${name} — ${t.deleteBody}`}
      trigger={
        <Button
          variant="ghost"
          size="lg"
          className="flex-1 rounded-full text-destructive sm:flex-none"
        >
          <Trash2 aria-hidden /> {t.delete}
        </Button>
      }
      footer={
        <>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            variant="destructive"
            size="lg"
            className="rounded-full"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await deletePersonAction(id);
                if (res && !res.ok) setError(t.errors.generic);
              })
            }
          >
            {t.deleteConfirm}
          </Button>
        </>
      }
    />
  );
}
