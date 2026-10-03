"use client";

import { Check, Share2 } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { markOnboardingAction } from "@/app/actions/onboarding";
import { ShareSheet } from "@/components/readings/share-card-button";
import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";

/** Shorter selections (a stray word) don't offer sharing. */
const MIN_CHARS = 10;
/** Sent to the card endpoint, which shows less (EXCERPT_MAX) — keeps the URL short. */
const MAX_CHARS = 600;
const BUTTON = 44;

type Pick = { text: string; top: number; left: number };
type Box = { top: number; left: number; width: number; height: number };
/** The tip's example line: where it is in the reading, and its boxes relative to the root. */
type Line = { range: Range; boxes: Box[] };

const tt = mn.share.tip;

/** The first sentence (20–220 characters) of a paragraph, else its first ~160 characters. */
function firstSentence(text: string): string {
  const m = text.match(/^[\s\S]{20,220}?[.!?…](?=\s|$)/);
  if (m) return m[0];
  const cut = text.slice(0, 160);
  return text.length > 160 ? cut.slice(0, cut.lastIndexOf(" ")) : cut;
}

/** A range over the first `length` characters of `el` (after leading whitespace), across nodes. */
function rangeOver(el: Element, length: number): Range | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let seen = 0;
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.nodeValue ?? "";
    if (!started) {
      const lead = value.search(/\S/);
      if (lead < 0) continue;
      range.setStart(node, lead);
      started = true;
      seen = -lead;
    }
    if (seen + value.length >= length) {
      range.setEnd(node, length - seen);
      return range;
    }
    seen += value.length;
  }
  return null;
}

/**
 * Selecting text of the reading shows a small share button at the selection; pressing it opens
 * the share sheet with a card of that text (SPEC §8). The card endpoint only accepts text that
 * is in the reading, so nothing here is trusted.
 */
