import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { APP_NAME, env } from "@/env";
import { avatarBase64Uri } from "@/lib/avatars";
import { loadAstroRefs } from "@/server/astro/refs";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { ReadingNotFoundError, getReading, readingPeople } from "@/server/reading";
import { renderCard } from "@/server/share/card";
import { cardName, cardQuote } from "@/server/share/text";

export const runtime = "nodejs";

/**
 * GET /api/share/:purchaseId?format=story|square&hide=1 (SPEC §8).
 * Only the owner — or a user with free view (linked synastry) — can render a card.
 * Unbought readings have no purchase id, so they can never get a card.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/share/[purchaseId]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { purchaseId } = await ctx.params;
  let reading;
  try {
    reading = await getReading(db, session.user.id, purchaseId);
  } catch (err) {
    if (err instanceof ReadingNotFoundError) return new NextResponse("Not found", { status: 404 });
    throw err;
  }

  const format = req.nextUrl.searchParams.get("format") === "square" ? "square" : "story";
  const hide = req.nextUrl.searchParams.get("hide") === "1";
  const refs = await loadAstroRefs(db);
  const signName = (code: string) => refs.signs.find((s) => s.code === code)?.nameMn ?? code;

  // Name and avatar of the (possibly since-edited) people the viewer owns; else the snapshot.
  const live = await readingPeople(db, session.user.id, reading.personIds);
  const people = reading.snapshot.persons.map((p, i) => ({
    name: cardName(live[i]?.name ?? p.name, hide),
    sign: p.sign,
    signName: signName(p.sign),
    avatarUri: avatarBase64Uri(live[i]?.avatarSeed ?? p.name),
  }));
  const pair = people.length === 2;
  // A quote sub-section reads best on a card; otherwise the first prose text.
  const fields = reading.sections.flatMap((s) => s.fields ?? []);
  const quoteSource =
    fields.find((f) => f.kind === "quote") ?? fields.find((f) => f.kind === "text");

  const image = await renderCard({
    format,
    productName: reading.productName,
    people,
    title: pair ? `${people[0].signName} & ${people[1].signName}` : people[0].signName,
    score: reading.sections.find((s) => s.score !== null)?.score ?? null,
    quote: cardQuote(quoteSource?.value),
    appName: APP_NAME,
    host: new URL(env().APP_URL).host,
  });
  image.headers.set("Cache-Control", "private, no-store");
  image.headers.set("Content-Disposition", `inline; filename="zurkhai-${format}.png"`);
  return image;
}
