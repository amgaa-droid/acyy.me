import type { Metadata } from "next";

import { mn } from "@/i18n/mn";
import { db } from "@/server/db";
import { allKinds } from "@/server/import/kinds";
import { loadProductDefs } from "@/server/products";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: mn.admin.nav.import };

export default async function ImportPage({ searchParams }: PageProps<"/admin/import">) {
  const { kind } = await searchParams;
  const kinds = allKinds(await loadProductDefs(db));
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div>
        <h1 className="text-[40px] leading-none font-semibold">{mn.admin.import.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{mn.admin.import.intro}</p>
      </div>
      <ImportForm
        initialKind={typeof kind === "string" ? kind : undefined}
        kinds={kinds.map((k) => ({
          kind: k.kind,
          label: k.label,
          file: k.file,
          columns: k.columns.map((c) => c.name),
        }))}
      />
    </div>
  );
}
