import type { Metadata } from "next";
import Link from "next/link";

import { StatusScreen, statusAction } from "@/components/app/status-screen";
import { mn } from "@/i18n/mn";

export const metadata: Metadata = { title: mn.notFound.title };

/** Any address the app doesn't have, and `notFound()` outside the app shell (e.g. /admin). */
export default function NotFound() {
  return (
    <StatusScreen page code="404" title={mn.notFound.title} body={mn.notFound.body}>
      {/* "/" sends a signed-in visitor on to /home. */}
      <Link href="/" className={statusAction}>
        {mn.notFound.home}
      </Link>
    </StatusScreen>
  );
}
