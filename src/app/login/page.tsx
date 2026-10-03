import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandMark } from "@/components/app/brand-mark";
import { CurrentThemeToggle } from "@/components/app/current-theme-toggle";
import { LegalFooter } from "@/components/legal/legal-footer";
import { APP_NAME, env } from "@/env";
import { mn } from "@/i18n/mn";
import { safeNext } from "@/lib/safe-next";
import { enabledSocialProviders } from "@/server/auth";
import { getSession } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: mn.login.title };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Back from Google/Facebook: Better Auth adds ?error=… when the sign-in failed.
  const { next, error } = await searchParams;
  const target = safeNext(typeof next === "string" ? next : undefined);
  if (await getSession()) redirect(target);

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <Link
        href="/"
        aria-label={mn.login.home}
        className="absolute top-[max(env(safe-area-inset-top),1rem)] left-4 flex size-11 items-center justify-center rounded-full border border-border bg-surface lg:top-6 lg:left-6"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </Link>
      <CurrentThemeToggle
        className="absolute top-[max(env(safe-area-inset-top),1rem)] right-4 lg:top-6 lg:right-6"
      />
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandMark className="size-10 text-highlight" />
          <span className="font-heading text-3xl font-semibold">{APP_NAME}</span>
        </Link>
        <div className="rounded-3xl bg-surface p-6 lg:p-8">
          <h1 className="text-4xl leading-none font-semibold">{mn.login.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{mn.login.subtitle}</p>
          <LoginForm
            next={target}
            passwordEnabled={env().AUTH_PASSWORD_ENABLED}
            providers={enabledSocialProviders}
            socialError={typeof error === "string" ? error : undefined}
            devMail={env().NODE_ENV !== "production" && env().EMAIL_TRANSPORT === "console"}
          />
        </div>
        <LegalFooter className="mt-4" />
      </div>
    </main>
  );
}
