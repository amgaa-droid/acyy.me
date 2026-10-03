import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/app/brand-mark";
import { CurrentThemeToggle } from "@/components/app/current-theme-toggle";
import { APP_NAME } from "@/env";
import { legalLinks, type LegalDoc } from "@/i18n/legal";

/** A public legal page (/terms, /privacy): readable width, a table of contents, anchors. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <div className="relative min-h-dvh bg-bg px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-10 lg:pt-6">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          aria-label={legalLinks.home}
          className="flex size-11 items-center justify-center rounded-full border border-border bg-surface"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <Link href="/" className="flex items-center gap-2 font-heading text-xl font-semibold">
          <BrandMark className="size-6 text-highlight" />
          {APP_NAME}
        </Link>
        <CurrentThemeToggle />
      </div>

      <main className="mx-auto mt-8 flex max-w-[680px] flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-heading text-4xl leading-tight font-semibold">{doc.title}</h1>
          <p className="text-sm text-muted-foreground">
            {legalLinks.updated} <time dateTime={doc.updated}>{doc.updated}</time>
          </p>
          <p className="mt-2 leading-relaxed">{doc.intro}</p>
        </header>

        <nav aria-label={legalLinks.contents} className="rounded-3xl bg-surface p-5">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{legalLinks.contents}</h2>
          <ol className="flex flex-col">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex min-h-11 items-center text-highlight">
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {doc.sections.map((s) => (
          <section key={s.id} id={s.id} className="flex scroll-mt-6 flex-col gap-3">
            <h2 className="text-xl font-semibold">{s.heading}</h2>
            {s.body.map((b, i) =>
              "p" in b ? (
                <p key={i} className="leading-relaxed">
                  {b.p}
                </p>
              ) : (
                <ul key={i} className="flex list-disc flex-col gap-2 pl-5 leading-relaxed">
                  {b.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
