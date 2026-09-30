"use client";

import { Download, Share2 } from "lucide-react";
import { useState } from "react";

import { BottomSheet } from "@/components/app/bottom-sheet";
import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { cn } from "@/lib/utils";

const t = mn.share;

/** "Хуваалцах" (SPEC §8): story/square card → Web Share (as a file) → fallback: download. */
export function ShareCardButton({ purchaseId }: { purchaseId: string }) {
  const [format, setFormat] = useState<"story" | "square">("story");
  const [hide, setHide] = useState(false);
  const [busy, setBusy] = useState(false);
  const src = `/api/share/${purchaseId}?format=${format}${hide ? "&hide=1" : ""}`;

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
      trigger={
        <Button className="rounded-full">
          <Share2 aria-hidden /> {t.button}
        </Button>
      }
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
            format === "story" ? "h-72 w-auto" : "size-60",
          )}
        />
      </div>
    </BottomSheet>
  );
}
