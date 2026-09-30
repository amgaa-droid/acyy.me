import type { Metadata } from "next";

import { mn } from "@/i18n/mn";
import { loadAstroRefs } from "@/server/astro/refs";
import { db } from "@/server/db";
import { ZodiacEditor } from "./zodiac-editor";

export const metadata: Metadata = { title: mn.admin.nav.zodiac };

export default async function ZodiacPage() {
  const { signs } = await loadAstroRefs(db);
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-[40px] leading-none font-semibold">{mn.admin.ranges.zodiacTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{mn.admin.ranges.hint}</p>
      </div>
      <ZodiacEditor
        rows={signs.map((s) => ({
          id: s.code,
          name: s.nameMn,
          startMd: s.startMd,
          endMd: s.endMd,
        }))}
      />
    </div>
  );
}
