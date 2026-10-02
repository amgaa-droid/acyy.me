"use client";

import { Check, Plus } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { mn } from "@/i18n/mn";
import { rimLine, type Body } from "@/lib/planet-system";
import { cn } from "@/lib/utils";
import type { GuideStep } from "@/lib/onboarding";

const g = mn.home.planets.guide;
const SPRING = "ease-[cubic-bezier(.2,.9,.25,1.3)]";
const STEPS: GuideStep[] = ["self", "add", "link"];

/**
 * First-run guide pieces for the home planet system (see src/server/onboarding.ts). One thing
 * at a time, next to what it's about, never covering the screen: the user learns by doing.
 */

/** "Эхлэх · 1/3" under the top bar; opens the three steps. Turns orange once all are done. */
export function GuidePill({
  done,
  current,
  ready,
  open,
  onToggle,
}: {
  done: Record<GuideStep, boolean>;
  current: GuideStep | null;
  ready: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const count = STEPS.filter((s) => done[s]).length;
  return (
    <div className="absolute top-[calc(max(env(safe-area-inset-top),1rem)+56px)] left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-2 lg:top-24">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={g.pillAria(count)}
        className={cn(
          "flex h-10 animate-pop-in items-center gap-2 rounded-full pr-4 pl-3 text-[13px] font-semibold whitespace-nowrap shadow-[0_6px_18px_rgb(0_0_0/0.12)] transition-colors duration-500",
          ready ? "bg-pair text-pair-fg" : "bg-surface text-fg",
        )}
      >
        <span className="flex gap-1">
          {STEPS.map((s) => (
            <span
              key={s}
              className={cn(
                "size-2 rounded-full transition-colors duration-500",
                done[s] ? (ready ? "bg-pair-fg" : "bg-pair") : current === s ? "bg-fg" : "bg-border",
              )}
            />
          ))}
        </span>
        {ready ? g.ready : g.pill(count)}
      </button>
      {open && (
        <ol className="flex w-[300px] animate-pop-in flex-col gap-1.5 rounded-3xl bg-surface p-3 shadow-[0_18px_50px_rgb(0_0_0/0.18)]">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={cn("flex items-center gap-3 rounded-2xl p-2", current === s && "bg-subtle")}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
                  done[s] ? "bg-pair text-pair-fg" : current === s ? "bg-fg text-bg" : "bg-tint-1 text-highlight",
                )}
              >
                {done[s] ? <Check className="size-4" strokeWidth={3} aria-hidden /> : i + 1}
              </span>
              <span className="flex flex-col">
                <span className={cn("text-sm font-semibold", done[s] && "text-muted-foreground line-through")}>
                  {g.steps[s].title}
                </span>
                <span className="text-xs text-muted-foreground">{g.steps[s].sub}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * A dark speech bubble about a target: above it (tail down at `top`) when there's room under the
 * top bar, otherwise below it (tail up at `bottom`). Kept on screen; the tail still points at x.
 */
export function GuideTip({
  x,
  top,
  bottom,
  w,
  title,
  sub,
}: {
  x: number;
  /** The target's top edge — the tail tip when the bubble sits above. */
  top: number;
  /** Below the target (and its name) — the tail tip when the bubble sits below. */
  bottom: number;
  w: number;
  title: string;
  sub: string;
}) {
  const half = 125;
  const left = Math.min(w - 12 - half, Math.max(12 + half, x));
  const above = top - 8 - 64 > 132;
  const tail = Math.max(-100, Math.min(100, x - left));
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-none absolute z-[38] w-max max-w-[250px] -translate-x-1/2 animate-rise-in",
        above && "-translate-y-full",
      )}
      style={{ left, top: above ? top - 8 : bottom + 8 }}
    >
      <div className="relative rounded-[20px] bg-fg px-4 py-2.5 text-bg shadow-[0_14px_34px_rgb(0_0_0/0.28)] motion-safe:animate-guide-bob">
        <p className="text-[15px] leading-tight font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-snug opacity-75">{sub}</p>
        <span
          aria-hidden
          className={cn(
            "absolute size-3.5 -translate-x-1/2 rotate-45 rounded-[3px] bg-fg",
            above ? "-bottom-1.5" : "-top-1.5",
          )}
          style={{ left: `calc(50% + ${tail}px)` }}
        />
      </div>
    </div>
  );
}

/** A short, warm welcome at the bottom — not a slideshow. */
export function WelcomeCard({
  name,
  onStart,
  onLater,
}: {
  name: string;
  onStart: () => void;
  onLater: () => void;
}) {
  return (
    <section
      aria-label={g.welcome.title}
      className="absolute inset-x-4 bottom-[max(env(safe-area-inset-bottom),1.25rem)] z-[39] mx-auto flex max-w-md animate-rise-in flex-col gap-4 rounded-[32px] bg-surface px-5 pt-5.5 pb-4.5 shadow-[0_-10px_40px_rgb(0_0_0/0.14)] lg:bottom-8"
    >
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold tracking-[0.14em] text-highlight uppercase">
          {g.welcome.eyebrow(name)}
        </span>
        <h2 className="text-[30px] leading-[1.05] font-semibold">{g.welcome.title}</h2>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{g.welcome.body}</p>
      </div>
      <ol className="flex flex-col gap-1.5">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-3 text-sm font-medium">
            <span className="flex size-6.5 items-center justify-center rounded-full bg-tint-1 text-xs font-bold text-highlight">
              {i + 1}
            </span>
            {g.steps[s].title}
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onLater}
          className="h-13 rounded-full bg-subtle px-5 text-[15px] font-semibold text-muted-foreground"
        >
          {g.welcome.later}
        </button>
        <button
          type="button"
          onClick={onStart}
          className="h-13 flex-1 rounded-full bg-fg text-base font-semibold text-bg"
        >
          {g.welcome.start}
        </button>
      </div>
    </section>
  );
}

