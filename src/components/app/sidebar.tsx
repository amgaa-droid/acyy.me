"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMark } from "@/components/app/brand-mark";
import { TopUpSheet } from "@/components/app/top-up-sheet";
import { formatMnt, mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";

/** Desktop navigation (from `lg`): a floating panel with logo, primary nav and wallet card. */
export function Sidebar({ appName, balance }: { appName: string; balance: number }) {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 hidden h-dvh shrink-0 p-4 pr-0 lg:block">
      <aside className="flex h-full w-60 flex-col gap-8 rounded-[28px] bg-nav px-3.5 py-6 text-nav-active">
        <Link href="/home" className="flex items-center gap-2.5 px-2.5">
          <BrandMark className="size-6 text-nav-fg" />
          <span className="font-heading text-[30px] font-semibold">{appName}</span>
        </Link>

        <nav aria-label="Үндсэн цэс" className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-12 items-center gap-3 rounded-full px-4 text-[15px] transition-colors",
                  active
                    ? "bg-nav-active font-semibold text-nav-active-fg"
                    : "text-nav-fg hover:bg-nav-active/10",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 1.8 : 1.6} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3 rounded-[22px] bg-nav-active/10 p-4">
          <span className="text-xs text-nav-fg">{mn.header.wallet}</span>
          <span className="text-[28px] leading-none font-semibold tabular-nums">
            {formatMnt(balance)}
          </span>
          <TopUpSheet
            trigger={
              <button
                type="button"
                className="h-11 rounded-full bg-nav-active text-sm font-semibold text-nav-active-fg"
              >
                {mn.header.topUp}
              </button>
            }
          />
        </div>
      </aside>
    </div>
  );
}
