/**
 * The five content areas of mathematics (NCTM / NAEP): the one division of
 * the curriculum every screen uses, in this order. Display and grouping only:
 * the engine's strands, their estimates and levels are unchanged.
 *
 * Pure data, no imports: the web app and the server share it.
 */
export const areas = [
  { id: "number", title: "Number & operations", color: "--atlas-area-0" },
  { id: "algebra", title: "Algebra", color: "--atlas-area-1" },
  { id: "geometry", title: "Geometry", color: "--atlas-area-2" },
  { id: "measurement", title: "Measurement", color: "--atlas-area-3" },
  { id: "data", title: "Data & probability", color: "--atlas-area-4" },
] as const;
export type AreaId = (typeof areas)[number]["id"];
export const areaIds = areas.map((area) => area.id) as AreaId[];

/** Each engine strand's area. Modeling and reasoning are not areas: their
 * skills each take an area from `crossCuttingAreas`. */
export const strandAreas: Readonly<Record<string, AreaId>> = {
  number: "number",
  operations: "number",
  fractions: "number",
  decimals: "number",
  algebra: "algebra",
  ratio: "algebra",
  functions: "algebra",
  geometry: "geometry",
  trigonometry: "geometry",
  measurement: "measurement",
  data: "data",
  probability: "data",
};
/** Strands that cut across the areas: each of their skills is assigned an
 * area by hand, below. Families never see these strands as level rows. */
export const crossCuttingStrands = ["modeling", "reasoning"] as const;

/**
 * Reviewed: every modeling and reasoning skill's area, chosen by what the
 * skill is about (its prerequisites and problem types). A new modeling or
 * reasoning skill needs a row here: `areaOf` throws without one, and
 * tests/areas.test.ts fails.
 */
export const crossCuttingAreas: Readonly<Record<string, AreaId>> = {
  // Word problems on whole-number, decimal and signed arithmetic.
  "addition-stories": "number",
  "two-step-stories": "number",
  "multiplicative-stories": "number",
  "multi-operation-stories": "number",
  "multiplicative-comparison": "number",
  "multistep-whole-stories": "number",
  "financial-literacy-elementary": "number",
  "financial-literacy-middle": "number",
  "rational-stories": "number",
  // Number systems, vectors and matrices (the catalog's number strand).
  "number-system-closure": "number",
  "vector-modeling": "number",
  "matrix-properties": "number",
  // Building and justifying equations and function models.
  "linear-models": "algebra",
  "linear-equation-modeling": "algebra",
  "systems-modeling": "algebra",
  "nonlinear-equation-modeling": "algebra",
  "parametric-models": "algebra",
  "periodic-modeling": "algebra",
  "polynomial-identities": "algebra",
  "equation-reasoning": "algebra",
  "elimination-proof": "algebra",
  // Proof and modeling with figures, solids and coordinates.
  "geometric-proof": "geometry",
  "line-angle-proofs": "geometry",
  "triangle-proofs": "geometry",
  "parallelogram-proofs": "geometry",
  "circle-similarity": "geometry",
  "similarity-theorems": "geometry",
  "slope-proofs": "geometry",
  "measurement-formula-proofs": "geometry",
  "cavalieri-principle": "geometry",
  "triangle-law-proofs": "geometry",
  "geometric-modeling": "geometry",
  "solid-volume-models": "geometry",
  "density-modeling": "geometry",
  "geometric-design": "geometry",
  // Units, precision and the quantities a model measures.
  "units-and-precision": "measurement",
  "model-quantities": "measurement",
  // Evidence, studies and decisions under uncertainty.
  "model-validation": "data",
  "causal-claims": "data",
  "statistical-report-critique": "data",
  "decision-strategies": "data",
};

/** A skill's area: its strand's, or its reviewed assignment. Throws for a
 * skill with neither, so a gap fails at catalog load, never silently. */
export function areaOf(skill: { id: string; strand: string }): AreaId {
  const area = strandAreas[skill.strand] ?? crossCuttingAreas[skill.id];
  if (!area)
    throw new Error(
      `Skill ${skill.id} (${skill.strand}) has no area: add it to crossCuttingAreas`,
    );
  return area;
}
/**
 * One grade's skills in one area, easiest to hardest: a topological order of
 * the prerequisite graph, so a skill comes after everything it builds on in
 * the list (directly or through skills elsewhere). Among skills free to come
 * next, the lower `difficulty` first, then the earlier in `all` (the
 * catalog's editorial order). `all` is the whole catalog, for the paths that
 * leave the list and come back.
 */
