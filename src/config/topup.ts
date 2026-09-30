/** Top-up tiers (SPEC §4.1). Bonus is credited as a separate `bonus` ledger entry. */
export const TOPUP_TIERS = [
  { amount: 2_000, bonus: 0 },
  { amount: 5_000, bonus: 300 },
  { amount: 10_000, bonus: 1_000 },
  { amount: 20_000, bonus: 3_000 },
] as const;

export type TopupTier = (typeof TOPUP_TIERS)[number];

export function findTier(amount: number): TopupTier | undefined {
  return TOPUP_TIERS.find((t) => t.amount === amount);
}
