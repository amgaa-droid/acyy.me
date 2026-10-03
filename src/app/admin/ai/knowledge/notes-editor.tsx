"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { estimateTokens } from "@/lib/help-search";
import type { KnowledgeNote } from "@/server/help/notes";
import { Field, Status, Toggle, inputClass, type Msg } from "../../products/ui";
import {
  createNoteAction,
  deleteNoteAction,
  updateNoteAction,
  type HelpAdminResult,
} from "../actions";

const t = mn.admin.ai.knowledge;
const LIMITS = { title: 120, body: 6000 };

const msgOf = (res: HelpAdminResult, okText: string): Msg =>
  res.ok
    ? { ok: true, text: okText }
    : { ok: false, text: mn.admin.ai.errors[res.error] ?? mn.admin.ai.errors.generic };

type Draft = { title: string; body: string; isActive: boolean };

function Inputs({ draft, set }: { draft: Draft; set: (d: Draft) => void }) {
  return (
    <>
      <Field label={t.noteTitle}>
        <input
          className={inputClass}
          maxLength={LIMITS.title}
          placeholder={t.noteTitlePlaceholder}
          value={draft.title}
          onChange={(e) => set({ ...draft, title: e.target.value })}
        />
      </Field>
      <Field
        label={t.noteBody}
        hint={`${draft.body.length}/${LIMITS.body} · ${t.tokens(estimateTokens(draft.body))}`}
      >
        <textarea
          rows={5}
          maxLength={LIMITS.body}
          placeholder={t.noteBodyPlaceholder}
          value={draft.body}
          onChange={(e) => set({ ...draft, body: e.target.value })}
          className="field-sizing-content min-h-28 w-full rounded-2xl bg-subtle p-4 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </Field>
      <Toggle
        label={draft.isActive ? t.active : t.inactive}
        on={draft.isActive}
        onChange={(v) => set({ ...draft, isActive: v })}
      />
    </>
  );
}

/** A new note; "Сургах текст болгох" from the history prefills the title with the question. */
export function NewNote({ initialTitle }: { initialTitle: string }) {
  const router = useRouter();
  const q = initialTitle.slice(0, LIMITS.title);
  const [open, setOpen] = useState(!!q);
  const [draft, setDraft] = useState<Draft>({ title: q, body: "", isActive: true });
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
      <Inputs draft={draft} set={setDraft} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          className="rounded-full"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await createNoteAction(draft);
              setMsg(msgOf(res, t.saved));
              if (res.ok) {
                setDraft({ title: "", body: "", isActive: true });
                setOpen(false);
                router.replace("/admin/ai/knowledge");
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

export function NoteCard({ note }: { note: KnowledgeNote }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({
    title: note.title,
    body: note.body,
    isActive: note.isActive,
  });
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const dirty =
    draft.title !== note.title || draft.body !== note.body || draft.isActive !== note.isActive;

  const run = (fn: () => Promise<HelpAdminResult>, okText: string) =>
    start(async () => {
      const res = await fn();
      setMsg(msgOf(res, okText));
      if (res.ok) router.refresh();
    });

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
      <Inputs draft={draft} set={setDraft} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          className="rounded-full"
          disabled={pending || !dirty}
          onClick={() => run(() => updateNoteAction({ id: note.id, ...draft }), t.saved)}
        >
          {t.save}
        </Button>
        <Button
          size="lg"
          variant="ghost"
          className="rounded-full text-destructive"
          disabled={pending}
          onClick={() => confirm(t.deleteConfirm) && run(() => deleteNoteAction(note.id), "")}
        >
          <Trash2 aria-hidden /> {t.delete}
        </Button>
        <Status msg={msg?.text ? msg : null} />
      </div>
    </section>
  );
}
