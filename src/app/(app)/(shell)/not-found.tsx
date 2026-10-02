import Link from "next/link";

import { StatusScreen, statusAction } from "@/components/app/status-screen";
import { mn } from "@/i18n/mn";

/** A person or reading that isn't there (or isn't the viewer's): said inside the open sheet. */
export default function NotFound() {
  return (
    <StatusScreen code="404" title={mn.notFound.title} body={mn.notFound.body}>
      <Link href="/home" scroll={false} className={statusAction}>
        {mn.notFound.home}
      </Link>
    </StatusScreen>
  );
}
