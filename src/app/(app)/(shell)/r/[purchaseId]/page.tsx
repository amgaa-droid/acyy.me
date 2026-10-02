import { ChevronLeft, CircleDot } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConstellationArt } from "@/components/app/constellation";
import { OfferList } from "@/components/readings/offer-list";
import { ArticleField, Teaser } from "@/components/readings/reading-body";
import {
  PairHero,
  type PairHeroPerson,
  SummaryFields,
} from "@/components/readings/reading-highlights";
import { ScoreRing } from "@/components/readings/score-ring";
import { SelectionShare } from "@/components/readings/selection-share";
import { ShareCardButton } from "@/components/readings/share-card-button";
import { UnlinkButton } from "@/components/app/unlink-button";
import { mn } from "@/i18n/mn";
import { formatBirthDate, formatDate } from "@/lib/birth-date";
import { SHARE_CARD_PRODUCTS } from "@/lib/catalog-refs";
import { sectionLabel } from "@/lib/content-keys-display";
import { SUMMARY_FIELD_KINDS } from "@/lib/domain";
import { relationText, relationTint } from "@/lib/people";
import { loadAstroRefs } from "@/server/astro/refs";
import { requireOnboardedUser } from "@/server/auth/current";
import { loadViewer, offersForPerson } from "@/server/catalog";
import { db } from "@/server/db";
import { getPerson } from "@/server/persons";
import { ReadingNotFoundError, getReading, readingPeople } from "@/server/reading";

export const metadata: Metadata = { title: mn.reading.pageTitle };

