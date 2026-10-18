import { createHash } from "node:crypto";
import { absoluteValuePrintCase } from "../math/absolute-value-practice";
import type { GeneratedProblem } from "../math/contracts";
/** Distinct ordinary generator outputs, with all instructional outcomes represented. */
export function absoluteValueWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
): GeneratedProblem[] {
  const transformed = templateId === "absolute-value-transformed-equation";
  // A direct zero-distance equation has only one distinct prompt; use it once.
  const requirements = transformed
    ? [
        ["constant-interior", "true"],
        ["constant-interior", "false"],
        ["zero-factor", "true"],
        ["zero-factor", "false"],
        ["positive", "negative-factor"],
        ["positive", "positive-factor"],
        ["positive", "fraction-target"],
        ["positive"],
        ["zero", "negative-interior"],
        ["zero", "positive-interior"],
        ["negative", "negative-factor"],
        ["negative", "positive-factor"],
      ]
    : templateId === "absolute-value-direct-equation"
      ? [
          ["zero"],
          ...Array.from({ length: 7 }, () => ["positive"]),
          ...Array.from({ length: 4 }, () => ["negative"]),
        ]
      : [
          ["positive", "negative-interior"],
          ["positive", "positive-interior"],
          ["positive", "fraction-target"],
          ["positive"],
          ["positive"],
          ["positive"],
          ["zero", "negative-interior"],
          ["zero", "positive-interior"],
          ["zero"],
          ["negative"],
          ["negative"],
          ["negative"],
        ];
  const pool: ReturnType<typeof absoluteValuePrintCase>[] = [],
    selected: GeneratedProblem[] = [],
    seen = new Set<string>();
  let count = 0;
  for (const required of requirements) {
    let found: ReturnType<typeof absoluteValuePrintCase> | undefined;
    while (!found) {
      found = pool.find(
        (c) =>
          !seen.has(c.problem.public.prompt) &&
          required.every((tag) => c.tags.includes(tag)),
      );
      if (found) break;
      if (count >= 4096)
        throw new Error(`Cannot fill absolute-value worksheet ${templateId}`);
      pool.push(
        absoluteValuePrintCase(
          templateId,
          `print:${lessonId}:${edition}:${count++}`,
        ),
      );
    }
    selected.push(found.problem);
    seen.add(found.problem.public.prompt);
  }
  return selected
    .map((problem) => ({
      problem,
      key: createHash("sha256")
        .update(
          JSON.stringify([
            "absolute-value-sheet-order",
            templateId,
            lessonId,
            edition,
            problem.public.seed,
          ]),
        )
        .digest("hex"),
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((c) => c.problem);
}
