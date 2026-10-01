import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { mn } from "@/i18n/mn";
import { displayKey } from "@/lib/content-keys-display";
import { cn } from "@/lib/utils";
import { PAGE_SIZE, listContent, listQuerySchema, missingKeys } from "@/server/admin/content";
import { loadAstroRefs } from "@/server/astro/refs";
import { db } from "@/server/db";
import { activeParts, loadProductDefs } from "@/server/products";

export const metadata: Metadata = { title: mn.admin.nav.content };

const t = mn.admin;

export default async function AdminContentPage({ searchParams }: PageProps<"/admin/content">) {
  const raw = await searchParams;
  const parsed = listQuerySchema.safeParse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const query = parsed.success ? parsed.data : listQuerySchema.parse({});

  const [refs, defs] = await Promise.all([loadAstroRefs(db), loadProductDefs(db)]);
  const product = defs.find((p) => p.code === query.product) ?? defs[0];
  if (!product) return <p className="text-muted-foreground">{t.content.noProducts}</p>;
  const parts = activeParts(product);
  const part = parts.find((p) => p.code === query.section) ?? parts[0];
  const q = { ...query, product: product.code, section: part?.code ?? "" };

  const [{ items, total }, missing] = await Promise.all([
    listContent(db, q),
    part ? missingKeys(db, part) : [],
  ]);
  const names = Object.fromEntries(refs.signs.map((s) => [s.code, s.nameMn]));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (patch: Partial<typeof q>) => {
    const next = { ...q, ...patch };
    const p = new URLSearchParams({ product: next.product, section: next.section });
    if (next.q) p.set("q", next.q);
    if (next.status !== "all") p.set("status", next.status);
    if (next.page > 1) p.set("page", String(next.page));
    return `/admin/content?${p}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[40px] leading-none font-semibold">{t.nav.content}</h1>

      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        {defs.map((p) => (
          <Chip
            key={p.code}
            href={href({ product: p.code, section: activeParts(p)[0]?.code ?? "", page: 1, q: "" })}
            active={p.code === q.product}
          >
            {p.nameMn}
          </Chip>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {parts.length > 1 && (
          <div className="flex gap-2">
            {parts.map((s) => (
              <Chip
                key={s.code}
                href={href({ section: s.code, page: 1 })}
                active={s.code === q.section}
              >
                {s.nameMn}
              </Chip>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          {(["all", "published", "draft"] as const).map((s) => (
            <Chip key={s} href={href({ status: s, page: 1 })} active={s === q.status}>
              {t.status[s]}
            </Chip>
          ))}
        </div>
        <form action="/admin/content" className="flex flex-1 items-center gap-2 lg:max-w-md">
          <input type="hidden" name="product" value={q.product} />
          <input type="hidden" name="section" value={q.section} />
          {q.status !== "all" && <input type="hidden" name="status" value={q.status} />}
          <label className="relative flex-1">
            <span className="sr-only">{t.content.search}</span>
            <Search
              className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              name="q"
              defaultValue={q.q}
              placeholder={t.content.search}
              className="h-11 w-full rounded-full bg-surface pr-4 pl-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </form>
      </div>

      <div className="overflow-hidden rounded-3xl bg-surface">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-3 font-medium">{t.content.key}</th>
              <th className="px-4 py-3 font-medium">{t.content.titleCol}</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">{t.content.scoreCol}</th>
              <th className="px-4 py-3 font-medium">{t.content.statusCol}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b last:border-0 hover:bg-subtle">
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  <Link
                    href={`/admin/content/edit?id=${i.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {displayKey(i.key, names, part?.keyType)}
                  </Link>
                </td>
                <td className="max-w-0 truncate px-4 py-3 text-muted-foreground lg:max-w-md">
                  {i.title}
                </td>
                <td className="hidden px-4 py-3 tabular-nums sm:table-cell">{i.score ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold",
                      i.status === "published" ? "bg-tint-1 text-highlight" : "bg-tint-2",
                    )}
                  >
                    {t.status[i.status]}
                  </span>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  {t.content.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t.content.total(total)}</span>
        <div className="flex gap-2">
          {q.page > 1 && <Chip href={href({ page: q.page - 1 })}>{t.content.prev}</Chip>}
          <span className="flex h-11 items-center px-2 tabular-nums">
            {q.page} / {pages}
          </span>
          {q.page < pages && <Chip href={href({ page: q.page + 1 })}>{t.content.next}</Chip>}
        </div>
      </div>

      {missing.length > 0 && (
        <details className="rounded-3xl bg-surface p-5">
          <summary className="cursor-pointer font-semibold">
            {t.content.missingTitle(missing.length)}
          </summary>
          <div className="mt-4 flex flex-wrap gap-2">
            {missing.slice(0, 400).map((k) => (
              <Link
                key={k}
                href={`/admin/content/edit?product=${q.product}&section=${q.section}&key=${encodeURIComponent(k)}`}
                className="flex h-9 items-center gap-1 rounded-full bg-subtle px-3 text-xs font-medium hover:ring-2 hover:ring-border"
              >
                <Plus className="size-3.5" aria-hidden />
                {displayKey(k, names, part?.keyType)}
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap",
        active ? "bg-primary text-primary-foreground" : "bg-surface hover:ring-2 hover:ring-border",
      )}
    >
      {children}
    </Link>
  );
}