export function SelectionShare({
  purchaseId,
  tip = false,
  className,
  children,
}: {
  purchaseId: string;
  /** Teach it once (first reading): an example line lights up, a hand selects it, a bubble says why. */
  tip?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  /** While the button is being pressed the selection may collapse (touch) — keep the pick. */
  const pressing = useRef(false);
  const [pick, setPick] = useState<Pick | null>(null);
  const [sheet, setSheet] = useState({ open: false, quote: "" });
  /** "off" → "on" (example lit up; once a selection offers the button, it points there) → "done". */
  const [tipStage, setTipStage] = useState<"off" | "on" | "done">("off");
  const [line, setLine] = useState<Line | null>(null);
  const tipOn = tipStage === "on";
  const stage = tipOn ? (pick ? "button" : "line") : tipStage;

  /** Shared during the tip: cheer once the share sheet is closed again (it covers the screen). */
  const cheerOnClose = useRef(false);
  const finish = (shared: boolean) => {
    setTipStage("off");
    cheerOnClose.current = shared;
    void markOnboardingAction("share");
  };

  // Once the reader gets to the text (an example paragraph scrolled well into view, after a
  // moment), light up its first sentence.
  useEffect(() => {
    const host = root.current;
    if (!tip || !host) return;
    const para = [...host.querySelectorAll("p")].find(
      (p) => (p.textContent ?? "").trim().length >= 60,
    );
    if (!para) return;
    const measure = () => {
      const range = rangeOver(para, firstSentence((para.textContent ?? "").trim()).length);
      if (!range) return null;
      const frame = host.getBoundingClientRect();
      const boxes = [...range.getClientRects()]
        .filter((r) => r.width > 2)
        .map((r) => ({
          top: r.top - frame.top,
          left: r.left - frame.left,
          width: r.width,
          height: r.height,
        }));
      return boxes.length ? { range, boxes } : null;
    };
    // Checked on every scroll (the popup scrolls, not the window) and on a slow tick, so a
    // paragraph already on screen when the reading opens counts too.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let shown = false;
    const check = () => {
      if (shown) return;
      const r = para.getBoundingClientRect();
      const inView = r.top >= 0 && r.top < window.innerHeight * 0.7 && r.bottom > 0;
      if (!inView) {
        clearTimeout(timer);
        timer = undefined;
        return;
      }
      timer ??= setTimeout(() => {
        const found = measure();
        if (!found) return;
        shown = true;
        setLine(found);
        setTipStage((s) => (s === "off" ? "on" : s));
      }, 1200);
    };
    const tick = setInterval(check, 500);
    document.addEventListener("scroll", check, { capture: true, passive: true });
    const onResize = () => setLine((l) => (l ? (measure() ?? l) : l));
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      clearInterval(tick);
      document.removeEventListener("scroll", check, { capture: true });
      window.removeEventListener("resize", onResize);
    };
  }, [tip]);

  // The cheer goes away by itself.
  useEffect(() => {
    if (tipStage !== "done") return;
    const id = setTimeout(() => setTipStage("off"), 3200);
    return () => clearTimeout(id);
  }, [tipStage]);

  const selectLine = () => {
    if (!line) return;
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(line.range.cloneRange());
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const read = () => {
      if (pressing.current) return;
      const host = root.current;
      const selection = document.getSelection();
      if (!host || !selection || selection.isCollapsed || selection.rangeCount === 0) {
        return setPick(null);
      }
      const range = selection.getRangeAt(0);
      const text = selection.toString().trim();
      if (
        !host.contains(range.commonAncestorContainer) ||
        text.replace(/\s/g, "").length < MIN_CHARS
      ) {
        return setPick(null);
      }
      const box = range.getBoundingClientRect();
      const frame = host.getBoundingClientRect();
      // A mouse selection gets the button above it. On touch the system menu sits there, so it
      // goes below, clear of the selection handles — also when the top is scrolled out of view.
      const touch = window.matchMedia("(pointer: coarse)").matches;
      const above = !touch && box.top > BUTTON + 24;
      const top = above ? box.top - BUTTON - 10 : box.bottom + (touch ? 30 : 10);
      const center = box.left + box.width / 2 - frame.left;
      setPick({
        text: text.slice(0, MAX_CHARS),
        top: top - frame.top,
        left: Math.min(Math.max(center, BUTTON / 2), frame.width - BUTTON / 2),
      });
    };
    // selectionchange fires for every step of a drag; show the button once it settles.
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(read, 250);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
    };
  }, []);

  return (
    <div ref={root} className={cn("relative", className)}>
      {children}
      {stage === "line" && line && (
        <LineTip line={line} onSelect={selectLine} onDismiss={() => finish(false)} />
      )}
      {stage === "button" && pick && (
        <Bubble
          style={{ top: pick.top - 12, left: pick.left }}
          className="-translate-x-1/2 -translate-y-full"
          title={tt.press}
          onDismiss={() => finish(false)}
        />
      )}
      {stage === "done" && (
        <div
          role="status"
          className="fixed bottom-[max(env(safe-area-inset-bottom),1.25rem)] left-1/2 z-50 flex -translate-x-1/2 animate-pop-in items-center gap-2.5 rounded-full bg-fg py-2.5 pr-5 pl-2.5 text-sm font-semibold whitespace-nowrap text-bg shadow-[0_14px_34px_rgb(0_0_0/0.3)]"
        >
          <span className="flex size-7.5 items-center justify-center rounded-full bg-pair text-pair-fg">
            <Check className="size-4" strokeWidth={3} aria-hidden />
          </span>
          {tt.done}
        </div>
      )}
      {pick && (
        <button
          type="button"
          aria-label={mn.share.selection}
          title={mn.share.selection}
          style={{ top: pick.top, left: pick.left }}
          className="absolute z-20 flex size-11 -translate-x-1/2 animate-in items-center justify-center rounded-full bg-fg text-bg shadow-[0_6px_18px_rgb(0_0_0/0.25)] duration-150 fade-in-0 select-none zoom-in-90"
          // Keeps the mouse selection (and its highlight) while the button is pressed.
          onPointerDown={(e) => {
            e.preventDefault();
            pressing.current = true;
          }}
          onPointerCancel={() => (pressing.current = false)}
          onPointerLeave={() => (pressing.current = false)}
          onClick={() => {
            pressing.current = false;
            setSheet({ open: true, quote: pick.text });
            setPick(null);
            if (tipOn) finish(true);
            document.getSelection()?.removeAllRanges();
          }}
        >
          <Share2 className="size-4.5" aria-hidden />
        </button>
      )}
      <ShareSheet
        purchaseId={purchaseId}
        quote={sheet.quote}
        open={sheet.open}
        onOpenChange={(open) => {
          setSheet((s) => ({ ...s, open }));
          if (!open && cheerOnClose.current) {
            cheerOnClose.current = false;
            setTipStage("done");
          }
        }}
      />
    </div>
  );
}

