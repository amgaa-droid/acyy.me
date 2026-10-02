import type { ReactNode } from "react";

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="mb-5 text-[40px] leading-none font-semibold lg:mb-8 lg:text-[52px]">
      {children}
    </h1>
  );
}
