import {
  areaIds,
  crossCuttingStrands,
  easiestFirst,
  strandAreas,
} from "../../../curriculum/areas";
import { isEarned } from "../../../learning/earned";
import type { SkillStanding } from "../learners/SkillKey";
import {
  areaSlot,
  bands,
  frontierRange,
  type Evidence,
  type Frontier,
  type MapSkill,
} from "../pathways/model";

/*
 * Inventory by grade: every skill of one grade for one learner, in teaching
 * order under the five areas, each with where the learner stands on it.
 * Pure: the screen (InventoryScreen.tsx) reads these.
 */

/** A view's grade meaning "the learner's own": the grade their level's
 * best guess names, wherever it is when the screen opens. */
export const OWN_GRADE = "own";

/** Grade names short enough for a row of thirteen (ui/level-range
 * `shortGrade`'s words, the number alone for a grade). */
const SHORT: Record<string, string> = {
  "algebra-1": "Alg 1",
  geometry: "Geom",
  "algebra-2": "Alg 2",
  precalculus: "Precalc",
};
export const shortBand = (band: string) => SHORT[band] ?? band;

/**
 * The learner's own grade: the best guess of their level as the child page
 * names it (lib/learner-where.ts, through `frontierRange`); before any
 * answer, the grade practice starts from (their birth year's). Always a
 * grade of the curriculum, kindergarten to precalculus.
 */
export function ownBand(frontier: Frontier | undefined): string {
  const at = frontier
    ? (frontierRange(frontier)?.best ?? Math.round(frontier.expected))
    : 0;
  return bands[Math.min(bands.length - 1, Math.max(0, at))]!;
}

/** The grade a view shows: none ("", every grade), the learner's own, or
 * the one chosen. A value that names no grade (an old or edited view) is
 * none. */
export function viewedBand(
  grade: string | undefined,
  frontier: Frontier | undefined,
): string | null {
  if (!grade) return null;
  if (grade === OWN_GRADE) return ownBand(frontier);
  return bands.includes(grade) ? grade : null;
}

/** The engine's strands in the five areas' order (curriculum/areas.ts). */
const strandOrder = [...Object.keys(strandAreas), ...crossCuttingStrands];

/**
 * Skills in teaching order: the five areas in order, and inside an area a
 * skill after everything it builds on, strand by strand (numbers, then
 * operations, fractions, decimals…), the easier first (`easiestFirst`, with
 * the catalog's own order to break a tie). `all` is the whole catalog, for
 * the paths that leave the list and come back.
 */
export function teachingOrder(
  list: readonly MapSkill[],
  all: readonly MapSkill[],
): MapSkill[] {
  const rank = (skill: MapSkill) => {
    const at = strandOrder.indexOf(skill.strand);
    return (
      (at < 0 ? strandOrder.length : at) * 1000 + (skill.difficulty ?? 500)
    );
  };
  return areaIds.flatMap((_, area) =>
    easiestFirst(
      list.filter((skill) => areaSlot(skill) === area),
      all,
      rank,
    ),
  );
}

/**
 * Where a learner stands on a skill, in the dashboard's words (the key,
 * features/learners/SkillKey.tsx), each exclusive. The same rule as the
 * server's bars (family/dashboard.ts `checkedBucket`): Strong is the
 * evidence's `review-ready`, Earned `isEarned`, Tried any answer, else not
 * asked yet.
 */
export function standingOf(evidence: Evidence | undefined): SkillStanding {
  if (!evidence || !(evidence.attempts > 0)) return "notAsked";
  if (evidence.status === "review-ready") return "strong";
  return isEarned(evidence) ? "earned" : "tried";
}
