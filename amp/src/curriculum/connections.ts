import type { SkillConnection } from "./types";

/** Editorial connections supported by existing content, not assessment dependencies. */
export const curriculumConnections: (Omit<
  SkillConnection,
  "skillId" | "direction"
> & {
  from: string;
  to: string;
})[] = [
  {
    from: "dilations-similarity",
    to: "slope",
    kind: "application",
    explanation:
      "Scaling a right triangle's horizontal and vertical changes by the same factor preserves their ratio. This explains why triangles along one straight line give the same slope.",
    templateIds: ["slope-triangle-statements"],
  },
  {
    from: "odd-and-even",
    to: "rule-patterns",
    kind: "extension",
    explanation:
      "Adding an even number keeps a number odd or even; adding an odd number switches it. This explains patterns that stay odd or alternate.",
    templateIds: ["rule-pattern-feature"],
  },
  {
    from: "odd-and-even",
    to: "factors-multiples",
    kind: "related",
    explanation:
      "An even positive whole number has 2 as a factor: it can be written as 2 times another whole number.",
    templateIds: ["factor-partner"],
  },
  {
    from: "odd-and-even",
    to: "multistep-whole-stories",
    kind: "application",
    explanation:
      "When each kit holds two items, an even total fills complete kits. An odd total leaves one item over.",
    templateIds: ["kit-leftovers"],
  },
  {
    from: "odd-and-even",
    to: "event-sets",
    kind: "application",
    explanation:
      "Even and odd outcomes form sets. Listing their members helps count outcomes when finding probabilities.",
    templateIds: ["event-set-count"],
  },
  // Trigonometry cluster.
  {
    from: "right-triangle-trigonometry",
    to: "special-angle-values",
    kind: "extension",
    explanation:
      "Right-triangle ratios of 30°, 45° and 60° become the unit-circle coordinates, and the quadrant sign extends them to every angle.",
    templateIds: ["special-angle-exact-value"],
  },
  {
    from: "right-triangle-trigonometry",
    to: "oblique-triangles",
    kind: "extension",
    explanation:
      "Sine and cosine ratios find sides of right triangles. The laws of sines and cosines extend them to triangles with no right angle.",
    templateIds: ["oblique-triangle-solve"],
  },
  {
    from: "special-angle-values",
    to: "trigonometric-symmetry",
    kind: "extension",
    explanation:
      "Once the values at special angles are known, reflecting or rotating the angle changes only the sign or the function, so other angles need no new values.",
    templateIds: ["trig-symmetry-value"],
  },
  {
    from: "special-angle-values",
    to: "trigonometric-identities",
    kind: "application",
    explanation:
      "Angle-sum formulas combine the exact values at 30°, 45° and 60° to give exact values at angles such as 15° and 75°.",
    templateIds: ["trig-identity-value"],
  },
  {
    from: "trigonometric-symmetry",
    to: "trigonometric-graphs",
    kind: "related",
    explanation:
      "Odd, even and periodic symmetry of sine and cosine appear on the graph as point symmetry, mirror symmetry and repetition every period.",
    templateIds: ["sinusoid-parameters"],
  },
  {
    from: "trigonometric-graphs",
    to: "inverse-trigonometry",
    kind: "extension",
    explanation:
      "Restricting sine, cosine or tangent to one interval where its graph is one-to-one makes an inverse function possible.",
    templateIds: ["inverse-trig-value"],
  },
  {
    from: "inverse-trigonometry",
    to: "trigonometric-equations",
    kind: "application",
    explanation:
      "The inverse function gives one solution of a trigonometric equation. Symmetry then supplies the other solutions in the interval.",
    templateIds: ["trig-equation-solutions"],
  },
  {
    from: "trigonometric-identities",
    to: "trigonometric-equations",
    kind: "application",
    explanation:
      "Rewriting an expression with an identity can turn a trigonometric equation into one that is solved from a single function value.",
    templateIds: ["trig-equation-solutions"],
  },
  {
    from: "trigonometric-equations",
    to: "periodic-modeling",
    kind: "application",
    explanation:
      "Setting a sinusoidal model equal to a value and solving gives the times at which the modeled quantity reaches that value.",
    templateIds: ["sinusoid-model"],
  },
  {
    from: "periodic-modeling",
    to: "trigonometric-graphs",
    kind: "related",
    explanation:
      "The amplitude, midline and period of a model are the same features read from a sinusoid graph. A context supplies them as a maximum, minimum and cycle length.",
    templateIds: ["sinusoid-parameters", "sinusoid-model"],
  },
  {
    from: "oblique-triangles",
    to: "trigonometric-area",
    kind: "related",
    explanation:
      "The height used to count triangles in the ambiguous case is b sin A, the same product that appears in the area formula one half ab sin C.",
    templateIds: ["trig-triangle-area"],
  },
];

export function connectionsFor(skillId: string): SkillConnection[] {
  return curriculumConnections.flatMap<SkillConnection>(
    ({ from, to, ...connection }) =>
      from === skillId
        ? [
            {
              ...connection,
              templateIds: [...connection.templateIds],
              skillId: to,
              direction: "forward" as const,
            },
          ]
        : to === skillId
          ? [
              {
                ...connection,
                templateIds: [...connection.templateIds],
                skillId: from,
                direction: "backward" as const,
              },
            ]
          : [],
  );
}

/** Both ends and the cited problem family must exist; evidence must belong to an endpoint. */
export function auditConnectionEvidence(
  skills: readonly { id: string }[],
  templates: readonly { id: string; skillId: string }[],
  connections = curriculumConnections,
) {
  const ids = new Set(skills.map((s) => s.id));
  const families = new Map(templates.map((t) => [t.id, t.skillId]));
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const connection of connections) {
    const { from, to, kind, explanation, templateIds } = connection;
    const pair = [from, to].sort().join("|");
    if (seen.has(pair)) errors.push(`Duplicate navigation connection: ${pair}`);
    seen.add(pair);
    if (!ids.has(from) || !ids.has(to) || from === to)
      errors.push(`Invalid navigation endpoints: ${from} → ${to}`);
    if (
      !["extension", "application", "related"].includes(kind) ||
      !explanation.trim()
    )
      errors.push(`Incomplete navigation connection: ${pair}`);
    if (!templateIds.length || new Set(templateIds).size !== templateIds.length)
      errors.push(`Invalid navigation evidence: ${pair}`);
    for (const id of templateIds)
      if (![from, to].includes(families.get(id) ?? ""))
        errors.push(`Unrelated or missing navigation evidence: ${pair}: ${id}`);
  }
  return errors;
}
