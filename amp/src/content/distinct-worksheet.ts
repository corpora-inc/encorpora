import { generateProblem } from "../math/engine";
import type { GeneratedProblem } from "../math/contracts";

/** Twelve ordinary seeded problems with no repeated prompt-and-figure pair,
 * taken in seed order so an edition always reprints the same sheet. */
export function distinctWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
  count = 12,
): GeneratedProblem[] {
  const chosen: GeneratedProblem[] = [],
    seen = new Set<string>();
  for (let i = 0; chosen.length < count; i++) {
    if (i >= 4096) throw new Error(`Too few distinct problems: ${templateId}`);
    const problem = generateProblem(
      templateId,
      `print:${lessonId}:${edition}:${i}`,
    );
    const key = JSON.stringify([problem.public.prompt, problem.public.figure]);
    if (seen.has(key)) continue;
    seen.add(key);
    chosen.push(problem);
  }
  return chosen;
}
