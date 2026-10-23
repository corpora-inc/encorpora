import { objectiveForSkill } from "./selection";
import type { TemplateMetadata } from "../math/contracts";

/** A conservative exclusion filter, not a declaration that each remaining
 * family is directly tested. Foundations stay available to the adaptive planner.
 * Basis: College Board digital SAT framework v4, Appendix B, SAT column.
 */
export const SAT_PROFILE_VERSION = "sat-math-2026-10-23.1";
const excludedObjectives = new Set([
  "geometry-constructions",
  "complex-numbers",
  "vectors-matrices",
  "advanced-models",
  "probability-models",
]);
const excludedSkills = new Set([
  "logarithms",
  "logarithm-properties",
  "sequence-sums",
  "function-composition",
  "inverse-functions",
  "permutations-combinations",
  "trigonometric-graphs",
  "inverse-trigonometry",
  "trigonometric-identities",
  "trigonometric-equations",
  "oblique-triangles",
  "periodic-modeling",
  "trigonometric-area",
  "conic-sections",
  "parabola-locus",
  "randomization-tests",
  "normal-distributions",
]);
// One skill contains both SAT-relevant exponential work and logarithmic work.
const excludedFamilies = new Set(["exponential-log-solution", "log-equation"]);
export function satPracticeEligible(
  template: Pick<TemplateMetadata, "id" | "skillId">,
): boolean {
  return (
    !excludedObjectives.has(objectiveForSkill(template.skillId)?.id ?? "") &&
    !excludedSkills.has(template.skillId) &&
    !excludedFamilies.has(template.id)
  );
}
