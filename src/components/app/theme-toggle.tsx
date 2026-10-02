import { Contrast, Moon, Palette } from "lucide-react";

import { setTheme } from "@/app/actions/theme";
import { mn } from "@/i18n/mn";
import { THEMES, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const ICONS: Record<Theme, typeof Moon> = {
  cosmic: Palette,
  "cosmic-dark": Moon,
  white: Contrast,
};

/**
 * Colour-mode button for the screens outside the app (landing, login) and the admin sidebar:
 * each tap moves to the next theme. A plain form + server action, so it works without JS.
 * It sits in the page's own layout — a button floating over every page covered content and
 * crowded the header. Signed in, the choice is in the home menu (`ThemeSwitch`) and on /me.
 */
export function ThemeToggle({ current, className }: { current: Theme; className?: string }) {
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
  const Icon = ICONS[current];
  return (
    <form action={setTheme} className={cn("print:hidden", className)}>
      <button
        type="submit"
        name="theme"
        value={next}
        aria-label={mn.themeToggle(mn.themes[current].name, mn.themes[next].name)}
        title={mn.themes[next].name}
        className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-fg transition-transform active:scale-95"
      >
        <Icon className="size-4.5" aria-hidden />
      </button>
    </form>
  );
}

/** The three colour modes side by side, for a menu: the current one is ringed. */
export function ThemeSwitch({ current }: { current: Theme }) {
  return (
    <form
      action={setTheme}
      role="group"
      aria-label={mn.me.appearance}
      className="grid grid-cols-3 gap-2"
    >
      {THEMES.map((theme) => {
        const Icon = ICONS[theme];
        const selected = theme === current;
        return (
          <button
            key={theme}
            type="submit"
            name="theme"
            value={theme}
            aria-pressed={selected}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl bg-subtle px-1 py-2 text-xs leading-tight font-semibold transition-shadow",
              selected ? "ring-2 ring-highlight" : "ring-1 ring-border hover:ring-2",
            )}
          >
            <Icon className="size-4.5" aria-hidden />
            {mn.themes[theme].name}
          </button>
        );
      })}
    </form>
  );
}
