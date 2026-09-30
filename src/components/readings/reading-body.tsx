import { parseBody } from "@/lib/body";
import { cn } from "@/lib/utils";

/** A content body: paragraphs and "## " sub-headings (src/lib/body.ts). */
export function ReadingBody({ body }: { body: string }) {
  return parseBody(body).map((block, i) =>
    block.type === "heading" ? (
      <h3 key={i} className="pt-3 text-xl leading-tight font-semibold lg:text-2xl">
        {block.text}
      </h3>
    ) : (
      <p key={i} className="text-[17px] leading-[1.7] whitespace-pre-line lg:text-lg">
        {block.text}
      </p>
    ),
  );
}

/** The free teaser (SPEC §3.1) — shown in the preview and at the top of the reading. */
export function Teaser({ text, className }: { text: string; className?: string }) {
  return (
    <p
      className={cn(
        "rounded-3xl bg-tint-2 px-5 py-4 text-base leading-relaxed whitespace-pre-line",
        className,
      )}
    >
      {text}
    </p>
  );
}
