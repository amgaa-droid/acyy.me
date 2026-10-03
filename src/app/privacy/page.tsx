import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { privacy } from "@/i18n/legal";

export const metadata: Metadata = { title: privacy.title };

/** Public (no session needed) — Google and Facebook sign-in link here. */
export default function PrivacyPage() {
  return <LegalPage doc={privacy} />;
}
