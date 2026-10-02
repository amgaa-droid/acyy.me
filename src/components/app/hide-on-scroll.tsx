"use client";

import { useEffect, useRef, useState } from "react";

import { scrollStep } from "@/lib/scroll-hide";
import { cn } from "@/lib/utils";

/**
 * Wraps a floating control that slides away while the page scrolls down and comes back on
 * scrolling up or near the top. Keyboard focus inside brings it back too.
 */
export function HideOnScroll({ className, children }: { className?: string; children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const state = useRef({ hidden: false, anchor: 0 });

  useEffect(() => {
    state.current = { hidden: false, anchor: window.scrollY };
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        state.current = scrollStep(state.current.anchor, window.scrollY, state.current.hidden);
        setHidden(state.current.hidden);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      className={cn(
        "transition-[translate,opacity] duration-300 ease-out motion-reduce:transition-none",
        hidden && "pointer-events-none -translate-y-[calc(100%+1.5rem)] opacity-0",
        className,
      )}
      onFocusCapture={() => {
        state.current = { hidden: false, anchor: window.scrollY };
        setHidden(false);
      }}
    >
      {children}
    </div>
  );
}
