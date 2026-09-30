"use client";

import { RangesEditor, type RangeRow } from "@/components/admin/ranges-editor";
import { saveSignRangesAction } from "../actions";

export function ZodiacEditor({ rows }: { rows: RangeRow[] }) {
  return (
    <RangesEditor
      rows={rows}
      onSave={(rs) =>
        saveSignRangesAction(
          rs.map((r) => ({ code: r.id, startMd: r.startMd.trim(), endMd: r.endMd.trim() })),
        )
      }
    />
  );
}
