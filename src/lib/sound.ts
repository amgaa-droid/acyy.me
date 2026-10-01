/**
 * Tiny synthesised UI sounds (Web Audio, no asset files). Browsers only let audio start after a
 * user gesture, so call `primeAudio()` inside a click handler; sounds played later (after an
 * await, or on the next client-side page) reuse that unlocked context. Without one they're silent.
 */

let ctx: AudioContext | null = null;

/** Create/resume the shared AudioContext. Call from a user gesture (click/tap). */
export function primeAudio(): void {
  if (typeof window === "undefined") return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

function running(): AudioContext | null {
  return ctx && ctx.state === "running" ? ctx : null;
}

/** One soft bell-like partial: quick attack, exponential decay. */
function tone(
  ac: AudioContext,
  out: AudioNode,
  freq: number,
  start: number,
  dur: number,
  gain: number,
  type: OscillatorType = "sine",
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function master(ac: AudioContext, volume: number): GainNode {
  const g = ac.createGain();
  g.gain.value = volume;
  g.connect(ac.destination);
  return g;
}

/** Purchase unlocked: a latch "tick", then a rising bell arpeggio with a sparkle on top. */
export function playUnlock(): void {
  const ac = running();
  if (!ac) return;
  const out = master(ac, 0.5);
  const t = ac.currentTime + 0.02;
  // Latch click — a very short, low triangle blip.
  tone(ac, out, 180, t, 0.08, 0.35, "triangle");
  tone(ac, out, 360, t + 0.01, 0.06, 0.15, "square");
  // C major arpeggio (C6 E6 G6 C7) with a fifth above each note for shimmer.
  [1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
    const s = t + 0.14 + i * 0.085;
    tone(ac, out, f, s, 1.4 - i * 0.15, 0.22);
    tone(ac, out, f * 1.5, s, 0.6, 0.05);
  });
  // Sparkle tail.
  [3136, 3520, 4186].forEach((f, i) => tone(ac, out, f, t + 0.55 + i * 0.07, 0.5, 0.04));
}

/** Compatibility reveal: a soft, slow two-note chime. */
export function playReveal(): void {
  const ac = running();
  if (!ac) return;
  const out = master(ac, 0.4);
  const t = ac.currentTime + 0.02;
  tone(ac, out, 783.99, t, 2.2, 0.18); // G5
  tone(ac, out, 1174.66, t + 0.18, 2.4, 0.16); // D6
  tone(ac, out, 1567.98, t + 0.36, 2.0, 0.08); // G6
  tone(ac, out, 2349.32, t + 0.36, 1.2, 0.03);
}
