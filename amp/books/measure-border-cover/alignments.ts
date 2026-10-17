import { measureBorderCover } from "./book.js";
export interface MeasurementAlignment {
  id: string;
  skillId: string;
  relation: "taught" | "practiced" | "reference";
  pageIds: string[];
  taskIds: string[];
  templateIds: string[];
  standardIds: string[];
  scope: string;
  unassessedRequirements: string[];
}
const taskSelection: Record<string, string[]> = {
  "entry-length-probe": ["entry-ruler"],
  "fractional-scale-bridge": ["quarter-check", "mixed-distance"],
  "perimeter-meaning": [
    "entry-quantities",
    "border-path",
    "formula-repair",
    "new-border",
    "missing-width",
    "elbow-border",
    "seam-repair",
    "gate-opening",
    "double-border-claim",
    "floor-order",
    "counterexample-choice",
    "delayed-border",
    "delayed-seam",
    "three-quantities",
  ],
  "area-square-units": [
    "entry-quantities",
    "unit-square-explain",
    "rotate-cover",
    "large-tiles",
    "partition-why",
    "second-split",
    "missing-corner-area",
    "subtract-length-error",
    "overlap-floor",
    "floor-order",
    "three-quantities",
  ],
  "rectangle-constraints": [
    "equal-area-compare",
    "equal-border-compare",
    "area-width",
    "factor-designs",
    "two-limits",
    "double-both",
    "courtyard-design",
    "impossible-brief",
    "invent-design",
    "mixed-rectangle",
    "counterexample-choice",
    "delayed-border",
  ],
  "multistep-length-conversions": [
    "fractional-conversion",
    "metric-pair",
    "mixed-perimeter",
    "unit-claim-repair",
    "mixed-distance",
    "delayed-units",
  ],
};
const row = (
  id: string,
  skillId: string,
  pageIds: string[],
  standardIds: string[],
  scope: string,
  unassessedRequirements: string[],
  templateIds: string[] = [],
  relation: MeasurementAlignment["relation"] = "taught",
): MeasurementAlignment => ({
  id,
  skillId,
  pageIds,
  standardIds,
  scope,
  unassessedRequirements,
  templateIds,
  relation,
  taskIds:
    taskSelection[id] ??
    measureBorderCover.pages
      .filter((p) => pageIds.includes(p.id))
      .flatMap((p) =>
        p.blocks.filter((b) => b.kind === "task").map((b) => b.id),
      ),
});
export const measurementAlignments: readonly MeasurementAlignment[] = [
  row(
    "entry-length-probe",
    "ruler-measurement",
    ["entry-check"],
    ["2.MD.A.1"],
    "A single shifted-start length probe distinguishes endpoint position from distance.",
    [
      "One entry response does not establish ruler competence or durable mastery.",
    ],
    [],
    "reference",
  ),
  row(
    "length-intervals",
    "ruler-measurement",
    [
      "spaces-not-marks",
      "start-away-from-zero",
      "equal-units",
      "measure-an-object",
      "length-retrieval",
    ],
    ["2.MD.A.1", "2.MD.A.2", "2.MD.A.3"],
    "Length as equal intervals, shifted starts, estimates and a real-ruler activity, with selected comparisons of unit sizes.",
    [
      "Does not assess every tool or customary unit; printed diagrams are schematic.",
      "Actual measurement accuracy and oral explanations require human observation.",
    ],
  ),
  row(
    "fractional-scale-bridge",
    "ruler-measurement",
    ["fractional-lengths", "mixed-measures"],
    ["2.MD.A.1"],
    "Extension beyond whole-unit ruler entry: read selected half- and quarter-centimeter intervals and subtract positions.",
    [
      "Fractional scale work is an extension, not a claim that grade-two standards require these fraction computations.",
      "No automated ruler-reading template is bound to this volume.",
    ],
    [],
    "reference",
  ),
  row(
    "perimeter-meaning",
    "perimeter",
    [
      "entry-check",
      "walk-the-border",
      "opposite-sides",
      "missing-side",
      "every-outside-edge",
      "inside-is-not-outside",
      "border-decisions",
      "studio-floor",
      "mixed-explain",
      "return-later",
      "reflection",
    ],
    ["3.MD.D.8"],
    "Outside boundary length, missing rectangle sides, selected concave unit regions, shared seams, and open counterexamples.",
    [
      "Selected grid-aligned regions and rectangles do not cover every polygon or context.",
      "Constructed explanations, diagrams and delayed responses require human review; book presence is not mastery.",
    ],
  ),
  row(
    "area-square-units",
    "rectangle-area",
    [
      "entry-check",
      "cover-with-squares",
      "rows-to-area",
      "tile-size",
      "split-and-recombine",
      "another-decomposition",
      "surround-and-subtract",
      "coverage-repair",
      "studio-floor",
      "reflection",
    ],
    ["3.MD.C.5", "3.MD.C.6", "3.MD.C.7"],
    "Unit-square coverage, rows and products, disjoint decompositions, missing corners and selected overlap correction.",
    [
      "Runtime practice returns only the area of a complete rectangle with whole-number dimensions.",
      "No automated assessment of unit-square construction, explanation, decomposition or every standard component.",
    ],
    ["rectangle-area"],
  ),
  row(
    "rectangle-constraints",
    "area-perimeter-models",
    [
      "same-area-new-border",
      "same-border-new-area",
      "find-the-width",
      "all-rectangle-options",
      "design-with-two-limits",
      "stretch-or-rename",
      "studio-courtyard",
      "studio-impossible",
      "studio-invent",
      "mixed-measures",
      "mixed-explain",
      "return-later",
    ],
    ["4.MD.A.3"],
    "Rectangle area and perimeter relationships, missing factors, counterexamples, and complete searches under positive whole-number side constraints.",
    [
      "No general optimization theorem or unrestricted real-valued design space is claimed.",
      "Open designs and complete factor-pair arguments require human review; no automated family is bound for these facets.",
    ],
  ),
  row(
    "larger-to-smaller-length",
    "unit-conversion",
    ["same-length-new-unit", "unit-relationships"],
    ["4.MD.A.1"],
    "Selected metric-length relationships, exact larger-to-smaller conversions, and direction-of-count reasoning.",
    [
      "Length only: no full mass, capacity, time, customary-unit or measurement-story survey.",
      "The paired smaller-to-larger examples are grade-five extensions, not a claim of grade-four whole-standard coverage.",
    ],
  ),
  row(
    "multistep-length-conversions",
    "measurement-conversions",
    [
      "conversion-table",
      "unit-relationships",
      "one-unit-before-calculating",
      "length-is-not-area",
      "mixed-measures",
      "return-later",
    ],
    ["5.MD.A.1"],
    "Selected metric-length conversions in both directions, fractional/decimal outputs, mixed-unit perimeter, and a caution distinguishing square units.",
    [
      "Not every measurement system or quantity is taught.",
      "Square-centimeter conversion is a selected conceptual extension, not a complete area-unit conversion curriculum.",
      "No automated conversion template is bound to this volume.",
    ],
  ),
  row(
    "material-order-models",
    "area-perimeter-models",
    ["compare-the-plans", "studio-floor"],
    ["4.MD.A.3"],
    "Apply boundary and coverage quantities in explicitly bounded exact-length, exact-area and whole-pack purchasing models.",
    [
      "Pricing and pack assumptions are stated for the tasks; no general real-world purchasing accuracy or cost-optimization coverage is inferred.",
      "Numeric app answers do not assess an independently constructed model.",
    ],
    [],
    "practiced",
  ),
];
export function validateMeasurementAlignments(
  skills: readonly {
    id: string;
    alignments: readonly { standardId: string }[];
  }[],
  templates: readonly { id: string; skillId: string }[],
  standards: readonly { id: string }[],
  alignments: readonly MeasurementAlignment[] = measurementAlignments,
): void {
  const skillMap = new Map(skills.map((s) => [s.id, s])),
    templateMap = new Map(templates.map((t) => [t.id, t])),
    standardIds = new Set(standards.map((s) => s.id)),
    pages = new Map(measureBorderCover.pages.map((p) => [p.id, p])),
    seen = new Set<string>();
  for (const a of alignments) {
    if (!a.id.trim() || seen.has(a.id))
      throw new Error(`Duplicate or empty measurement alignment: ${a.id}`);
    seen.add(a.id);
    const skill = skillMap.get(a.skillId);
    if (!skill) throw new Error(`Unknown skill: ${a.skillId}`);
    if (
      !["taught", "practiced", "reference"].includes(a.relation) ||
      !a.scope.trim() ||
      !a.pageIds.length ||
      !a.standardIds.length ||
      !a.unassessedRequirements.length ||
      a.unassessedRequirements.some((s) => !s.trim())
    )
      throw new Error(`Incomplete alignment scope: ${a.id}`);
    for (const id of a.standardIds)
      if (
        !standardIds.has(id) ||
        !skill.alignments.some((s) => s.standardId === id)
      )
        throw new Error(`Standard outside skill crosswalk: ${a.skillId}/${id}`);
    for (const id of a.pageIds)
      if (!pages.has(id)) throw new Error(`Unknown page: ${id}`);
    for (const id of a.taskIds)
      if (
        !a.pageIds.some((p) =>
          pages.get(p)!.blocks.some((b) => b.kind === "task" && b.id === id),
        )
      )
        throw new Error(`Task outside alignment pages: ${id}`);
    for (const id of a.templateIds)
      if (templateMap.get(id)?.skillId !== a.skillId)
        throw new Error(`Template skill mismatch: ${id}`);
  }
}
