"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import type { FaqEntry } from "@/server/help/faq";
import { Field, Status, Toggle, inputClass, type Msg } from "../products/ui";
import {
  createFaqAction,
  deleteFaqAction,
  moveFaqAction,
  updateFaqAction,
  type FaqResult,
} from "./actions";

const t = mn.admin.faq;
const LIMITS = { question: 200, answer: 2000 };

const msgOf = (res: FaqResult, okText: string): Msg =>
  res.ok
    ? { ok: true, text: okText }
    : { ok: false, text: t.errors[res.error] ?? t.errors.generic };

type Draft = { question: string; answer: string; isPublished: boolean };

function Inputs({ draft, set }: { draft: Draft; set: (d: Draft) => void }) {
  return (
    <>
      <Field label={t.question}>
        <input
          className={inputClass}
          maxLength={LIMITS.question}
          value={draft.question}
          onChange={(e) => set({ ...draft, question: e.target.value })}
        />
      </Field>
      <Field label={t.answer} hint={`${draft.answer.length}/${LIMITS.answer}`}>
        <textarea
          rows={4}
          maxLength={LIMITS.answer}
          value={draft.answer}
          onChange={(e) => set({ ...draft, answer: e.target.value })}
          className="field-sizing-content min-h-24 w-full rounded-2xl bg-subtle p-4 text-base leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </Field>
      <Toggle
        label={draft.isPublished ? t.published : t.hidden}
        on={draft.isPublished}
        onChange={(v) => set({ ...draft, isPublished: v })}
      />
    </>
  );
}

export function NewFaq({ initialQuestion }: { initialQuestion: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!initialQuestion);
  const [draft, setDraft] = useState<Draft>({
    question: initialQuestion,
    answer: "",
    isPublished: true,
  });
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  if (!open)
    return (
      <Button size="lg" className="self-start rounded-full" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> {t.add}
      </Button>
    );

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
      <h2 className="font-semibold">{t.add}</h2>
      <Inputs draft={draft} set={setDraft} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          className="rounded-full"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await createFaqAction(draft);
              setMsg(msgOf(res, t.saved));
              if (res.ok) {
                setDraft({ question: "", answer: "", isPublished: true });
                setOpen(false);
                router.replace("/admin/faq");
                router.refresh();
              }
            })
          }
        >
          {t.save}
        </Button>
        <Button size="lg" variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
          {mn.common.cancel}
        </Button>
        <Status msg={msg} />
      </div>
    </section>
  );
}

export function FaqCard({ faq, index, last }: { faq: FaqEntry; index: number; last: boolean }) {
  const router = useRouter();
  const initial: Draft = {
    question: faq.question,
    answer: faq.answer,
    isPublished: faq.isPublished,
  };
  const [draft, setDraft] = useState<Draft>(initial);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const dirty =
    draft.question !== faq.question ||
    draft.answer !== faq.answer ||
    draft.isPublished !== faq.isPublished;

  const run = (fn: () => Promise<FaqResult>, okText: string) =>
    start(async () => {
      const res = await fn();
      setMsg(msgOf(res, okText));
      if (res.ok) router.refresh();
    });

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-tint-1 text-sm font-semibold text-highlight tabular-nums">
          {index + 1}
        </span>
        <div className="flex gap-1">
          <IconButton
            label={t.up}
            disabled={pending || index === 0}
            onClick={() => run(() => moveFaqAction(faq.id, "up"), "")}
          >
            <ArrowUp className="size-4" aria-hidden />
          </IconButton>
          <IconButton
            label={t.down}
            disabled={pending || last}
            onClick={() => run(() => moveFaqAction(faq.id, "down"), "")}
          >
            <ArrowDown className="size-4" aria-hidden />
          </IconButton>
          <IconButton
            label={t.delete}
            disabled={pending}
            onClick={() => confirm(t.deleteConfirm) && run(() => deleteFaqAction(faq.id), "")}
          >
            <Trash2 className="size-4" aria-hidden />
          </IconButton>
        </div>
      </div>
      <Inputs draft={draft} set={setDraft} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          className="rounded-full"
          disabled={pending || !dirty}
          onClick={() => run(() => updateFaqAction({ id: faq.id, ...draft }), t.saved)}
        >
          {t.save}
        </Button>
        <Status msg={msg?.text ? msg : null} />
      </div>
    </section>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full bg-subtle disabled:opacity-40"
    >
      {children}
    </button>
  );
}
