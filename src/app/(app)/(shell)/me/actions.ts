"use server";

import { requireUser } from "@/server/auth/session";
import { deleteAccount } from "@/server/account-deletion";
import { db } from "@/server/db";

/** "Данс устгах" on /me. The client signs out (clears the cookie) once this returns ok. */
export async function deleteAccountAction(confirmed: boolean): Promise<{ ok: boolean }> {
  if (confirmed !== true) return { ok: false };
  const user = await requireUser();
  try {
    await deleteAccount(db, user.id);
    return { ok: true };
  } catch (err) {
    console.error("[account.delete]", err);
    return { ok: false };
  }
}
