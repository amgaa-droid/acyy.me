import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PersonCard } from "@/components/people/person-card";
import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { requireOnboardedUser } from "@/server/auth/current";
import { listPeopleWithSigns } from "@/server/people-view";

export const metadata: Metadata = { title: mn.people.title };

export default async function PeoplePage() {
  const { user } = await requireOnboardedUser();
  const people = await listPeopleWithSigns(user.id);
  const others = people.length - 1;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl leading-none font-semibold lg:text-5xl">
            {mn.people.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{mn.people.count(people.length)}</p>
        </div>
        <Button
          className="hidden rounded-full px-5 lg:inline-flex"
          render={<Link href="/people/new" />}
          nativeButton={false}
        >
          <Plus aria-hidden /> {mn.people.add}
        </Button>
      </div>

      <ul className="grid gap-2.5 lg:grid-cols-2 xl:grid-cols-3">
        {people.map((p) => (
          <li key={p.id}>
            <PersonCard person={p} />
          </li>
        ))}
        <li>
          <Link
            href="/people/new"
            className="flex min-h-18 items-center gap-4 rounded-3xl border-2 border-dashed border-border p-3 font-semibold text-highlight"
          >
            <span className="flex size-13 items-center justify-center rounded-full bg-surface">
              <Plus className="size-6" aria-hidden />
            </span>
            {mn.people.add}
          </Link>
        </li>
      </ul>

      {others === 0 && <p className="text-sm text-muted-foreground">{mn.people.empty}</p>}
    </div>
  );
}
