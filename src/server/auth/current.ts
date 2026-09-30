import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/server/db";
import { getSelf } from "@/server/persons";
import { requireUser } from "./session";

/** Signed-in user with their "Би"; no "Би" yet → /onboarding (SPEC §5). */
export const requireOnboardedUser = cache(async () => {
  const user = await requireUser();
  const self = await getSelf(db, user.id);
  if (!self) redirect("/onboarding");
  return { user, self };
});
