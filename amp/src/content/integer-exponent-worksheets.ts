import { createHash } from "node:crypto";
import { integerExponentPrintCase } from "../math/integer-exponent-practice";
import type { GeneratedProblem } from "../math/contracts";

export function integerExponentWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
): GeneratedProblem[] {
  const requirements =
    templateId === "negative-integer-power"
      ? [
          ["negative-base", "odd"],
          ["negative-base", "even"],
          ["positive-base", "integer-base"],
          ["positive-base", "fraction-base"],
          ["negative-base", "fraction-base"],
          ["integer-base"],
          ["odd"],
          ["even"],
          ["fraction-base"],
          ["positive-base"],
          ["negative-base"],
          ["fraction-base"],
        ]
      : [
          ["negative-result"],
          ["zero-result"],
          ["positive-result"],
          ["zero-input"],
          ["both-negative"],
          ["one-negative"],
          ["negative-result"],
          ["zero-result"],
          ["positive-result"],
          ["zero-input"],
          ["both-negative"],
          ["one-negative"],
        ];
  const pool: ReturnType<typeof integerExponentPrintCase>[] = [],
    selected: GeneratedProblem[] = [],
    seen = new Set<string>();
  let counter = 0;
  for (const tags of requirements) {
    let match: ReturnType<typeof integerExponentPrintCase> | undefined;
    while (!match) {
      match = pool.find(
        (c) =>
          !seen.has(c.problem.public.prompt) &&
          tags.every((t) => c.tags.includes(t)),
      );
      if (match) break;
      if (counter >= 4096)
        throw new Error(`Cannot fill integer-exponent worksheet ${templateId}`);
      pool.push(
        integerExponentPrintCase(
          templateId,
          `print:${lessonId}:${edition}:${counter++}`,
        ),
      );
    }
    seen.add(match.problem.public.prompt);
    selected.push(match.problem);
  }
  return selected
    .map((problem) => ({
      problem,
      key: createHash("sha256")
        .update(
          JSON.stringify([templateId, lessonId, edition, problem.public.seed]),
        )
        .digest("hex"),
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((p) => p.problem);
}
