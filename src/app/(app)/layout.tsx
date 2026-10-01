import { Header } from "@/components/app/header";
import { Sidebar } from "@/components/app/sidebar";
import { TabBar } from "@/components/app/tab-bar";
import { TopupPackagesProvider } from "@/components/app/topup-packages";
import { APP_NAME } from "@/env";
import { requireOnboardedUser } from "@/server/auth/current";
import { db } from "@/server/db";
import { listActivePackages } from "@/server/topup-packages";
import { getBalance } from "@/server/wallet";

/**
 * App shell for signed-in, onboarded users.
 * Mobile: header + floating tab bar. Desktop (lg+): floating sidebar with nav and wallet.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireOnboardedUser();
  const [balance, packages] = await Promise.all([getBalance(db, user.id), listActivePackages(db)]);

  return (
    <TopupPackagesProvider packages={packages}>
      <div className="flex min-h-dvh">
        <Sidebar appName={APP_NAME} balance={balance} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header balance={balance} />
          <main className="mx-auto w-full max-w-md flex-1 px-4 pt-2 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+2.5rem)] lg:max-w-6xl lg:px-10 lg:py-10">
            {children}
          </main>
        </div>
        <TabBar />
      </div>
    </TopupPackagesProvider>
  );
}
