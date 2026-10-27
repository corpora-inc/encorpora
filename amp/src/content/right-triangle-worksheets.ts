import { generateProblem } from "../math/engine";
import type { GeneratedProblem } from "../math/contracts";

const family = new Set([
  "right-triangle",
  "right-triangle-missing-leg",
  "pythagorean-converse",
]);

/** Distinct stated givens; rearranging a converse triangle's side order does not make a new question. */
function caseKey(problem: GeneratedProblem): string {
  if (problem.public.templateId === "pythagorean-converse") {
    const lengths = [...problem.public.prompt.matchAll(/(\d+) cm/g)].map(
      (match) => Number(match[1]),
    );
    if (lengths.length !== 3)
      throw new Error("Converse worksheet requires three stated lengths");
    return lengths.sort((a, b) => a - b).join(",");
  }
  return problem.public.prompt;
}

/** The same deterministic selection feeds the worksheet and its matching solutions. */
export function rightTriangleWorksheetProblems(
  templateId: string,
  lessonId: string,
  edition: string,
): GeneratedProblem[] | undefined {
  if (!family.has(templateId)) return undefined;
  const selected: GeneratedProblem[] = [];
  const used = new Set<string>();
  for (
    let candidate = 0;
    candidate < 1000 && selected.length < 12;
    candidate++
  ) {
    const problem = generateProblem(
      templateId,
      `print:${lessonId}:${edition}:${candidate}`,
    );
    const key = caseKey(problem);
    if (used.has(key)) continue;
    used.add(key);
    selected.push(problem);
  }
  if (selected.length !== 12)
    throw new Error(
      `Could not select twelve distinct ${templateId} worksheet questions`,
    );
  return selected;
}
