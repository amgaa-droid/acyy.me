"use client";

import { Download, Share2 } from "lucide-react";
import { useState, type ReactElement } from "react";

import { BottomSheet } from "@/components/app/bottom-sheet";
import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";

const t = mn.share;

/**
 * The share sheet (SPEC §8): story/square card → Web Share (as a file) → fallback: download.
 * With `quote` (text selected in the reading) the card carries that text instead of the summary.
 */
export function ShareSheet({
  purchaseId,
  quote,
  trigger,
  open,
  onOpenChange,
}: {
  purchaseId: string;
  quote?: string;
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [format, setFormat] = useState<"story" | "square">("story");
  const [hide, setHide] = useState(false);
  const [busy, setBusy] = useState(false);
  const query = new URLSearchParams({ format });
  if (hide) query.set("hide", "1");
  if (quote) query.set("quote", quote);
  const src = `/api/share/${purchaseId}?${query}`;

  const fetchFile = async () => {
    const res = await fetch(src);
    if (!res.ok) throw new Error(String(res.status));
    return new File([await res.blob()], `zurkhai-${format}.png`, { type: "image/png" });
  };

  const download = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  const share = async () => {
    setBusy(true);
    try {
      const file = await fetchFile();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] }).catch(() => undefined); // dismissed = fine
      } else download(file);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      title={t.title}
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="lg"
            className="rounded-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                download(await fetchFile());
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download aria-hidden /> {t.download}
          </Button>
          <Button size="lg" className="rounded-full" disabled={busy} onClick={share}>
            <Share2 aria-hidden /> {busy ? t.preparing : t.shareFile}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.title}>
          {(["story", "square"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={format === f}
              onClick={() => setFormat(f)}
              className={cn(
                "h-11 rounded-full text-sm font-semibold",
                format === f ? "bg-primary text-primary-foreground" : "bg-subtle",
              )}
            >
              {t[f]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hide}
            onChange={(e) => setHide(e.target.checked)}
            className="size-4"
          />
          {t.hideNames}
        </label>
        {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG preview */}
        <img
          src={src}
          alt=""
          className={cn(
            "mx-auto rounded-2xl bg-subtle",
            format === "story" ? "aspect-9/16 h-72" : "size-60",
          )}
        />
      </div>
    </BottomSheet>
  );
}

/** "Хуваалцах": the reading's summary card, a full-width button under the name card. */
export function ShareCardButton({ purchaseId }: { purchaseId: string }) {
  return (
    <ShareSheet
      purchaseId={purchaseId}
      trigger={
        <Button size="lg" className="h-12 w-full gap-2 rounded-full">
          <Share2 aria-hidden /> {t.button}
        </Button>
      }
    />
  );
}
