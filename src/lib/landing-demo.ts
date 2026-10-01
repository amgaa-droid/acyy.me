import type { Point } from "@/lib/planet-system";

/**
 * Example people on the signed-out landing's planet system — fixed marketing data, not users.
 * Their signs are still worked out from the DB sign table (CLAUDE.md rule 7), on the page.
 * Positions are % of the stage; linked people sit next to each other so a link never crosses "Та".
 */

export type DemoPersonDef = {
  id: string;
  name: string;
  birthDate: string;
  tint: string;
  seed: number;
  phone: Point;
  desktop: Point;
};

export const DEMO_PEOPLE: readonly DemoPersonDef[] = [
  { id: "mom", name: "Ээж", birthDate: "1968-03-05", tint: "bg-tint-2", seed: 1, phone: { x: 20, y: 41 }, desktop: { x: 22, y: 44 } },
  { id: "dad", name: "Аав", birthDate: "1965-11-12", tint: "bg-tint-3", seed: 4, phone: { x: 78, y: 37 }, desktop: { x: 76, y: 40 } },
  { id: "love", name: "Хайрт", birthDate: "1997-08-02", tint: "bg-tint-1", seed: 7, phone: { x: 86, y: 55 }, desktop: { x: 86, y: 62 } },
  { id: "friend", name: "Найз", birthDate: "1996-04-10", tint: "bg-tint-3", seed: 10, phone: { x: 80, y: 76 }, desktop: { x: 66, y: 78 } },
  { id: "sib", name: "Дүү", birthDate: "2003-01-08", tint: "bg-tint-2", seed: 13, phone: { x: 20, y: 72 }, desktop: { x: 30, y: 78 } },
];

export type DemoLink = { a: string; b: string; score: number; text: string };

export const DEMO_LINKS: readonly DemoLink[] = [
  { a: "mom", b: "dad", score: 92, text: "momDad" },
  { a: "mom", b: "sib", score: 84, text: "momSib" },
  { a: "love", b: "friend", score: 68, text: "loveFriend" },
  { a: "sib", b: "friend", score: 76, text: "sibFriend" },
];

export type CompatLevel = "great" | "good" | "work";

/** How a 0–100 compatibility score reads in words. */
export function compatLevel(score: number): CompatLevel {
  if (score >= 85) return "great";
  if (score >= 70) return "good";
  return "work";
}
