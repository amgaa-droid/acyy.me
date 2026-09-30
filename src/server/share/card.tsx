import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

import { STAR_PATH } from "@/lib/brand-icon";
import { CONSTELLATIONS } from "@/lib/constellations";

/**
 * Share cards (SPEC §8): story 1080×1920 / square 1080×1080 via next/og.
 * The default OG font has no Cyrillic, so Inter + Cormorant Garamond are loaded from
 * src/assets/fonts — including the cyrillic-ext subsets that contain Ө and Ү, and latin-ext for ₮.
 * Cards always use the Cosmic palette (brand images), regardless of the viewer's theme.
 */

const C = {
  ground: "#f5f1eb",
  ink: "#1d1b3f",
  muted: "#6b6880",
  highlight: "#4a44b5",
  lavender: "#e6e3fb",
  blush: "#f9e0db",
  coral: "#d9705f",
  white: "#ffffff",
};

const SUBSETS = ["latin", "latin-ext", "cyrillic", "cyrillic-ext"] as const;
const SERIF = SUBSETS.map((s) => `"Serif-${s}"`).join(", ");
const SANS = SUBSETS.map((s) => `"Sans-${s}"`).join(", ");

type FontSpec = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600; style: "normal" };
let fontsPromise: Promise<FontSpec[]> | undefined;

export function loadCardFonts(): Promise<FontSpec[]> {
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

export type CardData = {
  format: "story" | "square";
  productName: string;
  people: { name: string; sign: string; signName: string; avatarUri: string }[];
  title: string;
  score: number | null;
  quote: string | null;
  appName: string;
  host: string;
};

function Constellation({ sign, size }: { sign: string; size: number }) {
  const art = CONSTELLATIONS[sign];
  if (!art) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle
        cx="50"
        cy="50"
        r="48"
        fill="none"
        stroke={C.highlight}
        strokeOpacity="0.25"
        strokeWidth="0.4"
      />
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

export async function renderCard(d: CardData): Promise<ImageResponse> {
  const story = d.format === "story";
  const W = 1080;
  const H = story ? 1920 : 1080;
  const pair = d.people.length === 2;
  const pad = story ? 96 : 72;
  const avatar = story ? 168 : 128;

  return new ImageResponse(
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        background: C.ground,
        padding: pad,
        fontFamily: SANS,
        color: C.ink,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <svg width={52} height={52} viewBox="0 0 100 100">
          <path d={STAR_PATH} fill={C.highlight} />
        </svg>
        <span style={{ fontFamily: SERIF, fontSize: 60 }}>{d.appName}</span>
      </div>

      <div
        style={{
          marginTop: story ? 72 : 40,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          position: "relative",
          overflow: "hidden",
          borderRadius: 72,
          background: pair ? C.blush : C.lavender,
          padding: story ? 72 : 56,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: story ? 40 : 10,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {d.people.map((p) => (
            <Constellation
              key={p.name + p.sign}
              sign={p.sign}
              size={pair ? (story ? 460 : 260) : story ? 720 : 420}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: 24, marginBottom: story ? 40 : 28 }}>
          {d.people.map((p) => (
            <div key={p.name + p.sign} style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  width: avatar,
                  height: avatar,
                  borderRadius: avatar,
                  background: C.white,
                  display: "flex",
                  overflow: "hidden",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- rendered by satori */}
                <img src={p.avatarUri} width={avatar} height={avatar} alt="" />
              </div>
              {!pair && <span style={{ fontSize: 44, fontWeight: 600 }}>{p.name}</span>}
            </div>
          ))}
        </div>

        <span
          style={{
            fontSize: 30,
            fontWeight: 600,
            color: C.highlight,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          {d.productName}
        </span>
        <span
          style={{ fontFamily: SERIF, fontSize: story ? 120 : 92, lineHeight: 1, marginTop: 12 }}
        >
          {d.title}
        </span>
        {pair && (
          <span style={{ fontSize: 40, color: C.muted, marginTop: 16 }}>
            {d.people.map((p) => p.name).join(" × ")}
          </span>
        )}
        {d.score !== null && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 28 }}>
            <span style={{ fontFamily: SERIF, fontSize: story ? 160 : 120, lineHeight: 1 }}>
              {d.score}
            </span>
            <span style={{ fontSize: 40, color: C.muted }}>/ 100</span>
          </div>
        )}
      </div>

      {d.quote && (
        <div
          style={{
            marginTop: story ? 56 : 36,
            fontFamily: SERIF,
            fontSize: story ? 56 : 44,
            lineHeight: 1.25,
            display: "flex",
          }}
        >
          «{d.quote}»
        </div>
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
        <span>Зөвхөн зугаа цэнгэлийн зорилготой</span>
      </div>
    </div>,
    { width: W, height: H, fonts: await loadCardFonts() },
  );
}
