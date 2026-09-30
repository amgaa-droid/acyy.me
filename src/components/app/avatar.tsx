import { cn } from "@/lib/utils";
import { avatarDataUri } from "@/lib/avatars";

type AvatarProps = {
  seed: string;
  /** Pixel size of the circle. */
  size?: number;
  className?: string;
  alt?: string;
};

/** DiceBear line-art avatar in a hairline circle; inverted in dark mode. */
export function Avatar({ seed, size = 48, className, alt = "" }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-bg",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local data URI, nothing to optimize */}
      <img
        src={avatarDataUri(seed)}
        alt={alt}
        width={size}
        height={size}
        className="size-full dark:invert"
      />
    </span>
  );
}
