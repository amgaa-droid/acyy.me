import type { ReactNode } from "react";

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-6 text-4xl font-semibold lg:mb-8 lg:text-5xl">{children}</h1>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed px-6 py-12 text-center text-muted-foreground">
      {children}
    </div>
  );
}
