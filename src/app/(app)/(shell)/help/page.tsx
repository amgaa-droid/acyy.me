import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";

import { PageTitle } from "@/components/app/empty-state";
import { env } from "@/env";
import { mn } from "@/i18n/mn";
import { loadAiRuntime } from "@/server/ai/settings";
import { requireOnboardedUser } from "@/server/auth/current";
import { db } from "@/server/db";
import { recentConversation } from "@/server/help/chat";
import { listPublishedFaqs } from "@/server/help/faq";
import { getHelpSettings } from "@/server/help/settings";
import { HelpChat } from "./help-chat";

export const metadata: Metadata = { title: mn.help.title };

const t = mn.help;

/**
 * Help (SPEC §3.3): the FAQ first, then "Асуух зүйл байвал" — the AI assistant. Desktop: the
 * FAQ and the chat side by side.
 */
export default async function HelpPage() {
  const { user } = await requireOnboardedUser();
  const [faqs, settings, recent] = await Promise.all([
    listPublishedFaqs(db),
    getHelpSettings(db),
    recentConversation(db, user.id),
  ]);
  // The chat is offered only when it can answer: switched on and a key to call the AI with.
  const ready =
    settings.enabled &&
    (await loadAiRuntime(db, env().SETTINGS_ENCRYPTION_KEY, {
      provider: settings.provider || undefined,
    }).then(
      () => true,
      () => false,
    ));

  return (
    <>
      <PageTitle>{t.title}</PageTitle>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="faq-title" className="flex flex-col gap-3">
          <h2 id="faq-title" className="text-2xl font-semibold">
            {t.faqTitle}
          </h2>
          {faqs.length === 0 ? (
            <p className="rounded-3xl bg-surface p-5 text-muted-foreground">{t.faqEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {faqs.map((f) => (
                <li key={f.id}>
                  <details className="group rounded-3xl bg-surface open:bg-subtle">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                      <span className="flex-1">{f.question}</span>
                      <ChevronDown
                        className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                        aria-hidden
                      />
                    </summary>
                    <p className="px-5 pb-5 leading-relaxed whitespace-pre-line text-fg/90">
                      {f.answer}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="ask-title" className="flex flex-col gap-3 lg:sticky lg:top-4">
          <div>
            <h2 id="ask-title" className="text-2xl font-semibold">
              {t.askTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.askHint}</p>
          </div>
          {ready ? (
            <HelpChat greeting={settings.greeting} faqs={faqs} initial={recent} />
          ) : (
            <p className="rounded-3xl bg-surface p-5 text-muted-foreground">{t.disabled}</p>
          )}
        </section>
      </div>
    </>
  );
}
