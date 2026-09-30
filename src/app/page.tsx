import Link from "next/link";

import { BrandMark } from "@/components/app/brand-mark";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/env";
import { mn } from "@/i18n/mn";

// C2: redirect signed-in users to /home and point the button at /login.
export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-between px-6 pt-24 pb-[calc(env(safe-area-inset-bottom)+2rem)] lg:max-w-3xl lg:justify-center lg:gap-12 lg:pt-0">
      <div>
        <BrandMark className="mb-8 size-12 lg:size-16" />
        <h1 className="text-6xl font-semibold lg:text-8xl">{APP_NAME}</h1>
        <p className="mt-4 text-lg text-muted-foreground lg:text-2xl">{mn.landing.tagline}</p>
      </div>
      <Button size="lg" className="lg:w-60" render={<Link href="/home" />} nativeButton={false}>
        {mn.landing.login}
      </Button>
    </main>
  );
}
