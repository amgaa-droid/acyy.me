"use client";

import { RangesEditor, type RangeRow } from "@/components/admin/ranges-editor";
import { savePeriodRangesAction } from "../actions";

export function PeriodsEditor({ rows }: { rows: RangeRow[] }) {
  return (
    <RangesEditor
      rows={rows}
      withLabel
      onSave={(rs) =>
        savePeriodRangesAction(
          rs.map((r) => ({
            no: Number(r.id),
            startMd: r.startMd.trim(),
            endMd: r.endMd.trim(),
            label: r.label ?? null,
          })),
        )
      }
    />
  );
}
