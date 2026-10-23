import { z } from "zod";

export const catalogSchema = z.object({
  trial: z.object({ free: z.number().int().positive() }).optional(),
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
export const illuminationPolicy = {
  version: "illumination-v1",
  stageSuccesses: [1, 5, 15],
  maximum: 10,
  independentSuccessesForFull: 20,
} as const;
export function illumination(evidence?: Evidence) {
  return Math.min(
    illuminationPolicy.maximum,
    ((evidence?.independentCorrect ?? 0) /
      illuminationPolicy.independentSuccessesForFull) *
      illuminationPolicy.maximum,
  );
}
/** Earned successes persist; recent strength changes independently. No mastery percentage. */
export function crystal(evidence?: Evidence) {
  const successes = evidence?.independentCorrect ?? 0;
  const score = illumination(evidence),
    strong = evidence?.status === "review-ready";
  return {
    intensity: successes ? 0.25 + score * 0.04 + (strong ? 0.45 : 0) : 0.07,
    glow: successes ? 0.25 + score * 0.035 + (strong ? 0.2 : 0) : 0.12,
    stage: illuminationPolicy.stageSuccesses.filter(
      (threshold) => successes >= threshold,
    ).length,
    strong,
    score,
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
/** Stable per-ID anchors prevent catalog additions from reindexing whole neighborhoods. */
function stableFraction(id: string) {
  let hash = 2166136261;
  for (const character of id)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}
export function layout(skills: MapSkill[]) {
  const ordered = [...skills].sort((a, b) => a.id.localeCompare(b.id));
  const points = ordered.map((skill) => {
    const area = Math.max(0, neighborhood(skill));
    const grade = Math.max(0, bands.indexOf(skill.gradeBand));
    const angle =
      (area * Math.PI) / 3 + (stableFraction(`${skill.id}:angle`) - 0.5) * 0.84;
    const radius =
      14 + grade * 5.4 + (stableFraction(`${skill.id}:radius`) - 0.5) * 4;
    return {
      skill,
      position: [
        Math.cos(angle) * radius * 1.18,
        Math.sin(angle) * radius * 0.7 + (grade - 6) * 4.4,
        28 - grade * 4.8 + Math.sin(angle * 3 + grade * 0.6) * 8,
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

/** Lateral navigation through shared foundations; never input to prerequisite scheduling. */
export function relatedSkills(skills: MapSkill[], id: string, limit = 5) {
  const selected = skills.find((s) => s.id === id);
  if (!selected) return [];
  const paths = connections(skills, id);
  const grade = bands.indexOf(selected.gradeBand);
  return skills
    .filter(
      (s) =>
        s.id !== id &&
        !paths.prerequisites.has(s.id) &&
        !paths.dependents.has(s.id) &&
        Math.abs(bands.indexOf(s.gradeBand) - grade) <= 2,
    )
    .map((skill) => ({
      skill,
      shared: skill.prerequisites.filter((id) =>
        selected.prerequisites.includes(id),
      ).length,
    }))
    .filter((s) => s.shared > 0)
    .sort((a, b) => b.shared - a.shared || a.skill.id.localeCompare(b.skill.id))
    .slice(0, limit)
    .map((s) => s.skill);
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
