import type { Metadata } from "next";

import { mn } from "@/i18n/mn";
import { RELATIONS } from "@/lib/domain";
import { avatarOptions } from "@/lib/avatars";
import { safeNext } from "@/lib/safe-next";
import { NewPersonFlow } from "./new-person-flow";

const OTHER_RELATIONS = RELATIONS.filter((r) => r !== "self");

export const metadata: Metadata = { title: mn.people.newTitle };

export default async function NewPersonPage({ searchParams }: PageProps<"/people/new">) {
  const { next, slot, relation } = await searchParams;
  // From the buy flow: come back with the new person filled into slot a|b.
  const back =
    typeof next === "string" && next.startsWith("/buy/") && (slot === "a" || slot === "b")
      ? { next: safeNext(next), slot: slot as "a" | "b" }
      : null;
  // From the first-run guide's ghost planets: the relation is picked, and home is where they
  // return to see the new planet arrive.
  const preset = OTHER_RELATIONS.find((r) => r === relation) ?? null;
  return (
    <NewPersonFlow
      avatars={avatarOptions()}
      returnTo={back}
      initialRelation={preset}
      returnHome={next === "/home"}
    />
  );
}
