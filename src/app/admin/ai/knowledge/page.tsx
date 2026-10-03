import { ArrowRight, ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { mn } from "@/i18n/mn";
import { chunkText, estimateTokens, type Chunk } from "@/lib/help-search";
import { requireOwner } from "@/server/admin/guard";
import { db } from "@/server/db";
import { chatQuestion } from "@/server/help/admin";
import { listPublishedFaqs } from "@/server/help/faq";
import { CORE_KNOWLEDGE, liveFacts } from "@/server/help/knowledge";
import { listNotes } from "@/server/help/notes";
import { getHelpSettings } from "@/server/help/settings";
import { AiHeader } from "../ai-tabs";
import { NewNote, NoteCard } from "./notes-editor";

export const metadata: Metadata = { title: mn.admin.ai.tabs.knowledge };

const t = mn.admin.ai.knowledge;
const size = (c: Chunk) => estimateTokens(chunkText(c));

/** Owner only: what the help assistant knows, and the notes that teach it more (SPEC §3.3). */
export default async function KnowledgePage({ searchParams }: PageProps<"/admin/ai/knowledge">) {
  await requireOwner();
  const { from } = await searchParams;
  const [notes, facts, faqs, settings, question] = await Promise.all([
    listNotes(db),
    liveFacts(db),
    listPublishedFaqs(db),
    getHelpSettings(db),
    chatQuestion(db, from),
  ]);
  const noteTokens = notes
    .filter((n) => n.isActive)
    .reduce((s, n) => s + size({ id: n.id, title: n.title, body: n.body }), 0);
  const faqTokens = faqs.reduce(
    (s, f) => s + size({ id: f.id, title: f.question, body: f.answer }),
    0,
  );
  const total =
    CORE_KNOWLEDGE.reduce((s, c) => s + size(c), 0) + size(facts) + faqTokens + noteTokens;

  return (
    <div className="flex flex-col gap-5">
      <AiHeader intro={t.intro} />
      <p
        className={
          total > settings.contextBudget
            ? "max-w-3xl rounded-3xl bg-tint-2 p-4 text-sm font-semibold"
            : "text-sm font-semibold text-muted-foreground"
        }
      >
        {t.size(total, settings.contextBudget)}
        {total > settings.contextBudget && (
          <span className="block font-normal">{t.overBudget}</span>
        )}
      </p>

      <section className="flex max-w-4xl flex-col gap-3">
        <h2 className="text-2xl font-semibold">{t.notesTitle}</h2>
        <NewNote key={question} initialTitle={question} />
        {notes.length === 0 ? (
          <p className="rounded-3xl bg-surface p-5 text-sm text-muted-foreground">{t.notesEmpty}</p>
        ) : (
          notes.map((n) => <NoteCard key={n.id} note={n} />)
        )}
      </section>

      <section className="flex max-w-4xl flex-col gap-3">
        <h2 className="text-2xl font-semibold">{t.coreTitle}</h2>
        <p className="text-sm text-muted-foreground">{t.coreHint}</p>
        <ul className="flex flex-col gap-2">
          {[...CORE_KNOWLEDGE, facts].map((c) => (
            <li key={c.id}>
              <details className="group rounded-3xl bg-surface">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="flex-1 font-semibold">
                    {c.id === "facts" ? t.factsTitle : c.title}
                  </span>
                  {c.pinned && (
                    <span className="rounded-full bg-tint-1 px-2.5 py-0.5 text-xs font-semibold text-highlight">
                      {t.pinned}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t.tokens(size(c))}
                  </span>
                  <ChevronDown
                    className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed whitespace-pre-line">{c.body}</p>
              </details>
            </li>
          ))}
        </ul>
        <Link
          href="/admin/faq"
          className="flex min-h-12 items-center justify-between gap-3 rounded-3xl bg-surface px-5 py-3 font-semibold"
        >
          <span>{t.faqTitle(faqs.length)}</span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
            {t.tokens(faqTokens)} <ArrowRight className="size-4" aria-hidden />
          </span>
        </Link>
      </section>
    </div>
  );
}
