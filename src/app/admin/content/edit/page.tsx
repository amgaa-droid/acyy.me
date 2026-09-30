import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { mn } from "@/i18n/mn";
import { CONTENT_SECTIONS, PRODUCT_CODES } from "@/lib/domain";
import { displayKey } from "@/lib/content-keys-display";
import { getContentEntry } from "@/server/admin/content";
import { loadAstroRefs } from "@/server/astro/refs";
import { db } from "@/server/db";
import { ContentForm } from "./content-form";

export const metadata: Metadata = { title: mn.admin.content.editTitle };

const newSchema = z.object({
  product: z.enum(PRODUCT_CODES),
  section: z.enum(CONTENT_SECTIONS),
  key: z.string().min(1).max(20),
});

export default async function EditContentPage({ searchParams }: PageProps<"/admin/content/edit">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const entry = sp.id ? await getContentEntry(db, one(sp.id)!) : null;
  if (sp.id && !entry) notFound();
  const target = entry
    ? { product: entry.productCode, section: entry.section, key: entry.key }
    : newSchema.safeParse({ product: one(sp.product), section: one(sp.section), key: one(sp.key) })
        .data;
  if (!target) notFound();

  const refs = await loadAstroRefs(db);
  const names = Object.fromEntries(refs.signs.map((s) => [s.code, s.nameMn]));
  const t = mn.admin;

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link
        href={`/admin/content?product=${target.product}&section=${target.section}`}
        className="flex h-11 items-center gap-1 self-start rounded-full bg-surface pr-4 pl-2 text-sm font-semibold"
      >
        <ChevronLeft className="size-5" aria-hidden /> {t.nav.content}
      </Link>
      <div>
        <p className="text-sm text-muted-foreground">
          {t.products[target.product]}
          {target.section !== "main" && ` · ${t.sections[target.section]}`}
        </p>
        <h1 className="text-[40px] leading-none font-semibold">{displayKey(target.key, names)}</h1>
      </div>
      <ContentForm
        target={target as { product: string; section: string; key: string }}
        initial={
          entry
            ? { title: entry.title, body: entry.body, score: entry.score, status: entry.status }
            : { title: "", body: "", score: null, status: "published" }
        }
        showScore={target.section !== "main"}
      />
    </div>
  );
}
