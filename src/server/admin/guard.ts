import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { requireUser, adminRoleOf } from "@/server/auth/session";
import { canManageContent, canManageMoney, type AdminRole } from "@/server/auth/roles";

/**
 * Admin access (CLAUDE.md rule 4). Non-admins get a 404 so the admin area isn't discoverable.
 * Editor = content, import, sign/period ranges. Owner = everything.
 */
export const requireAdmin = cache(
  async (): Promise<{ userId: string; email: string; role: AdminRole }> => {
    const user = await requireUser();
    const role = adminRoleOf(user.email);
    if (!canManageContent(role)) notFound();
    return { userId: user.id, email: user.email, role: role! };
  },
);

export async function requireOwner() {
  const admin = await requireAdmin();
  if (!canManageMoney(admin.role)) notFound();
  return admin;
}
