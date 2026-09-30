import type { Metadata } from "next";

import { mn } from "@/i18n/mn";
import { IMPORT_KIND_LIST } from "@/server/import/kinds";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: mn.admin.nav.import };

export default function ImportPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div>
        <h1 className="text-[40px] leading-none font-semibold">{mn.admin.import.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{mn.admin.import.intro}</p>
      </div>
      <ImportForm
        kinds={IMPORT_KIND_LIST.map((k) => ({
          kind: k.kind,
          label: k.label,
          file: k.file,
          columns: k.columns.map((c) => c.name),
        }))}
      />
    </div>
  );
}
