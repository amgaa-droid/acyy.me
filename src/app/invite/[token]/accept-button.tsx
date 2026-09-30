"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { acceptInviteAction } from "./actions";

export function AcceptButton({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        size="lg"
        className="rounded-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await acceptInviteAction(token);
            if (res?.error)
              setError(mn.invite.page.errors[res.error] ?? mn.invite.page.errors.generic);
          })
        }
      >
        {mn.invite.page.accept}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
