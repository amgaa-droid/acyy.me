import type { Metadata } from "next";

import { AdminNav } from "@/components/admin/admin-nav";
import { BrandMark } from "@/components/app/brand-mark";
import { mn } from "@/i18n/mn";
import { requireAdmin } from "@/server/admin/guard";

export const metadata: Metadata = {
  title: { default: mn.admin.title, template: `%s · ${mn.admin.title}` },
};

/**
 * Admin shell (SPEC §6.2): desktop-first, but usable on a phone. Non-admins get 404.
 * Phone: the menu floats at the bottom (thumb reach; the colour-mode button owns the top).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-dvh bg-bg lg:flex">
      <div className="fixed inset-x-0 bottom-0 z-30 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] lg:sticky lg:top-0 lg:bottom-auto lg:h-dvh lg:w-64 lg:shrink-0 lg:p-4 lg:pr-0">
        <aside className="flex flex-col gap-3 rounded-[24px] bg-nav p-2 text-nav-active shadow-[0_-8px_30px_rgb(0_0_0/0.18)] lg:shadow-none lg:h-full lg:gap-8 lg:rounded-[28px] lg:px-3 lg:py-6">
          <div className="hidden items-center gap-2.5 px-3 lg:flex">
            <BrandMark className="size-5 text-nav-fg" />
            <span className="font-heading text-2xl font-semibold">{mn.admin.title}</span>
          </div>
          <div className="scrollbar-none overflow-x-auto">
            <AdminNav isOwner={admin.role === "owner"} />
          </div>
          <div className="mt-auto hidden px-3 text-xs text-nav-fg lg:block">
            {admin.email}
            <br />
            {mn.me.roles[admin.role]}
          </div>
        </aside>
      </div>
      <main className="min-w-0 flex-1 px-4 pt-20 pb-28 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
