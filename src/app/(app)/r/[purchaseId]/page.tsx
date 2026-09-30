import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConstellationArt } from "@/components/app/constellation";
import { ScoreRing } from "@/components/readings/score-ring";
import { ShareCardButton } from "@/components/readings/share-card-button";
import { UnlinkButton } from "@/components/app/unlink-button";
import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";
import { loadAstroRefs } from "@/server/astro/refs";
import { requireOnboardedUser } from "@/server/auth/current";
import { db } from "@/server/db";
import { ReadingNotFoundError, getReading } from "@/server/reading";

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

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <Link
        href="/readings?tab=mine"
        className="flex h-11 items-center gap-1 self-start rounded-full bg-surface pr-4 pl-2 text-sm font-semibold"
      >
        <ChevronLeft className="size-5" aria-hidden /> {t.back}
      </Link>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] lg:items-start">
        <section
          className={cn(
            "relative flex min-h-72 flex-col justify-end overflow-hidden rounded-[32px] p-6 lg:sticky lg:top-10 lg:min-h-105",
            pair ? "bg-tint-2" : "bg-tint-1",
          )}
        >
          {pair ? (
            <>
              <ConstellationArt
                sign={people[0].sign}
                rings={false}
                className="absolute -top-2 -left-6 size-52 opacity-90"
              />
              <ConstellationArt
                sign={people[1].sign}
                rings={false}
                className="absolute top-10 -right-6 size-52 opacity-90"
              />
            </>
          ) : (
            <ConstellationArt sign={people[0].sign} className="absolute -top-6 -right-12 size-72" />
          )}
          <span className="relative text-xs font-semibold tracking-widest text-highlight uppercase">
            {reading.viaLink ? t.freeView : reading.productName}
          </span>
          <h1 className="relative text-[40px] leading-[0.95] font-semibold lg:text-5xl">
            {pair ? (
              <>
                {signName(people[0].sign)} <em className="font-medium text-highlight">&amp;</em>{" "}
                {signName(people[1].sign)}
              </>
            ) : (
              people[0].name
            )}
          </h1>
          <p className="relative mt-2 text-sm text-muted-foreground">
            {pair
              ? `${people[0].name} × ${people[1].name} · ${people[0].period}-р үе × ${people[1].period}-р үе`
              : `${signName(people[0].sign)} · ${people[0].birthDate}`}
          </p>
          {pair && reading.sections.some((s) => s.score !== null) && (
            <div className="relative mt-4 grid grid-cols-2 gap-2">
              {reading.sections.map((s) =>
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

        <article className="flex flex-col gap-8 rounded-[32px] bg-surface p-6 lg:p-10">
          {reading.sections.map((s) => (
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
                  {s.body.split(/\n\s*\n/).map((para, i) => (
                    <p key={i} className="text-[17px] leading-[1.7] whitespace-pre-line lg:text-lg">
                      {para}
                    </p>
                  ))}
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
