import "server-only";

import { cookies } from "next/headers";

import { HOME_VIEW_COOKIE, initialHomeView, type HomeView } from "@/lib/daily";
import { guideState } from "@/lib/onboarding";
import type { PlanetSystemData } from "@/server/planets";

/** The view home opens on for this user (see `initialHomeView`). */
export async function readHomeView(data: PlanetSystemData): Promise<HomeView> {
  const cookie = (await cookies()).get(HOME_VIEW_COOKIE)?.value;
  const guide = guideState(data.onboarding, {
    people: data.people.length,
    pairs: Object.keys(data.mePairs).length + data.pairs.length,
  });
  return initialHomeView(cookie, guide.active);
}
