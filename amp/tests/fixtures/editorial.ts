import { after } from "node:test";

const offenders = new Set<string>();

/** Editorial budgets guide review; they do not establish learner breakage. */
export function reportEditorialLimit(withinBudget: unknown, offender: string) {
  if (!withinBudget) offenders.add(offender);
}

after(() => {
  if (offenders.size)
    console.warn(
      `Editorial warning (non-blocking):\n${[...offenders]
        .sort()
        .map((s) => `  - ${s}`)
        .join("\n")}`,
    );
});
