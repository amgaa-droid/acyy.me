import type { Metadata } from "next";

import { mn } from "@/i18n/mn";
import { loadAstroRefs } from "@/server/astro/refs";
import { db } from "@/server/db";
import { PeriodsEditor } from "./periods-editor";

export const metadata: Metadata = { title: mn.admin.nav.periods };

export default async function PeriodsPage() {
  const { periods } = await loadAstroRefs(db);
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-[40px] leading-none font-semibold">{mn.admin.ranges.periodsTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{mn.admin.ranges.hint}</p>
      </div>
      <PeriodsEditor
        rows={periods.map((p) => ({
          id: String(p.no),
          name: `${p.no}-р үе`,
          startMd: p.startMd,
          endMd: p.endMd,
          label: p.label,
        }))}
      />
    </div>
  );
}
