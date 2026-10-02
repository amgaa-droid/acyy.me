import { KEY_GENDERS, KEY_TYPE_ARITY, type Gender, type KeyType } from "@/lib/domain";
import { ALL_MONTH_DAYS } from "@/server/astro/calendar";

/**
 * Canonical content keys (SPEC §3), derived from a product part's `key_type` (+ `by_gender`).
 * Unordered pair keys are "A|B" with A ≤ B, so A×B and B×A share one text; ordered pairs keep
 * the people's order. Signs compare by code (string), periods numerically.
 * Gender-split keys append the gender: "aries|male", "03-21|female".
 */

export function signPairKey(a: string, b: string): string {
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

export function periodPairKey(a: number, b: number): string {
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

export function orderedPairKey(a: string | number, b: string | number): string {
  return `${a}|${b}`;
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

/** Every ordered pair: n² keys (A→B and B→A are different texts). */
export function orderedSignPairKeys(signCodes: readonly string[]): string[] {
  return signCodes.flatMap((a) => signCodes.map((b) => orderedPairKey(a, b)));
}

export type KeyRefs = { signCodes: readonly string[]; periodCount: number };
export type PartKeySpec = { keyType: KeyType; byGender: boolean };

export function genderKey(base: string, gender: string): string {
  return `${base}|${gender}`;
}

/** Every key a part must have for full coverage, in a stable display order. */
export function expectedPartKeys(part: PartKeySpec, ref: KeyRefs): string[] {
  const base = baseKeys(part.keyType, ref);
  if (!part.byGender || KEY_TYPE_ARITY[part.keyType] !== 1) return base;
  return base.flatMap((k) => KEY_GENDERS.map((g) => genderKey(k, g)));
}

function baseKeys(keyType: KeyType, ref: KeyRefs): string[] {
  switch (keyType) {
    case "month_day":
      return [...ALL_MONTH_DAYS];
    case "sign":
      return [...ref.signCodes];
    case "period":
      return Array.from({ length: ref.periodCount }, (_, i) => String(i + 1));
    case "sign_pair":
      return signPairKeys(ref.signCodes);
    case "period_pair":
      return periodPairKeys(ref.periodCount);
    case "sign_pair_ordered":
      return orderedSignPairKeys(ref.signCodes);
  }
}

/** What a key is computed from, per person (the product's people in order). */
export type KeyPerson = { monthDay: string; sign: string; period: number; gender: Gender };

export class GenderRequiredError extends Error {
  constructor() {
    super("gender_required");
  }
}

/** The content key a part shows for these people. Gender-split parts need male/female. */
export function partKeyFor(part: PartKeySpec, people: readonly KeyPerson[]): string {
  const [a, b] = people;
  let key: string;
  switch (part.keyType) {
    case "month_day":
      key = a.monthDay;
      break;
    case "sign":
      key = a.sign;
      break;
    case "period":
      key = String(a.period);
      break;
    case "sign_pair":
      key = signPairKey(a.sign, b.sign);
      break;
    case "period_pair":
      key = periodPairKey(a.period, b.period);
      break;
    case "sign_pair_ordered":
      key = orderedPairKey(a.sign, b.sign);
      break;
  }
  if (!part.byGender || KEY_TYPE_ARITY[part.keyType] !== 1) return key;
  if (a.gender === "unspecified") throw new GenderRequiredError();
  return genderKey(key, a.gender);
}

/**
 * The texts a part shows for its stored key. An ordered sign pair is still one purchase for the
 * pair: the reading shows both directions, A→B then B→A (one text when both signs match).
 */
export function shownKeys(keyType: KeyType, key: string): string[] {
  if (keyType !== "sign_pair_ordered") return [key];
  const [a, b] = key.split("|");
  return a === b ? [key] : [key, orderedPairKey(b, a)];
}
