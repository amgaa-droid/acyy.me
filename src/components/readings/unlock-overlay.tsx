"use client";

import { Lock, LockOpen, Sparkle } from "lucide-react";
import { createPortal } from "react-dom";

import { mn } from "@/i18n/mn";

export type UnlockState = "pending" | "done" | null;

const BURST = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  const r = i % 2 ? 150 : 110;
  return { dx: `${Math.round(Math.cos(a) * r)}px`, dy: `${Math.round(Math.sin(a) * r)}px`, i };
});

/**
 * Full-screen "unlocking" moment while a purchase goes through: a lock wobbles inside a spinning
 * ring, then springs open with a flash and a burst of sparkles (the chime is played by the caller).
 */
export function UnlockOverlay({ state }: { state: UnlockState }) {
  if (!state) return null;
  const done = state === "done";
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[70] flex animate-reveal-fade flex-col items-center justify-center gap-7 bg-scrim/80 backdrop-blur-md"
      // Also inline (with fallbacks): a stylesheet cached before these classes existed must not
      // leave it unpositioned and see-through.
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        color: "var(--scrim-fg, #eeebfb)",
        background: "color-mix(in oklab, var(--scrim, #07061a) 80%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div className="relative flex size-44 items-center justify-center">
        <span
          aria-hidden
          className="absolute inset-0 animate-reveal-glow rounded-full bg-highlight/60 blur-2xl"
        />
        <span
          aria-hidden
          className="absolute inset-3 animate-[orbit-spin_5s_linear_infinite] rounded-full border-2 border-dashed border-scrim-fg/40"
        />
        {done && (
          <>
            <span aria-hidden className="absolute inset-6 animate-flash rounded-full bg-scrim-fg" />
            {BURST.map((b) => (
              <span
                key={b.i}
                aria-hidden
                className="absolute top-1/2 left-1/2 -mt-2 -ml-2 animate-sparkle-burst text-scrim-fg"
                style={
                  {
                    opacity: 0,
                    "--dx": b.dx,
                    "--dy": b.dy,
                    animationDelay: `${(b.i % 4) * 50}ms`,
                  } as React.CSSProperties
                }
              >
                {b.i % 3 ? (
                  <span className="block size-1.5 rounded-full bg-current" />
                ) : (
                  <Sparkle className="size-4 fill-current" />
                )}
              </span>
            ))}
          </>
        )}
        <span className="relative flex size-24 items-center justify-center rounded-full bg-highlight text-highlight-fg shadow-[0_20px_50px_rgb(0_0_0/0.3)]">
          {done ? (
            <LockOpen className="size-10 animate-unlock-pop" aria-hidden />
          ) : (
            <Lock className="size-10 animate-lock-wobble" aria-hidden />
          )}
        </span>
      </div>
      <p key={state} className="animate-reveal-fade font-serif text-[32px] font-semibold text-scrim-fg">
        {done ? mn.buy.unlocked : mn.buy.unlocking}
      </p>
    </div>,
    document.body,
  );
}
