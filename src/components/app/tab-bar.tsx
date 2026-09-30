"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";

/**
 * Mobile navigation: a floating pill. The active tab shows its label, the others are icons.
 * Hidden from `lg`, where the sidebar takes over.
 */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Үндсэн цэс"
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-40 mx-auto max-w-md lg:hidden"
    >
      <ul className="flex h-(--tabbar-h) items-center justify-between rounded-full bg-nav p-2 shadow-lg shadow-black/10">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={cn(
                  "flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors",
                  active ? "bg-nav-active px-5 text-nav-active-fg" : "w-13 text-nav-fg",
                )}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 1.9 : 1.6} aria-hidden />
                {active && <span>{label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
