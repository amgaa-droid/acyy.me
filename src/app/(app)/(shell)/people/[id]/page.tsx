import { ChevronLeft, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Avatar } from "@/components/app/avatar";
import { ConstellationArt } from "@/components/app/constellation";
import { OfferList } from "@/components/readings/offer-list";
import { mn } from "@/i18n/mn";
import { avatarOptions } from "@/lib/avatars";
import { relationTint, relationText } from "@/lib/people";
import { cn } from "@/lib/utils";
import { describeBirthDate, loadAstroRefs } from "@/server/astro/refs";
import { requireOnboardedUser } from "@/server/auth/current";
import { loadViewer, offersForPerson } from "@/server/catalog";
import { db } from "@/server/db";
import { PersonNotFoundError, getPerson, isGenderLocked } from "@/server/persons";
import { DeletePersonButton, EditPersonButton } from "./person-actions";
import { InviteSection } from "./invite-section";
import { personLinkState } from "@/server/invitations";
import { APP_NAME } from "@/env";

export const metadata: Metadata = { title: mn.people.title };

async function loadPerson(userId: string, id: string) {
  try {
    return await getPerson(db, userId, id);
  } catch (err) {
    if (err instanceof PersonNotFoundError) notFound();
    throw err;
  }
}

export default async function PersonPage({ params }: PageProps<"/people/[id]">) {
  const { id } = await params;
  const { user, self } = await requireOnboardedUser();
  const person = await loadPerson(user.id, id);
  const link = person.isSelf ? null : await personLinkState(db, user.id, person);
  const { sign, period } = describeBirthDate(person.birthDate, await loadAstroRefs(db));
  const [offers, genderLocked] = await Promise.all([
    loadViewer(db, user.id).then((viewer) => offersForPerson(db, viewer, person)),
    isGenderLocked(db, user.id, person.id),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/people"
        className="flex h-11 items-center gap-1 self-start rounded-full bg-surface pr-4 pl-2 text-sm font-semibold"
      >
        <ChevronLeft className="size-5" aria-hidden /> {mn.people.title}
      </Link>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start">
        <section
          className={cn(
            "relative flex min-h-80 flex-col justify-end overflow-hidden rounded-[32px] p-6 lg:min-h-105",
            person.isSelf ? "bg-tint-1" : relationTint(person.relation),
          )}
        >
          <ConstellationArt
            sign={sign.code}
            className="absolute -top-6 -right-12 size-72 lg:size-96"
          />
          <Avatar
            seed={person.avatarSeed}
            size={72}
            className="relative mb-4 border-0 bg-surface"
          />
          <span className="relative text-xs font-semibold tracking-widest text-highlight uppercase">
            {relationText(person)}
          </span>
          <h1 className="relative text-5xl leading-none font-semibold break-words lg:text-6xl">
            {person.name}
          </h1>
          <div className="relative mt-4 flex flex-wrap gap-2">
            <Chip>{sign.nameMn}</Chip>
            <Chip>{mn.people.periodValue(period.no)}</Chip>
            <Chip>
              <Lock className="size-3.5" aria-label={mn.people.birthDateLocked} />
              {person.birthDate}
            </Chip>
          </div>
        </section>

        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-2.5">
            <Fact
              label={mn.people.sign}
              value={sign.nameMn}
              sub={`${sign.startMd} – ${sign.endMd}`}
            />
            <Fact
              label={mn.people.period}
              value={mn.people.periodValue(period.no)}
              sub={`${period.startMd} – ${period.endMd}`}
            />
          </dl>

          <section className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold">{mn.people.readingsTitle}</h2>
            <OfferList
              personId={person.id}
              offers={offers.map((o) => ({
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

          {link && (
            <InviteSection
              personId={person.id}
              inviterName={self.name}
              appName={APP_NAME}
              state={
                link.kind === "pending"
                  ? { ...link, expiresAt: link.expiresAt.toISOString() }
                  : link
              }
            />
          )}

          <div className="flex flex-wrap gap-2">
            <EditPersonButton
              person={{
                id: person.id,
                isSelf: person.isSelf,
                name: person.name,
                gender: person.gender,
                genderLocked,
                avatarSeed: person.avatarSeed,
                relation: person.relation,
                relationLabel: person.relationLabel,
              }}
              avatars={avatarOptions()}
            />
            {!person.isSelf && <DeletePersonButton id={person.id} name={person.name} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-surface/75 px-3 py-1.5 text-sm font-medium">
      {children}
    </span>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-3xl bg-surface p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold">{value}</dd>
      <dd className="text-sm text-muted-foreground">{sub}</dd>
    </div>
  );
}
