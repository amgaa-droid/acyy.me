import { Check } from "lucide-react";

import { setTheme } from "@/app/actions/theme";
import { mn } from "@/i18n/mn";
import { THEMES, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

// The tile inside each preview: a pastel in the cosmic modes, a white card in the white one.
const SWATCH_TILE: Record<Theme, string> = {
  cosmic: "bg-tint-1",
  "cosmic-dark": "bg-tint-1",
  white: "bg-surface",
};

/** Colour mode choice. A plain form + server action, so it works without JS. */
export function ThemePicker({ current }: { current: Theme }) {
  return (
    <form action={setTheme} className="grid grid-cols-3 gap-2.5 lg:gap-3">
      {THEMES.map((theme) => {
        const selected = theme === current;
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
            {/* `data-theme` here draws the preview in that mode's own tokens (see globals.css):
                as it will look on this device, OS dark mode included. */}
            <span
              data-theme={theme}
              className="relative flex h-16 items-end gap-1.5 overflow-hidden rounded-2xl bg-bg p-2 lg:h-20 lg:p-2.5"
            >
              <span className={cn("h-10 flex-1 rounded-xl", SWATCH_TILE[theme])} />
              <span className="h-6 w-8 rounded-full bg-fg lg:w-10" />
            </span>
            <span className="flex items-start justify-between gap-1 px-1">
              <span className="flex min-w-0 flex-col">
                <span className="text-sm leading-tight font-semibold lg:text-base">
                  {mn.themes[theme].name}
                </span>
                <span className="mt-0.5 text-xs leading-snug text-muted-foreground">
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
