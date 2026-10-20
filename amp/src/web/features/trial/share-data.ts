import { NOTE_MIN_AGE } from "../../../feedback/problem-flags";

/**
 * What a shared level card may contain: levels and a problem count, nothing
 * else. Built from the trial's progress by `levelCardData`, which copies
 * only these fields, so no name, birth year, age, learner or trial id can
 * reach the image or the link. Not even the age-typical grade the app's
 * charts mark: on a card it would hint at the child's age.
 */
export type LevelCardData = {
  answered: number;
  overall: { level: number; sd: number };
  strands: { strand: string; level: number; sd: number }[];
};
/** At most this many areas on a card, the most practiced first. */
export const CARD_AREAS = 6;

export function levelCardData(
  progress: {
    totals: { answered: number };
    frontier: {
      current: {
        overall: { level: number; sd: number };
        strands: Record<
          string,
          { level: number; sd: number; answered: number }
        >;
      };
    };
  },
  order: readonly string[],
): LevelCardData {
  const current = progress.frontier.current;
  const strands = order
    .filter((strand) => current.strands[strand])
    .map((strand) => ({ strand, estimate: current.strands[strand]! }))
    .sort((a, b) => b.estimate.answered - a.estimate.answered)
    .slice(0, CARD_AREAS)
    .sort((a, b) => order.indexOf(a.strand) - order.indexOf(b.strand))
    .map(({ strand, estimate }) => ({
      strand,
      level: round(estimate.level),
      sd: round(estimate.sd),
    }));
  return {
    answered: progress.totals.answered,
    overall: {
      level: round(current.overall.level),
      sd: round(current.overall.sd),
    },
    strands,
  };
}
const round = (value: number) => Math.round(value * 100) / 100;

/** The shared link: the start of a fresh level check, with fixed campaign
 * tags and no learner data. */
export function levelShareUrl(origin: string) {
  return `${origin}/level?utm_source=share&utm_medium=level-card`;
}
export const shareText = "What’s your level? A free math level check.";
export const facebookShareUrl = (url: string) =>
  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
export const xShareUrl = (url: string) =>
  `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;

/** Whether the learner could be under 13 (or the birth year is unknown):
 * then social sharing sits behind a step for a parent or guardian. */
export function mayBeChild(
  birthYear: number | null | undefined,
  now = new Date(),
) {
  if (birthYear == null) return true;
  // Born late in the year, a learner is a year younger than the difference.
  return now.getUTCFullYear() - birthYear - 1 < NOTE_MIN_AGE;
}
