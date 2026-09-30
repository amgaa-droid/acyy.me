"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { mn } from "@/i18n/mn";
import { recheckTopupAction } from "../actions";

export function RecheckButton({ id }: { id: string }) {
  const router = useRouter();
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="flex items-center justify-end gap-2">
      {result && (
        <span className="text-xs text-muted-foreground">
          {mn.admin.topups.recheckResult(result)}
        </span>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await recheckTopupAction(id);
            setResult(mn.admin.topups.status[res.status] ?? res.status);
            router.refresh();
          })
        }
        className="h-9 rounded-full bg-subtle px-3 text-xs font-semibold whitespace-nowrap hover:ring-2 hover:ring-border"
      >
        {mn.admin.topups.recheck}
      </button>
    </span>
  );
}
