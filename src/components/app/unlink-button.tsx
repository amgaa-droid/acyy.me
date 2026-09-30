"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { unlinkMeAction } from "@/app/(app)/people/[id]/invite-actions";
import { BottomSheet } from "@/components/app/bottom-sheet";
import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";

/** "Намайг хасах" for a user linked to someone else's person. */
export function UnlinkButton({
  personId,
  then = "/readings?tab=mine",
}: {
  personId: string;
  then?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <BottomSheet
      title={mn.invite.unlink}
      description={mn.invite.unlinkConfirm}
      trigger={
        <Button variant="ghost" size="sm" className="rounded-full text-destructive">
          {mn.invite.unlink}
        </Button>
      }
      footer={
        <Button
          variant="destructive"
          size="lg"
          className="rounded-full"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await unlinkMeAction(personId);
              router.push(then);
              router.refresh();
            })
          }
        >
          {mn.invite.unlink}
        </Button>
      }
    />
  );
}
