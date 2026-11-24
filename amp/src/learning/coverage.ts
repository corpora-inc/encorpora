import { crossCuttingAreas, strandAreas } from "../curriculum/areas.js";
import { isEarned } from "./earned.js";

/**
 * How far practice may reach for a learner whose start comes from a birth
 * year or an assigned grade: by what they have covered, one grade at a time.
 *
 * A grade is covered when the learner has earned (`learning/earned.ts`: a
 * right answer without help) `skills` different skills of that grade or a
 * harder one, in at least `areas` of the five areas (fewer where the grade
 * itself has fewer). Practice may reach `step` grades past the highest grade
 * covered, and stays at the starting grade until that grade is covered.
 *
 * This reads the same per-skill standing a family sees (Earned, Tried, Not
 * asked yet). It is a scheduling rule, not a mastery claim, and it only ever
 * lowers the ceiling the estimator's evidence allows.
 */
export type CoverageRules = {
  /** Different skills earned at a grade or above that cover the grade. */
  skills: number;
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

export function gradeCoverage(options: {
  /** Where practice starts: the grade the birth year or roster gives. */
  start: number;
  /** The catalog's skills that can be asked. */
  skills: readonly CoverageSkill[];
  /** The learner's per-skill evidence. */
  evidence: readonly { skillId: string; independentCorrect?: number }[];
  rules: CoverageRules;
}): Coverage {
  const { start, skills, rules } = options;
  const earned = new Set(
    options.evidence.filter(isEarned).map((entry) => entry.skillId),
  );
  const first = Math.ceil(start);
  const top = Math.max(first, ...skills.map((skill) => skill.grade));
  let covered: number | null = null;
  for (let grade = top; grade >= first && covered === null; grade--) {
    const own = new Set<string>();
    const shown = new Set<string>();
    let count = 0;
    for (const skill of skills) {
      if (skill.grade === grade) own.add(skill.area);
      if (skill.grade < grade || !earned.has(skill.id)) continue;
      count += 1;
      shown.add(skill.area);
    }
    if (!own.size) continue;
    if (count >= rules.skills && shown.size >= Math.min(rules.areas, own.size))
      covered = grade;
  }
  return {
    covered,
    ceiling: covered === null ? start : covered + rules.step,
  };
}
