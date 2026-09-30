import { notFound } from "next/navigation";

import { Avatar } from "@/components/app/avatar";
import { ConstellationArt } from "@/components/app/constellation";
import { SignHero } from "@/components/app/sign-hero";
import { PageTitle } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AVATAR_SEEDS } from "@/lib/avatars";
import { ZODIAC_SIGNS } from "@/server/db/seed-data";
import { DevDateAndSheet } from "./client";

/** Component gallery for manual testing. Disabled in production builds. */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-md space-y-10 bg-bg px-4 py-8">
      <PageTitle>UI</PageTitle>

      <SignHero
        label="Таны орд"
        signCode="scorpio"
        signName="Хилэнц"
        chips={["10-23 – 11-21", "41-р үе"]}
      />

      <section className="space-y-3">
        <h2 className="text-2xl">Орд (12)</h2>
        <div className="grid grid-cols-4 gap-2">
          {ZODIAC_SIGNS.map((s) => (
            <div key={s.code} className="flex flex-col items-center rounded-2xl bg-surface p-2">
              <ConstellationArt sign={s.code} className="size-16" />
              <span className="text-xs">{s.nameMn}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">Button</h2>
        <Button size="lg">Үндсэн</Button>
        <div className="flex flex-wrap gap-2">
          <Button>Default</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Устгах</Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">Card</h2>
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Хилэнц</CardTitle>
            <CardDescription>10-23 – 11-21</CardDescription>
          </CardHeader>
          <CardContent>Эрч хүчтэй, нууцлаг, үнэнч.</CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">Avatar ({AVATAR_SEEDS.length})</h2>
        <div className="grid grid-cols-5 gap-3">
          {AVATAR_SEEDS.map((seed) => (
            <Avatar key={seed} seed={seed} size={56} alt={seed} />
          ))}
        </div>
      </section>

      <DevDateAndSheet />
    </main>
  );
}
