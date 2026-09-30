import Link from "next/link";

import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/env";
import { mn } from "@/i18n/mn";

// C2: redirect signed-in users to /home and point the button at /login.
export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-between px-6 pt-24 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div>
        <svg viewBox="0 0 100 100" className="mb-8 size-12" aria-hidden>
          <path
            d="M50 14C53 38 62 47 86 50C62 53 53 62 50 86C47 62 38 53 14 50C38 47 47 38 50 14Z"
            fill="currentColor"
          />
        </svg>
        <h1 className="text-6xl font-semibold">{APP_NAME}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{mn.landing.tagline}</p>
      </div>
      <Button size="lg" render={<Link href="/home" />} nativeButton={false}>
        {mn.landing.login}
      </Button>
    </main>
  );
}
