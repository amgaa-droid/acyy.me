/** Page links for long lists: first, last, the current page's neighbours, gaps in between. */
export type PageItem = number | "gap";

/**
 * 1 … 5 [6] 7 … 130. Up to `2 * around + 5` pages are shown in full; a gap never hides a
 * single page (it shows that page instead).
 */
export function pageWindow(page: number, pages: number, around = 1): PageItem[] {
  if (pages <= 2 * around + 5) return Array.from({ length: pages }, (_, i) => i + 1);
  const from = Math.max(2, page - around);
  const to = Math.min(pages - 1, page + around);
  const items: PageItem[] = [1];
  if (from === 3) items.push(2);
  else if (from > 3) items.push("gap");
  for (let p = from; p <= to; p++) items.push(p);
  if (to === pages - 2) items.push(pages - 1);
  else if (to < pages - 2) items.push("gap");
  items.push(pages);
  return items;
}

/** A requested page number clamped into 1..pages (garbage → 1). */
export function clampPage(raw: unknown, pages: number): number {
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), Math.max(pages, 1)) : 1;
}
