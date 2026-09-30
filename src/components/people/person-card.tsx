import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/app/avatar";
import { mn } from "@/i18n/mn";
import type { Relation } from "@/lib/domain";
import { relationTint, relationText } from "@/lib/people";
import { cn } from "@/lib/utils";

export type PersonSummary = {
  id: string;
  name: string;
  relation: Relation;
  relationLabel: string | null;
  avatarSeed: string;
  signName: string;
};

/** Row card for the people list: tinted avatar, name, relation · sign. */
export function PersonCard({ person }: { person: PersonSummary }) {
  const isSelf = person.relation === "self";
  return (
    <Link
      href={`/people/${person.id}`}
      className="flex min-h-18 items-center gap-4 rounded-3xl bg-surface p-3 pr-4 transition-colors hover:bg-surface/70"
    >
      <Avatar
        seed={person.avatarSeed}
        size={52}
        className={cn("border-0", relationTint(person.relation))}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-semibold">
          {person.name}
          {isSelf && (
            <span className="ml-2 text-xs font-medium text-highlight">{mn.people.you}</span>
          )}
        </span>
        <span className="truncate text-sm text-muted-foreground">
          {relationText(person)} · {person.signName}
        </span>
      </span>
      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
    </Link>
  );
}

/** Compact vertical tile for horizontal rows (home). */
export function PersonTile({ person }: { person: PersonSummary }) {
  return (
    <Link
      href={`/people/${person.id}`}
      className="flex w-22 shrink-0 flex-col items-center gap-1.5 rounded-3xl bg-surface px-1 py-3"
    >
      <Avatar
        seed={person.avatarSeed}
        size={48}
        className={cn("border-0", relationTint(person.relation))}
      />
      <span className="w-full truncate text-center text-xs font-semibold">
        {relationText(person)}
      </span>
      <span className="-mt-1 w-full truncate text-center text-[11px] text-muted-foreground">
        {person.signName}
      </span>
    </Link>
  );
}
