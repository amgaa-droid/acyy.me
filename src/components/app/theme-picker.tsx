import { Check } from "lucide-react";

import { setTheme } from "@/app/actions/theme";
import { mn } from "@/i18n/mn";
import { THEMES, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

// Fixed preview swatches (ground, tint, ink) so each option shows its own colours.
const SWATCHES: Record<Theme, [string, string, string]> = {
  cosmic: ["#f5f1eb", "#e6e3fb", "#1d1b3f"],
  "cosmic-dark": ["#111027", "#2b2862", "#eeebfb"],
  white: ["#f5f5f5", "#ffffff", "#0a0a0a"],
};

/** Colour mode choice. A plain form + server action, so it works without JS. */
export function ThemePicker({ current }: { current: Theme }) {
  return (
    <form action={setTheme} className="grid grid-cols-3 gap-2.5 lg:gap-3">
      {THEMES.map((theme) => {
        const selected = theme === current;
        const [ground, tint, ink] = SWATCHES[theme];
        return (
          <button
            key={theme}
            type="submit"
            name="theme"
            value={theme}
            aria-pressed={selected}
            className={cn(
              "flex flex-col gap-2.5 rounded-3xl bg-surface p-2.5 text-left ring-2 transition-shadow lg:gap-3 lg:p-3",
              selected ? "ring-highlight" : "ring-transparent hover:ring-border",
            )}
          >
            <span
              className="relative flex h-16 items-end gap-1.5 overflow-hidden rounded-2xl p-2 lg:h-20 lg:p-2.5"
              style={{ background: ground }}
            >
              <span className="h-10 flex-1 rounded-xl" style={{ background: tint }} />
              <span className="h-6 w-8 rounded-full lg:w-10" style={{ background: ink }} />
            </span>
            <span className="flex items-start justify-between gap-1 px-1">
              <span className="flex min-w-0 flex-col">
                <span className="text-sm leading-tight font-semibold lg:text-base">
                  {mn.themes[theme].name}
                </span>
                <span className="mt-0.5 text-[11px] leading-snug text-muted-foreground lg:text-xs">
                  {mn.themes[theme].description}
                </span>
              </span>
              {selected && <Check className="size-4 shrink-0 text-highlight lg:size-5" aria-hidden />}
            </span>
          </button>
        );
      })}
    </form>
  );
}
