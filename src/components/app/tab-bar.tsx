"use client";

import { CircleUser, House, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/home", label: mn.tabs.home, Icon: House },
  { href: "/people", label: mn.tabs.people, Icon: Users },
  { href: "/readings", label: mn.tabs.readings, Icon: Sparkles },
  { href: "/me", label: mn.tabs.me, Icon: CircleUser },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Үндсэн цэс"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid h-(--tabbar-h) max-w-md grid-cols-4">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] transition-colors",
                  active ? "text-fg" : "text-muted-foreground",
                )}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2 : 1.5} aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
