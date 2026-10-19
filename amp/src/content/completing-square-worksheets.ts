import { createHash } from "node:crypto";
import { completingSquarePrintCase } from "../math/completing-square-practice";
import type { GeneratedProblem } from "../math/contracts";
export function completingSquareWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
): GeneratedProblem[] {
  const requirements =
    templateId === "complete-square-term"
      ? [
          "positive-linear",
          "negative-linear",
          "zero-linear",
          "odd-linear",
          "even-linear",
          "fractional-shift",
          "negative-linear",
          "positive-linear",
          "odd-linear",
          "even-linear",
          "negative-linear",
          "positive-linear",
        ]
      : [
          "positive-linear",
          "negative-linear",
          "zero-linear",
          "zero-constant",
          "fractional-shift",
          "integer-shift",
          "zero-remainder",
          "negative-remainder",
          "positive-remainder",
          "fractional-remainder",
          templateId === "complete-square-nonmonic"
            ? "negative-leading"
            : "positive-linear",
          "integer-remainder",
        ];
  const pool: ReturnType<typeof completingSquarePrintCase>[] = [],
    picked: GeneratedProblem[] = [],
    seen = new Set<string>();
  let counter = 0;
  for (const tag of requirements) {
    let match: ReturnType<typeof completingSquarePrintCase> | undefined;
    while (!match) {
      match = pool.find(
        (c) => !seen.has(c.problem.public.prompt) && c.tags.includes(tag),
      );
      if (match) break;
      if (counter >= 8192)
        throw new Error(
          `Cannot fill completing-square worksheet ${templateId}`,
        );
      pool.push(
        completingSquarePrintCase(
          templateId,
          `print:${lessonId}:${edition}:${counter++}`,
        ),
      );
    }
    seen.add(match.problem.public.prompt);
    picked.push(match.problem);
  }
  return picked
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