export function easiestFirst<
  T extends { id: string; prerequisites: readonly string[] },
>(
  list: readonly T[],
  all: readonly T[],
  difficulty: (skill: T) => number = () => 0,
): T[] {
  const byId = new Map(all.map((skill) => [skill.id, skill]));
  const position = new Map(all.map((skill, i) => [skill.id, i]));
  const ancestors = new Map<string, Set<string>>();
  const ancestorsOf = (id: string, path = new Set<string>()): Set<string> => {
    const known = ancestors.get(id);
    if (known) return known;
    const found = new Set<string>();
    path.add(id);
    for (const parent of byId.get(id)?.prerequisites ?? []) {
      if (path.has(parent) || !byId.has(parent)) continue;
      found.add(parent);
      for (const above of ancestorsOf(parent, path)) found.add(above);
    }
    path.delete(id);
    ancestors.set(id, found);
    return found;
  };
  const here = new Set(list.map((skill) => skill.id));
  const waitingOn = new Map(
    list.map((skill) => [
      skill.id,
      new Set([...ancestorsOf(skill.id)].filter((id) => here.has(id))),
    ]),
  );
  const key = (skill: T) => [difficulty(skill), position.get(skill.id) ?? 0];
  const before = (a: T, b: T) => {
    const [da, pa] = key(a),
      [db, pb] = key(b);
    return da! - db! || pa! - pb!;
  };
  const ordered: T[] = [];
  const left = [...list];
  while (left.length) {
    const ready = left.filter((skill) => waitingOn.get(skill.id)!.size === 0);
    // A cycle (never in the catalog) falls back to the tie-break alone.
    const next = (ready.length ? ready : left).reduce((best, skill) =>
      before(skill, best) < 0 ? skill : best,
    );
    ordered.push(next);
    left.splice(left.indexOf(next), 1);
    for (const waiting of waitingOn.values()) waiting.delete(next.id);
  }
  return ordered;
}
export function areaIndex(area: AreaId) {
  return areaIds.indexOf(area);
}
export function isAreaId(value: unknown): value is AreaId {
  return areaIds.includes(value as AreaId);
}

/** The engine's strands in the five areas' order (curriculum/areas.ts). */
const strandOrder = [...Object.keys(strandAreas), ...crossCuttingStrands];
/** Modeling and reasoning cut across the areas: a staff view lists them
 * last, under this heading. */
export const ACROSS_AREAS = "Across areas";

/**
 * A learner's strand rows grouped by the five areas of math, in order, each
 * area's strands in the engine's order. The engine combines strands only
 * into Overall, so an area has no level of its own: it is a heading over its
 * strands' rows (`heading` on the first row of each group). An area whose
 * only row is its namesake strand (Measurement) needs no heading over it.
 * Modeling and reasoning are no area: families never see them; a teacher's
 * view (`crossCutting`) lists them last, under "Across areas".
 */
export function byArea<T extends { id: string }>(
  rows: readonly T[],
  { crossCutting = false }: { crossCutting?: boolean } = {},
): (T & { group: string; heading?: string; nested?: boolean })[] {
  const groupOf = (id: string) =>
    strandAreas[id] ?? (crossCutting ? "across" : null);
  const rank = (id: string) => {
    const at = strandOrder.indexOf(id);
    return at < 0 ? strandOrder.length : at;
  };
  const kept = rows
    .flatMap((row) => {
      const group = groupOf(row.id);
      return group ? [{ ...row, group }] : [];
    })
    .sort((a, b) => {
      const ga = areaIds.indexOf(a.group as never),
        gb = areaIds.indexOf(b.group as never);
      return (
        (ga < 0 ? areaIds.length : ga) - (gb < 0 ? areaIds.length : gb) ||
        rank(a.id) - rank(b.id)
      );
    });
  const headed = new Set(
    kept
      .filter(
        (row) =>
          !(
            row.id === row.group &&
            kept.filter((other) => other.group === row.group).length === 1
          ),
      )
      .map((row) => row.group),
  );
  return kept.map((row, i) => {
    if (!headed.has(row.group)) return row;
    const first = kept[i - 1]?.group !== row.group;
    return {
      ...row,
      nested: true,
      ...(first && {
        heading:
          areas.find((area) => area.id === row.group)?.title ?? ACROSS_AREAS,
      }),
    };
  });
}
