import type { ReactNode } from "react";

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="mb-5 text-4xl leading-none font-semibold lg:mb-8 lg:text-5xl">
      {children}
    </h1>
  );
}
