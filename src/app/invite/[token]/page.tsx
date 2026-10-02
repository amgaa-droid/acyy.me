import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/app/brand-mark";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/env";
import { mn } from "@/i18n/mn";
import { getSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { InvitationError, viewInvitation } from "@/server/invitations";
import { AcceptButton } from "./accept-button";

export const metadata: Metadata = { title: "Урилга" };

/** Public invite landing (SPEC §7). Works signed-out; accepting requires an account. */
export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const t = mn.invite.page;
  const session = await getSession();

  let view;
  let error: string | null = null;
  try {
    view = await viewInvitation(db, token);
  } catch (err) {
    error = err instanceof InvitationError ? err.reason : "generic";
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-3xl bg-surface p-7 text-center">
        <BrandMark className="size-10 text-highlight" />
        {view ? (
          <>
            <h1 className="text-4xl leading-tight font-semibold">
              {t.title(view.inviterName, APP_NAME)}
            </h1>
            <p className="text-muted-foreground">{t.body}</p>
            <p className="rounded-2xl bg-tint-1 px-4 py-2 text-sm">{t.asPerson(view.personName)}</p>
            {!session ? (
              <Button
                size="lg"
                className="rounded-full"
                render={<Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} />}
                nativeButton={false}
              >
                {t.login}
              </Button>
            ) : session.user.id === view.inviterUserId ? (
              <p className="text-sm text-muted-foreground">{t.own}</p>
            ) : (
              <AcceptButton token={token} />
            )}
          </>
        ) : (
          <>
            <p className="text-lg font-semibold" role="alert">
              {t.errors[error ?? "generic"]}
            </p>
            <Link href={session ? "/home" : "/"} className="text-sm font-semibold text-highlight">
              {t.home}
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
