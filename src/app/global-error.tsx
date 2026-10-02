"use client";

import { useEffect } from "react";

import { StatusScreen } from "@/components/app/status-screen";
import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import "./globals.css";

/**
 * An error in the root layout itself. This replaces the layout, so it brings its own document
 * and stylesheet; without the layout's `data-theme` the colours are the default (cosmic) ones.
 */
export default function GlobalError({
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
    <html lang="mn">
      <body>
        <title>{mn.errorPage.title}</title>
        <StatusScreen page title={mn.errorPage.title} body={mn.errorPage.body}>
          <Button size="lg" className="rounded-full" onClick={() => retry()}>
            {mn.errorPage.retry}
          </Button>
        </StatusScreen>
      </body>
    </html>
  );
}
