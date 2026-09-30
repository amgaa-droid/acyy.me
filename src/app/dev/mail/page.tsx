import { notFound } from "next/navigation";

import { PageTitle } from "@/components/app/empty-state";
import { listEmails } from "@/server/email/outbox";

export const dynamic = "force-dynamic";

/** Dev outbox: emails sent by this server process (e.g. OTP codes) when Mailpit isn't running. */
export default function DevMailPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const emails = listEmails();

  return (
    <main className="mx-auto max-w-2xl bg-bg px-4 py-8">
      {/* Refresh every 3 s so a freshly sent OTP shows up without reloading. */}
      <meta httpEquiv="refresh" content="3" />
      <PageTitle>Dev mail</PageTitle>
      {emails.length === 0 && <p className="text-muted-foreground">Имэйл алга.</p>}
      <ul className="flex flex-col gap-3">
        {emails.map((m) => (
          <li key={m.id} className="rounded-2xl bg-surface p-4" data-testid="dev-mail">
            <div className="text-xs text-muted-foreground">
              {m.at.toISOString()} → <span data-testid="dev-mail-to">{m.to}</span>
            </div>
            <div className="font-semibold">{m.subject}</div>
            <pre className="mt-2 text-sm whitespace-pre-wrap">{m.text}</pre>
          </li>
        ))}
      </ul>
    </main>
  );
}
