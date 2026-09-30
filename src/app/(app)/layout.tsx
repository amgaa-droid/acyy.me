import { Header } from "@/components/app/header";
import { TabBar } from "@/components/app/tab-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+1.5rem)]">
        {children}
      </main>
      <TabBar />
    </div>
  );
}
