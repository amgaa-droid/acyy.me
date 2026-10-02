/**
 * Prose field markup (SPEC §10): plain text, paragraphs separated by a blank line, and a line
 * starting with "## " is a sub-heading. Nothing else is interpreted (no HTML, no Markdown).
 * Sub-sections with their own look are separate fields (product_fields), not headings.
 */
type BodyBlock = { type: "heading"; text: string } | { type: "paragraph"; text: string };

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
