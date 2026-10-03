import { COSMIC } from "@/lib/palette";

/** App mark (four-point star) for ImageResponse-generated PNG icons: the brand ink, the star in white. */
export const STAR_PATH =
  "M50 14C53 38 62 47 86 50C62 53 53 62 50 86C47 62 38 53 14 50C38 47 47 38 50 14Z";

export function BrandIcon({ size, padding = 0 }: { size: number; padding?: number }) {
  const inner = size * (1 - padding * 2);
  return (
    <div
      style={{
        width: size,
        height: size,
        background: COSMIC.fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={inner} height={inner} viewBox="0 0 100 100">
        <path d={STAR_PATH} fill={COSMIC.surface} />
      </svg>
    </div>
  );
}
