import type { ContentSection, ProductCode } from "@/lib/domain";
import { ALL_MONTH_DAYS } from "@/server/astro/calendar";

/**
 * Canonical content keys (SPEC §3).
 * Pair keys are order-independent: "A|B" with A ≤ B, so A×B and B×A share one text.
 * Signs compare by code (string), periods numerically.
 */

export function signPairKey(a: string, b: string): string {
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

export function periodPairKey(a: number, b: number): string {
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

/** All unordered pairs including self-pairs: n(n+1)/2 keys. */
export function signPairKeys(signCodes: readonly string[]): string[] {
  const sorted = [...signCodes].sort();
  return sorted.flatMap((a, i) => sorted.slice(i).map((b) => signPairKey(a, b)));
}

export function periodPairKeys(count = 48): string[] {
  const keys: string[] = [];
  for (let a = 1; a <= count; a++) for (let b = a; b <= count; b++) keys.push(periodPairKey(a, b));
  return keys;
}

export type ExpectedKeys = { section: ContentSection; keys: string[] }[];

/** Every content key a product must have for full coverage. */
export function expectedKeys(
  product: ProductCode,
  ref: { signCodes: readonly string[]; periodCount: number },
): ExpectedKeys {
  switch (product) {
    case "birthday":
      return [{ section: "main", keys: [...ALL_MONTH_DAYS] }];
    case "sign":
    case "love":
    case "sex":
    case "dating":
      return [{ section: "main", keys: [...ref.signCodes] }];
    case "synastry":
      return [
        { section: "sign_pair", keys: signPairKeys(ref.signCodes) },
        { section: "period_pair", keys: periodPairKeys(ref.periodCount) },
      ];
  }
}
