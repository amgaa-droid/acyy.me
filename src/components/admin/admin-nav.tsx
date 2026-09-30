"use client";

import {
  ArrowLeft,
  FileSpreadsheet,
  LayoutDashboard,
  Orbit,
  Package,
  Receipt,
  Sparkles,
  Text,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";

const t = mn.admin.nav;

const ITEMS = [
  { href: "/admin", label: t.dashboard, Icon: LayoutDashboard, owner: false, exact: true },
  { href: "/admin/content", label: t.content, Icon: Text, owner: false },
  { href: "/admin/import", label: t.import, Icon: FileSpreadsheet, owner: false },
  { href: "/admin/zodiac", label: t.zodiac, Icon: Sparkles, owner: false },
  { href: "/admin/periods", label: t.periods, Icon: Orbit, owner: false },
  { href: "/admin/products", label: t.products, Icon: Package, owner: true },
  { href: "/admin/users", label: t.users, Icon: Users, owner: true },
  { href: "/admin/topups", label: t.topups, Icon: Receipt, owner: true },
];

/** Admin navigation: sidebar on desktop, horizontal scroller on mobile. Owner-only items hidden for Editors. */
export function AdminNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => isOwner || !i.owner);

  return (
    <nav aria-label={mn.admin.title} className="flex gap-1 lg:flex-col">
      {items.map(({ href, label, Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 shrink-0 items-center gap-2.5 rounded-full px-4 text-sm whitespace-nowrap transition-colors",
              active
                ? "bg-nav-active font-semibold text-nav-active-fg"
                : "text-nav-fg hover:bg-nav-active/10",
            )}
          >
            <Icon className="size-4.5" aria-hidden />
            {label}
          </Link>
        );
      })}
      <Link
        href="/home"
        className="flex h-11 shrink-0 items-center gap-2.5 rounded-full px-4 text-sm whitespace-nowrap text-nav-fg hover:bg-nav-active/10 lg:mt-6"
      >
        <ArrowLeft className="size-4.5" aria-hidden />
        {mn.admin.backToApp}
      </Link>
    </nav>
  );
}
