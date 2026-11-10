import { generateProblem, templates } from "../../src/math/engine";
import { clauseFamilies } from "../../src/math/clause-variants";
import { clauseExtensions } from "../../src/math/clause-extensions";

/** Regression tests for the previously published surfaces keep exercising
 * their stored catalog version. Clause tests exercise the current version. */
export function generateBeforeClauses(
  id: string,
  seed: string,
  version?: number,
) {
  const current = templates.find((t) => t.id === id);
  return generateProblem(
    id,
    seed,
    version ??
      ((clauseFamilies[id] || clauseExtensions[id]) && current
        ? current.version - 1
        : undefined),
  );
}
