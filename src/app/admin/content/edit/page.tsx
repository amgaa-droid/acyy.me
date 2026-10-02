import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { mn } from "@/i18n/mn";
import { displayKey } from "@/lib/content-keys-display";
import { KEY_TYPE_ARITY } from "@/lib/domain";
import { getContentEntry } from "@/server/admin/content";
import { requireAdmin } from "@/server/admin/guard";
import { loadAstroRefs } from "@/server/astro/refs";
import { db } from "@/server/db";
import { activeFields, loadProductDef } from "@/server/products";
import { ContentForm } from "./content-form";

export const metadata: Metadata = { title: mn.admin.content.editTitle };

const newSchema = z.object({
  product: z.string().min(1).max(32),
  section: z.string().min(1).max(32),
  key: z.string().min(1).max(40),
});

export default async function EditContentPage({ searchParams }: PageProps<"/admin/content/edit">) {
  await requireAdmin();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const entry = sp.id ? await getContentEntry(db, one(sp.id)!) : null;
  if (sp.id && !entry) notFound();
  const target = entry
    ? { product: entry.productCode, section: entry.section, key: entry.key }
    : newSchema.safeParse({ product: one(sp.product), section: one(sp.section), key: one(sp.key) })
        .data;
  if (!target) notFound();
  const product = await loadProductDef(db, target.product);
  const part = product?.parts.find((p) => p.code === target.section && p.archivedAt === null);
  if (!product || !part) notFound();

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
          {product.nameMn}
          {product.parts.length > 1 && ` · ${part.nameMn}`}
        </p>
        <h1 className="text-4xl leading-none font-semibold">
          {displayKey(target.key, names, part.keyType)}
        </h1>
      </div>
      <ContentForm
        target={target}
        fields={activeFields(part).map((f) => ({
          code: f.code,
          name: f.nameMn,
          kind: f.kind,
          isFree: f.isFree,
          required: f.required,
        }))}
        initial={
          entry
            ? {
                title: entry.title,
                fields: entry.fields,
                teaser: entry.teaser ?? "",
                score: entry.score,
                status: entry.status,
              }
            : { title: "", fields: {}, teaser: "", score: null, status: "published" }
        }
        showScore={KEY_TYPE_ARITY[part.keyType] === 2 || entry?.score != null}
      />
    </div>
  );
}
