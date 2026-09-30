"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMark } from "@/components/app/brand-mark";
import { TopUpSheet } from "@/components/app/top-up-sheet";
import { Button } from "@/components/ui/button";
import { formatMnt, mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";

/** Desktop navigation (from `lg`): logo, primary nav, wallet card. */
export function Sidebar({ appName, balance }: { appName: string; balance: number }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-62 shrink-0 flex-col gap-8 border-r px-4 py-7 lg:flex">
      <Link href="/home" className="flex items-center gap-2.5 px-2">
        <BrandMark className="size-6" />
        <span className="font-heading text-[28px] font-semibold">{appName}</span>
      </Link>

      <nav aria-label="Үндсэн цэс" className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] transition-colors hover:bg-subtle",
                active ? "bg-subtle font-semibold text-fg" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 1.8 : 1.5} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{mn.header.wallet}</span>
          <span className="text-2xl font-semibold tabular-nums">{formatMnt(balance)}</span>
        </div>
        <TopUpSheet trigger={<Button>{mn.header.topUp}</Button>} />
      </div>
    </aside>
  );
}
