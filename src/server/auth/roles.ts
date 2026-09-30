/** Admin roles from env (SPEC §5). Owner = everything; Editor = content only. */
export type AdminRole = "owner" | "editor";

export function parseEmailList(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function getAdminRole(
  email: string | null | undefined,
  lists: { owners: string | undefined; editors: string | undefined },
): AdminRole | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  if (parseEmailList(lists.owners).has(e)) return "owner";
  if (parseEmailList(lists.editors).has(e)) return "editor";
  return null;
}

export function canManageContent(role: AdminRole | null): boolean {
  return role === "owner" || role === "editor";
}

export function canManageMoney(role: AdminRole | null): boolean {
  return role === "owner";
}
