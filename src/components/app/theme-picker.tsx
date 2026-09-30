import { Check } from "lucide-react";

import { setTheme } from "@/app/actions/theme";
import { mn } from "@/i18n/mn";
import { THEMES, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

// Fixed preview swatches (ground, tint, ink) so each option shows its own colours.
const SWATCHES: Record<Theme, [string, string, string]> = {
  cosmic: ["#f5f1eb", "#e6e3fb", "#1d1b3f"],
  white: ["#f5f5f5", "#ffffff", "#0a0a0a"],
};

/** Colour mode choice. A plain form + server action, so it works without JS. */
export function ThemePicker({ current }: { current: Theme }) {
  return (
    <form action={setTheme} className="grid grid-cols-2 gap-3">
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
              "flex flex-col gap-3 rounded-3xl bg-surface p-3 text-left ring-2 transition-shadow",
              selected ? "ring-highlight" : "ring-transparent hover:ring-border",
            )}
          >
            <span
              className="relative flex h-20 items-end gap-1.5 overflow-hidden rounded-2xl p-2.5"
              style={{ background: ground }}
            >
              <span className="h-10 flex-1 rounded-xl" style={{ background: tint }} />
              <span className="h-6 w-10 rounded-full" style={{ background: ink }} />
            </span>
            <span className="flex items-center justify-between px-1">
              <span className="flex flex-col">
                <span className="font-semibold">{mn.themes[theme].name}</span>
                <span className="text-xs text-muted-foreground">
                  {mn.themes[theme].description}
                </span>
              </span>
              {selected && <Check className="size-5 text-highlight" aria-hidden />}
            </span>
          </button>
        );
      })}
    </form>
  );
}
