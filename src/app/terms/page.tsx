import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { terms } from "@/i18n/legal";

export const metadata: Metadata = { title: terms.title };

/** Public (no session needed) — Google and Facebook sign-in link here. */
export default function TermsPage() {
  return <LegalPage doc={terms} />;
}
