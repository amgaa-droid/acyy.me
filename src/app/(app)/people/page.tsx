import { Plus } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState, PageTitle } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";

export const metadata: Metadata = { title: mn.people.title };

export default function PeoplePage() {
  return (
    <>
      <PageTitle>{mn.people.title}</PageTitle>
      <EmptyState>{mn.people.empty}</EmptyState>
      <Button size="lg" className="mt-6" disabled>
        <Plus aria-hidden /> {mn.people.add}
      </Button>
    </>
  );
}