/** Readings with a "Хуваалцах" card button (top right); the rest share only selected text. */
const SHARE_CARD = new Set(SHARE_CARD_PRODUCTS);

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
  const signNames = Object.fromEntries(refs.signs.map((s) => [s.code, s.nameMn]));
  const live = await readingPeople(db, user.id, reading.personIds);
  // Bought text stays as the snapshot; the name follows later edits (the person is the same).
  const people = reading.snapshot.persons.map((p, i) => ({ ...p, name: live[i]?.name ?? p.name }));
  const pair = people.length === 2;
  const t = mn.reading;
  // After the text: what else there is to read about the same person — the owner's own person,
  // and only what isn't bought yet. (A pair, or someone else's reading, ends with the text.)
  const subject =
    !pair && live[0] ? await getPerson(db, user.id, live[0].id).catch(() => null) : null;
  const more = subject
    ? (await offersForPerson(db, await loadViewer(db, user.id), subject))
        .filter((o) => o.purchaseId === null)
        .slice(0, 3)
    : [];

  const personProps = (i: number): PairHeroPerson => ({
    name: people[i].name,
    relation: live[i] ? relationText(live[i]) : null,
    birthDate: people[i].birthDate,
    avatarSeed: live[i]?.avatarSeed ?? people[i].name,
    tint: live[i] ? relationTint(live[i].relation) : "bg-subtle",
    sign: { code: people[i].sign, name: signName(people[i].sign) },
    period: people[i].period,
  });

  // Summary sub-sections (lists, chips, alerts) go next to the hero; the rest reads as an article.
  const isSummary = (kind: string) => SUMMARY_FIELD_KINDS.some((k) => k === kind);
  const summary = reading.sections.flatMap((s) =>
    (s.fields ?? [])
      .filter((f) => isSummary(f.kind))
      .map((f) => ({ ...f, code: `${s.section}.${s.key}.${f.code}` })),
  );
  const multiPart = reading.sections.length > 1;
  // A pair's headline (the first part's title, "Харилцааны зөвлөмж") sits in the hero with the two
  // people instead of atop its article section.
  const headline = pair ? reading.sections.find((s) => s.fields !== null && s.title) : undefined;
  const firstScored = reading.sections.find((s) => s.score !== null);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      {/* Desktop: the sheet's close button sits over the right end of this row. */}
      <div className="flex items-center justify-between gap-2 lg:pr-10">
        <Link
          href="/readings?tab=mine"
          className="flex h-11 shrink-0 items-center gap-1 rounded-full bg-surface pr-4 pl-2 text-sm font-semibold"
        >
          <ChevronLeft className="size-5" aria-hidden /> {t.back}
        </Link>
        {pair && (
          <span className="min-w-0 truncate rounded-full bg-pair px-2.5 py-1.5 text-xs font-semibold tracking-wide text-pair-fg uppercase lg:px-3.5 lg:tracking-widest">
            {reading.viaLink ? t.freeView : reading.productName}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] lg:items-start">
        <div className="flex flex-col gap-3 lg:sticky lg:top-10">
          {pair ? (
            <PairHero
              title={headline?.title ?? `${people[0].name} & ${people[1].name}`}
              people={[personProps(0), personProps(1)]}
            >
              {reading.sections.some((s) => s.score !== null) && (
                <div className="relative grid grid-cols-2 gap-2">
                  {reading.sections.map((s) =>
                    s.score !== null ? (
                      <div
                        key={`${s.section}|${s.key}`}
                        className="flex items-center gap-3 rounded-3xl bg-surface p-3"
                      >
                        <ScoreRing
                          value={s.score}
                          tone={s === firstScored ? "primary" : "secondary"}
                        />
                        <span className="text-sm leading-tight font-semibold">
                          {sectionLabel(s, signNames)}
                        </span>
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </PairHero>
          ) : (
            <section className="relative min-h-[340px] overflow-hidden rounded-3xl bg-tint-1 lg:min-h-[440px] lg:rounded-4xl">
              <ConstellationArt
                sign={people[0].sign}
                className="absolute -top-8 -right-16 size-80 lg:-top-12 lg:-right-20 lg:size-[26rem]"
              />
              <div className="absolute inset-x-6 bottom-6.5 flex flex-col gap-2 lg:inset-x-9 lg:bottom-8.5 lg:gap-2.5">
                <span className="text-xs font-semibold tracking-[0.16em] text-highlight uppercase">
                  {reading.productName}
                </span>
                <h1 className="text-5xl leading-[0.95] font-semibold lg:text-7xl">
                  {people[0].name}
                </h1>
                <p className="mt-1.5 flex items-center gap-3.5 text-sm text-muted-foreground lg:text-[15px]">
                  <span className="flex items-center gap-1.5">
                    <CircleDot className="size-3.5" aria-hidden />
                    {signName(people[0].sign)}
                  </span>
                  <span aria-hidden className="size-[3px] rounded-full bg-muted-foreground" />
                  <span className="tabular-nums">{formatBirthDate(people[0].birthDate)}</span>
                </p>
              </div>
            </section>
          )}
          {/* Under the name card: only the birthday and pair readings make a card; any other
              reading shares selected text. */}
          {SHARE_CARD.has(reading.productCode) && <ShareCardButton purchaseId={reading.id} />}
          {summary.length > 0 && <SummaryFields fields={summary} />}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <article className="flex flex-col gap-12 rounded-3xl bg-surface px-5.5 pt-7.5 pb-6.5 lg:rounded-4xl lg:px-16 lg:pt-14 lg:pb-11">
            <SelectionShare purchaseId={reading.id} className="flex flex-col gap-12">
              {reading.sections.map((s) => {
                const article = (s.fields ?? []).filter((f) => !isSummary(f.kind));
                const lone = article.length === 1 && article[0].kind === "text";
                return (
                  <section
                    key={`${s.section}|${s.key}`}
                    className="flex max-w-[640px] flex-col gap-8 lg:gap-10"
                    aria-label={multiPart ? sectionLabel(s, signNames) : reading.productName}
                  >
                    <header className="flex flex-col gap-3 lg:gap-3.5">
                      {multiPart && (
                        <span className="text-xs font-semibold tracking-[0.16em] text-highlight uppercase">
                          {sectionLabel(s, signNames)}
                        </span>
                      )}
                      {s.fields === null ? (
                        <p className="text-muted-foreground">{t.unavailable}</p>
                      ) : s === headline ? (
                        s.teaser && <Teaser text={s.teaser} className="mt-1" />
                      ) : (
                        <>
                          <h2 className="text-4xl leading-none font-semibold lg:text-6xl">
                            {s.title}
                          </h2>
                          {s.teaser && <Teaser text={s.teaser} className="mt-1" />}
                        </>
                      )}
                    </header>
                    {s.fields !== null &&
                      article.map((f) => (
                        <ArticleField key={f.code} field={f} showHeading={!lone} />
                      ))}
                  </section>
                );
              })}
            </SelectionShare>
            <div className="flex max-w-[640px] flex-wrap items-center justify-between gap-3 border-t border-border pt-4.5 lg:pt-5">
              <p className="text-xs text-muted-foreground">
                {t.bought(formatDate(reading.createdAt))}
              </p>
              {reading.linkedPersonId && <UnlinkButton personId={reading.linkedPersonId} />}
            </div>
          </article>
          {/* Phones: the share button again, where the reading ends (on desktop the one beside
            the text stays in view). */}
          {SHARE_CARD.has(reading.productCode) && (
            <div className="lg:hidden">
              <ShareCardButton purchaseId={reading.id} />
            </div>
          )}
          {subject && more.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-2xl font-semibold">{t.next}</h2>
              <OfferList
                personId={subject.id}
                offers={more.map((o) => ({
                  code: o.product.code,
                  name: o.product.nameMn,
                  icon: o.product.icon,
                  tint: o.product.tint,
                  price: o.product.price,
                  personCount: o.product.personCount,
                  purchaseId: o.purchaseId,
                }))}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
