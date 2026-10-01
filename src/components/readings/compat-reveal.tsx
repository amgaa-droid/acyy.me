"use client";

import { Sparkle } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { FeaturedCard } from "@/components/readings/featured-card";
import { mn } from "@/i18n/mn";
import { playReveal } from "@/lib/sound";

type Phase = "idle" | "show" | "fly" | "done";

const TARGET = '[data-reveal-target="compat"]';
/** Timeline (ms from the start): names → card emerges from "&" → letters → sparkles → fly down. */
const EMERGE_AT = 900;
const EMERGE_MS = 1000;
const LETTER_START_MS = 1700;
const LETTER_STEP_MS = 75;
const HOLD_MS = 1800;
const FLY_MS = 1000;

/**
 * The overlay's essentials are also set inline (with fallback colours): a stylesheet cached from
 * before these classes/tokens existed (seen after hot reloads) would otherwise leave it unpositioned
 * under the home popup — invisible, with the real card hidden.
 */
const SCRIM = "var(--scrim, #07061a)";
const SCRIM_FG = "var(--scrim-fg, #eeebfb)";

const SKY = [
  [8, 14], [22, 78], [15, 42], [34, 8], [30, 92], [52, 18], [60, 86], [72, 30],
  [80, 70], [88, 12], [92, 52], [44, 64], [66, 4], [10, 60], [84, 92],
] as const;

const BURST = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2;
  const r = i % 2 ? 160 : 120;
  return { dx: `${Math.round(Math.cos(a) * r)}px`, dy: `${Math.round(Math.sin(a) * r * 0.7)}px`, i };
});

function shouldPlay(purchaseId: string): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (!document.querySelector(TARGET)) return false;
  try {
    const key = `reveal:${purchaseId}`;
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}

/** Centre of an element's box, in viewport pixels. */
const centre = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/**
 * The first time a pair reading is opened on this device, its "Тохиромжтой харилцаа" is revealed
 * like a secret: the page dims, the two names appear, the card is born out of the "&" between them,
 * the answer resolves letter by letter with a chime and a burst of sparkles, then the card flies
 * down onto its place in the summary. Tap to skip. Off with reduced motion.
 */
