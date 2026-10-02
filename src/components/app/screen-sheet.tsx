"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { SHEET } from "@/components/app/route-modal";
import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";

/** The sheet's name for a detail screen — the same names the home popups use. */
export function screenLabel(pathname: string): string {
  if (pathname === "/people/new") return mn.people.newTitle;
  if (pathname.startsWith("/people")) return mn.people.title;
  if (pathname.startsWith("/me")) return mn.me.title;
  if (pathname.startsWith("/wallet")) return mn.header.wallet;
  return mn.readings.title;
}

/**
 * A detail screen opened directly (a shared link, a refresh, QPay's return): the same sheet as
 * the home popups (`RouteModal`), over the planet system. Rendered in place rather than in a
 * portal so the screen is in the server HTML (first paint, a 404's status); the planets behind
 * are `inert`. There is no home behind it in history, so closing goes to home.
 */
export function ScreenSheet({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // A sheet opened inside the screen (a confirm, a picker) closes first.
      if (document.querySelectorAll('[role="dialog"]').length > 1) return;
      router.push("/home", { scroll: false });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <>
      <div
        aria-hidden
        onClick={() => router.push("/home", { scroll: false })}
        className={cn(SHEET.backdrop, "animate-in fade-in-0")}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={screenLabel(pathname)}
        className={cn(SHEET.popup, "animate-in duration-500 slide-in-from-bottom")}
      >
        <Link href="/home" scroll={false} aria-label={mn.common.close} className={SHEET.close}>
          <X className="size-5" aria-hidden />
        </Link>
        <div className={SHEET.body}>{children}</div>
      </section>
    </>
  );
}
