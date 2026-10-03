import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { mn } from "@/i18n/mn";
import { pageWindow } from "@/lib/pagination";
import { cn } from "@/lib/utils";

const t = mn.admin.pagination;

/**
 * Pager for admin lists. Links keep the list's other query params (`params`); the jump box is a
 * plain GET form, so it works without JavaScript. Phones get ‹ 6 / 130 › + the jump box; wider
 * screens also get the page numbers (1 … 5 6 7 … 130).
 */
export function Pagination({
  basePath,
  params,
  page,
  pages,
  total,
  pageSize,
}: {
  basePath: string;
  /** Other query params to keep (sort, search…), without `page`. */
  params: Record<string, string>;
  page: number;
  pages: number;
  total: number;
  pageSize: number;
}) {
  const href = (p: number) => {
    const sp = new URLSearchParams(params);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const item =
    "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold";

  return (
    <nav
      aria-label={t.label}
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-muted-foreground tabular-nums">
        {t.range(
          from.toLocaleString("en-US"),
          to.toLocaleString("en-US"),
          total.toLocaleString("en-US"),
        )}
      </p>
      {pages > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <PageStep href={page > 1 ? href(page - 1) : null} label={t.prev}>
              <ChevronLeft className="size-5" aria-hidden />
            </PageStep>
            <span className="px-2 text-sm font-semibold tabular-nums sm:hidden">
              {t.pageOf(page, pages)}
            </span>
            <ol className="hidden items-center gap-1 sm:flex">
              {pageWindow(page, pages).map((p, i) =>
                p === "gap" ? (
                  <li
                    key={`gap-${i}`}
                    aria-hidden
                    className="w-6 text-center text-muted-foreground"
                  >
                    …
                  </li>
                ) : (
                  <li key={p}>
                    <Link
                      href={href(p)}
                      aria-label={t.page(p)}
                      aria-current={p === page ? "page" : undefined}
                      className={cn(
                        item,
                        "min-w-11 px-2 tabular-nums",
                        p === page
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface hover:ring-2 hover:ring-border",
                      )}
                    >
                      {p.toLocaleString("en-US")}
                    </Link>
                  </li>
                ),
              )}
            </ol>
            <PageStep href={page < pages ? href(page + 1) : null} label={t.next}>
              <ChevronRight className="size-5" aria-hidden />
            </PageStep>
          </div>
          <form action={basePath} className="flex items-center gap-1.5">
            {Object.entries(params).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="whitespace-nowrap">{t.jump}</span>
              <input
                name="page"
                type="number"
                inputMode="numeric"
                min={1}
                max={pages}
                defaultValue={page}
                className="h-11 w-20 rounded-full bg-surface px-3 text-center text-sm text-fg tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <button
              type="submit"
              className="h-11 rounded-full bg-surface px-4 text-sm font-semibold hover:ring-2 hover:ring-border"
            >
              {t.go}
            </button>
          </form>
        </div>
      )}
    </nav>
  );
}

function PageStep({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: React.ReactNode;
}) {
  const cls = "flex size-11 shrink-0 items-center justify-center rounded-full bg-surface";
  return href ? (
    <Link href={href} aria-label={label} className={cn(cls, "hover:ring-2 hover:ring-border")}>
      {children}
    </Link>
  ) : (
    <span aria-label={label} aria-disabled="true" className={cn(cls, "opacity-40")}>
      {children}
    </span>
  );
}
