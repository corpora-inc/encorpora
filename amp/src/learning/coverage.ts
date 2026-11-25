import { crossCuttingAreas, strandAreas } from "../curriculum/areas.js";
import { isEarned } from "./earned.js";

/**
 * How far practice may reach for a learner whose start comes from a birth
 * year or an assigned grade: by what they have covered, one grade at a time.
 *
 * A grade is covered when the learner has earned (`learning/earned.ts`: a
 * right answer without help) `share` of its skills, or as many harder skills,
 * in at least `areas` of the five areas (fewer where the grade itself has
 * fewer). The bar scales with the grade: half of kindergarten's 17 skills is
 * 9, half of Geometry's 39 is 20. Harder skills count on their own, never
 * added to the grade's, so a stretch problem does not make the grade cheaper;
 * they are how a learner who already works above a grade is not sent back to
 * it. Practice may reach `step` grades past the highest covered grade, and
 * stays at the starting grade until that grade is covered.
 *
 * The bar is set by the skills this learner can be asked (`askable`): a
 * client that cannot draw part of the catalog is held to half of what it can
 * show, and a grade it can show nothing of is passed over. What counts toward
 * the bar is everything earned, wherever it was earned.
 *
 * This reads the same per-skill standing a family sees (Earned, Tried, Not
 * asked yet). It is a scheduling rule, not a mastery claim, and it only ever
 * lowers the ceiling the estimator's evidence allows.
 */
export type CoverageRules = {
  /** The share of a grade's own skills that covers it. */
  share: number;
  /** Areas those skills must span, or every area the grade has if fewer. */
  areas: number;
  /** Grades past the highest covered grade that practice may reach. */
  step: number;
  /** A stretch problem may reach this far past the ceiling. */
  probeRise: number;
};
/** A catalog skill as coverage reads it: its whole grade (K = 0) and area. */
export type CoverageSkill = { id: string; grade: number; area: string };
export type Coverage = {
  /** The highest covered grade at or above the start; null before any. */
  covered: number | null;
  /** The grade practice may reach. */
  ceiling: number;
};

/** A skill's area for coverage: its strand's, its reviewed assignment
 * (modeling and reasoning), or the strand itself in a catalog without areas. */
export const coverageArea = (skill: { id: string; strand: string }): string =>
  strandAreas[skill.strand] ?? crossCuttingAreas[skill.id] ?? skill.strand;

/** How many skills cover a grade with `size` skills that can be asked. */
export const coverageNeed = (size: number, share: number) =>
  Math.max(1, Math.ceil(share * size));

export function gradeCoverage(options: {
  /** Where practice starts: the grade the birth year or roster gives. */
  start: number;
  /** The catalog's skills. */
  skills: readonly CoverageSkill[];
  /** The skills this learner can be asked; absent, all of them. */
  askable?: ReadonlySet<string>;
  /** The learner's per-skill evidence. */
  evidence: readonly { skillId: string; independentCorrect?: number }[];
  rules: CoverageRules;
}): Coverage {
  const { start, rules, askable } = options;
  // A skill without a grade has no place on the scale.
  const skills = options.skills.filter((skill) => Number.isFinite(skill.grade));
  const earned = new Set(
    options.evidence.filter(isEarned).map((entry) => entry.skillId),
  );
  const asked = (skill: CoverageSkill) => !askable || askable.has(skill.id);
  const first = Math.ceil(start);
  const top = Math.max(first, ...skills.map((skill) => skill.grade));
  let covered: number | null = null;
  for (let grade = top; grade >= first && covered === null; grade--) {
    // The grade's own list as this learner can be asked it, and what is
    // earned of the grade and above it.
    const areas = new Set<string>();
    const own = new Set<string>();
    const harder = new Set<string>();
    let size = 0;
    let ownCount = 0;
    let harderCount = 0;
    for (const skill of skills) {
      if (skill.grade < grade) continue;
      const has = earned.has(skill.id);
      if (skill.grade > grade) {
        if (!has) continue;
        harderCount += 1;
        harder.add(skill.area);
        continue;
      }
      if (asked(skill)) {
        size += 1;
        areas.add(skill.area);
      }
      if (!has) continue;
      ownCount += 1;
      own.add(skill.area);
    }
    if (!size) continue;
    const need = coverageNeed(size, rules.share);
    const broad = Math.min(rules.areas, areas.size);
    if (
      (ownCount >= need && own.size >= broad) ||
      (harderCount >= need && harder.size >= broad)
    )
      covered = grade;
  }
  // A grade with nothing to ask is passed over, while there is more above it.
  const empty = (grade: number) =>
    !skills.some((skill) => skill.grade === Math.round(grade) && asked(skill));
  const more = (grade: number) =>
    skills.some((skill) => skill.grade > Math.round(grade) && asked(skill));
  let ceiling = covered === null ? start : covered + rules.step;
  while (empty(ceiling) && more(ceiling)) ceiling += 1;
  return { covered, ceiling };
}
