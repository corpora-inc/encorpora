import type { TemplateMetadata } from "../math/contracts";
import { satTasks } from "./sat-tasks";

/** Automatic SAT practice draws only from original problem families mapped to
 * an actual SAT task. Skill tags alone do not establish that a family is tested. */
export const SAT_PROFILE_VERSION = "sat-math-2026-11-16.1";
const mappedFamilies = new Set(satTasks.flatMap((task) => task.templateIds));
export function satPracticeEligible(
  template: Pick<TemplateMetadata, "id" | "skillId">,
): boolean {
  return mappedFamilies.has(template.id);
}
