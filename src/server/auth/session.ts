import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { env } from "@/env";
import { auth } from "./index";
import { getUserAdminRole } from "./roles";

/** Current session (deduplicated per request). */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Signed-in user or redirect to /login. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

/** Admin role of a signed-in user (verified email only, see getUserAdminRole). */
export function adminRoleOf(user: { email: string; emailVerified: boolean }) {
  const { ADMIN_OWNER_EMAILS, ADMIN_EDITOR_EMAILS } = env();
  return getUserAdminRole(user, { owners: ADMIN_OWNER_EMAILS, editors: ADMIN_EDITOR_EMAILS });
}
