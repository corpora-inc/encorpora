import { createHash } from "node:crypto";
import { percentChangePrintCase } from "../math/percent-change-practice";
import type { GeneratedProblem } from "../math/contracts";
/** Cover overlapping mathematical features using unmodified ordinary seeded problems. */
export function percentChangeWorksheet(
  templateId: string,
  lessonId: string,
  edition: string,
): GeneratedProblem[] {
  const wanted: Record<string, number> = {
    increase: 4,
    decrease: 4,
    unchanged: 1,
    "integer-rate": 1,
    "decimal-rate": 1,
    "repeating-rate": 1,
    "whole-original": 1,
    "decimal-original": 1,
    "whole-final": 1,
    "decimal-final": 1,
    "below-one": 1,
    "over-100": 1,
    price: 1,
  };
  if (templateId !== "percent-change-original") wanted["complete-decrease"] = 1;
  if (templateId === "percent-change-rate") wanted.share = 1;
  const pool: ReturnType<typeof percentChangePrintCase>[] = [];
  for (const size of [512, 1024, 2048]) {
    while (pool.length < size)
      pool.push(
        percentChangePrintCase(
          templateId,
          `print:${lessonId}:${edition}:${pool.length}`,
        ),
      );
    const selected: typeof pool = [],
      used = new Set<string>(),
      remaining = { ...wanted };
    while (selected.length < 12) {
      let best: (typeof pool)[number] | undefined,
        bestScore = -1;
      for (const candidate of pool) {
        if (used.has(candidate.caseKey)) continue;
        if (candidate.tags.includes("unchanged") && remaining.unchanged === 0)
          continue;
        const score = candidate.tags.reduce(
          (total, tag) => total + ((remaining[tag] ?? 0) > 0 ? 1 : 0),
          0,
        );
        if (score > bestScore) {
          best = candidate;
          bestScore = score;
        }
      }
      if (!best) break;
      selected.push(best);
      used.add(best.caseKey);
      for (const tag of best.tags)
        remaining[tag] = Math.max(0, (remaining[tag] ?? 0) - 1);
    }
    if (
      selected.length === 12 &&
      Object.values(remaining).every((n) => n === 0)
    )
      return selected
        .map((c) => c.problem)
        .sort((a, b) => {
          const key = (p: GeneratedProblem) =>
            createHash("sha256")
              .update(
                JSON.stringify([
                  "percent-change-sheet-order",
                  templateId,
                  lessonId,
                  edition,
                  p.public.seed,
                ]),
              )
              .digest("hex");
          return key(a).localeCompare(key(b));
        });
  }
  throw new Error(
    `Cannot fill representative percent-change worksheet: ${templateId}`,
  );
}
