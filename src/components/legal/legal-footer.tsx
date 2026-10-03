import Link from "next/link";

import { legalLinks } from "@/i18n/legal";
import { cn } from "@/lib/utils";

/**
 * Terms · Privacy at the very bottom of the signed-out landing. Data deletion and contact
 * are sections of the privacy policy (/privacy#data-deletion, #contact).
 */
export function LegalFooter({ className }: { className?: string }) {
  const link = "inline-flex min-h-11 items-center px-2 hover:text-fg";
  return (
    <nav
      aria-label={legalLinks.contents}
      className={cn("flex flex-wrap justify-center text-sm text-muted-foreground", className)}
    >
      <Link href="/terms" className={link}>
        {legalLinks.terms}
      </Link>
      <span aria-hidden className="inline-flex items-center">·</span>
      <Link href="/privacy" className={link}>
        {legalLinks.privacy}
      </Link>
    </nav>
  );
}
