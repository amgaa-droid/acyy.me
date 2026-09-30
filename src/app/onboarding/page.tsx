import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AVATAR_SEEDS, avatarDataUri } from "@/lib/avatars";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { getSelf } from "@/server/persons";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = { title: "Эхлэх" };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (await getSelf(db, user.id)) redirect("/home");

  // Render avatars on the server so the DiceBear renderer stays out of the client bundle.
  const avatars = AVATAR_SEEDS.map((seed) => ({ seed, uri: avatarDataUri(seed) }));

  return (
    <main className="flex min-h-dvh justify-center bg-bg lg:items-center lg:py-10">
      <div className="flex w-full max-w-md flex-col lg:min-h-0 lg:rounded-[32px] lg:bg-surface lg:shadow-sm">
        <OnboardingFlow avatars={avatars} />
      </div>
    </main>
  );
}
