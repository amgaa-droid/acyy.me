"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { authClient } from "@/lib/auth-client";

const t = mn.me.accounts;

/**
 * /me: link Google or Facebook to this account, so either signs in too. Linking goes through
 * the provider and back to /me (`?error=…` when it fails, e.g. that account belongs to someone
 * else).
 */
export function LinkedAccounts({
  providers,
  linked,
  error,
}: {
  providers: ("google" | "facebook")[];
  linked: string[];
  error?: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  if (providers.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
      <div>
        <h2 className="text-xl font-semibold">{t.title}</h2>
        <p className="text-sm text-muted-foreground">{t.hint}</p>
      </div>
      {error && (
        <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t.errors[error.toLowerCase()] ?? t.errors.generic}
        </p>
      )}
      <ul className="flex flex-col divide-y divide-border">
        {providers.map((p) => {
          const name = t.providers[p] ?? p;
          return (
            <li key={p} className="flex min-h-14 items-center justify-between gap-3 py-2">
              <span className="text-base font-semibold">{name}</span>
              {linked.includes(p) ? (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-highlight">
                  <Check className="size-4" strokeWidth={2.5} aria-hidden /> {t.linked}
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-full px-5"
                  aria-label={t.linkAria(name)}
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy(p);
                    const res = await authClient.linkSocial({
                      provider: p,
                      callbackURL: "/me",
                      errorCallbackURL: "/me",
                    });
                    if (res.error) setBusy(null);
                  }}
                >
                  {t.link}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
