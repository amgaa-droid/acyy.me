import type { ReactNode } from "react";

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="mb-5 text-[40px] leading-none font-semibold lg:mb-8 lg:text-[52px]">
      {children}
    </h1>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-3xl bg-surface px-6 py-12 text-center text-muted-foreground">
      {children}
    </div>
  );
}
