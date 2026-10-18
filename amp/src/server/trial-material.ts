import { generateProblem } from "../math/engine";
import type { PublicProblem } from "../math/contracts";
import { problemLesson } from "../content/problem-lessons";

/** Compare what the learner sees, independent of instance ids and seeds.
 * Omitting answers and response options deliberately rejects more duplicates. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export const teachingSurface = (problem: {
  prompt: string;
  figure?: unknown;
}) => JSON.stringify(canonical([problem.prompt, problem.figure ?? null]));

/** Small finite families may not have four unseen questions left. The caller
 * selects another existing family instead of presenting copied worked examples
 * as independent evidence. No curriculum content is authored here. */
export function teachingMaterial(
  templateId: string,
  seed: string,
  seen: PublicProblem[] = [],
) {
  const lesson = problemLesson(templateId, "trial-teaching-lesson");
  const examples = [0, 1, 2].map(
    (i) => problemLesson(templateId, `trial-printable:${i}`).example,
  );
  const excluded = new Set(
    [
      lesson.example,
      ...examples,
      ...seen,
      ...seen.map(
        (problem) =>
          problemLesson(problem.templateId, problem.seed, problem.prompt)
            .example,
      ),
    ].map(teachingSurface),
  );
  const problems = [];
  for (let i = 0; i < 128 && problems.length < 4; i++) {
    const problem = generateProblem(templateId, `${seed}:trial-teaching:${i}`);
    const surface = teachingSurface(problem.public);
    if (excluded.has(surface)) continue;
    excluded.add(surface);
    problems.push(problem);
  }
  return problems.length === 4 ? { lesson, examples, problems } : null;
}
