/** Archetype ids that were merged into another archetype. The merged id is
 * gone from the archetype list, every ledger row and every template link; the
 * map lets an old reference (a saved report, a pull request, a stored note)
 * resolve to the archetype that now names the task. Add an entry whenever two
 * archetypes are merged (see docs/assessment-coverage.md, "Archetype
 * consistency"). */
export const archetypeAliases: Readonly<Record<string, string>> = {
  "measure.thermometer": "measure.read-scale",
  "univariate.mode": "univariate.center",
  "number.number-line-equation": "early.number-line-hops",
  "shape.name-flat": "shape.attributes",
  "fractions.name-equal-share": "fractions.model",
  "equation.model-choice": "number.strip-diagram",
};

/** The archetype id that currently names a task, following merges. */
export function canonicalArchetypeId(id: string): string {
  let current = id;
  for (let hops = 0; hops < 8 && archetypeAliases[current]; hops++)
    current = archetypeAliases[current]!;
  return current;
}