/** "Add someone": a dashed ghost planet where a real one will be; opens the add flow preset. */
export function GhostPlanet({
  body,
  label,
  relation,
  index,
}: {
  body: Body;
  label: string;
  relation: string;
  index: number;
}) {
  return (
    <div
      className="absolute z-[12] -translate-1/2 animate-rise-in"
      style={{ left: body.x, top: body.y, width: body.r * 2, height: body.r * 2, animationDelay: `${index * 0.12}s` }}
    >
      <div className={cn("size-full", index % 2 ? "motion-safe:animate-drift-b" : "motion-safe:animate-drift-a")}>
        <Link
          href={`/people/new?${new URLSearchParams({ relation, next: "/home" })}`}
          scroll={false}
          aria-label={g.ghostAria(label)}
          className="group/g relative flex size-full items-center justify-center"
        >
          <span
            className={`flex size-full items-center justify-center rounded-full border-2 border-dashed border-highlight bg-surface/45 text-highlight transition-[scale] duration-500 ${SPRING} group-hover/g:scale-108`}
          >
            <Plus className="size-[36%]" aria-hidden />
          </span>
          <span className="pointer-events-none absolute top-full left-1/2 mt-1.5 -translate-x-1/2 text-[13px] font-semibold whitespace-nowrap text-highlight">
            {label}
          </span>
        </Link>
      </div>
    </div>
  );
}

/** "Drag me onto yourself": a ghost of the planet with a hand glides along a dashed path. */
export function DragHint({ from, to, avatarUri, tint }: { from: Body; to: Body; avatarUri: string; tint: string }) {
  const path = rimLine(from, to);
  const size = from.r * 1.5;
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute z-[11] planet-line planet-line-ghost opacity-70 motion-safe:animate-line-flow"
        style={{ left: path.x, top: path.y - 1.5, width: path.length, transform: `rotate(${path.angle}deg)` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute z-[37] -translate-1/2"
        style={{ left: from.x, top: from.y, width: size, height: size }}
      >
        <div
          className="relative size-full motion-safe:animate-guide-drag"
          style={{ "--guide-dx": `${to.x - from.x}px`, "--guide-dy": `${to.y - from.y}px` } as CSSProperties}
        >
          <span
            className={cn(
              "block size-full overflow-hidden rounded-full border-[3px] border-surface opacity-80 shadow-[0_12px_30px_rgb(0_0_0/0.25)] dark:bg-face",
              tint,
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URI */}
            <img src={avatarUri} alt="" className="size-full" />
          </span>
          <svg
            className="absolute -right-2.5 -bottom-3.5 size-8 drop-shadow"
            viewBox="0 0 24 24"
            fill="var(--surface)"
            stroke="var(--fg)"
            strokeWidth="1.6"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0 0V4.5a1.5 1.5 0 0 1 3 0V10m0 0V6.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5a6 6 0 0 1-4.6-2.2L3.6 15.4a1.6 1.6 0 0 1 2.5-2l1.9 2V11" />
          </svg>
        </div>
      </div>
    </>
  );
}

/** A little burst of stars where a pair just opened. */
export function Burst({ x, y }: { x: number; y: number }) {
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <span
            key={i}
            aria-hidden
            className={cn(
              "pointer-events-none absolute z-[38] -translate-1/2 rounded-full motion-safe:animate-guide-burst",
              i % 3 === 0 ? "bg-highlight" : "bg-pair",
              i % 2 ? "size-1.5" : "size-2",
            )}
            style={
              {
                left: x,
                top: y,
                "--burst-x": `${Math.cos(a) * 52}px`,
                "--burst-y": `${Math.sin(a) * 52}px`,
                animationDelay: `${(i % 3) * 0.04}s`,
              } as CSSProperties
            }
          />
        );
      })}
    </>
  );
}

/** "Өөрийгөө нээлээ · 1/3" — a short cheer after each step. */
export function GuideToast({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="absolute bottom-[max(env(safe-area-inset-bottom),1.25rem)] left-1/2 z-[45] flex -translate-x-1/2 animate-pop-in items-center gap-2.5 rounded-full bg-fg py-2.5 pr-5 pl-2.5 whitespace-nowrap text-bg shadow-[0_14px_34px_rgb(0_0_0/0.3)] lg:bottom-8"
    >
      <span className="flex size-7.5 items-center justify-center rounded-full bg-pair text-pair-fg">
        <Check className="size-4" strokeWidth={3} aria-hidden />
      </span>
      <span className="text-sm font-semibold">{text}</span>
    </div>
  );
}
