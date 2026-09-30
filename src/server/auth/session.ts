import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { env } from "@/env";
import { auth } from "./index";
import { getAdminRole } from "./roles";

/** Current session (deduplicated per request). */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Signed-in user or redirect to /login. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

export function adminRoleOf(email: string) {
  const { ADMIN_OWNER_EMAILS, ADMIN_EDITOR_EMAILS } = env();
  return getAdminRole(email, { owners: ADMIN_OWNER_EMAILS, editors: ADMIN_EDITOR_EMAILS });
}
