"use client";

import Link from "next/link";
import { useEffect } from "react";

import { StatusScreen, statusActionQuiet } from "@/components/app/status-screen";
import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";

/** An unexpected error anywhere under the root layout: say so, offer another try. */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen page title={mn.errorPage.title} body={mn.errorPage.body}>
      <Button size="lg" className="rounded-full" onClick={() => retry()}>
        {mn.errorPage.retry}
      </Button>
      <Link href="/" className={statusActionQuiet}>
        {mn.notFound.home}
      </Link>
    </StatusScreen>
  );
}