export function CompatReveal({
  purchaseId,
  names,
  label,
  items,
}: {
  purchaseId: string;
  names: [string, string];
  label: string;
  items: string[];
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [card, setCard] = useState({ width: 0, zoom: 1 });
  const decided = useRef<boolean | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const ampRef = useRef<HTMLSpanElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);

  const text = items.join(" · ");
  const lettersDoneMs = LETTER_START_MS + Array.from(text).length * LETTER_STEP_MS + 600;

  // Decide once (StrictMode runs mount effects twice; localStorage is written on the first run).
  useEffect(() => {
    if (decided.current !== null) return;
    decided.current = shouldPlay(purchaseId);
    if (!decided.current) return;
    const target = document.querySelector<HTMLElement>(TARGET)!;
    target.scrollIntoView({ block: "nearest" });
    const width = target.offsetWidth;
    // Bigger than its place while centre stage, but never wider than the screen.
    setCard({ width, zoom: Math.min(1.15, (window.innerWidth - 24) / width) });
    setPhase("show");
  }, [purchaseId]);

  // The card grows out of the "&" between the two names, with a chime. The real one waits hidden.
  useEffect(() => {
    if (phase !== "show") return;
    document.querySelector<HTMLElement>(TARGET)?.style.setProperty("visibility", "hidden");
    const el = cardRef.current;
    const amp = ampRef.current;
    if (!el || !amp) return;
    const from = centre(amp.getBoundingClientRect());
    const to = centre(el.getBoundingClientRect());
    const z = card.zoom;
    const emerge = el.animate(
      [
        {
          transform: `translate(${from.x - to.x}px, ${from.y - to.y}px) scale(0.04)`,
          opacity: 0,
          filter: "blur(6px)",
        },
        { opacity: 1, offset: 0.35 },
        { transform: `translate(0, 0) scale(${z})`, opacity: 1, filter: "blur(0)" },
      ],
      { duration: EMERGE_MS, delay: EMERGE_AT, easing: "cubic-bezier(0.2, 0.9, 0.25, 1.15)", fill: "both" },
    );
    const chime = setTimeout(playReveal, EMERGE_AT);
    const next = setTimeout(() => setPhase("fly"), lettersDoneMs + HOLD_MS);
    return () => {
      clearTimeout(chime);
      clearTimeout(next);
      if (emerge.playState === "running") emerge.finish();
    };
  }, [phase, card.zoom, lettersDoneMs]);

  // Fly down onto the real card, then hand over to it.
  useEffect(() => {
    if (phase !== "fly") return;
    const target = document.querySelector<HTMLElement>(TARGET);
    const el = cardRef.current;
    const land = () => {
      if (target) {
        target.style.visibility = "";
        target.classList.add("animate-land-glow");
      }
      setPhase("done");
    };
    if (!target || !el) return land();
    el.getAnimations().forEach((a) => a.finish());
    const from = el.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const dx = centre(to).x - centre(from).x;
    const dy = centre(to).y - centre(from).y;
    const z = card.zoom;
    const s = (to.width / from.width) * z;
    const opts = { duration: FLY_MS, easing: "cubic-bezier(0.65, 0, 0.25, 1)", fill: "forwards" } as const;
    const fly = el.animate(
      [
        { transform: `translate(0, 0) scale(${z})` },
        { transform: `translate(0, -16px) scale(${z * 1.03})`, offset: 0.18 },
        { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
      ],
      opts,
    );
    backdropRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], opts);
    chromeRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { ...opts, duration: 300 });
    fly.onfinish = land;
    // Belt and braces: never leave the real card hidden if `finish` doesn't arrive.
    const fallback = setTimeout(land, FLY_MS + 800);
    return () => {
      clearTimeout(fallback);
      fly.cancel();
    };
  }, [phase, card.zoom]);

  // Leaving the page mid-reveal must not leave the real card hidden.
  useEffect(
    () => () => {
      const target = document.querySelector<HTMLElement>(TARGET);
      if (target) target.style.visibility = "";
    },
    [],
  );

  if (phase === "idle" || phase === "done") return null;

  // Words stay unbroken; each letter lands on its own beat.
  const words = text.split(" ").reduce<{ word: string; start: number }[]>((acc, word) => {
    const prev = acc.at(-1);
    acc.push({ word, start: prev ? prev.start + Array.from(prev.word).length + 1 : 0 });
    return acc;
  }, []);
  const value = words.map(({ word, start }, w) => (
    <Fragment key={w}>
      {w > 0 && " "}
      <span className="inline-block whitespace-nowrap">
        {Array.from(word).map((ch, i) => (
          <span
            key={i}
            className="inline-block animate-reveal-letter"
            style={{ animationDelay: `${LETTER_START_MS + (start + i) * LETTER_STEP_MS}ms` }}
          >
            {ch}
          </span>
        ))}
      </span>
    </Fragment>
  ));

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: SCRIM_FG,
      }}
      onClick={() => phase === "show" && setPhase("fly")}
      role="status"
      aria-label={`${mn.reading.revealEyebrow} ${label}: ${text}`}
    >
      <div
        ref={backdropRef}
        aria-hidden
        className="absolute inset-0 animate-reveal-fade bg-scrim/85 backdrop-blur-md"
        style={{
          position: "absolute",
          inset: 0,
          background: `color-mix(in oklab, ${SCRIM} 85%, transparent)`,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {SKY.map(([top, left], i) => (
          <span
            key={i}
            className="absolute size-[3px] animate-twinkle rounded-full bg-scrim-fg"
            style={{
              top: `${top}%`,
              left: `${left}%`,
              background: SCRIM_FG,
              animationDelay: `${(i % 5) * 0.5}s`,
            }}
          />
        ))}
      </div>

      <div className="relative flex w-full flex-col items-center gap-9">
        <div
          ref={chromeRef}
          aria-hidden
          className="flex flex-col items-center gap-2 px-4 text-center text-scrim-fg"
        >
          <p className="flex items-center gap-3 font-serif text-[32px] leading-none font-semibold lg:text-[40px]">
            <span className="animate-reveal-fade" style={{ animationDelay: "200ms" }}>
              {names[0]}
            </span>
            <span ref={ampRef} className="relative animate-pop-in" style={{ animationDelay: "500ms" }}>
              <span className="absolute inset-[-70%] animate-reveal-glow rounded-full bg-highlight/70 blur-xl" />
              <span className="relative">&amp;</span>
            </span>
            <span className="animate-reveal-fade" style={{ animationDelay: "350ms" }}>
              {names[1]}
            </span>
          </p>
          <p
            className="animate-reveal-fade text-[11px] font-semibold tracking-[0.2em] uppercase opacity-70"
            style={{ animationDelay: "600ms" }}
          >
            {mn.reading.revealEyebrow}
          </p>
        </div>

        <div className="relative" style={{ width: card.width }}>
          <span
            aria-hidden
            className="absolute inset-[-25%] -z-10 animate-reveal-fade rounded-full"
            style={{ animationDelay: `${EMERGE_AT}ms` }}
          >
            <span className="absolute inset-0 animate-reveal-glow rounded-full bg-highlight/50 blur-3xl" />
          </span>
          {BURST.map((b) => (
            <span
              key={b.i}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-1/2 z-10 -mt-2 -ml-2 animate-sparkle-burst text-scrim-fg"
              style={
                {
                  opacity: 0,
                  "--dx": b.dx,
                  "--dy": b.dy,
                  animationDelay: `${lettersDoneMs - 400 + (b.i % 4) * 50}ms`,
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
          <FeaturedCard
            ref={cardRef}
            label={label}
            value={value}
            className="shadow-[0_30px_80px_rgb(0_0_0/0.35)]"
            style={{ opacity: 0 }}
          />
        </div>

        <p
          className="animate-reveal-fade text-xs text-scrim-fg/60"
          style={{ animationDelay: `${lettersDoneMs}ms` }}
        >
          {mn.reading.revealSkip}
        </p>
      </div>
    </div>,
    document.body,
  );
}
