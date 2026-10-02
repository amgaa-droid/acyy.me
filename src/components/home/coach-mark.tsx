"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pointer } from "lucide-react";
import type { CSSProperties } from "react";

import { coachCaptionSide, rimLine, type Body } from "@/lib/planet-system";
import { cn } from "@/lib/utils";

type CoachMarkProps = {
  /** The planet (or button) the guide points at. */
  target: Body;
  /** For "drag it here": where the ghost glides to (me); it gets a softer spotlight too. */
  to?: Body;
  ghost?: { uri: string; tint: string };
  title: string;
  subtitle: string;
  skipLabel: string;
  onSkip: () => void;
  w: number;
  h: number;
};

/** Spotlight hole: soft-edged, a little wider than the target. */
const hole = (b: Body, pad: number) =>
  `radial-gradient(circle at ${b.x}px ${b.y}px, transparent ${b.r + pad}px, black ${b.r + pad + 28}px)`;

/**
 * A first-run guide over the planet system: the screen dims except a soft spotlight on the
 * target, a dashed ring turns round it and a caption beside it says what to do. It never blocks
 * the screen — the target stays tappable/draggable through it.
 */
export function CoachMark({ target, to, ghost, title, subtitle, skipLabel, onSkip, w, h }: CoachMarkProps) {
  const pad = 22;
  const ring = target.r + pad;
  const masks = [hole(target, pad), ...(to ? [hole(to, 10)] : [])];
  const side = coachCaptionSide(target, w, h);
  const gap = ring + 18;
  const maxW = Math.min(280, w - 32);

  const caption: CSSProperties =
    side === "left"
      ? { right: w - (target.x - gap), top: target.y, maxWidth: Math.min(maxW, target.x - gap - 16) }
      : side === "right"
        ? { left: target.x + gap, top: target.y, maxWidth: Math.min(maxW, w - target.x - gap - 16) }
        : side === "above"
          ? { left: Math.min(w - 16 - maxW / 2, Math.max(16 + maxW / 2, target.x)), bottom: h - (target.y - gap), maxWidth: maxW }
          : { left: Math.min(w - 16 - maxW / 2, Math.max(16 + maxW / 2, target.x)), top: target.y + gap + 28, maxWidth: maxW };
  const Arrow = { left: ArrowRight, right: ArrowLeft, above: ArrowDown, below: ArrowUp }[side];
  const path = to ? rimLine(target, to) : null;

  return (
    <>
      {/* Dim everything but the spotlight(s); clicks pass through. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[45] animate-in bg-[color-mix(in_oklab,var(--highlight)_42%,transparent)] duration-700 fade-in-0 dark:bg-black/55"
        style={{
          maskImage: masks.join(", "),
          WebkitMaskImage: masks.join(", "),
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        }}
      />

      {/* A dashed ring turning round the target, breathing a little. */}
      <div
        aria-hidden
        className="pointer-events-none absolute z-[46] -translate-1/2 motion-safe:animate-breathe"
        style={{ left: target.x, top: target.y, width: ring * 2, height: ring * 2 }}
      >
        <span className="block size-full animate-in rounded-full border-[3px] border-dashed border-white duration-700 zoom-in-50 fade-in-0 motion-safe:animate-coach-spin dark:border-highlight" />
      </div>

      {/* "Drag it onto yourself": a ghost of the planet glides along a dashed path to me. */}
      {to && ghost && path && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute z-[46] planet-line planet-line-ghost opacity-70 motion-safe:animate-line-flow"
            style={{ left: path.x, top: path.y - 1.5, width: path.length, transform: `rotate(${path.angle}deg)` }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute z-[47] -translate-1/2"
            style={{ left: target.x, top: target.y, width: target.r * 1.7, height: target.r * 1.7 }}
          >
            <div
              className="relative size-full motion-safe:animate-coach-drag"
              style={{ "--coach-dx": `${to.x - target.x}px`, "--coach-dy": `${to.y - target.y}px` } as CSSProperties}
            >
              <span
                className={cn(
                  "block size-full overflow-hidden rounded-full border-[3px] border-surface opacity-85 shadow-[0_12px_30px_rgb(0_0_0/0.25)] dark:bg-nav",
                  ghost.tint,
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local data URI */}
                <img src={ghost.uri} alt="" className="size-full" />
              </span>
              <Pointer className="absolute -right-2 -bottom-3 size-7 fill-surface text-fg drop-shadow" strokeWidth={1.6} />
            </div>
          </div>
        </>
      )}

      {/* What to do: a card beside the target, its arrow pointing at it. */}
      <div
        role="status"
        className={cn(
          "pointer-events-none absolute z-[47] flex w-max animate-in items-center gap-3 rounded-3xl bg-surface py-3 shadow-[0_14px_40px_rgb(0_0_0/0.18)] duration-500 [animation-delay:300ms] [animation-fill-mode:both] fade-in-0 zoom-in-90",
          side === "left" || side === "right" ? "-translate-y-1/2" : "-translate-x-1/2 flex-col text-center",
          side === "right" ? "pr-4 pl-3" : side === "left" ? "pr-3 pl-4" : "px-4",
        )}
        style={caption}
      >
        {(side === "right" || side === "below") && <ArrowBadge Arrow={Arrow} />}
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-[15px] leading-tight font-semibold lg:text-lg">{title}</p>
          <p className="text-xs leading-snug text-muted-foreground">{subtitle}</p>
        </div>
        {(side === "left" || side === "above") && <ArrowBadge Arrow={Arrow} />}
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="absolute bottom-[max(env(safe-area-inset-bottom),1rem)] left-1/2 z-[47] flex h-11 -translate-x-1/2 animate-in items-center rounded-full bg-surface/90 px-5 text-sm font-semibold text-muted-foreground shadow-[0_6px_18px_rgb(0_0_0/0.1)] duration-500 [animation-delay:700ms] [animation-fill-mode:both] fade-in-0 lg:bottom-8"
      >
        {skipLabel}
      </button>
    </>
  );
}

function ArrowBadge({ Arrow }: { Arrow: typeof ArrowRight }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tint-1 text-highlight">
      <Arrow className="size-4.5 motion-safe:animate-pulse" aria-hidden />
    </span>
  );
}
