import { templates } from "../../src/math/engine";

const versionOf = new Map(templates.map((t) => [t.id, t.version]));

/** The problem as recorded at `templateVersion`. `generateProblem` stamps the
 * version it generated at over a family generator's own stamp, so a family
 * generator called directly matches the engine apart from that field. */
export function asRecorded<P extends { public: { templateVersion: number } }>(
  problem: P,
  templateVersion: number,
): P {
  return { ...problem, public: { ...problem.public, templateVersion } };
}

/** The problem as the engine records it at its template's current version. */
export function asCurrent<
  P extends { public: { templateId: string; templateVersion: number } },
>(problem: P): P {
  const version = versionOf.get(problem.public.templateId);
  if (version == null)
    throw new Error(`No template ${problem.public.templateId}`);
  return asRecorded(problem, version);
}

/** Goldens frozen before the engine recorded versions hold the stamp every
 * template but count-objects had then: 1. */
export const asFrozen = <P extends { public: { templateVersion: number } }>(
  problem: P,
) => asRecorded(problem, 1);
