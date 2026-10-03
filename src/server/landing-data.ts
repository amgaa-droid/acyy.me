import { loadAstroRefs } from "@/server/astro/refs";
import { listActiveProducts } from "@/server/catalog";
import { db } from "@/server/db";
import { getPublishedLanding } from "@/server/landing-cms";
import { landingDaily } from "@/server/landing-daily";
import { listActivePackages } from "@/server/topup-packages";
import { ttlCache } from "@/server/ttl-cache";

/**
 * Everything the signed-out landing page reads, loaded once per 30 s per web process. Pages with
 * a CSP nonce must render per request (no ISR), so caching the ~8 queries is what keeps a traffic
 * spike off the database. Publishing in /admin/landing clears this process's copy at once; the
 * other process catches up within 30 s. Today's daily teaser may lag midnight by as much.
 */
export const landingData = ttlCache(30_000, async () => {
  const [published, products, packages, refs] = await Promise.all([
    getPublishedLanding(db),
    listActiveProducts(db),
    listActivePackages(db),
    loadAstroRefs(db),
  ]);
  return {
    content: published.content,
    products,
    packages,
    refs,
    daily: await landingDaily(db, refs),
  };
});
