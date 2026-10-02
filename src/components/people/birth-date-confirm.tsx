"use client";

import { BottomSheet } from "@/components/app/bottom-sheet";
import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { parseIsoDate } from "@/lib/birth-date";

const t = mn.people.confirmBirth;

/**
 * The last step before a person is saved: the birth date read back, spelled out. It can't be
 * changed afterwards (CLAUDE.md rule 2) and the wheel it was picked on moves easily, so a
 * wrong one is caught here — "Засах" goes back with nothing saved.
 */
export function BirthDateConfirm({
  open,
  onOpenChange,
  name,
  birthDate,
  busy,
  onConfirm,
  onFix,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  /** "YYYY-MM-DD" */
  birthDate: string;
  /** Saving (or saved and on the way out): both buttons wait. */
  busy: boolean;
  onConfirm: () => void;
  onFix: () => void;
}) {
  const ymd = parseIsoDate(birthDate);
  return (
    <BottomSheet
      title={t.title}
      description={t.body}
      open={open}
      onOpenChange={(next) => !busy && onOpenChange(next)}
      footer={
        <>
          <Button size="lg" className="rounded-full" disabled={busy} onClick={onConfirm}>
            {t.yes}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="rounded-full"
            disabled={busy}
            onClick={onFix}
          >
            {t.fix}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-1 rounded-3xl bg-subtle px-5 py-5 text-center">
        <span className="max-w-full truncate text-sm text-muted-foreground">{name.trim()}</span>
        <span className="font-heading text-[28px] leading-tight font-semibold text-balance">
          {ymd ? mn.datePicker.long(ymd.y, ymd.m, ymd.d) : birthDate}
        </span>
      </div>
    </BottomSheet>
  );
}
