import { CircleUser, House, Sparkles, Users } from "lucide-react";

import { mn } from "@/i18n/mn";

/** Primary navigation: bottom tab bar on mobile, sidebar on desktop. */
export const NAV_ITEMS = [
  { href: "/home", label: mn.tabs.home, Icon: House },
  { href: "/people", label: mn.tabs.people, Icon: Users },
  { href: "/readings", label: mn.tabs.readings, Icon: Sparkles },
  { href: "/me", label: mn.tabs.me, Icon: CircleUser },
] as const;

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
