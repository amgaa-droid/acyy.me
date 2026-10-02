import { ScreenSheet } from "@/components/app/screen-sheet";
import { PlanetSystem } from "@/components/home/planet-system";
import { APP_NAME } from "@/env";
import { requireOnboardedUser } from "@/server/auth/current";
import { db } from "@/server/db";
import { readHomeView } from "@/server/home-view";
import { loadPlanetSystem } from "@/server/planets";
import { getBalance } from "@/server/wallet";

/**
 * Detail screens opened directly (a shared link, a refresh). There are no separate full pages:
 * the screen opens as the same popup as from home (`../home/@modal`), over the planet system,
 * which stays behind it untouchable until the popup closes to home.
 */
export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const { user, self } = await requireOnboardedUser();
  const [data, balance] = await Promise.all([
    loadPlanetSystem(db, user.id, self),
    getBalance(db, user.id),
  ]);
  const view = await readHomeView(data);

  return (
    <>
      <div inert aria-hidden>
        <PlanetSystem data={data} balance={balance} appName={APP_NAME} initialView={view} />
      </div>
      <ScreenSheet>{children}</ScreenSheet>
    </>
  );
}
