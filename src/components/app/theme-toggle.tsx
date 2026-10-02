import { Contrast, Moon, Sparkles } from "lucide-react";

import { setTheme } from "@/app/actions/theme";
import { HideOnScroll } from "@/components/app/hide-on-scroll";
import { mn } from "@/i18n/mn";
import { THEMES, type Theme } from "@/lib/theme";

const ICONS: Record<Theme, typeof Moon> = {
  cosmic: Sparkles,
  "cosmic-dark": Moon,
  white: Contrast,
};

/**
 * Floating colour-mode button, top centre of every page (rendered by the root layout).
 * Each tap moves to the next theme. A plain form + server action, so it works without JS.
 * On the full-screen home it lines up with the menu and wallet buttons (`data-screen="home"`).
 * It slides away while the page scrolls down (HideOnScroll) so it doesn't cover the content.
 */
export function ThemeToggle({ current }: { current: Theme }) {
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
  const Icon = ICONS[current];
  return (
    <HideOnScroll className="fixed top-[max(env(safe-area-inset-top),0.625rem)] left-1/2 z-45 -translate-x-1/2 print:hidden lg:top-[1.125rem] [body:has([data-screen=home])_&]:top-[max(env(safe-area-inset-top),1rem)] lg:[body:has([data-screen=home])_&]:top-8">
      <form action={setTheme}>
        <button
          type="submit"
          name="theme"
          value={next}
          aria-label={mn.themeToggle(mn.themes[current].name, mn.themes[next].name)}
          title={mn.themes[next].name}
          className="flex size-11 items-center justify-center rounded-full border border-border bg-surface/90 text-fg shadow-[0_4px_14px_rgb(0_0_0/0.08)] backdrop-blur transition-transform active:scale-95 [body:has([data-screen=home])_&]:size-12"
        >
          <Icon className="size-[18px]" aria-hidden />
        </button>
      </form>
    </HideOnScroll>
  );
}
