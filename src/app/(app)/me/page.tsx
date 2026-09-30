import type { Metadata } from "next";

import { PageTitle } from "@/components/app/empty-state";
import { mn } from "@/i18n/mn";

export const metadata: Metadata = { title: mn.me.title };

export default function MePage() {
  return (
    <>
      <PageTitle>{mn.me.title}</PageTitle>
      <p className="text-sm text-muted-foreground">{mn.common.entertainmentOnly}</p>
    </>
  );
}
