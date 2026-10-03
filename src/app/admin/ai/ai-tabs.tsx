"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";

const t = mn.admin.ai.tabs;

const TABS = [
  { href: "/admin/ai", label: t.general },
  { href: "/admin/ai/assistant", label: t.assistant },
  { href: "/admin/ai/knowledge", label: t.knowledge },
  { href: "/admin/ai/history", label: t.history },
];

/** The AI settings' sections: keys + translation, the help assistant, its knowledge, its log. */
export function AiTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label={mn.admin.ai.title}
      className="-mx-4 scrollbar-none flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0"
    >
      {TABS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-surface hover:ring-2 hover:ring-border",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Title, intro and tabs shared by the four AI pages. */
export function AiHeader({ intro }: { intro: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-4xl leading-none font-semibold">{mn.admin.ai.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{intro}</p>
      </div>
      <AiTabs />
    </div>
  );
}
