import { generateProblem as current, templates } from "../../src/math/engine";
import { clauseExtensions } from "../../src/math/clause-extensions";

/** Keep the original families' prompt-derived regression assertions on their
 * stored catalog version. clause-variants-astra-3 and clause-oracle exercise
 * the new formats, their dispatch, and the current mixed catalog separately.
 * An explicit version is a reprint request and is passed through unchanged. */
export function generateProblem(id: string, seed: string, version?: number) {
  const meta = templates.find((t) => t.id === id);
  return current(
    id,
    seed,
    version ?? (clauseExtensions[id] && meta ? meta.version - 1 : undefined),
  );
}
