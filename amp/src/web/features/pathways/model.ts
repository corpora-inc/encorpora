import { z } from "zod";

export const catalogSchema = z.object({
  skills: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      gradeBand: z.string(),
      strand: z.string(),
      prerequisites: z.array(z.string()),
    }),
  ),
  templates: z.array(z.object({ id: z.string(), skillId: z.string() })),
});
export const progressSchema = z.object({
  asOf: z.string(),
  skills: z.array(
    z.object({
      skillId: z.string(),
      attempts: z.number().nonnegative(),
      independentCorrect: z.number().nonnegative(),
      independentOccasions: z.number().nonnegative(),
      status: z.enum(["new", "practicing", "review-ready"]),
      reviewDueAt: z.string().nullable(),
    }),
  ),
});
export type MapSkill = z.infer<typeof catalogSchema>["skills"][number];
export type Evidence = z.infer<typeof progressSchema>["skills"][number];
export const bands = [
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "algebra-1",
  "geometry",
  "algebra-2",
  "precalculus",
];
export function bandLabel(band: string) {
  return (
    (
      {
        K: "Kindergarten",
        "algebra-1": "Algebra 1",
        geometry: "Geometry",
        "algebra-2": "Algebra 2",
        precalculus: "Precalculus",
      } as Record<string, string>
    )[band] ?? `Grade ${band}`
  );
}
/** Earned successes persist; recent strength changes independently. No mastery percentage. */
export function crystal(evidence?: Evidence) {
  const successes = evidence?.independentCorrect ?? 0;
  return {
    stage: successes === 0 ? 0 : successes < 5 ? 1 : successes < 15 ? 2 : 3,
    strong: evidence?.status === "review-ready",
  };
}
/** Stable grade/course shelves and strand columns; edges connect actual prerequisites. */
export function layout(skills: MapSkill[]) {
  const strands = [...new Set(skills.map((s) => s.strand))].sort();
  const groups = new Map<string, MapSkill[]>();
  for (const skill of skills) {
    const key = `${skill.gradeBand}/${skill.strand}`;
    groups.set(key, [...(groups.get(key) ?? []), skill]);
  }
  return skills.map((skill) => {
    const group = groups
      .get(`${skill.gradeBand}/${skill.strand}`)!
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id));
    const slot = group.findIndex((s) => s.id === skill.id);
    return {
      skill,
      position: [
        (strands.indexOf(skill.strand) - (strands.length - 1) / 2) * 8 +
          ((slot % 3) - 1) * 1.8,
        (bands.indexOf(skill.gradeBand) - 6) * 6,
        (Math.floor(slot / 3) - (Math.ceil(group.length / 3) - 1) / 2) * 2.4,
      ] as [number, number, number],
    };
  });
}

const estimateSchema = z.object({
  level: z.number().finite(),
  sd: z.number().nonnegative(),
  answered: z.number().nonnegative(),
  independent: z.number().nonnegative(),
});
export const frontierSchema = z.object({
  expected: z.number().finite(),
  overall: estimateSchema,
  strands: z.record(z.string(), estimateSchema),
});
export type Frontier = z.infer<typeof frontierSchema>;
export function frontierRange(frontier: Frontier, strand?: string) {
  const estimate = strand ? frontier.strands[strand] : frontier.overall;
  if (!estimate || estimate.answered === 0) return null;
  return {
    level: estimate.level,
    lo: estimate.level - 1.64 * estimate.sd,
    hi: estimate.level + 1.64 * estimate.sd,
  };
}
