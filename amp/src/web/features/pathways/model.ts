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
  templates: z.array(
    z.object({
      id: z.string(),
      skillId: z.string(),
      title: z.string().optional(),
    }),
  ),
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
/** Spatial neighborhoods are visual only; the prerequisite graph owns the connections. */
export const neighborhoods = [
  {
    title: "Number & operations",
    strands: ["number", "operations", "fractions", "decimals"],
    color: "--atlas-area-0",
  },
  {
    title: "Algebra & ratios",
    strands: ["algebra", "ratio"],
    color: "--atlas-area-1",
  },
  {
    title: "Functions & trigonometry",
    strands: ["functions", "trigonometry"],
    color: "--atlas-area-2",
  },
  {
    title: "Geometry & measurement",
    strands: ["geometry", "measurement"],
    color: "--atlas-area-3",
  },
  {
    title: "Data & probability",
    strands: ["data", "probability"],
    color: "--atlas-area-4",
  },
  {
    title: "Modeling & reasoning",
    strands: ["modeling", "reasoning"],
    color: "--atlas-area-5",
  },
];
export function neighborhood(skill: MapSkill) {
  return Math.max(
    0,
    neighborhoods.findIndex((n) => n.strands.includes(skill.strand)),
  );
}
export function layout(skills: MapSkill[]) {
  const ordered = [...skills].sort((a, b) => a.id.localeCompare(b.id));
  const points = ordered.map((skill) => {
    const area = Math.max(0, neighborhood(skill));
    const grade = Math.max(0, bands.indexOf(skill.gradeBand));
    const group = ordered.filter(
      (s) => neighborhood(s) === area && s.gradeBand === skill.gradeBand,
    );
    const slot = group.findIndex((s) => s.id === skill.id);
    const angle =
      (area * Math.PI) / 3 + ((slot + 0.5) / group.length - 0.5) * 0.84;
    const radius = 14 + grade * 5.4 + Math.sin(slot * 2.4) * 2;
    return {
      skill,
      position: [
        Math.cos(angle) * radius * 1.18,
        Math.sin(angle) * radius,
        Math.sin(angle * 3 + grade * 0.6) * 5,
      ] as [number, number, number],
    };
  });
  // Separate dense neighborhoods without a live force simulation or a jumping map.
  for (let pass = 0; pass < 36; pass++) {
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i]!.position,
          b = points[j]!.position;
        const dx = b[0] - a[0],
          dy = b[1] - a[1],
          d = Math.hypot(dx, dy);
        if (d < 3.9 && d > 0) {
          const push = (3.9 - d) * 0.25;
          a[0] -= (dx / d) * push;
          a[1] -= (dy / d) * push;
          b[0] += (dx / d) * push;
          b[1] += (dy / d) * push;
        }
      }
  }
  const byId = new Map(points.map((p) => [p.skill.id, p]));
  return skills.map((s) => byId.get(s.id)!);
}
/** An explicitly labeled, deterministic preview. Never persisted as learner evidence. */
export function previewEvidence(skills: MapSkill[]): Evidence[] {
  return skills.flatMap((skill, i) => {
    const grade = bands.indexOf(skill.gradeBand);
    if (grade > 7 || (i % 7 === 0 && grade > 3)) return [];
    const successes = Math.max(1, 22 - grade * 3 + (i % 4));
    return [
      {
        skillId: skill.id,
        attempts: successes + 2,
        independentCorrect: successes,
        independentOccasions: 3,
        status: grade < 5 ? ("review-ready" as const) : ("practicing" as const),
        reviewDueAt: null,
      },
    ];
  });
}
/** Cycle-safe transitive paths. Edges retain prerequisite → dependent direction. */
export function connections(skills: MapSkill[], id: string) {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const walk = (reverse: boolean) => {
    const found = new Set<string>();
    const pending = [id];
    while (pending.length) {
      const current = pending.pop()!;
      const next = reverse
        ? skills
            .filter((s) => s.prerequisites.includes(current))
            .map((s) => s.id)
        : (byId.get(current)?.prerequisites ?? []);
      for (const key of next)
        if (key !== id && byId.has(key) && !found.has(key)) {
          found.add(key);
          pending.push(key);
        }
    }
    return found;
  };
  return { prerequisites: walk(false), dependents: walk(true) };
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
