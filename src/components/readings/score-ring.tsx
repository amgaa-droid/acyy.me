import { cn } from "@/lib/utils";

/** Compatibility score (0–100) as a ring — the cosmic-soft "80%" motif. */
export function ScoreRing({
  value,
  tone = "primary",
  size = 60,
}: {
  value: number;
  tone?: "primary" | "secondary";
  size?: number;
}) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={`${v}/100`}
      className="shrink-0"
    >
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        strokeWidth="5"
        className={tone === "primary" ? "stroke-tint-1" : "stroke-tint-2"}
      />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(v / 100) * c} ${c}`}
        transform="rotate(-90 32 32)"
        className={cn(tone === "primary" ? "stroke-highlight" : "stroke-ring-2")}
      />
      <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight="600" className="fill-fg">
        {v}
      </text>
    </svg>
  );
}
