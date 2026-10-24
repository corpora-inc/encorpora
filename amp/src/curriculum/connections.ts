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
  {
    from: "polynomial-behavior",
    to: "rational-function-behavior",
    kind: "related",
    explanation:
      "A polynomial's degree and leading coefficient set its end behavior. A rational function compares the degrees and leading coefficients of its numerator and denominator to find its horizontal asymptote.",
    templateIds: ["rational-function-features"],
  },
  {
    from: "rational-function-behavior",
    to: "rational-equations",
    kind: "related",
    explanation:
      "The inputs that make a denominator zero are the holes and vertical asymptotes of the graph. They are also the excluded values that must be checked when solving a rational equation.",
    templateIds: ["rational-equation-check"],
  },
  {
    from: "nonlinear-intersection-reading",
    to: "graphical-equation-solving",
    kind: "extension",
    explanation:
      "Reading shared points of a line and a parabola extends to any equation f(x) = g(x): the solutions are the inputs where the two outputs match. A table of values locates them.",
    templateIds: ["graphical-solution-table"],
  },
  {
    from: "graphical-equation-solving",
    to: "nonlinear-systems",
    kind: "related",
    explanation:
      "Substitution gives exact intersections when the equation can be solved by factoring. A table of values approximates intersections that algebra cannot give simply.",
    templateIds: ["nonlinear-system-solve"],
  },
  {
    from: "factor-quadratics",
    to: "polynomial-identities",
    kind: "extension",
    explanation:
      "Factoring a difference of squares or a perfect-square trinomial uses identities such as a² − b² = (a + b)(a − b). Read from either side, the same identity also computes products and squares quickly.",
    templateIds: ["monic-quadratic-factorization"],
  },
  {
    from: "polynomial-identities",
    to: "binomial-theorem",
    kind: "extension",
    explanation:
      "The identities for (a + b)² and (a + b)³ are the cases n = 2 and n = 3 of the binomial expansion. The binomial theorem gives the coefficients for every n.",
    templateIds: ["binomial-coefficient"],
  },
  {
    from: "permutations-combinations",
    to: "binomial-theorem",
    kind: "application",
    explanation:
      "The coefficient of the term with k factors of a in (a + b)ⁿ counts the ways to choose which k of the n factors give a. That count is the combination C(n, k).",
    templateIds: ["combination-count"],
  },
  {
    from: "number-system-closure",
    to: "quadratic-formula",
    kind: "application",
    explanation:
      "A root such as (−b + √d) / 2a is a rational number plus a nonzero rational multiple of √d. When √d is irrational, the closure rules make the whole root irrational.",
    templateIds: ["quadratic-irrational-solutions"],
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
