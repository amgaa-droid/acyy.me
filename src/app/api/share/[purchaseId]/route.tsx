import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { APP_NAME, env } from "@/env";
import { avatarBase64Uri } from "@/lib/avatars";
import { relationText } from "@/lib/people";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { ReadingNotFoundError, getReading, readingPeople } from "@/server/reading";
import { renderCard } from "@/server/share/card";
import {
  cardChips,
  cardExcerpt,
  cardMonthDay,
  cardName,
  cardQuote,
  cardStrengths,
} from "@/server/share/text";

export const runtime = "nodejs";

/** A selection longer than this is cut before matching (the card shows far less). */
const SELECTION_MAX = 2_000;

/**
 * GET /api/share/:purchaseId?format=story|square&hide=1&quote=… (SPEC §8).
 * Only the owner — or a user with free view (linked synastry) — can render a card.
 * Unbought readings have no purchase id, so they can never get a card.
 * `quote` = text the reader selected; it must be text of this reading (else 400).
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
  const selection = req.nextUrl.searchParams.get("quote");
  const excerpt =
    selection === null ? null : cardExcerpt(reading.sections, selection.slice(0, SELECTION_MAX));
  if (selection !== null && !excerpt) return new NextResponse("Bad request", { status: 400 });

  // Name, relation and avatar of the (possibly since-edited) people the viewer owns; else the
  // snapshot. Never the sign or the full birth date: a card reads as the person's own.
  const live = await readingPeople(db, session.user.id, reading.personIds);
  const people = reading.snapshot.persons.map((p, i) => ({
    name: cardName(live[i]?.name ?? p.name, hide),
    relation: live[i] ? relationText(live[i]) : null,
    avatarUri: avatarBase64Uri(live[i]?.avatarSeed ?? p.name),
  }));
  const pair = people.length === 2;
  // A quote sub-section reads best on a card; otherwise the first prose text.
  const fields = reading.sections.flatMap((s) => s.fields ?? []);
  const quoteSource =
    fields.find((f) => f.kind === "quote") ?? fields.find((f) => f.kind === "text");
  const byBirthday = reading.sections.some((s) => s.keyType === "month_day");

  const image = await renderCard({
    format,
    productName: reading.productName,
    people,
    // Two people: the headline the reading's hero shows. One: the birthday, when the text is its.
    title: pair
      ? (reading.sections.find((s) => s.fields !== null && s.title)?.title ?? null)
      : byBirthday
        ? cardMonthDay(reading.snapshot.persons[0].birthDate)
        : null,
    list: pair ? null : cardStrengths(reading.sections),
    chips: pair ? cardChips(reading.sections) : null,
    score: reading.sections.find((s) => s.score !== null)?.score ?? null,
    quote: cardQuote(quoteSource?.value),
    excerpt,
    appName: APP_NAME,
    host: new URL(env().APP_URL).host,
  });
  image.headers.set("Cache-Control", "private, no-store");
  image.headers.set("Content-Disposition", `inline; filename="zurkhai-${format}.png"`);
  return image;
}
