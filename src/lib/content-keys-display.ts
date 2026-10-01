import type { KeyType } from "./domain";

const GENDER_LABELS: Record<string, string> = { male: "Эр", female: "Эм" };

/**
 * Human label for a content key: "aries|leo" → "Хуц × Арслан", "3|12" → "3 × 12",
 * "leo" → "Арслан", "leo|female" → "Арслан · Эм", ordered "aries|leo" → "Хуц → Арслан".
 */
export function displayKey(
  key: string,
  signNames: Record<string, string>,
  keyType?: KeyType,
): string {
  const parts = key.split("|");
  const gender = parts.length > 1 && GENDER_LABELS[parts.at(-1)!] ? parts.pop()! : null;
  const label = parts
    .map((part) => signNames[part] ?? part)
    .join(keyType === "sign_pair_ordered" ? " → " : " × ");
  return gender ? `${label} · ${GENDER_LABELS[gender]}` : label;
}

/** A reading section's label: the part name, plus the direction for ordered sign pairs. */
export function sectionLabel(
  section: { name: string; keyType: KeyType; key: string },
  signNames: Record<string, string>,
): string {
  return section.keyType === "sign_pair_ordered"
    ? `${section.name} · ${displayKey(section.key, signNames, section.keyType)}`
    : section.name;
}