/** The example line lit up, a hand sweeping across it, and the tip above it. */
function LineTip({
  line,
  onSelect,
  onDismiss,
}: {
  line: Line;
  onSelect: () => void;
  onDismiss: () => void;
}) {
  const first = line.boxes[0];
  const last = line.boxes[line.boxes.length - 1];
  return (
    <>
      {line.boxes.map((b, i) => (
        <button
          key={i}
          type="button"
          aria-label={i === 0 ? tt.line : undefined}
          aria-hidden={i === 0 ? undefined : true}
          tabIndex={i === 0 ? 0 : -1}
          onClick={onSelect}
          className="absolute z-10 animate-in rounded-md bg-highlight/20 ring-2 ring-highlight/40 duration-500 fade-in-0 motion-safe:animate-pulse"
          style={{ top: b.top - 2, left: b.left - 3, width: b.width + 6, height: b.height + 4 }}
        />
      ))}
      <svg
        aria-hidden
        className="pointer-events-none absolute z-20 size-8 drop-shadow motion-safe:animate-share-sweep"
        style={
          {
            top: first.top + first.height - 6,
            left: first.left - 8,
            "--sweep-x": `${last.left + last.width - first.left}px`,
            "--sweep-y": `${last.top - first.top}px`,
          } as CSSProperties
        }
        viewBox="0 0 24 24"
        fill="var(--surface)"
        stroke="var(--fg)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      >
        <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0 0V4.5a1.5 1.5 0 0 1 3 0V10m0 0V6.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5a6 6 0 0 1-4.6-2.2L3.6 15.4a1.6 1.6 0 0 1 2.5-2l1.9 2V11" />
      </svg>
      <Bubble
        style={{ top: first.top - 12, left: Math.max(first.left, 0) }}
        className="-translate-y-full"
        title={tt.title}
        sub={tt.sub}
        onDismiss={onDismiss}
      />
    </>
  );
}

/** The guide's dark bubble (as on home), with "Ойлголоо". */
function Bubble({
  title,
  sub,
  style,
  className,
  onDismiss,
}: {
  title: string;
  sub?: string;
  style: CSSProperties;
  className?: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className={cn("absolute z-30 w-max max-w-[min(300px,100%)] min-w-[220px] animate-rise-in", className)}
      style={style}
    >
      <div className="flex items-start gap-3 rounded-[20px] bg-fg py-2.5 pr-2 pl-4 text-bg shadow-[0_14px_34px_rgb(0_0_0/0.28)] motion-safe:animate-guide-bob">
        <div className="flex flex-col">
          <p className="text-[15px] leading-tight font-semibold">{title}</p>
          {sub && <p className="mt-0.5 text-xs leading-snug opacity-75">{sub}</p>}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="-my-0.5 shrink-0 rounded-full bg-bg/15 px-3 py-1.5 text-xs font-semibold"
        >
          {tt.ok}
        </button>
      </div>
    </div>
  );
}
