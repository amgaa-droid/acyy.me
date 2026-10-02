import { ThemeToggle } from "@/components/app/theme-toggle";
import { readTheme } from "@/server/theme";

/** `ThemeToggle` for a server-rendered page: reads the visitor's current colour mode itself. */
export async function CurrentThemeToggle({ className }: { className?: string }) {
  return <ThemeToggle current={await readTheme()} className={className} />;
}
