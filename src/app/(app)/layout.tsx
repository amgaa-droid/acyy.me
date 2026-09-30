import { Header } from "@/components/app/header";
import { Sidebar } from "@/components/app/sidebar";
import { TabBar } from "@/components/app/tab-bar";
import { APP_NAME } from "@/env";

/**
 * App shell. Mobile: sticky header + bottom tab bar, single column.
 * Desktop (lg+): left sidebar with nav and wallet, wide content area.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const balance = 0; // C5: real wallet balance

  return (
    <div className="flex min-h-dvh">
      <Sidebar appName={APP_NAME} balance={balance} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header balance={balance} />
        <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+1.5rem)] lg:max-w-6xl lg:px-14 lg:py-10">
          {children}
        </main>
      </div>
      <TabBar />
    </div>
  );
}
