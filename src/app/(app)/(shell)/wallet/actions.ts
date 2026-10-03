"use server";

import { z } from "zod";

import { APP_NAME, env } from "@/env";
import { requireOnboardedUser } from "@/server/auth/current";
import { db } from "@/server/db";
import type { InvoiceData } from "@/server/db/schema";
import { mockQPay, qpay } from "@/server/qpay";
import {
  InvalidTierError,
  PackageChangedError,
  TopupNotFoundError,
  TopupRateLimitError,
  createTopup,
  getTopupForUser,
  settleTopup,
} from "@/server/topups";
import { createThrottle } from "@/server/throttle";
import { getBalance } from "@/server/wallet";

/** "Төлсөн, шалгах" asks QPay at most this often per user; in between it answers from the DB. */
const mayAskQPay = createThrottle(3_000);

const offerSchema = z.object({
  packageId: z.uuid(),
  amount: z.number().int().positive(),
  bonus: z.number().int().min(0),
});

export async function createTopupAction(input: unknown): Promise<
  | {
      ok: true;
      topup: {
        id: string;
        amount: number;
        bonus: number;
        status: string;
        invoice: InvoiceData | null;
      };
      balance: number;
      mockPayUrl: string | null;
    }
  | { ok: false; error: "invalid_tier" | "package_changed" | "rate" | "generic" }
> {
  const { user } = await requireOnboardedUser();
  const offer = offerSchema.safeParse(input);
  if (!offer.success) return { ok: false, error: "invalid_tier" };

  try {
    const t = await createTopup(db, qpay(), {
      userId: user.id,
      offer: offer.data,
      appUrl: env().APP_URL,
      callbackSecret: env().QPAY_CALLBACK_SECRET,
      description: `${APP_NAME}: хэтэвч цэнэглэх`,
    });
    return {
      ok: true,
      topup: {
        id: t.id,
        amount: t.amount,
        bonus: t.bonus,
        status: t.status,
        invoice: t.invoiceData,
      },
      balance: await getBalance(db, user.id),
      mockPayUrl: mockQPay() && t.invoiceId ? `/dev/qpay/${t.invoiceId}` : null,
    };
  } catch (err) {
    if (err instanceof InvalidTierError) return { ok: false, error: "package_changed" };
    if (err instanceof PackageChangedError) return { ok: false, error: "package_changed" };
    if (err instanceof TopupRateLimitError) return { ok: false, error: "rate" };
    console.error("[topup:create]", err);
    return { ok: false, error: "generic" };
  }
}

/** "Төлсөн, шалгах" — the user asks us to verify with QPay now instead of waiting for cron. */
export async function checkTopupAction(id: string): Promise<{ status: string }> {
  const { user } = await requireOnboardedUser();
  try {
    const topup = await getTopupForUser(db, user.id, id);
    if (!mayAskQPay(user.id)) return { status: topup.status };
    return await settleTopup(db, qpay(), id, { source: "user", actorId: user.id });
  } catch (err) {
    if (err instanceof TopupNotFoundError) return { status: "not_found" };
    console.error("[topup:check]", err);
    return { status: "error" };
  }
}
