import { CalendarDays, Sparkle, TriangleAlert } from "lucide-react";

import { Avatar } from "@/components/app/avatar";
import { ConstellationArt } from "@/components/app/constellation";
import { mn } from "@/i18n/mn";
import { formatBirthDate } from "@/lib/birth-date";
import { fieldItems } from "@/lib/fields";
import { cn } from "@/lib/utils";
import type { ReadingField } from "@/server/reading";

export type PairHeroPerson = {
  name: string;
  relation: string | null;
  /** "YYYY-MM-DD"; without it the date pill and the sign line are left out. */
  birthDate?: string;
  avatarSeed: string;
  tint: string;
  /** Sign code (constellation art) and the "Хонь · 13-р үе" caption parts. */
  sign?: { code: string; name: string };
  period?: number;
};

/**
 * The synastry hero: headline, the two people side by side, their signs and periods, and
 * (children) anything below them such as the score rings. Used by the reading page and the
 * landing's example, so the example looks exactly like a real pair reading.
 */
export function PairHero({
  title,
  people,
  headingLevel = 1,
  children,
}: {
  title: string;
  people: [PairHeroPerson, PairHeroPerson];
  headingLevel?: 1 | 2 | 3;
  children?: React.ReactNode;
}) {
  const Heading = `h${headingLevel}` as const;
  const [a, b] = people;
  const caption = (p: PairHeroPerson) =>
    [p.sign?.name, p.period !== undefined ? mn.reading.period(p.period) : null]
      .filter(Boolean)
      .join(" · ");
  return (
    <section className="relative flex flex-col gap-5 overflow-hidden rounded-3xl bg-tint-1 px-5 pt-6 pb-6 text-fg lg:px-6">
      {a.sign && (
        <ConstellationArt
          sign={a.sign.code}
          rings={false}
          className="absolute -top-6 -left-8 size-44 opacity-25"
        />
      )}
      {b.sign && (
        <ConstellationArt
          sign={b.sign.code}
          rings={false}
          className="absolute -top-2 -right-8 size-44 opacity-25"
        />
      )}
      <Heading className="relative px-6 text-center font-serif text-3xl leading-[1.05] font-semibold text-balance lg:text-4xl">
        {title}
      </Heading>
      <div className="relative grid grid-cols-[minmax(0,1fr)_2.25rem_minmax(0,1fr)] items-start">
        <PairPerson {...a} />
        <span
          aria-hidden
          className="flex h-[72px] items-center justify-center font-serif text-4xl font-semibold text-highlight"
        >
          &amp;
        </span>
        <PairPerson {...b} />
      </div>
      {caption(a) && caption(b) && (
        <p className="relative flex flex-wrap justify-center gap-x-2 text-xs text-muted-foreground">
          <span>{caption(a)}</span>
          <span aria-hidden>×</span>
          <span>{caption(b)}</span>
        </p>
      )}
      {children}
    </section>
  );
}

/** One of the two people in a synastry hero: avatar, name, relation and birth date up front. */
function PairPerson({ name, relation, birthDate, avatarSeed, tint }: PairHeroPerson) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <Avatar seed={avatarSeed} size={72} className={cn("border-[3px] border-surface", tint)} />
      <p className="w-full truncate font-serif text-3xl leading-none font-semibold lg:text-4xl">
        {name}
      </p>
      {relation && (
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {relation}
        </p>
      )}
      {birthDate && (
        <p
          className="flex items-center gap-1.5 rounded-xl bg-surface px-2.5 py-1.5 text-sm font-semibold tabular-nums"
          aria-label={`${mn.reading.birthDate}: ${formatBirthDate(birthDate)}`}
        >
          <CalendarDays className="size-3.5" aria-hidden />
          {formatBirthDate(birthDate)}
        </p>
      )}
    </div>
  );
}

/**
 * The summary sub-sections next to the hero, in field order. Consecutive chips/alert fields share
 * one card as rows; two list fields in a row share one row as a pair of tiles
 * (e.g. "Давуу тал" / "Сул тал").
 */
export function SummaryFields({ fields }: { fields: ReadingField[] }) {
  const isRow = (f: ReadingField) => f.kind === "chips" || f.kind === "alert";
  const groups: ReadingField[][] = [];
  for (const f of fields) {
    const last = groups.at(-1);
    if (f.kind === "list" && last?.length === 1 && last[0].kind === "list") last.push(f);
    else if (isRow(f) && last && isRow(last[0])) last.push(f);
    else groups.push([f]);
  }
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) =>
        group[0].kind === "list" ? (
          <div key={group[0].code} className="grid grid-cols-2 gap-3">
            {group.map((f, i) => (
              <section
                key={f.code}
                className={cn(
                  "flex flex-col rounded-3xl px-4.5 pt-4.5 pb-2 lg:rounded-3xl lg:px-5.5 lg:pt-5.5 lg:pb-2.5",
                  i === 0 ? "bg-tint-3" : "bg-tint-2",
                  group.length === 1 && "col-span-2",
                )}
              >
                <SummaryLabel className="mb-1.5">{f.name}</SummaryLabel>
                <ul className="text-[15px] leading-[1.3] font-medium lg:text-base">
                  {fieldItems(f.value, f.kind).map((item) => (
                    <li key={item} className="border-t border-fg/10 py-2.5 lg:py-[11px]">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <section
            key={group[0].code}
            className="flex flex-col divide-y divide-border rounded-3xl bg-surface px-5 py-0.5 lg:rounded-3xl lg:px-6 lg:py-1"
          >
            {group.map((f) => (
              <SummaryRow key={f.code} field={f} />
            ))}
          </section>
        ),
      )}
    </div>
  );
}

const SummaryLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <h3
    className={cn(
      "font-sans text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase",
      className,
    )}
  >
    {children}
  </h3>
);

/** A chips or alert field: icon, label and its items as one serif value. */
function SummaryRow({ field }: { field: ReadingField }) {
  const alert = field.kind === "alert";
  const Icon = alert ? TriangleAlert : Sparkle;
  return (
    <div className="flex items-center gap-3.5 py-4 lg:gap-4 lg:py-[18px]">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full lg:size-11",
          alert ? "bg-tint-2" : "bg-tint-1 text-highlight",
        )}
      >
        <Icon className="size-4.5" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <SummaryLabel>{field.name}</SummaryLabel>
        <p className="font-serif text-3xl leading-[1.1] font-semibold">
          {fieldItems(field.value, field.kind).map((item, i) => (
            <span key={item}>
              {i > 0 && (
                <span aria-hidden className="px-2 text-muted-foreground">
                  ·
                </span>
              )}
              {item}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
