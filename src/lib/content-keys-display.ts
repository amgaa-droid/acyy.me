/** Human label for a content key: "aries|leo" → "Хуц × Арслан", "3|12" → "3 × 12", "leo" → "Арслан". */
export function displayKey(key: string, signNames: Record<string, string>): string {
  return key
    .split("|")
    .map((part) => signNames[part] ?? part)
    .join(" × ");
}
