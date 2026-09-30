import { CalendarDays, TriangleAlert } from "lucide-react";

import { Avatar } from "@/components/app/avatar";
import { mn } from "@/i18n/mn";
import { formatBirthDate } from "@/lib/birth-date";
import type { Highlights } from "@/lib/body";
import { cn } from "@/lib/utils";

/** One of the two people in a synastry hero: avatar, name, relation and birth date up front. */
export function PairPerson({
  name,
  relation,
  birthDate,
  avatarSeed,
  tint,
}: {
  name: string;
  relation: string | null;
  birthDate: string;
  avatarSeed: string;
  tint: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <Avatar seed={avatarSeed} size={72} className={cn("border-[3px] border-surface", tint)} />
      <p className="w-full truncate font-serif text-[30px] leading-none font-semibold lg:text-4xl">
        {name}
      </p>
      {relation && (
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {relation}
        </p>
      )}
      <p
        className="flex items-center gap-1.5 rounded-xl bg-surface px-2.5 py-1.5 text-sm font-semibold tabular-nums"
        aria-label={`${mn.reading.birthDate}: ${formatBirthDate(birthDate)}`}
      >
        <CalendarDays className="size-3.5" aria-hidden />
        {formatBirthDate(birthDate)}
      </p>
    </div>
  );
}

/** The key facts of a pair text, lifted out of the prose (src/lib/body.ts extractHighlights). */
export function ReadingHighlights({ highlights }: { highlights: Highlights }) {
  const t = mn.reading.highlights;
  const { goodFor, cautionFor, strengths, weaknesses } = highlights;
  return (
    <div className="flex flex-col gap-3">
      {goodFor.length > 0 && (
        <section className="flex flex-col gap-3.5 rounded-[28px] bg-highlight px-5 py-5 text-highlight-fg">
          <h2 className="font-sans text-xs font-semibold tracking-widest uppercase opacity-80">
            {t.goodFor}
          </h2>
          <ul className="flex flex-wrap gap-2.5">
            {goodFor.map((item, i) => (
              <li
                key={item}
                className={cn(
                  "rounded-full px-[18px] py-2 font-serif leading-tight font-semibold",
                  i === 0
                    ? "bg-highlight-fg text-[30px] text-highlight"
                    : "border-[1.5px] border-highlight-fg text-[26px]",
                )}
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {cautionFor.length > 0 && (
        <section className="flex items-center gap-3.5 rounded-3xl border border-border bg-surface px-5 py-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-tint-2">
            <TriangleAlert className="size-5" aria-hidden />
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 className="font-sans text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t.cautionFor}
            </h2>
            <p className="text-xl font-bold">{cautionFor.join(", ")}</p>
          </div>
        </section>
      )}

      {(strengths.length > 0 || weaknesses.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { title: t.strengths, items: strengths, tint: "bg-tint-3" },
            { title: t.weaknesses, items: weaknesses, tint: "bg-tint-2" },
          ].map(
            (col) =>
              col.items.length > 0 && (
                <section
                  key={col.title}
                  className={cn(
                    "flex flex-col gap-2.5 rounded-3xl px-4 py-4",
                    col.tint,
                    (strengths.length === 0 || weaknesses.length === 0) && "col-span-2",
                  )}
                >
                  <h2 className="font-sans text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {col.title}
                  </h2>
                  <ul className="flex flex-col gap-1 font-serif text-xl leading-tight font-semibold">
                    {col.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ),
          )}
        </div>
      )}
    </div>
  );
}
