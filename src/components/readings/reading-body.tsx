import { readingBlocks } from "@/lib/body";
import { cn } from "@/lib/utils";

/**
 * A content body: paragraphs and "## " sub-headings (src/lib/body.ts). "Бясалгах үг" becomes a
 * large quote card and "Зөвлөгөө" one card per item, so the key lines stand out from the prose.
 */
export function ReadingBody({ body }: { body: string }) {
  return readingBlocks(body).map((block, i) => {
    switch (block.type) {
      case "heading":
        return (
          <h3 key={i} className="pt-3 text-xl leading-tight font-semibold lg:text-2xl">
            {block.text}
          </h3>
        );
      case "quote":
        return (
          <figure
            key={i}
            className="my-2 flex flex-col gap-3.5 rounded-[28px] bg-fg px-6 py-7 text-center text-bg lg:px-10 lg:py-9"
          >
            <figcaption className="font-sans text-xs font-semibold tracking-[0.18em] text-nav-fg uppercase">
              {block.label}
            </figcaption>
            <blockquote className="font-serif text-[30px] leading-[1.15] font-semibold whitespace-pre-line lg:text-4xl">
              {block.text}
            </blockquote>
          </figure>
        );
      case "cards":
        return (
          <section key={i} className="flex flex-col gap-3" aria-label={block.label}>
            <h3 className="pt-3 text-xl leading-tight font-semibold lg:text-2xl">{block.label}</h3>
            <ul className="flex flex-col gap-2.5">
              {block.items.map((item, j) => (
                <li
                  key={j}
                  className="rounded-[22px] border border-border bg-surface px-5 py-4 text-center font-serif text-[22px] leading-tight font-semibold lg:text-2xl"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
        );
      default:
        return (
          <p key={i} className="text-[17px] leading-[1.7] whitespace-pre-line lg:text-lg">
            {block.text}
          </p>
        );
    }
  });
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
