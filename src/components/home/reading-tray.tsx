"use client";

import { X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";

const t = mn.home.planets;
const SPRING = "ease-[cubic-bezier(.2,.9,.25,1.3)]";

export type TrayTile = {
  key: string;
  href: string;
  label: string;
  aria: string;
  icon: ReactNode;
  /** "info": the person's page; "on": a bought reading; "off": not bought yet. */
  kind: "info" | "on" | "off";
  onClick?: () => void;
  /** First-run guide: a halo and a tip on this tile. */
  tip?: { title: string; sub: string };
};

/**
 * The tapped planet's readings, in a tray at the bottom of the screen (thumb reach) instead of
 * buttons scattered round the planet: the orbit stays calm, every name is readable, and more
 * readings only add tiles. One row of up to six; more wrap.
 */
export function ReadingTray({
  name,
  sub,
  avatarUri,
  faceClass,
  tiles,
  frame,
  onClose,
}: {
  /** Shared with the "+N" dock: the gap to the bottom of the screen and the width (px). */
  frame: { bottom: number; width: number };
  name: string;
  sub: string;
  avatarUri: string;
  faceClass: string;
  tiles: TrayTile[];
  onClose: () => void;
}) {
  const cols = Math.min(tiles.length, 6);
  return (
    <section
      aria-label={t.trayAria(name)}
      className="absolute z-40 flex animate-rise-in flex-col gap-3.5 rounded-3xl bg-surface px-3.5 pt-3.5 pb-4 shadow-[0_-8px_40px_rgb(0_0_0/0.16)]"
      // Centred with left, not translate: the rise-in animation owns translate.
      style={{ bottom: frame.bottom, width: frame.width, left: `calc(50% - ${frame.width / 2}px)` }}
    >
      <div className="flex items-center gap-3">
        <span className={cn("size-[42px] shrink-0 overflow-hidden rounded-full border-2", faceClass)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URI */}
          <img src={avatarUri} alt="" draggable={false} className="size-full" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base leading-tight font-semibold">{name}</span>
          <span className="truncate text-xs text-muted-foreground">{sub}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={mn.common.close}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-subtle text-fg"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <ul className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {tiles.map((tile, i) => {
          // A tip on an edge tile is pinned to that edge so it stays on screen.
          const col = i % cols;
          const edge = col < cols / 3 ? "start" : col >= (cols * 2) / 3 ? "end" : "center";
          return (
            <li key={tile.key} className="relative">
              <Link
                href={tile.href}
                scroll={false}
                onClick={tile.onClick}
                aria-label={tile.aria}
                className="group/r flex animate-pop-in flex-col items-center gap-1.5 rounded-2xl py-1 outline-offset-2"
                style={{ animationDelay: `${0.04 + i * 0.035}s` }}
              >
                <span
                  className={cn(
                    `relative flex size-12 items-center justify-center rounded-full border-[1.5px] transition-[scale] duration-300 ${SPRING} group-hover/r:scale-110 group-active/r:scale-95`,
                    tile.kind === "info" && "border-fg bg-fg text-bg",
                    tile.kind === "on" && "border-highlight bg-highlight text-highlight-fg",
                    tile.kind === "off" && "border-highlight/30 bg-surface text-highlight",
                  )}
                >
                  {tile.tip && (
                    <span aria-hidden className="absolute inset-0 rounded-full motion-safe:animate-guide-halo" />
                  )}
                  {tile.icon}
                </span>
                <span className="line-clamp-2 h-[2.4em] text-center text-xs leading-[1.2] font-semibold">
                  {tile.label}
                </span>
              </Link>
              {tile.tip && <TileTip tip={tile.tip} edge={edge} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The guide's dark bubble, above a tile, its tail on the tile's middle. */
function TileTip({ tip, edge }: { tip: { title: string; sub: string }; edge: "start" | "center" | "end" }) {
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-none absolute bottom-[calc(100%+10px)] z-10 w-max max-w-[240px] animate-rise-in",
        edge === "start" && "-left-1",
        edge === "center" && "left-1/2 -translate-x-1/2",
        edge === "end" && "-right-1",
      )}
    >
      <div className="relative rounded-xl bg-fg px-4 py-2.5 text-bg shadow-[0_14px_34px_rgb(0_0_0/0.28)] motion-safe:animate-guide-bob">
        <p className="text-base leading-tight font-semibold">{tip.title}</p>
        <p className="mt-0.5 text-xs leading-snug opacity-75">{tip.sub}</p>
        <span
          aria-hidden
          className={cn(
            "absolute -bottom-1.5 size-3.5 rotate-45 rounded-[3px] bg-fg",
            edge === "start" && "left-[calc(min(50%,2.25rem)-7px)]",
            edge === "center" && "left-1/2 -translate-x-1/2",
            edge === "end" && "right-[calc(min(50%,2.25rem)-7px)]",
          )}
        />
      </div>
    </div>
  );
}
