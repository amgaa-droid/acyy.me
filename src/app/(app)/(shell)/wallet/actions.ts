"use server";

import { and, count, eq, gte } from "drizzle-orm";
import { z } from "zod";

import { APP_NAME, env } from "@/env";
import { requireOnboardedUser } from "@/server/auth/current";
import { db } from "@/server/db";
import { topups } from "@/server/db/schema";
import type { InvoiceData } from "@/server/db/schema";
import { mockQPay, qpay } from "@/server/qpay";
import {
  InvalidTierError,
  PackageChangedError,
  TopupNotFoundError,
  createTopup,
  getTopupForUser,
  settleTopup,
} from "@/server/topups";
import { getBalance } from "@/server/wallet";

const INVOICES_PER_HOUR = 10; // SPEC §12

const offerSchema = z.object({
  packageId: z.uuid(),
  amount: z.number().int().positive(),
  bonus: z.number().int().min(0),
});

export async function createTopupAction(
  input: unknown,
): Promise<
  | {
      ok: true;
      topup: { id: string; amount: number; bonus: number; status: string; invoice: InvoiceData | null };
      balance: number;
      mockPayUrl: string | null;
    }
  | { ok: false; error: "invalid_tier" | "package_changed" | "rate" | "generic" }
> {
  const { user } = await requireOnboardedUser();
  const offer = offerSchema.safeParse(input);
  if (!offer.success) return { ok: false, error: "invalid_tier" };

  const [{ recent }] = await db
    .select({ recent: count() })
    .from(topups)
    .where(
      and(eq(topups.userId, user.id), gte(topups.createdAt, new Date(Date.now() - 60 * 60 * 1000))),
    );
  if (recent >= INVOICES_PER_HOUR) return { ok: false, error: "rate" };

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
      topup: { id: t.id, amount: t.amount, bonus: t.bonus, status: t.status, invoice: t.invoiceData },
      balance: await getBalance(db, user.id),
      mockPayUrl: mockQPay() && t.invoiceId ? `/dev/qpay/${t.invoiceId}` : null,
    };
  } catch (err) {
    if (err instanceof InvalidTierError) return { ok: false, error: "package_changed" };
    if (err instanceof PackageChangedError) return { ok: false, error: "package_changed" };
    console.error("[topup:create]", err);
    return { ok: false, error: "generic" };
  }
}

/** "Төлсөн, шалгах" — the user asks us to verify with QPay now instead of waiting for cron. */
export async function checkTopupAction(id: string): Promise<{ status: string }> {
  const { user } = await requireOnboardedUser();
  try {
    await getTopupForUser(db, user.id, id);
    return await settleTopup(db, qpay(), id, { source: "user", actorId: user.id });
  } catch (err) {
    if (err instanceof TopupNotFoundError) return { status: "not_found" };
    console.error("[topup:check]", err);
    return { status: "error" };
  }
}
