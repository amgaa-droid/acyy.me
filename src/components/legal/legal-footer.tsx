import Link from "next/link";

import { LEGAL_CONTACT_EMAIL, legalLinks } from "@/i18n/legal";
import { cn } from "@/lib/utils";

/** Terms · Privacy · contact — under the landing, the login card and the legal pages. */
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
      <Link href="/privacy" className={link}>
        {legalLinks.privacy}
      </Link>
      <Link href="/privacy#data-deletion" className={link}>
        {legalLinks.dataDeletion}
      </Link>
      <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className={link}>
        {legalLinks.contact}
      </a>
    </nav>
  );
}
