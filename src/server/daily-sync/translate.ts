import type { AiRequest } from "@/server/ai/providers";

/**
 * One translation request per daily kind: the 12 signs' English texts go in as a JSON object
 * (sign code → text) and the model answers with the same keys in Mongolian. The admin's
 * instructions come first; the sign-name glossary and the output format are always appended
 * so an edited prompt can't break parsing.
 */

type SignName = { code: string; nameMn: string };

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

export function buildTranslationRequest(opts: {
  prompt: string;
  /** e.g. "daily love horoscope" — tells the model what it is reading. */
  kindName: string;
  signs: SignName[];
  texts: Record<string, string>;
}): AiRequest {
  const glossary = opts.signs.map((s) => `${capitalize(s.code)} — ${s.nameMn}`).join(", ");
  const system = [
    opts.prompt.trim(),
    `Ордны нэр: ${glossary}.`,
    [
      "Хариултын хэлбэр: зөвхөн JSON объект. Түлхүүрүүд нь оролтын түлхүүрүүд (ордны код) яг хэвээрээ,",
      "утга нь тухайн текстийн монгол хувилбар — эх текстийн догол мөрүүдийг хадгалсан энгийн текст",
      "(жагсаалт, зураас, тэмдэглэгээгүй). Өөр юу ч бүү бич.",
    ].join(" "),
  ].join("\n\n");
  const user = `Today's ${opts.kindName} for each zodiac sign:\n\n${JSON.stringify(opts.texts, null, 2)}`;
  return { system, user, json: true };
}

/**
 * Plain paragraphs: models sometimes write a newline as the two characters `\n` (double-escaped
 * JSON) or start paragraphs with a "- " bullet the source never had.
 */
export function cleanTranslation(v: string): string {
  return v
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim().replace(/^[-–—•*]\s+/, ""))
    .filter(Boolean)
    .join("\n\n");
}

type ParsedTranslation = {
  texts: Record<string, string>;
  /** Signs the answer left out or left empty. */
  missing: string[];
  /** Signs whose translation is longer than `max`. */
  tooLong: string[];
};

/** Reads the model's JSON (tolerating ``` fences); only the expected sign codes are kept. */
export function parseTranslation(raw: string, expected: string[], max: number): ParsedTranslation {
  const unfenced = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  let obj: unknown = null;
  for (const candidate of [unfenced, unfenced.slice(start, end + 1)]) {
    try {
      obj = JSON.parse(candidate);
      break;
    } catch {
      // try the outermost {…} next (some models add a sentence around the JSON)
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("not_json_object");

  const out: ParsedTranslation = { texts: {}, missing: [], tooLong: [] };
  for (const code of expected) {
    const v = (obj as Record<string, unknown>)[code];
    const text = typeof v === "string" ? cleanTranslation(v) : "";
    if (!text) out.missing.push(code);
    else if (text.length > max) out.tooLong.push(code);
    else out.texts[code] = text;
  }
  return out;
}
