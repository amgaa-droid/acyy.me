import type { ReactNode } from "react";

import { BrandMark } from "@/components/app/brand-mark";
import { cn } from "@/lib/utils";

/**
 * A page with nothing to show but a message: not found, an error. `page` fills the screen
 * (outside the app shell); otherwise it sits inside a sheet that is already open.
 */
export function StatusScreen({
  code,
  title,
  body,
  page = false,
  children,
}: {
  /** A short mark above the title, e.g. "404". */
  code?: string;
  title: string;
  body: string;
  page?: boolean;
  /** Actions: links or buttons. */
  children: ReactNode;
}) {
  const Tag = page ? "main" : "div";
  return (
    <Tag
      className={cn(
        "flex flex-col items-center justify-center gap-6 px-6 text-center",
        page ? "min-h-dvh bg-bg py-16" : "min-h-[60dvh] py-10",
      )}
    >
      <BrandMark className="size-10 text-highlight" />
      <div className="flex max-w-sm flex-col gap-2">
        {code && (
          <span className="text-xs font-semibold tracking-[0.16em] text-highlight">{code}</span>
        )}
        <h1 className="text-[34px] leading-none font-semibold lg:text-[44px]">{title}</h1>
        <p className="text-muted-foreground">{body}</p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">{children}</div>
    </Tag>
  );
}

/** The look of a link inside a StatusScreen: the main action, and a quieter second one. */
export const statusAction =
  "flex h-12 w-full items-center justify-center rounded-full bg-fg px-5 text-base font-medium text-bg";
export const statusActionQuiet =
  "flex h-12 w-full items-center justify-center rounded-full bg-surface px-5 text-base font-medium text-fg";
