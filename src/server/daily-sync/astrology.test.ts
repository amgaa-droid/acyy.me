import { describe, expect, it } from "vitest";

import {
  SourceError,
  htmlToText,
  loadSourcePage,
  parseLongDate,
  parseSourcePage,
  sourceUrl,
} from "./astrology";

/** A made-up page with the same structure as astrology.com's (not their text). */
function page(opts: { body: string; iso?: string; long?: string; sign?: string }) {
  return `<html><body>
    <span id="content-date">${opts.long ?? "October 3, 2026"}</span>
    <div class="horoscope-content-wrapper">
      <div id="content">${opts.body}</div>
      <div id="content-couples" class="horoscope-content-container"><p>Couples extra.</p></div>
    </div>
    <script>ChatWidgetV5.init({ zodiacSign: "${opts.sign ?? "aries"}",${
      opts.iso ? ` horoscopeDate: "${opts.iso}",` : ""
    } horoscopeType: "daily" });</script>
  </body></html>`;
}

describe("astrology.com pages", () => {
  it("builds the tomorrow URL per kind", () => {
    expect(sourceUrl("general", "aries")).toBe(
      "https://www.astrology.com/horoscope/daily/tomorrow/aries.html",
    );
    expect(sourceUrl("love", "pisces")).toBe(
      "https://www.astrology.com/horoscope/daily-love/tomorrow/pisces.html",
    );
    expect(sourceUrl("work", "leo")).toBe(
      "https://www.astrology.com/horoscope/daily-work/tomorrow/leo.html",
    );
    expect(() => sourceUrl("money", "leo")).toThrow();
  });

  it("takes only the main text, joining inline tags and decoding entities", () => {
    const p = parseSourcePage(
      page({
        iso: "2026-10-03",
        body: `<p><span>Big energy now,</span><a href="/x"> <span>Aries</span></a><span>. You&rsquo;ll shine &amp; glow.</span></p>
               <p>Second   paragraph&#33;</p>`,
      }),
    );
    expect(p).toEqual({
      date: "2026-10-03",
      sign: "aries",
      text: "Big energy now, Aries. You’ll shine & glow.\n\nSecond paragraph!",
    });
  });

  it("reads a bare-text body and falls back to the visible date", () => {
    const p = parseSourcePage(page({ body: "\n  Helping a coworker pays off.\n  " }));
    expect(p.date).toBe("2026-10-03");
    expect(p.text).toBe("Helping a coworker pays off.");
  });

  it("parses long dates, including year ends", () => {
    expect(parseLongDate("December 31, 2026")).toBe("2026-12-31");
    expect(parseLongDate("January 1, 2027")).toBe("2027-01-01");
    expect(parseLongDate("February 29, 2028")).toBe("2028-02-29");
    expect(parseLongDate("Smarch 1, 2026")).toBeNull();
  });

  it("fails on a page without text or date", () => {
    expect(() => parseSourcePage(page({ body: "  " }))).toThrow(SourceError);
    expect(() => parseSourcePage("<html>Not found</html>")).toThrow(SourceError);
  });

  it("rejects a page for another sign", async () => {
    const fetchPage = async () => page({ body: "x", sign: "taurus" });
    await expect(loadSourcePage(fetchPage, "general", "aries")).rejects.toMatchObject({
      code: "wrong_sign",
    });
  });

  it("strips scripts and handles <br>", () => {
    expect(htmlToText("a<br>b<script>evil()</script>")).toBe("a\n\nb");
  });
});
