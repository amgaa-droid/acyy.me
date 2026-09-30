import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { Avatar } from "@/components/app/avatar";
import { PageTitle } from "@/components/app/empty-state";
import { SignOutButton } from "@/components/app/sign-out-button";
import { ThemePicker } from "@/components/app/theme-picker";
import { mn } from "@/i18n/mn";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { describeBirthDate, loadAstroRefs } from "@/server/astro/refs";
import { requireOnboardedUser } from "@/server/auth/current";
import { adminRoleOf } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: mn.me.title };

export default async function MePage() {
  const { user, self } = await requireOnboardedUser();
  const { sign } = describeBirthDate(self.birthDate, await loadAstroRefs(db));
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const role = adminRoleOf(user.email);

  return (
    <>
      <PageTitle>{mn.me.title}</PageTitle>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section className="flex items-center gap-4 self-start rounded-3xl bg-surface p-5">
          <Avatar seed={self.avatarSeed} size={72} />
          <div className="flex min-w-0 flex-col">
            <span className="text-xl font-semibold">{self.name}</span>
            <span className="truncate text-sm text-muted-foreground">{user.email}</span>
            <span className="mt-1 text-sm">
              {sign.nameMn} · {self.birthDate}
            </span>
            {role && (
              <Link
                href="/admin"
                className="mt-2 flex h-9 items-center gap-1.5 self-start rounded-full bg-tint-1 px-3 text-xs font-semibold text-highlight"
              >
                {mn.me.admin} · {mn.me.roles[role]}
              </Link>
            )}
          </div>
        </section>
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-2xl font-semibold">{mn.me.appearance}</h2>
            <p className="text-sm text-muted-foreground">{mn.me.appearanceHint}</p>
          </div>
          <ThemePicker current={theme} />
        </section>
      </div>
      <div className="mt-8">
        <SignOutButton />
      </div>
      <p className="mt-8 text-xs text-muted-foreground">{mn.common.entertainmentOnly}</p>
    </>
  );
}
