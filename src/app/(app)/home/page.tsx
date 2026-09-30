import type { Metadata } from "next";

import { EmptyState } from "@/components/app/empty-state";
import { mn } from "@/i18n/mn";

export const metadata: Metadata = { title: mn.home.title };

// C2/C3: greeting, SignHero with the user's sign, people row, product tiles.
export default function HomePage() {
  return (
    <>
      <h1 className="mb-5 text-[32px] leading-tight font-semibold lg:text-[52px]">
        {mn.home.title}
      </h1>
      <EmptyState>{mn.home.empty}</EmptyState>
    </>
  );
}
