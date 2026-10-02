import type { Metadata } from "next";

import { PlanetSystem } from "@/components/home/planet-system";
import { APP_NAME } from "@/env";
import { mn } from "@/i18n/mn";
import { requireOnboardedUser } from "@/server/auth/current";
import { db } from "@/server/db";
import { readHomeView } from "@/server/home-view";
import { loadPlanetSystem } from "@/server/planets";
import { getBalance } from "@/server/wallet";

export const metadata: Metadata = { title: mn.home.title };

/**
 * Signed-in home: one full-screen stage — my day ("today") or the planet system; details open
 * over it as popups.
 */
export default async function HomePage() {
  const { user, self } = await requireOnboardedUser();
  const [data, balance] = await Promise.all([
    loadPlanetSystem(db, user.id, self),
    getBalance(db, user.id),
  ]);
  const view = await readHomeView(data);
  return <PlanetSystem data={data} balance={balance} appName={APP_NAME} initialView={view} />;
}
