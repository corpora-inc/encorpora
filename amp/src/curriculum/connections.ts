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
