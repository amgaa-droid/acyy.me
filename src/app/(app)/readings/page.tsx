import type { Metadata } from "next";

import { EmptyState, PageTitle } from "@/components/app/empty-state";
import { mn } from "@/i18n/mn";

export const metadata: Metadata = { title: mn.readings.title };

export default function ReadingsPage() {
  return (
    <>
      <PageTitle>{mn.readings.title}</PageTitle>
      <EmptyState>{mn.readings.catalog}</EmptyState>
    </>
  );
}
