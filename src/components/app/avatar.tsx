import { cn } from "@/lib/utils";
import { avatarUrl } from "@/lib/avatars";

type AvatarProps = {
  seed: string;
  /** Pixel size of the circle. */
  size?: number;
  className?: string;
  alt?: string;
};

/** DiceBear line-art avatar (black ink) in a hairline circle; on a light face in dark mode too. */
export function Avatar({ seed, size = 48, className, alt = "" }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-bg dark:bg-face",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- small cached SVG, nothing to optimize */}
      <img src={avatarUrl(seed)} alt={alt} width={size} height={size} className="size-full" />
    </span>
  );
}
