import { TopupPackagesProvider } from "@/components/app/topup-packages";
import { requireOnboardedUser } from "@/server/auth/current";
import { db } from "@/server/db";
import { listActivePackages } from "@/server/topup-packages";

/**
 * Signed-in, onboarded users: the full-screen home (`home`, with popups over it) and the
 * full-page detail screens (`(shell)`).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireOnboardedUser();
  const packages = await listActivePackages(db);
  return <TopupPackagesProvider packages={packages}>{children}</TopupPackagesProvider>;
}
