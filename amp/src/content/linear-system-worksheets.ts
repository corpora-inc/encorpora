import { createHash } from "node:crypto";
import { linearSystemPrintCase } from "../math/linear-system-practice";
import type { GeneratedProblem } from "../math/contracts";

/** Select from ordinary generation, then order independently of outcome and selection quota. */
export function linearSystemWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
): GeneratedProblem[] {
  const requirements =
    templateId === "linear-system-pair"
      ? [
          ["quadrant:1"],
          ["quadrant:2"],
          ["quadrant:3"],
          ["quadrant:4"],
          ["x-axis"],
          ["y-axis"],
          ["origin"],
          ["fractional-coordinates:0"],
          ["fractional-coordinates:1"],
          ["fractional-coordinates:2"],
          ["axis-aligned"],
          ["scale-both"],
        ]
      : [
          ["unique", "axis-aligned"],
          ["unique", "scale-both"],
          ["unique", "fractional-coordinates:1"],
          ["unique", "fractional-coordinates:2"],
          ["none", "negative-proportionality", "vertical"],
          ["none", "negative-proportionality", "horizontal"],
          ["none", "negative-proportionality", "oblique"],
          ["none", "positive-proportionality", "oblique"],
          ["infinite", "duplicate-equations"],
          [
            "infinite",
            "differently-written",
            "negative-proportionality",
            "oblique",
          ],
          ["infinite", "vertical"],
          ["infinite", "horizontal"],
        ];
  const pool: ReturnType<typeof linearSystemPrintCase>[] = [],
    selected: GeneratedProblem[] = [];
  const systems = new Set<string>();
  let counter = 0;
  for (const required of requirements) {
    let candidate: ReturnType<typeof linearSystemPrintCase> | undefined;
    while (!candidate) {
      candidate = pool.find(
        (c) =>
          !systems.has(c.systemKey) &&
          required.every((tag) => c.tags.includes(tag)),
      );
      if (candidate) break;
      if (counter >= 4096)
        throw new Error(
          `Cannot fill representative linear-system worksheet: ${templateId}`,
        );
      pool.push(
        linearSystemPrintCase(
          templateId,
          `print:${lessonId}:${edition}:${counter++}`,
        ),
      );
    }
    systems.add(candidate.systemKey);
    selected.push(candidate.problem);
  }
  return selected
    .map((problem) => ({
      problem,
      order: createHash("sha256")
        .update(
          JSON.stringify([
            "linear-system-sheet-order",
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
