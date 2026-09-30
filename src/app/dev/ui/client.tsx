"use client";

import { useState } from "react";

import { BottomSheet } from "@/components/app/bottom-sheet";
import { DatePicker } from "@/components/app/date-picker";
import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";

export function DevDateAndSheet() {
  const [date, setDate] = useState("1995-10-30");

  return (
    <>
      <section className="space-y-3">
        <h2 className="text-2xl">DatePicker</h2>
        <DatePicker value={date} onChange={setDate} />
        <p className="text-sm text-muted-foreground" data-testid="date-value">
          {date} · {mn.datePicker.immutableWarning}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">BottomSheet</h2>
        <BottomSheet
          title="Баталгаажуулах"
          description="1,000₮ хасагдана · Үлдэгдэл 3,500 → 2,500"
          trigger={<Button variant="outline">Sheet нээх</Button>}
          footer={<Button size="lg">Нээх · 1,000₮</Button>}
        />
      </section>
    </>
  );
}
