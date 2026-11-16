import { templates } from "../math/engine";
import { lessons } from "../content/lessons";
import { methods } from "../content/problem-methods";
import { familyRegistry } from "../families/registry";
import { SAT_PROFILE_VERSION, satPracticeEligible } from "./sat";

import { SAT_SOURCE, satTasks } from "./sat-tasks";
export { SAT_SOURCE, satTasks, type SatDomain } from "./sat-tasks";

export function buildSatCoverage() {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const id of Object.keys(familyRegistry.satTaskTemplates))
    if (!satTasks.some((task) => task.id === id))
      errors.push(`Unknown SAT task: ${id}`);
  const tasks = satTasks.map((task) => {
    if (seen.has(task.id)) errors.push(`Duplicate SAT task: ${task.id}`);
    seen.add(task.id);
    const families = task.templateIds.map((id) => {
      const template = templates.find((t) => t.id === id);
      if (!template) errors.push(`Unknown SAT family: ${id}`);
      else if (!satPracticeEligible(template))
        errors.push(`SAT task uses excluded family: ${id}`);
      const hasLesson = lessons.some((l) => l.templateIds.includes(id));
      if (!hasLesson || !methods[id])
        errors.push(`Missing SAT instruction: ${id}`);
      return {
        id,
        available: !!template,
        responseCapability: template?.requiredResponseCapability ?? "numeric",
        referenceLesson: hasLesson,
      };
    });
    return { ...task, families };
  });
  return {
    profileVersion: SAT_PROFILE_VERSION,
    source: SAT_SOURCE,
    valid: errors.length === 0,
    errors,
    tasks,
    limitations: [
      "This checklist maps bounded original practice to published SAT demands; it cannot enumerate future questions or certify score readiness.",
      "A mapped family does not establish coverage of every difficulty, context, graph, or combination within that task.",
      "Practice uses AMP answer controls and calculator, not an exact reproduction of the SAT testing application.",
    ],
  };
}
export function renderSatCoverage(report = buildSatCoverage()) {
  return [
    `# SAT Math practice coverage`,
    `Source: [${report.source.title}](${report.source.url}), ${report.source.location}. Reviewed ${report.source.reviewedAt}.`,
    `Structural audit valid: ${report.valid}.`,
    ...report.limitations,
    ``,
    `| Domain | Task | Problem families |`,
    `| --- | --- | --- |`,
    ...report.tasks.map(
      (t) => `| ${t.domain} | ${t.task} | ${t.templateIds.join(", ")} |`,
    ),
    ...report.errors,
  ].join("\n\n");
}
