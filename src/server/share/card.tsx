import { readFile } from "node:fs/promises";
import { COSMIC } from "@/lib/palette";
import path from "node:path";

import { ImageResponse } from "next/og";

import { STAR_PATH } from "@/lib/brand-icon";
import { CONSTELLATIONS } from "@/lib/constellations";

import type { CardList } from "./text";

/**
 * Share cards (SPEC §8): story 1080×1920 / square 1080×1080 via next/og.
 * The default OG font has no Cyrillic, so Inter + Cormorant Garamond are loaded from
 * src/assets/fonts — including the cyrillic-ext subsets that contain Ө and Ү, and latin-ext for ₮.
 * Cards always use the Cosmic palette (brand images), regardless of the viewer's theme.
 *
 * A card reads as the person's own: name, avatar and what the text says about them. The sign is
 * never named — its constellation stays as artwork — and there is no full birth date (a birthday
 * text shows the day without the year).
 */

const C = {
  ground: COSMIC.bg,
  ink: COSMIC.fg,
  muted: COSMIC.muted,
  highlight: COSMIC.highlight,
  lavender: COSMIC["tint-1"],
  blush: COSMIC["tint-2"],
  coral: COSMIC["ring-2"],
  white: COSMIC.surface,
};

const SUBSETS = ["latin", "latin-ext", "cyrillic", "cyrillic-ext"] as const;
const SERIF = SUBSETS.map((s) => `"Serif-${s}"`).join(", ");
const SANS = SUBSETS.map((s) => `"Sans-${s}"`).join(", ");

type FontSpec = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600; style: "normal" };
let fontsPromise: Promise<FontSpec[]> | undefined;

function loadCardFonts(): Promise<FontSpec[]> {
  fontsPromise ??= (async () => {
    const dir = path.join(process.cwd(), "src/assets/fonts");
    // One family name per subset: satori keeps only the first font per (name, weight), so
    // sharing a name would silently drop the Cyrillic files. SERIF/SANS list them in order.
    const files: [string, string, 400 | 600][] = SUBSETS.flatMap((sub) => [
      [`Serif-${sub}`, `cormorant-garamond-${sub}-600-normal.woff`, 600],
      [`Sans-${sub}`, `inter-${sub}-400-normal.woff`, 400],
      [`Sans-${sub}`, `inter-${sub}-600-normal.woff`, 600],
    ]);
    return Promise.all(
      files.map(async ([name, file, weight]) => {
        const buf = await readFile(path.join(dir, file));
        return {
          name,
          data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
          weight,
          style: "normal" as const,
        };
      }),
    );
  })();
  return fontsPromise;
}

type CardPerson = {
  name: string;
  relation: string | null;
  /** `zodiac_signs.code` — picks the constellation artwork only; the sign is never named. */
  sign: string;
  avatarUri: string;
};

type CardData = {
  format: "story" | "square";
  productName: string;
  people: CardPerson[];
  /** Two people: the reading's headline. One person: the birthday ("3-р сарын 25"), else the name. */
  title: string | null;
  /** One person: "Энэ өдөр төрсөн хүмүүсийн давуу тал". */
  list: CardList | null;
  /** Two people: "Нийцтэй харилцаа". */
  chips: CardList | null;
  score: number | null;
  /** One sentence of the text — only for one-person cards that have nothing else to show. */
  quote: string | null;
  /** Text the reader selected — the card is then the people and this text only. */
  excerpt: string | null;
  appName: string;
  host: string;
};

/** Shrinks a display size for text longer than `fits` characters. */
const fit = (size: number, text: string, fits: number) =>
  text.length <= fits ? size : Math.round((size * fits) / text.length);

const LABEL = { fontWeight: 600, letterSpacing: 4, textTransform: "uppercase" } as const;

function Star({ size, color = C.highlight }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path d={STAR_PATH} fill={color} />
    </svg>
  );
}

/** The sign's constellation as artwork; `ring` adds the faint circle around a large one. */
function Constellation({ sign, size, ring }: { sign: string; size: number; ring?: boolean }) {
  const art = CONSTELLATIONS[sign];
  if (!art) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {ring && (
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke={C.highlight}
          strokeOpacity="0.25"
          strokeWidth="0.4"
        />
      )}
      {art.lines.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={art.stars[a][0]}
          y1={art.stars[a][1]}
          x2={art.stars[b][0]}
          y2={art.stars[b][1]}
          stroke={C.ink}
          strokeWidth="0.6"
        />
      ))}
      {art.stars.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === art.bright ? 3 : 1.4}
          fill={i === art.bright ? C.highlight : C.ink}
        />
      ))}
    </svg>
  );
}

