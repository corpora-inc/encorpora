import {
  areaIds,
  crossCuttingStrands,
  easiestFirst,
  strandAreas,
} from "../../../curriculum/areas";
import { isEarned } from "../../../learning/earned";
import type { SkillStanding } from "../learners/SkillKey";
import {
  areas,
  areaSlot,
  bands,
  frontierRange,
  type Evidence,
  type Frontier,
  type MapSkill,
} from "../pathways/model";

/*
 * Inventory by grade: one grade as a flat index, every skill of it in
 * teaching order under the five areas, each with where the learner stands
 * on it and its problem types under it. Pure: the screen (GradeIndex.tsx)
 * reads these.
 */

/** How Inventory is sliced: one grade's whole index, or (as it always
 * was) the learner's collection by area. */
export type InventoryMode = "grade" | "area";
/** The slice a view shows: the one chosen, else by grade for a grown-up
 * reading a child's, by area for a learner's own. */
export const inventoryMode = (
  chosen: string | undefined,
  child: boolean,
): InventoryMode =>
  chosen === "grade" || chosen === "area" ? chosen : child ? "grade" : "area";

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

/** The grade a by-grade view shows: the one chosen, else (none chosen, or
 * a value that names no grade) the learner's own. */
export const viewedBand = (
  grade: string | undefined,
  frontier: Frontier | undefined,
): string => (grade && bands.includes(grade) ? grade : ownBand(frontier));

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

type ProblemType = { id: string; skillId: string; title?: string };
/** One area of a grade's index: its skills in teaching order, each with
 * its problem types as the catalog lists them. */
export type IndexSection<Type extends ProblemType = ProblemType> = {
  area: string;
  title: string;
  skills: { skill: MapSkill; types: Type[] }[];
};
/**
 * One grade as a flat index: an area heading, then each of its skills (in
 * `teachingOrder`), then that skill's problem types. Only areas the grade
 * has; `only` keeps one area.
 */
export function gradeIndex<Type extends ProblemType>(
  catalog: { skills: readonly MapSkill[]; templates: readonly Type[] },
  band: string,
  only: string | null = null,
  /** A search's finds: only these skills are listed. */
  found?: ReadonlySet<string>,
): IndexSection<Type>[] {
  const types = new Map<string, Type[]>();
  for (const type of catalog.templates)
    types.set(type.skillId, [...(types.get(type.skillId) ?? []), type]);
  const ordered = teachingOrder(
    catalog.skills.filter(
      (skill) => skill.gradeBand === band && (!found || found.has(skill.id)),
    ),
    catalog.skills,
  );
  return areas
    .map((area, slot) => ({
      area: area.id,
      title: area.title,
      skills: ordered
        .filter((skill) => areaSlot(skill) === slot)
        .map((skill) => ({ skill, types: types.get(skill.id) ?? [] })),
    }))
    .filter(
      (section) => section.skills.length && (!only || section.area === only),
    );
}
