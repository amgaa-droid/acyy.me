import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SignHero } from "@/components/app/sign-hero";
import { PersonTile } from "@/components/people/person-card";
import { mn } from "@/i18n/mn";
import { describeBirthDate, loadAstroRefs } from "@/server/astro/refs";
import { requireOnboardedUser } from "@/server/auth/current";
import { db } from "@/server/db";
import { listPeopleWithSigns } from "@/server/people-view";

export const metadata: Metadata = { title: mn.home.title };

// C6: suggestion card, product tiles, recent readings.
export default async function HomePage() {
  const { user, self } = await requireOnboardedUser();
  const [{ sign, period }, people] = await Promise.all([
    loadAstroRefs(db).then((refs) => describeBirthDate(self.birthDate, refs)),
    listPeopleWithSigns(user.id),
  ]);
  const others = people.filter((p) => p.relation !== "self");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">{mn.home.greeting}</p>
        <h1 className="text-[34px] leading-tight font-semibold lg:text-[52px]">{self.name}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <SignHero
          label={mn.hero.yourSign}
          signCode={sign.code}
          signName={sign.nameMn}
          chips={[`${sign.startMd} – ${sign.endMd}`, `${period.no}-р үе`]}
        />

        <section className="flex flex-col gap-3 lg:rounded-[32px] lg:bg-surface lg:p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-semibold lg:text-[28px]">{mn.home.myPeople}</h2>
            <Link href="/people" className="text-sm font-semibold text-highlight">
              {mn.home.all}
            </Link>
          </div>
          <div className="-mx-4 scrollbar-none flex gap-2.5 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
            {others.map((p) => (
              <PersonTile key={p.id} person={p} />
            ))}
            <Link
              href="/people/new"
              aria-label={mn.people.add}
              className="flex w-22 shrink-0 flex-col items-center justify-center gap-1.5 rounded-3xl border-2 border-dashed border-border py-3 text-xs font-semibold text-highlight"
            >
              <Plus className="size-6" aria-hidden />
              {mn.home.add}
            </Link>
          </div>
          {others.length === 0 && (
            <p className="text-sm text-muted-foreground">{mn.people.empty}</p>
          )}
        </section>
      </div>
    </div>
  );
}