function AvatarDisc({ uri, size, ring }: { uri: string; size: number; ring?: string }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size,
        background: C.white,
        ...(ring && { border: `8px solid ${ring}` }),
        display: "flex",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- rendered by satori */}
      <img src={uri} width={size} height={size} alt="" />
    </div>
  );
}

function Quote({ text, story }: { text: string; story: boolean }) {
  return (
    <div
      style={{
        marginTop: story ? 56 : 36,
        fontFamily: SERIF,
        fontSize: story ? 56 : 44,
        lineHeight: 1.25,
        display: "flex",
      }}
    >
      «{text}»
    </div>
  );
}

/** Two people (synastry): the headline, both people with their relation, "Нийцтэй харилцаа". */
function PairBody({ d, story }: { d: CardData; story: boolean }) {
  const avatar = story ? 200 : 128;
  const title = d.title ?? d.productName;
  // A long headline wraps to two lines at a smaller size rather than shrinking to one.
  const titleScale = title.length <= 20 ? 1 : title.length <= 40 ? 0.82 : 0.66;
  // Both constellations sit faded at the top, left and right, as in the reading's own hero.
  const art = story ? 460 : 320;
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          borderRadius: 72,
          background: C.blush,
          padding: story ? 72 : 44,
        }}
      >
        {d.people.map((p, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: story ? -80 : -60,
              ...(i === 0 ? { left: -70 } : { right: -70 }),
              display: "flex",
              opacity: 0.3,
            }}
          >
            <Constellation sign={p.sign} size={art} />
          </div>
        ))}
        {d.title && (
          <span style={{ ...LABEL, fontSize: story ? 28 : 24, color: C.highlight }}>
            {d.productName}
          </span>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            textAlign: "center",
            fontFamily: SERIF,
            fontSize: Math.round((story ? 104 : 72) * titleScale),
            lineHeight: 1.02,
            marginTop: 16,
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", marginTop: story ? 64 : 28 }}>
          {d.people.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start" }}>
              {i > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: avatar,
                    fontFamily: SERIF,
                    fontSize: story ? 88 : 64,
                    color: C.highlight,
                  }}
                >
                  &amp;
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: story ? 330 : 340,
                }}
              >
                <AvatarDisc uri={p.avatarUri} size={avatar} ring={C.white} />
                <span
                  style={{
                    fontFamily: SERIF,
                    fontSize: fit(story ? 68 : 50, p.name, 9),
                    lineHeight: 1,
                    marginTop: story ? 24 : 14,
                  }}
                >
                  {p.name}
                </span>
                {p.relation && (
                  <span
                    style={{
                      ...LABEL,
                      fontSize: fit(story ? 26 : 22, p.relation, 16),
                      color: C.muted,
                      marginTop: story ? 14 : 8,
                    }}
                  >
                    {p.relation}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        {d.score !== null && (
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              marginTop: story ? 44 : 20,
              padding: story ? "14px 44px" : "8px 32px",
              borderRadius: 999,
              background: C.white,
            }}
          >
            <span style={{ fontFamily: SERIF, fontSize: story ? 84 : 56, lineHeight: 1 }}>
              {d.score}
            </span>
            <span style={{ fontSize: story ? 32 : 26, color: C.muted }}>/ 100</span>
          </div>
        )}
      </div>

      {d.chips && (
        <div
          style={{
            marginTop: story ? 32 : 24,
            display: "flex",
            alignItems: "center",
            gap: story ? 32 : 26,
            borderRadius: story ? 56 : 44,
            background: C.white,
            padding: story ? "40px 48px" : "26px 36px",
          }}
        >
          <div
            style={{
              width: story ? 96 : 76,
              height: story ? 96 : 76,
              borderRadius: 96,
              background: C.lavender,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Star size={story ? 52 : 42} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <span style={{ ...LABEL, fontSize: story ? 24 : 21, color: C.muted }}>
              {d.chips.label}
            </span>
            <span
              style={{
                fontFamily: SERIF,
                fontSize: story ? 58 : 46,
                lineHeight: 1.08,
                marginTop: 8,
              }}
            >
              {d.chips.items.slice(0, 4).join(" · ")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** One person: the birthday (or the name) up front, and what the text says about them. */
function SingleBody({ d, story }: { d: CardData; story: boolean }) {
  const [p] = d.people;
  const avatar = story ? 168 : 128;
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          position: "relative",
          overflow: "hidden",
          borderRadius: 72,
          background: C.lavender,
          padding: story ? 72 : 56,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: story ? -20 : -40,
            right: story ? -80 : -50,
            display: "flex",
          }}
        >
          <Constellation sign={p.sign} size={story ? 620 : 460} ring />
        </div>

        <div
          style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: story ? 40 : 24 }}
        >
          <AvatarDisc uri={p.avatarUri} size={avatar} />
          {d.title && <span style={{ fontSize: 44, fontWeight: 600 }}>{p.name}</span>}
        </div>
        <span style={{ ...LABEL, fontSize: story ? 30 : 26, color: C.highlight }}>
          {d.productName}
        </span>
        {d.title ? (
          // The date is set in the sans: Cormorant's old-style "11" reads as a Roman "II".
          <span
            style={{
              fontSize: story ? 104 : 84,
              fontWeight: 600,
              letterSpacing: -3,
              lineHeight: 1,
              marginTop: 16,
            }}
          >
            {d.title}
          </span>
        ) : (
          <span
            style={{
              fontFamily: SERIF,
              fontSize: fit(story ? 120 : 92, p.name, 14),
              lineHeight: 1,
              marginTop: 12,
            }}
          >
            {p.name}
          </span>
        )}

        {d.list && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: story ? 56 : 32 }}>
            <span style={{ ...LABEL, letterSpacing: 3, fontSize: story ? 26 : 23, color: C.muted }}>
              {d.list.label}
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: story ? 24 : 16 }}>
              {d.list.items.slice(0, 6).map((item) => (
                <span
                  key={item}
                  style={{
                    padding: story ? "16px 34px" : "12px 28px",
                    borderRadius: 44,
                    background: C.white,
                    fontSize: story ? 42 : 36,
                    fontWeight: 600,
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {d.quote && <Quote text={d.quote} story={story} />}
    </div>
  );
}

/** Selected text: whose reading it is, and the text — sized to fill the card. */
function ExcerptBody({ d, story, text }: { d: CardData; story: boolean; text: string }) {
  const pair = d.people.length === 2;
  const tint = pair ? C.blush : C.lavender;
  const pad = story ? 72 : 56;
  const avatar = story ? 128 : 100;
  const lines = text.split("\n");
  // Cormorant Garamond 600 runs ≈0.46em per character at a 1.25 line height; a paragraph break
  // costs about half a line. 0.88 leaves room for ragged line ends.
  const width = 1080 - 2 * (story ? 96 : 72) - 2 * pad;
  const height = story ? 1150 : 500;
  const chars = text.length + 30 * (lines.length - 1) + 2;
  const fontSize = Math.max(
    30,
    Math.min(story ? 76 : 60, Math.floor(Math.sqrt((width * height) / (chars * 0.575)) * 0.88)),
  );
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        borderRadius: 72,
        background: tint,
        padding: pad,
      }}
    >
      {d.people.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            bottom: story ? -40 : -70,
            ...(pair && i === 0 ? { left: -70 } : { right: -70 }),
            display: "flex",
            opacity: 0.22,
          }}
        >
          <Constellation sign={p.sign} size={story ? 460 : 340} />
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ display: "flex" }}>
          {d.people.map((p, i) => (
            <div key={i} style={{ display: "flex", marginLeft: i > 0 ? -32 : 0 }}>
              <AvatarDisc uri={p.avatarUri} size={avatar} ring={tint} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: story ? 46 : 40, fontWeight: 600 }}>
            {d.people.map((p) => p.name).join(" & ")}
          </span>
          <span style={{ ...LABEL, fontSize: story ? 24 : 21, color: C.highlight }}>
            {d.productName}
          </span>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          fontFamily: SERIF,
          fontSize,
          lineHeight: 1.25,
        }}
      >
        {lines.map((line, i) => (
          <div key={i} style={{ display: "flex", marginTop: i > 0 ? fontSize * 0.6 : 0 }}>
            {i === 0 ? "«" : ""}
            {line}
            {i === lines.length - 1 ? "»" : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

export async function renderCard(d: CardData): Promise<ImageResponse> {
  const story = d.format === "story";
  const W = 1080;
  const H = story ? 1920 : 1080;

  return new ImageResponse(
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        background: C.ground,
        padding: story ? 96 : 72,
        fontFamily: SANS,
        color: C.ink,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: story ? 72 : 40 }}
      >
        <Star size={52} />
        <span style={{ fontFamily: SERIF, fontSize: 60 }}>{d.appName}</span>
      </div>

      {d.excerpt ? (
        <ExcerptBody d={d} story={story} text={d.excerpt} />
      ) : d.people.length === 2 ? (
        <PairBody d={d} story={story} />
      ) : (
        <SingleBody d={d} story={story} />
      )}

      <div
        style={{
          marginTop: story ? 56 : 32,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 30,
          color: C.muted,
        }}
      >
        <span>{d.host}</span>
      </div>
    </div>,
    { width: W, height: H, fonts: await loadCardFonts() },
  );
}
