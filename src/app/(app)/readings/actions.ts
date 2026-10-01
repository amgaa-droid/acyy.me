"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOnboardedUser } from "@/server/auth/current";
import { viewerIsAdult } from "@/server/catalog";
import { db } from "@/server/db";
import { GenderRequiredError } from "@/server/content/keys";
import { user } from "@/server/db/schema";
import { updatePerson } from "@/server/persons";
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
        | "gender_required"
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
    if (err instanceof GenderRequiredError) return { ok: false, error: "gender_required" };
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

const genderForm = z.object({
  personId: z.uuid(),
  gender: z.enum(["male", "female"]),
  returnTo: z.string().regex(/^\/buy\/[a-z0-9_]+(\?[\w=&%-]*)?$/),
});

/**
 * Gender-split products (SPEC §3): the buy screen asks for a person's gender when it isn't set,
 * saves it on the person (gender stays editable) and returns to the same step.
 */
export async function setGenderForPurchaseAction(formData: FormData): Promise<void> {
  const { user: u } = await requireOnboardedUser();
  const input = genderForm.parse(Object.fromEntries(formData));
  await updatePerson(db, u.id, input.personId, { gender: input.gender });
  revalidatePath(`/people/${input.personId}`);
  redirect(input.returnTo);
}
