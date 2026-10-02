import { ArrowRight, Pencil, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Avatar } from "@/components/app/avatar";
import { PageTitle } from "@/components/app/empty-state";
import { SignOutButton } from "@/components/app/sign-out-button";
import { LinkedAccounts } from "@/components/app/linked-accounts";
import { AdultConfirm } from "@/components/readings/adult-confirm";
import { UnlinkButton } from "@/components/app/unlink-button";
import { peopleLinkedTo } from "@/server/invitations";
import { getSelf } from "@/server/persons";
import { ageOn, formatBirthDate, parseIsoDate, todayYmd } from "@/lib/birth-date";
import { ThemePicker } from "@/components/app/theme-picker";
import { formatMnt, mn } from "@/i18n/mn";
import { describeBirthDate, loadAstroRefs } from "@/server/astro/refs";
import { linkedProviders } from "@/server/auth/accounts";
import { requireOnboardedUser } from "@/server/auth/current";
import { enabledSocialProviders } from "@/server/auth";
import { adminRoleOf } from "@/server/auth/session";
import { db } from "@/server/db";
import { readTheme } from "@/server/theme";
import { getBalance } from "@/server/wallet";

export const metadata: Metadata = { title: mn.me.title };

export default async function MePage({ searchParams }: PageProps<"/me">) {
  const { user, self } = await requireOnboardedUser();
  // Back from linking Google/Facebook: Better Auth adds ?error=… when it failed.
  const { error } = await searchParams;
  const linked = await linkedProviders(db, user.id);
  const { sign } = describeBirthDate(self.birthDate, await loadAstroRefs(db));
  const theme = await readTheme();
  const role = adminRoleOf(user);
  const balance = await getBalance(db, user.id);
  const selfAge = ageOn(parseIsoDate(self.birthDate)!, todayYmd());
  const linkedTo = await Promise.all(
    (await peopleLinkedTo(db, user.id)).map(async (p) => ({
      ...p,
      ownerName: (await getSelf(db, p.ownerUserId))?.name ?? "",
    })),
  );
  const adultState =
    selfAge < 18 ? "too_young" : user.adultConfirmedAt ? "confirmed" : "can_confirm";

  return (
    <>
      <PageTitle>{mn.me.title}</PageTitle>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section className="flex items-center gap-4 self-start rounded-3xl bg-surface p-5">
          <Avatar seed={self.avatarSeed} size={72} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-xl font-semibold">{self.name}</span>
            <span className="truncate text-sm text-muted-foreground">{user.email}</span>
            <span className="mt-1 text-sm">
              {sign.nameMn} · {formatBirthDate(self.birthDate)}
            </span>
          </div>
          {/* My own page: the name and avatar are edited there. */}
          <Link
            href={`/people/${self.id}`}
            aria-label={mn.people.edit}
            className="flex size-11 shrink-0 items-center justify-center self-start rounded-full bg-subtle"
          >
            <Pencil className="size-4.5" aria-hidden />
          </Link>
        </section>
        {role && (
          <Link
            href="/admin"
            className="flex h-14 w-full items-center gap-3 self-start rounded-3xl bg-tint-1 px-5 font-semibold text-highlight lg:col-start-1"
          >
            <ShieldCheck className="size-5" aria-hidden />
            <span className="flex-1">
              {mn.me.admin} · {mn.me.roles[role]}
            </span>
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
        <Link
          href="/wallet"
          className="flex w-full items-center justify-between self-start rounded-3xl bg-surface p-5 lg:col-start-1"
        >
          <span className="flex flex-col">
            <span className="text-xs text-muted-foreground">{mn.wallet.title}</span>
            <span className="text-2xl font-semibold tabular-nums">{formatMnt(balance)}</span>
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold text-highlight">
            {mn.wallet.history} <ArrowRight className="size-4" aria-hidden />
          </span>
        </Link>
        <div className="lg:col-start-1">
          <AdultConfirm state={adultState} />
        </div>
        {linkedTo.length > 0 && (
          <section className="flex flex-col gap-2 rounded-3xl bg-surface p-5 lg:col-start-1">
            <h2 className="text-xl font-semibold">{mn.invite.linkedToMe}</h2>
            <p className="text-sm text-muted-foreground">{mn.invite.linkedToMeHint}</p>
            <ul className="flex flex-col divide-y divide-border">
              {linkedTo.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="text-sm">
                    <span className="font-semibold">{p.ownerName}</span>
                    <span className="text-muted-foreground"> · «{p.name}»</span>
                  </span>
                  <UnlinkButton personId={p.id} then="/me" />
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="lg:col-start-1">
          <LinkedAccounts
            providers={enabledSocialProviders}
            linked={linked}
            error={typeof error === "string" ? error : undefined}
          />
        </div>
        <section className="flex flex-col gap-3 lg:col-start-2 lg:row-span-6 lg:row-start-1">
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
    </>
  );
}
