import { createHash } from "node:crypto";
import { inequalityPrintCase } from "../math/inequality-practice";
import type { GeneratedProblem } from "../math/contracts";

/** Each sheet includes three problems per comparison sign, with exact matching answer-key order. */
export function inequalityWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
): GeneratedProblem[] {
  const operators = ["<", "≤", ">", "≥"];
  const requirements =
    templateId === "cancelled-linear-inequality"
      ? operators.flatMap((op) => [
          [`operator:${op}`, "equal"],
          [`operator:${op}`, "unequal", "true"],
          [`operator:${op}`, "unequal", "false"],
        ])
      : [
          [
            "operator:<",
            "positive",
            "zero",
            ...(templateId === "affine-linear-inequality"
              ? ["fraction-coefficient"]
              : []),
          ],
          ["operator:<", "negative", "fraction-boundary"],
          ...operators.slice(1).flatMap((op) => [
            [`operator:${op}`, "positive"],
            [`operator:${op}`, "negative"],
          ]),
          ...operators.map((op) => [`operator:${op}`]),
        ];
  const pool: ReturnType<typeof inequalityPrintCase>[] = [];
  const selected: GeneratedProblem[] = [];
  const prompts = new Set<string>();
  let counter = 0;
  for (const required of requirements) {
    let candidate: ReturnType<typeof inequalityPrintCase> | undefined;
    while (!candidate) {
      candidate = pool.find(
        (c) =>
          !prompts.has(c.problem.public.prompt) &&
          required.every((tag) => c.tags.includes(tag)),
      );
      if (candidate) break;
      if (counter >= 4096)
        throw new Error(`Cannot fill representative worksheet: ${templateId}`);
      pool.push(
        inequalityPrintCase(
          templateId,
          `print:${lessonId}:${edition}:${counter++}`,
        ),
      );
    }
    selected.push(candidate.problem);
    prompts.add(candidate.problem.public.prompt);
  }
  return selected
    .map((problem) => ({
      problem,
      order: createHash("sha256")
        .update(
          JSON.stringify([
            "inequality-sheet-order",
            templateId,
            lessonId,
            edition,
            problem.public.seed,
          ]),
        )
        .digest("hex"),
    }))
    .sort(
      (a, b) =>
        a.order.localeCompare(b.order) ||
        a.problem.public.id.localeCompare(b.problem.public.id),
    )
    .map(({ problem }) => problem);
}
