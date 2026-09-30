"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireOnboardedUser } from "@/server/auth/current";
import { viewerIsAdult } from "@/server/catalog";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import {
  ContentUnavailableError,
  NotEligibleError,
  PersonsInvalidError,
  ProductUnavailableError,
  purchase,
} from "@/server/purchase";
import { InsufficientFundsError } from "@/server/wallet";

export type PurchaseResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error:
        | "not_eligible"
        | "persons_invalid"
        | "product_unavailable"
        | "content_unavailable"
        | "insufficient"
        | "generic";
    };

export async function purchaseAction(
  productCode: string,
  personIds: string[],
): Promise<PurchaseResult> {
  const { user: u } = await requireOnboardedUser();
  try {
    const { purchase: p } = await purchase(db, { userId: u.id, productCode, personIds });
    revalidatePath("/readings");
    revalidatePath("/home");
    return { ok: true, id: p.id };
  } catch (err) {
    if (err instanceof InsufficientFundsError) return { ok: false, error: "insufficient" };
    if (err instanceof NotEligibleError) return { ok: false, error: "not_eligible" };
    if (err instanceof PersonsInvalidError) return { ok: false, error: "persons_invalid" };
    if (err instanceof ProductUnavailableError) return { ok: false, error: "product_unavailable" };
    if (err instanceof ContentUnavailableError) return { ok: false, error: "content_unavailable" };
    console.error("[purchase]", err);
    return { ok: false, error: "generic" };
  }
}

/** "Би 18 нас хүрсэн" — once; only if the user's "Би" is actually 18+. */
export async function confirmAdultAction(): Promise<{ ok: boolean }> {
  const { user: u, self } = await requireOnboardedUser();
  const now = new Date();
  if (!viewerIsAdult({ userId: u.id, selfBirthDate: self.birthDate, adultConfirmedAt: now }))
    return { ok: false };
  await db.update(user).set({ adultConfirmedAt: now }).where(eq(user.id, u.id));
  revalidatePath("/me");
  revalidatePath("/readings");
  return { ok: true };
}
