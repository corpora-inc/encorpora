import { createHash } from "node:crypto";
import { circleMeasurementPrintCase } from "../math/circle-measurement-practice";
import type { GeneratedProblem } from "../math/contracts";
import { generateProblem } from "../math/engine";
import { withLegacySurfaces } from "../math/number-domain-axes";

/** Select ordinary seeded problems while retaining both diameter and radius practice. */
export function circleMeasurementWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
): GeneratedProblem[] {
  const angular =
    templateId === "arc-length-coefficient" ||
    templateId === "sector-area-coefficient";
  const wanted: Record<string, number> = {
    radius: 6,
    diameter: 6,
    "fraction-given": 3,
    "fraction-coefficient": 2,
  };
  if (angular)
    Object.assign(wanted, {
      acute: 1,
      right: 1,
      obtuse: 1,
      straight: 1,
      reflex: 3,
    });
  const pool: ReturnType<typeof circleMeasurementPrintCase>[] = [];
  for (const size of [512, 1024, 2048]) {
    while (pool.length < size)
      pool.push(
        circleMeasurementPrintCase(
          templateId,
          `print:${lessonId}:${edition}:${pool.length}`,
        ),
      );
    const selected: typeof pool = [],
      used = new Set<string>(),
      seenAngles = new Set<number>(),
      remaining = { ...wanted };
    while (selected.length < 12) {
      let best: (typeof pool)[number] | undefined,
        score = -1;
      for (const candidate of pool) {
        if (
          used.has(candidate.caseKey) ||
          candidate.tags.some(
            (t) => (t === "radius" || t === "diameter") && remaining[t] === 0,
          )
        )
          continue;
        const value =
          candidate.tags.reduce(
            (sum, t) => sum + ((remaining[t] ?? 0) > 0 ? 1 : 0),
            0,
          ) +
          (angular && seenAngles.size < 6 && !seenAngles.has(candidate.angle!)
            ? 1
            : 0);
        if (value > score) {
          best = candidate;
          score = value;
        }
      }
      if (!best) break;
      selected.push(best);
      used.add(best.caseKey);
      if (best.angle !== null) seenAngles.add(best.angle);
      for (const tag of best.tags)
        remaining[tag] = Math.max(0, (remaining[tag] ?? 0) - 1);
    }
    if (
      selected.length === 12 &&
      Object.values(remaining).every((n) => n === 0) &&
      (!angular || seenAngles.size >= 6)
    )
      return withLegacySurfaces(() =>
        selected
          .map((c) => generateProblem(templateId, c.problem.public.seed))
          .sort((a, b) => {
            const key = (p: GeneratedProblem) =>
              createHash("sha256")
                .update(
                  JSON.stringify([
                    "circle-sheet-order",
                    templateId,
                    lessonId,
                    edition,
                    p.public.seed,
                  ]),
                )
                .digest("hex");
            return key(a).localeCompare(key(b));
          }),
      );
  }
  throw new Error(`Cannot fill representative circle worksheet: ${templateId}`);
}
