import { CONSTELLATIONS } from "@/lib/constellations";
import { cn } from "@/lib/utils";

type ConstellationProps = {
  /** zodiac_signs.code */
  sign: string;
  className?: string;
  /** Draw the orbit rings behind the stars. */
  rings?: boolean;
};

/** Line-art constellation of a sign. Colours follow the theme tokens. */
export function ConstellationArt({ sign, className, rings = true }: ConstellationProps) {
  const art = CONSTELLATIONS[sign];
  if (!art) return null;

  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden className={cn("text-fg", className)}>
      {rings && (
        <>
          <circle
            cx="50"
            cy="50"
            r="48"
            className="stroke-highlight"
            strokeOpacity={0.25}
            strokeWidth={0.35}
          />
          <circle
            cx="50"
            cy="50"
            r="38"
            className="stroke-highlight"
            strokeOpacity={0.35}
            strokeWidth={0.35}
            strokeDasharray="0.6 2"
          />
        </>
      )}
      {art.lines.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={art.stars[a][0]}
          y1={art.stars[a][1]}
          x2={art.stars[b][0]}
          y2={art.stars[b][1]}
          stroke="currentColor"
          strokeWidth={0.55}
        />
      ))}
      {art.stars.map(([x, y], i) =>
        i === art.bright ? (
          <circle key={i} cx={x} cy={y} r={2.8} className="fill-highlight" />
        ) : (
          <circle key={i} cx={x} cy={y} r={1.3} fill="currentColor" />
        ),
      )}
    </svg>
  );
}
