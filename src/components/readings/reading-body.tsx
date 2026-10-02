import { parseBody } from "@/lib/body";
import { fieldItems } from "@/lib/fields";
import { cn } from "@/lib/utils";
import type { ReadingField } from "@/server/reading";

/**
 * Type rules for readings: serif only at display sizes (names, titles, quotes, key values);
 * everything read — prose, lists, labels — in sans.
 */

/** A prose value: paragraphs and "## " sub-headings (src/lib/body.ts). */
export function ProseBody({ value }: { value: string }) {
  return parseBody(value).map((block, i) =>
    block.type === "heading" ? (
      <h4
        key={i}
        className="flex items-center gap-2.5 pt-2.5 text-[13px] font-semibold tracking-[0.12em] uppercase"
      >
        <span aria-hidden className="h-px w-4 shrink-0 bg-highlight" />
        {block.text}
      </h4>
    ) : (
      <p key={i} className="text-base leading-[1.7] whitespace-pre-line text-fg/85 lg:text-lg">
        {block.text}
      </p>
    ),
  );
}

/** Sub-section heading: serif title over a hairline, optional item count on the right. */
function FieldHeading({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-fg pb-3">
      <h3 className="text-3xl leading-[1.1] font-semibold lg:text-4xl">{children}</h3>
      {count !== undefined && (
        <span className="text-xs font-medium text-muted-foreground tabular-nums select-none">
          {count}
        </span>
      )}
    </div>
  );
}

/**
 * One article sub-section by its kind: text (heading + prose), quote (large dark card),
 * cards (numbered list). `showHeading` is off when a text is the reading's only section.
 */
export function ArticleField({
  field,
  showHeading = true,
}: {
  field: ReadingField;
  showHeading?: boolean;
}) {
  switch (field.kind) {
    case "quote":
      return (
        <figure className="flex flex-col items-center gap-3.5 rounded-3xl bg-fg px-6 pt-7.5 pb-8.5 text-center text-bg lg:rounded-3xl lg:px-12 lg:pt-10 lg:pb-11">
          <svg viewBox="0 0 24 24" aria-hidden className="size-4.5 fill-current text-nav-fg">
            <path d="M12 1.5l2.2 8.3 8.3 2.2-8.3 2.2L12 22.5l-2.2-8.3L1.5 12l8.3-2.2z" />
          </svg>
          <figcaption className="font-sans text-xs font-semibold tracking-[0.2em] text-nav-fg uppercase">
            {field.name}
          </figcaption>
          <blockquote className="font-serif text-4xl leading-[1.12] font-semibold whitespace-pre-line lg:text-5xl lg:leading-[1.1]">
            {field.value}
          </blockquote>
        </figure>
      );
    case "cards": {
      const items = fieldItems(field.value, field.kind);
      return (
        <section className="flex flex-col" aria-label={field.name}>
          <FieldHeading count={items.length}>{field.name}</FieldHeading>
          <ol>
            {items.map((item, j) => (
              <li
                key={j}
                className="grid grid-cols-[44px_minmax(0,1fr)] items-baseline border-b border-border py-4.5 last:border-b-0 lg:grid-cols-[56px_minmax(0,1fr)] lg:py-5"
              >
                <span
                  aria-hidden
                  className="font-serif text-2xl leading-none font-semibold text-highlight lining-nums tabular-nums select-none lg:text-3xl"
                >
                  {String(j + 1).padStart(2, "0")}
                </span>
                <span className="text-base leading-normal lg:text-lg">{item}</span>
              </li>
            ))}
          </ol>
        </section>
      );
    }
    default:
      return (
        <section className="flex flex-col gap-3.5" aria-label={field.name}>
          {showHeading && <FieldHeading>{field.name}</FieldHeading>}
          <div className={cn("flex flex-col gap-3.5", showHeading && "pt-1")}>
            <ProseBody value={field.value} />
          </div>
        </section>
      );
  }
}

/** The free teaser (SPEC §3.1) — an italic serif lead above the reading and in previews. */
export function Teaser({ text, className }: { text: string; className?: string }) {
  return (
    <p
      className={cn(
        "font-serif text-2xl leading-[1.35] font-medium whitespace-pre-line text-fg/80 italic lg:text-3xl",
        className,
      )}
    >
      {text}
    </p>
  );
}
