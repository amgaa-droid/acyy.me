"use client";

import { Check, Mail, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BottomSheet } from "@/components/app/bottom-sheet";
import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { formatDate } from "@/lib/birth-date";
import {
  createInviteLinkAction,
  revokeInviteAction,
  sendInviteEmailAction,
} from "./invite-actions";

const t = mn.invite;

type State =
  | { kind: "linked" }
  | {
      kind: "pending";
      invitationId: string;
      expiresAt: string;
      channel: "link" | "email";
      email: string | null;
    }
  | { kind: "unlinked_by_them" }
  | { kind: "none" };

const errorText = (e: string) =>
  e === "invalid_email"
    ? mn.login.errors.invalidEmail
    : (t.page.errors[e] ?? t.page.errors.generic);

/** "Урих" on a person's page (SPEC §7): copy/share a link or send an email invitation. */
export function InviteSection({
  personId,
  state,
  inviterName,
  appName,
}: {
  personId: string;
  state: State;
  inviterName: string;
  appName: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [email, setEmail] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (state.kind === "linked") {
    return (
      <Box>
        <p className="flex items-center gap-1 text-sm font-semibold text-highlight">
          <Check className="size-4" strokeWidth={2.5} aria-hidden /> {t.linked}
        </p>
      </Box>
    );
  }

  const shareLink = () =>
    startTransition(async () => {
      setMsg(null);
      const res = await createInviteLinkAction(personId);
      if (!res.ok || !res.url) {
        setMsg({ ok: false, text: errorText(res.ok ? "generic" : res.error) });
        return;
      }
      const text = t.shareText(inviterName, appName);
      try {
        if (typeof navigator.share === "function") {
          await navigator.share({ title: appName, text, url: res.url });
          setMsg({ ok: true, text: t.copied });
        } else {
          await navigator.clipboard.writeText(res.url);
          setMsg({ ok: true, text: t.copied });
        }
      } catch {
        // Share sheet dismissed, or clipboard blocked — show the link so it can be copied by hand.
        setMsg({ ok: true, text: res.url });
      }
      router.refresh();
    });

  const sendEmail = () =>
    startTransition(async () => {
      const res = await sendInviteEmailAction(personId, email);
      if (res.ok) {
        setSheetOpen(false);
        setMsg({ ok: true, text: t.sent(email.trim()) });
        setEmail("");
        router.refresh();
      } else setMsg({ ok: false, text: errorText(res.error) });
    });

  return (
    <Box>
      <p className="text-sm text-muted-foreground">
        {state.kind === "unlinked_by_them" ? t.unlinkedByThem : t.sectionHint}
      </p>
      {state.kind === "pending" && (
        <p className="flex items-center justify-between gap-2 rounded-2xl bg-subtle px-4 py-2.5 text-sm">
          <span>
            {t.pending(formatDate(new Date(state.expiresAt)))}
            {state.email && ` · ${state.email}`}
          </span>
          <button
            type="button"
            className="h-9 shrink-0 rounded-full px-3 text-xs font-semibold text-destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await revokeInviteAction(personId, state.invitationId);
                router.refresh();
              })
            }
          >
            {t.revoke}
          </button>
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="rounded-full" disabled={pending} onClick={shareLink}>
          <Share2 aria-hidden />
          {t.copyLink}
        </Button>
        <BottomSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={t.byEmail}
          trigger={
            <Button variant="outline" className="rounded-full">
              <Mail aria-hidden /> {t.byEmail}
            </Button>
          }
          footer={
            <Button
              size="lg"
              className="rounded-full"
              disabled={pending || !email.includes("@")}
              onClick={sendEmail}
            >
              {t.send}
            </Button>
          }
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t.emailLabel}
            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-2xl bg-subtle px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </BottomSheet>
      </div>
      {msg && (
        <p
          role="status"
          className={msg.ok ? "text-sm break-all text-highlight" : "text-sm text-destructive"}
          data-testid="invite-status"
        >
          {msg.text}
        </p>
      )}
    </Box>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
      <h2 className="text-xl font-semibold">{t.sectionTitle}</h2>
      {children}
    </section>
  );
}
