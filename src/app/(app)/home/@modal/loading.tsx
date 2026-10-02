import { Loader2 } from "lucide-react";

import { mn } from "@/i18n/mn";

/**
 * While a popup's screen is on its way: a small pill, so a tap is answered at once. Not a
 * sheet of its own — the real one slides up when its content arrives (two sheets in a row
 * would slide twice). It fades in late, so a quick load shows nothing at all.
 */
export default function PopupLoading() {
  return (
    <div
      role="status"
      className="fixed bottom-[max(env(safe-area-inset-bottom),1.25rem)] left-1/2 z-50 flex h-11 -translate-x-1/2 animate-in items-center gap-2.5 rounded-full bg-fg pr-5 pl-4 text-sm font-semibold text-bg shadow-[0_6px_18px_rgb(0_0_0/0.25)] delay-200 duration-300 fill-mode-both fade-in-0 lg:bottom-8"
    >
      <Loader2 className="size-4.5 motion-safe:animate-spin" aria-hidden />
      {mn.common.loading}
    </div>
  );
}
