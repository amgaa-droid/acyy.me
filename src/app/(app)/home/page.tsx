import type { Metadata } from "next";

import { EmptyState, PageTitle } from "@/components/app/empty-state";
import { mn } from "@/i18n/mn";

export const metadata: Metadata = { title: mn.home.title };

export default function HomePage() {
  return (
    <>
      <PageTitle>{mn.home.title}</PageTitle>
      <EmptyState>{mn.home.empty}</EmptyState>
    </>
  );
}
