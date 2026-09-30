"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/** Mobile bottom CTA back to the reveal form — shown only while the form is off-screen. */
export function StickyCta({ targetId, label }: { targetId: string; label: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting));
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] transition duration-300 lg:hidden",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
    >
      <a
        href={`#${targetId}`}
        className="flex h-13 items-center justify-center gap-2 rounded-full bg-fg px-6 text-base font-semibold text-bg"
      >
        {label} <ArrowRight className="size-4.5" aria-hidden />
      </a>
    </div>
  );
}
