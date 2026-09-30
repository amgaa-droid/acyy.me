import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { avatarOptions } from "@/lib/avatars";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { invitationPrefill } from "@/server/invitations";
import { getSelf } from "@/server/persons";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = { title: "Эхлэх" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const user = await requireUser();
  if (await getSelf(db, user.id)) redirect("/home");

  // Render avatars on the server so the DiceBear renderer stays out of the client bundle.
  const avatars = avatarOptions();
  const { invite } = await searchParams;
  const prefill = typeof invite === "string" ? await invitationPrefill(db, invite, user.id) : null;

  return (
    <main className="flex min-h-dvh justify-center bg-bg lg:items-center lg:py-10">
      <div className="flex w-full max-w-md flex-col lg:min-h-0 lg:rounded-[32px] lg:bg-surface lg:shadow-sm">
        <OnboardingFlow avatars={avatars} prefill={prefill} />
      </div>
    </main>
  );
}
