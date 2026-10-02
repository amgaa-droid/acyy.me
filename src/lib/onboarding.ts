import { z } from "zod";

/**
 * First-run guide (home planet system): three steps in order — open your own free birthday
 * teaser, add someone close, drag them onto yourself to open your pair reading. Progress is kept
 * on the user (`user.onboarding`: mark → ISO time), so it follows them across devices.
 */
const GUIDE_STEPS = ["self", "add", "link"] as const;
export type GuideStep = (typeof GUIDE_STEPS)[number];

const ONBOARDING_MARKS = ["welcome", ...GUIDE_STEPS, "dismissed"] as const;
export type OnboardingMark = (typeof ONBOARDING_MARKS)[number];
export type OnboardingProgress = Partial<Record<OnboardingMark, string>>;

export const onboardingMarkSchema = z.enum(ONBOARDING_MARKS);

type GuideState = {
  /** The guide is on: not dismissed and not finished. */
  active: boolean;
  /** Show the welcome card (first visit, guide on). */
  welcome: boolean;
  /** The step to point at next, or null when finished. */
  current: GuideStep | null;
  done: Record<GuideStep, boolean>;
  count: number;
};

/**
 * Where the guide is. A step also counts as done when the user did it some other way: having
 * someone besides themselves ("add"), or any pair reading or drawn pair ("link").
 */
export function guideState(
  progress: OnboardingProgress,
  facts: { people: number; pairs: number },
): GuideState {
  const done: Record<GuideStep, boolean> = {
    self: !!progress.self,
    add: !!progress.add || facts.people > 0,
    link: !!progress.link || facts.pairs > 0,
  };
  const current = GUIDE_STEPS.find((s) => !done[s]) ?? null;
  const count = GUIDE_STEPS.filter((s) => done[s]).length;
  const active = !progress.dismissed && current !== null;
  return { active, welcome: active && !progress.welcome, current, done, count };
}
