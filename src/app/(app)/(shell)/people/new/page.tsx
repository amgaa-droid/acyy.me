import type { Metadata } from "next";

import { mn } from "@/i18n/mn";
import { avatarOptions } from "@/lib/avatars";
import { safeNext } from "@/lib/safe-next";
import { NewPersonFlow } from "./new-person-flow";

export const metadata: Metadata = { title: mn.people.newTitle };

export default async function NewPersonPage({ searchParams }: PageProps<"/people/new">) {
  const { next, slot } = await searchParams;
  // From the buy flow: come back with the new person filled into slot a|b.
  const back =
    typeof next === "string" && next.startsWith("/buy/") && (slot === "a" || slot === "b")
      ? { next: safeNext(next), slot: slot as "a" | "b" }
      : null;
  return <NewPersonFlow avatars={avatarOptions()} returnTo={back} />;
}
