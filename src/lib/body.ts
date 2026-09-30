/**
 * Content body markup (SPEC §10): plain text, paragraphs separated by a blank line, and a line
 * starting with "## " is a sub-heading. Nothing else is interpreted (no HTML, no Markdown).
 */
export type BodyBlock = { type: "heading"; text: string } | { type: "paragraph"; text: string };

const HEADING = /^##\s+(.+)$/;

export function parseBody(body: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    const text = para.join("\n").trim();
    if (text) blocks.push({ type: "paragraph", text });
    para = [];
  };
  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const heading = HEADING.exec(line.trim());
    if (heading) {
      flush();
      blocks.push({ type: "heading", text: heading[1].trim() });
    } else if (line.trim() === "") {
      flush();
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}

/** The body without its sub-heading lines — what sentence-based previews and quotes read. */
export function bodyProse(body: string): string {
  return parseBody(body)
    .filter((b) => b.type === "paragraph")
    .map((b) => b.text)
    .join("\n\n");
}

/**
 * Structured sub-sections of a pair text (legacy import, src/server/legacy/transform.ts) that the
 * reading screen lifts out of the prose and shows as highlight cards.
 */
export const HIGHLIGHT_HEADINGS = {
  goodFor: "Тохиромжтой харилцаа",
  cautionFor: "Анхаарах харилцаа",
  strengths: "Давуу тал",
  weaknesses: "Сул тал",
} as const;

export type HighlightKind = keyof typeof HIGHLIGHT_HEADINGS;
export type Highlights = Record<HighlightKind, string[]>;

const KIND_BY_HEADING = new Map(
  Object.entries(HIGHLIGHT_HEADINGS).map(([k, h]) => [
    h.toLocaleLowerCase("mn"),
    k as HighlightKind,
  ]),
);

/** "• a\n• b" or "a, b" → ["a", "b"]. */
function splitItems(text: string): string[] {
  return text
    .split(/\n|,/)
    .map((s) => s.replace(/^[•\-–*]\s*/, "").trim())
    .filter(Boolean);
}

/**
 * Splits a body into its highlight sections and the remaining body (still "## " markup).
 * A highlight section runs from its heading to the next heading; items are de-duplicated.
 */
export function extractHighlights(body: string): { highlights: Highlights; rest: string } {
  const highlights: Highlights = { goodFor: [], cautionFor: [], strengths: [], weaknesses: [] };
  const rest: string[] = [];
  let current: HighlightKind | null = null;
  for (const block of parseBody(body)) {
    if (block.type === "heading") {
      current = KIND_BY_HEADING.get(block.text.toLocaleLowerCase("mn")) ?? null;
      if (!current) rest.push(`## ${block.text}`);
    } else if (current) {
      for (const item of splitItems(block.text)) {
        if (!highlights[current].includes(item)) highlights[current].push(item);
      }
    } else {
      rest.push(block.text);
    }
  }
  return { highlights, rest: rest.join("\n\n") };
}

export function hasHighlights(h: Highlights): boolean {
  return Object.values(h).some((items) => items.length > 0);
}

/** "Давуу тал: a · b · c\nСул тал: x · y" — the free teaser of a birthday text → trait lists. */
export function parseTraits(teaser: string): Pick<Highlights, "strengths" | "weaknesses"> | null {
  const traits = { strengths: [] as string[], weaknesses: [] as string[] };
  for (const line of teaser.split("\n")) {
    const m = /^([^:]+):(.*)$/.exec(line.trim());
    const kind = m && KIND_BY_HEADING.get(m[1].trim().toLocaleLowerCase("mn"));
    if (kind !== "strengths" && kind !== "weaknesses") continue;
    for (const item of m![2].split("·").map((s) => s.trim())) {
      if (item && !traits[kind].includes(item)) traits[kind].push(item);
    }
  }
  return traits.strengths.length || traits.weaknesses.length ? traits : null;
}

/** Sub-sections shown as a large quote card and as one card per item (birthday texts). */
export const QUOTE_HEADINGS = ["Бясалгах үг"] as const;
export const CARD_LIST_HEADINGS = ["Зөвлөгөө"] as const;

export type ReadingBlock =
  | BodyBlock
  | { type: "quote"; label: string; text: string }
  | { type: "cards"; label: string; items: string[] };

const isOneOf = (list: readonly string[], text: string) =>
  list.some((h) => h.toLocaleLowerCase("mn") === text.toLocaleLowerCase("mn"));

/**
 * parseBody plus presentation: a quote heading and its paragraphs become one quote block, a
 * card-list heading and its "• " lines become one cards block. Everything else is unchanged.
 */
export function readingBlocks(body: string): ReadingBlock[] {
  const out: ReadingBlock[] = [];
  let open: Extract<ReadingBlock, { type: "quote" | "cards" }> | null = null;
  for (const block of parseBody(body)) {
    if (block.type === "heading") {
      open = isOneOf(QUOTE_HEADINGS, block.text)
        ? { type: "quote", label: block.text, text: "" }
        : isOneOf(CARD_LIST_HEADINGS, block.text)
          ? { type: "cards", label: block.text, items: [] }
          : null;
      out.push(open ?? block);
    } else if (open?.type === "quote") {
      open.text = open.text ? `${open.text}\n${block.text}` : block.text;
    } else if (open?.type === "cards") {
      for (const line of block.text.split("\n")) {
        const item = line.replace(/^[•\-–*]\s*/, "").trim();
        if (item) open.items.push(item);
      }
    } else {
      out.push(block);
    }
  }
  return out.filter((b) => (b.type === "quote" ? b.text : b.type === "cards" ? b.items.length : true));
}
