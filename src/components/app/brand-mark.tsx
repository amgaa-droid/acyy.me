import { STAR_PATH } from "@/lib/brand-icon";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path d={STAR_PATH} fill="currentColor" />
    </svg>
  );
}
