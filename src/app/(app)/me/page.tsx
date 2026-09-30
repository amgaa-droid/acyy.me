import type { Metadata } from "next";
import { cookies } from "next/headers";

import { PageTitle } from "@/components/app/empty-state";
import { ThemePicker } from "@/components/app/theme-picker";
import { mn } from "@/i18n/mn";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";

export const metadata: Metadata = { title: mn.me.title };

export default async function MePage() {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <>
      <PageTitle>{mn.me.title}</PageTitle>
      <section className="flex max-w-xl flex-col gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{mn.me.appearance}</h2>
          <p className="text-sm text-muted-foreground">{mn.me.appearanceHint}</p>
        </div>
        <ThemePicker current={theme} />
      </section>
      <p className="mt-10 text-xs text-muted-foreground">{mn.common.entertainmentOnly}</p>
    </>
  );
}
