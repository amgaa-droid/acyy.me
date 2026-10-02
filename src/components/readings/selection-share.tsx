"use client";

import { Share2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ShareSheet } from "@/components/readings/share-card-button";
import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";

/** Shorter selections (a stray word) don't offer sharing. */
const MIN_CHARS = 10;
/** Sent to the card endpoint, which shows less (EXCERPT_MAX) — keeps the URL short. */
const MAX_CHARS = 600;
const BUTTON = 44;

type Pick = { text: string; top: number; left: number };

/**
 * Selecting text of the reading shows a small share button at the selection; pressing it opens
 * the share sheet with a card of that text (SPEC §8). The card endpoint only accepts text that
 * is in the reading, so nothing here is trusted.
 */
export function SelectionShare({
  purchaseId,
  className,
  children,
}: {
  purchaseId: string;
  className?: string;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  /** While the button is being pressed the selection may collapse (touch) — keep the pick. */
  const pressing = useRef(false);
  const [pick, setPick] = useState<Pick | null>(null);
  const [sheet, setSheet] = useState({ open: false, quote: "" });

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
            document.getSelection()?.removeAllRanges();
          }}
        >
          <Share2 className="size-[18px]" aria-hidden />
        </button>
      )}
      <ShareSheet
        purchaseId={purchaseId}
        quote={sheet.quote}
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
      />
    </div>
  );
}
