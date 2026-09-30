import type { Metadata } from "next";

import { EmptyState } from "@/components/app/empty-state";
import { SignHero } from "@/components/app/sign-hero";
import { mn } from "@/i18n/mn";
import { describeBirthDate, loadAstroRefs } from "@/server/astro/refs";
import { requireOnboardedUser } from "@/server/auth/current";
import { db } from "@/server/db";

export const metadata: Metadata = { title: mn.home.title };

// C3+: people row, suggestion card, product tiles, recent readings.
export default async function HomePage() {
  const { self } = await requireOnboardedUser();
  const { sign, period } = describeBirthDate(self.birthDate, await loadAstroRefs(db));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">{mn.home.greeting}</p>
        <h1 className="text-[34px] leading-tight font-semibold lg:text-[52px]">{self.name}</h1>
      </div>
      <SignHero
        label={mn.hero.yourSign}
        signCode={sign.code}
        signName={sign.nameMn}
        chips={[`${sign.startMd} – ${sign.endMd}`, `${period.no}-р үе`, self.birthDate]}
      />
      <EmptyState>{mn.home.empty}</EmptyState>
    </div>
  );
}
