import { count, sql } from "drizzle-orm";
import type { Metadata } from "next";

import { mn } from "@/i18n/mn";
import { requireOwner } from "@/server/admin/guard";
import { db } from "@/server/db";
import { topups } from "@/server/db/schema";
import { listPackages } from "@/server/topup-packages";
import { PackageCard, NewPackage } from "./package-form";

export const metadata: Metadata = { title: mn.admin.nav.packages };

const t = mn.admin.packages;

/** Owner only: the top-up packages the wallet sheet offers (SPEC §4.1). */
export default async function PackagesPage() {
  await requireOwner();
  const [packages, sales] = await Promise.all([
    listPackages(db),
    db
      .select({
        packageId: topups.packageId,
        all: count(),
        paid: sql<number>`count(*) filter (where ${topups.status} = 'paid')`.mapWith(Number),
      })
      .from(topups)
      .groupBy(topups.packageId),
  ]);
  const sold = new Map(sales.map((s) => [s.packageId, s]));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-4xl leading-none font-semibold">{t.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t.intro}</p>
      </div>
      <NewPackage nextSort={Math.max(0, ...packages.map((p) => p.sort)) + 1} />
      {packages.length === 0 ? (
        <p className="rounded-3xl bg-surface p-5 text-sm font-semibold text-destructive">
          {t.empty}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {packages.map((p) => (
            <li key={p.id}>
              <PackageCard
                pkg={p}
                sold={sold.get(p.id)?.paid ?? 0}
                locked={(sold.get(p.id)?.all ?? 0) > 0}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
