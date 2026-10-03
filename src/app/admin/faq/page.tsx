import type { Metadata } from "next";

import { mn } from "@/i18n/mn";
import { requireAdmin } from "@/server/admin/guard";
import { db } from "@/server/db";
import { chatQuestion } from "@/server/help/admin";
import { listFaqs } from "@/server/help/faq";
import { FaqCard, NewFaq } from "./faq-editor";

export const metadata: Metadata = { title: mn.admin.nav.faq };

const t = mn.admin.faq;

/** Owner/Editor: the FAQ on the user's help screen, which the AI assistant also knows. */
export default async function FaqPage({ searchParams }: PageProps<"/admin/faq">) {
  await requireAdmin();
  const faqs = await listFaqs(db);
  // "FAQ болгох" from the assistant's history: the logged question starts a new FAQ.
  const { from } = await searchParams;
  const question = await chatQuestion(db, from);

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div>
        <h1 className="text-4xl leading-none font-semibold">{t.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t.intro}</p>
      </div>
      <NewFaq key={question} initialQuestion={question.slice(0, 200)} />
      {faqs.length === 0 ? (
        <p className="rounded-3xl bg-surface p-5 text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {faqs.map((f, i) => (
            <li key={f.id}>
              <FaqCard faq={f} index={i} last={i === faqs.length - 1} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
