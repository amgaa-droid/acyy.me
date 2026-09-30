import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConstellationArt } from "@/components/app/constellation";
import { ReadingBody, Teaser } from "@/components/readings/reading-body";
import { PairPerson, ReadingHighlights } from "@/components/readings/reading-highlights";
import { ScoreRing } from "@/components/readings/score-ring";
import { ShareCardButton } from "@/components/readings/share-card-button";
import { UnlinkButton } from "@/components/app/unlink-button";
import { mn } from "@/i18n/mn";
import { type Highlights, extractHighlights, hasHighlights, parseTraits } from "@/lib/body";
import { relationText, relationTint } from "@/lib/people";
import { loadAstroRefs } from "@/server/astro/refs";
import { requireOnboardedUser } from "@/server/auth/current";
import { db } from "@/server/db";
import { ReadingNotFoundError, getReading, readingPeople } from "@/server/reading";

export const metadata: Metadata = { title: mn.readings.title };

const dateFmt = new Intl.DateTimeFormat("mn-MN", {
  timeZone: "Asia/Ulaanbaatar",
  dateStyle: "medium",
});

/** The reading (SPEC §6.1 /r/[purchaseId]). Full text only reaches this page via getReading(). */
export default async function ReadingPage({ params }: PageProps<"/r/[purchaseId]">) {
  const { purchaseId } = await params;
  const { user } = await requireOnboardedUser();
  const reading = await getReading(db, user.id, purchaseId).catch((err) => {
    if (err instanceof ReadingNotFoundError) notFound();
    throw err;
  });
  const refs = await loadAstroRefs(db);
  const signName = (code: string) => refs.signs.find((s) => s.code === code)?.nameMn ?? code;
  const people = reading.snapshot.persons;
  const pair = people.length === 2;
  const t = mn.reading;
  const live = pair ? await readingPeople(db, user.id, reading.personIds) : [];

  const personProps = (i: number) => ({
    name: people[i].name,
    relation: live[i] ? relationText(live[i]) : null,
    birthDate: people[i].birthDate,
    avatarSeed: live[i]?.avatarSeed ?? people[i].name,
    tint: live[i] ? relationTint(live[i].relation) : "bg-subtle",
  });

  // Pair texts carry "Тохиромжтой харилцаа" etc. as sub-sections: lift them into cards up top.
  const highlights: Highlights = { goodFor: [], cautionFor: [], strengths: [], weaknesses: [] };
  const sections = reading.sections.map((s) => {
    if (!pair || s.body === null) return s;
    const { highlights: h, rest } = extractHighlights(s.body);
    for (const k of Object.keys(highlights) as (keyof Highlights)[]) {
      for (const item of h[k]) if (!highlights[k].includes(item)) highlights[k].push(item);
    }
    return { ...s, body: rest };
  });
  // Birthday teasers are "Давуу тал: a · b\nСул тал: …": show them as trait tiles, not a text box.
  const traitSections = new Set<string>();
  if (!pair) {
    for (const s of sections) {
      const traits = s.teaser ? parseTraits(s.teaser) : null;
      if (!traits) continue;
      traitSections.add(s.section);
      for (const k of ["strengths", "weaknesses"] as const) {
        for (const item of traits[k]) if (!highlights[k].includes(item)) highlights[k].push(item);
      }
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <Link
        href="/readings?tab=mine"
        className="flex h-11 items-center gap-1 self-start rounded-full bg-surface pr-4 pl-2 text-sm font-semibold"
      >
        <ChevronLeft className="size-5" aria-hidden /> {t.back}
      </Link>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] lg:items-start">
        <div className="flex flex-col gap-3 lg:sticky lg:top-10">
          {pair ? (
            <section className="relative flex flex-col gap-5 overflow-hidden rounded-[32px] bg-tint-1 px-5 pt-6 pb-6 lg:px-6">
              <ConstellationArt
                sign={people[0].sign}
                rings={false}
                className="absolute -top-6 -left-8 size-44 opacity-25"
              />
              <ConstellationArt
                sign={people[1].sign}
                rings={false}
                className="absolute -top-2 -right-8 size-44 opacity-25"
              />
              <span className="relative self-center rounded-full bg-surface px-3.5 py-1.5 text-xs font-semibold tracking-widest text-highlight uppercase">
                {reading.viaLink ? t.freeView : reading.productName}
              </span>
              <h1 className="sr-only">
                {people[0].name} &amp; {people[1].name}
              </h1>
              <div className="relative grid grid-cols-[minmax(0,1fr)_2.25rem_minmax(0,1fr)] items-start">
                <PairPerson {...personProps(0)} />
                <span
                  aria-hidden
                  className="flex h-[72px] items-center justify-center font-serif text-[34px] font-semibold text-highlight"
                >
                  &amp;
                </span>
                <PairPerson {...personProps(1)} />
              </div>
              <p className="relative flex flex-wrap justify-center gap-x-2 text-xs text-muted-foreground">
                <span>
                  {signName(people[0].sign)} · {t.period(people[0].period)}
                </span>
                <span aria-hidden>×</span>
                <span>
                  {signName(people[1].sign)} · {t.period(people[1].period)}
                </span>
              </p>
              {sections.some((s) => s.score !== null) && (
                <div className="relative grid grid-cols-2 gap-2">
                  {sections.map((s) =>
                    s.score !== null ? (
                      <div
                        key={s.section}
                        className="flex items-center gap-3 rounded-3xl bg-surface p-3"
                      >
                        <ScoreRing
                          value={s.score}
                          tone={s.section === "sign_pair" ? "primary" : "secondary"}
                        />
                        <span className="text-sm leading-tight font-semibold">
                          {t.sections[s.section]}
                        </span>
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </section>
          ) : (
            <section className="relative flex min-h-72 flex-col justify-end overflow-hidden rounded-[32px] bg-tint-1 p-6 lg:min-h-105">
              <ConstellationArt
                sign={people[0].sign}
                className="absolute -top-6 -right-12 size-72"
              />
              <span className="relative text-xs font-semibold tracking-widest text-highlight uppercase">
                {reading.productName}
              </span>
              <h1 className="relative text-[40px] leading-[0.95] font-semibold lg:text-5xl">
                {people[0].name}
              </h1>
              <p className="relative mt-2 text-sm text-muted-foreground">
                {signName(people[0].sign)} · {people[0].birthDate}
              </p>
            </section>
          )}
          {hasHighlights(highlights) && <ReadingHighlights highlights={highlights} />}
        </div>

        <article className="flex flex-col gap-8 rounded-[32px] bg-surface p-6 lg:p-10">
          {sections.map((s) => (
            <section
              key={s.section}
              className="flex max-w-[680px] flex-col gap-3"
              aria-label={t.sections[s.section] || reading.productName}
            >
              {s.section !== "main" && (
                <span className="text-xs font-semibold tracking-widest text-highlight uppercase">
                  {t.sections[s.section]}
                </span>
              )}
              {s.body === null ? (
                <p className="text-muted-foreground">{t.unavailable}</p>
              ) : (
                <>
                  <h2 className="text-[32px] leading-tight font-semibold lg:text-[40px]">
                    {s.title}
                  </h2>
                  {s.teaser && !traitSections.has(s.section) && <Teaser text={s.teaser} />}
                  <ReadingBody body={s.body} />
                </>
              )}
            </section>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              {mn.common.entertainmentOnly} · {t.bought(dateFmt.format(reading.createdAt))}
            </p>
            <div className="flex items-center gap-2">
              {reading.linkedPersonId && <UnlinkButton personId={reading.linkedPersonId} />}
              <ShareCardButton purchaseId={reading.id} />
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
