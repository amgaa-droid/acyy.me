"use server";

import { and, count, eq, gte } from "drizzle-orm";
import { z } from "zod";

import { APP_NAME, env } from "@/env";
import { requireOnboardedUser } from "@/server/auth/current";
import { db } from "@/server/db";
import { topups } from "@/server/db/schema";
import { qpay } from "@/server/qpay";
import {
  InvalidTierError,
  TopupNotFoundError,
  createTopup,
  getTopupForUser,
  settleTopup,
} from "@/server/topups";

const INVOICES_PER_HOUR = 10; // SPEC §12

export async function createTopupAction(
  amount: number,
): Promise<{ ok: true; id: string } | { ok: false; error: "invalid_tier" | "rate" | "generic" }> {
  const { user } = await requireOnboardedUser();
  if (!z.number().int().positive().safeParse(amount).success)
    return { ok: false, error: "invalid_tier" };

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
      amount,
      appUrl: env().APP_URL,
      callbackSecret: env().QPAY_CALLBACK_SECRET,
      description: `${APP_NAME}: хэтэвч цэнэглэх`,
    });
    return { ok: true, id: t.id };
  } catch (err) {
    if (err instanceof InvalidTierError) return { ok: false, error: "invalid_tier" };
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
