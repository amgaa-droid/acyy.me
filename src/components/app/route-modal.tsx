"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { useCloseAllModals } from "@/components/app/modal-scope";
import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";

/**
 * A detail screen opened from the home planet system: it slides up as a sheet over the planets
 * (full width on phones, a wide centred sheet on desktop). Closing goes back to home through
 * history (every popup opened on the way closes too); the browser back button steps back one.
 */
/** The sheet's look, shared with the server-rendered one for direct links (`screen-sheet.tsx`). */
export const SHEET = {
  backdrop: "fixed inset-0 z-50 bg-fg/30 supports-backdrop-filter:backdrop-blur-[2px]",
  popup:
    "fixed inset-x-0 top-[max(env(safe-area-inset-top),2.5rem)] bottom-0 z-50 flex flex-col overflow-hidden rounded-t-3xl bg-bg shadow-[0_-20px_60px_rgb(0_0_0/0.18)] outline-none lg:top-10 lg:left-1/2 lg:w-[min(64rem,calc(100%-4rem))] lg:-translate-x-1/2 lg:rounded-t-4xl",
  close:
    "absolute top-3 right-3 z-10 flex size-11 items-center justify-center rounded-full bg-surface shadow-[0_4px_14px_rgb(0_0_0/0.08)] lg:top-5 lg:right-5",
  // `scroll-pt` matches `pt`: moving to another screen inside the sheet scrolls its top into
  // view, and without it the content would stop right under the close button.
  body: "flex-1 scroll-pt-16 overflow-y-auto overscroll-contain px-4 pt-16 pb-[calc(env(safe-area-inset-bottom)+2rem)] lg:scroll-pt-10 lg:px-10 lg:pt-10 lg:pb-12",
};

export function RouteModal({ label, children }: { label: string; children: ReactNode }) {
  const router = useRouter();
  const closeAll = useCloseAllModals();

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (open) return;
        if (closeAll) closeAll();
        else router.back();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className={cn(SHEET.backdrop, "data-open:animate-in data-open:fade-in-0")} />
        <DialogPrimitive.Popup
          aria-label={label}
          className={cn(
            SHEET.popup,
            "data-open:animate-in data-open:duration-500 data-open:slide-in-from-bottom",
          )}
        >
          <DialogPrimitive.Close
            aria-label={mn.common.close}
            className={SHEET.close}
          >
            <X className="size-5" aria-hidden />
          </DialogPrimitive.Close>
          <div className={SHEET.body}>
            {children}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
