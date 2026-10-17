import { balanceAndChange } from "./book.js";
export interface AlgebraAlignment {
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
const row = (
  id: string,
  skillId: string,
  pageIds: string[],
  standardIds: string[],
  scope: string,
  unassessedRequirements: string[],
  templateIds: string[] = [],
  relation: AlgebraAlignment["relation"] = "taught",
  taskIds?: string[],
): AlgebraAlignment => ({
  id,
  skillId,
  pageIds,
  standardIds,
  scope,
  unassessedRequirements,
  templateIds,
  relation,
  taskIds:
    taskIds ??
    balanceAndChange.pages
      .filter((p) => pageIds.includes(p.id))
      .flatMap((p) =>
        p.blocks.filter((b) => b.kind === "task").map((b) => b.id),
      ),
});
/** Editorial relationships to selected requirements; neither content presence nor a visit establishes mastery. */
export const balanceAlignments: readonly AlgebraAlignment[] = [
  row(
    "delayed-equation-retrieval",
    "linear-equations",
    ["delayed-return"],
    ["8.EE.C.7"],
    "Return to a rational equation and an identity without adjacent worked examples.",
    [
      "A later attempt is evidence for the selected forms, not complete equation mastery.",
    ],
    [],
    "practiced",
    ["delayed-rational", "delayed-identity"],
  ),
  row(
    "delayed-model-retrieval",
    "linear-models",
    ["delayed-return"],
    ["8.F.B.4"],
    "Reconstruct a linear rule and zero-input value from two observations under an explicit linear assumption.",
    ["One reconstruction does not establish general modeling or transfer."],
    [],
    "practiced",
    ["delayed-model"],
  ),

  row(
    "entry-equation-probe",
    "one-step-equations",
    ["entry"],
    ["6.EE.B.7"],
    "An entry probe retrieves a missing-value equation.",
    ["One entry response is not evidence of durable mastery."],
    [],
    "reference",
    ["entry-unknown"],
  ),
  row(
    "mixed-equation-retrieval",
    "linear-equations",
    ["mixed-return"],
    ["8.EE.C.7"],
    "Solve and check a linear equation after intervening topics.",
    ["A single retrieval does not assess all equation forms."],
    [],
    "practiced",
    ["mixed-equation"],
  ),
  row(
    "mixed-function-retrieval",
    "function-notation",
    ["mixed-return"],
    ["8.F.A.1"],
    "Revisit whether a relation assigns one output to each input.",
    ["No formal notation or function-family coverage is inferred."],
    [],
    "practiced",
    ["mixed-function"],
  ),

  row(
    "expression-meaning",
    "variable-expressions",
    ["expression-equation", "structure", "substitution", "expression-studio"],
    ["6.EE.A.2"],
    "Translate, group and evaluate selected linear expressions, including signed and fractional inputs.",
    [
      "No complete coverage of exponent expressions or every formula/context in the standard.",
      "Written explanations and translations require human review.",
    ],
  ),
  row(
    "equivalent-structure",
    "expression-properties",
    ["equivalent", "like-terms", "expression-studio"],
    ["6.EE.A.3", "6.EE.A.4"],
    "Distributive and like-term reasoning, identities and counterexamples.",
    [
      "Selected linear forms only; numeric checks alone do not establish general equivalence.",
    ],
  ),
  row(
    "linear-expression-forms",
    "linear-expressions",
    ["equivalent", "like-terms", "grouped-equation"],
    ["7.EE.A.1", "7.EE.A.2"],
    "Connect equivalent linear forms with grouping and distributive structure.",
    [
      "Not every rational-coefficient form or contextual interpretation is taught.",
    ],
  ),
  row(
    "one-operation-meaning",
    "one-step-equations",
    ["mystery", "equality", "preserve", "inverse", "check-original"],
    ["6.EE.B.5", "6.EE.B.6", "6.EE.B.7"],
    "Unknown quantities, equation truth, inverse operations and original-equation checks.",
    [
      "Selected equations and contexts do not establish complete word-problem transfer.",
    ],
  ),
  row(
    "two-operation-reasoning",
    "two-step-equations",
    ["two-step", "grouped-equation", "rational-equations"],
    ["7.EE.B.4"],
    "Solve selected two-step and grouped equations, including rational quantities.",
    [
      "The inequality portion of 7.EE.B.4 is outside this volume.",
      "No automated assessment of equation construction or written justification.",
    ],
  ),
  row(
    "linear-solution-sets",
    "linear-equations",
    [
      "check-original",
      "two-step",
      "both-sides",
      "negative-coefficient",
      "rational-equations",
      "real-solution-sets",
      "false-move",
      "equation-studio",
    ],
    ["8.EE.C.7"],
    "Solve and check selected linear equations and distinguish one, no, or all-real solution sets.",
    [
      "Practice uses bounded numeric or selection responses, not a constructed proof.",
      "No claim of every rational-coefficient form.",
    ],
    ["linear-equation", "equation-solution-count"],
  ),
  row(
    "equivalence-reasoning",
    "equation-reasoning",
    ["preserve", "false-move", "equation-studio"],
    ["HSA.REI.A.1"],
    "Explain reversibility and identify information lost by multiplication by zero.",
    [
      "Selected linear examples only; general equation-solving proofs need further work.",
    ],
  ),
  row(
    "rational-linear-equations",
    "symbolic-linear-constraints",
    ["negative-coefficient", "rational-equations", "both-sides"],
    ["HSA.REI.B.3"],
    "Selected signed and rational linear equations with explicit checks.",
    ["No complete parameter analysis or linear-inequality instruction."],
  ),
  row(
    "formula-dependence",
    "dependent-variables",
    ["formula", "paired-quantities", "table-to-graph"],
    ["6.EE.C.9"],
    "Relate input/output quantities through formulas, tables and points.",
    [
      "Selected measurement and cost contexts; broader modeling requires independent transfer.",
    ],
  ),
  row(
    "ordered-pairs",
    "coordinate-four-quadrants",
    ["coordinates", "coordinate-studio", "table-to-graph"],
    ["6.NS.C.6", "6.NS.C.8"],
    "Read and construct selected ordered pairs and explain axis scales.",
    [
      "No complete coverage of coordinate distance or all signed-number requirements.",
      "Numeric practice asks for one coordinate, not an independently constructed plot.",
    ],
    ["coordinate-point-reading"],
  ),
  row(
    "proportional-multiplier",
    "proportional-relationships",
    ["unit-rate", "domain", "proportional"],
    ["7.RP.A.2"],
    "Connect a unit rate, proportional rule and origin; distinguish a fixed starting fee.",
    [
      "Selected whole-item costs and simple rates do not cover all ratio contexts.",
    ],
    ["unit-price"],
  ),
  row(
    "slope-and-similarity",
    "slope",
    [
      "slope",
      "reverse-rate",
      "similar-triangles",
      "slope-rule",
      "negative-change",
      "zero-undefined",
    ],
    ["8.EE.B.5", "8.EE.B.6"],
    "Interpret signed rise/run, units, a bounded similarity argument and the linear rule.",
    [
      "Practice returns a scalar slope, not a geometric explanation or learner-created graph.",
      "Vertical and horizontal cases are taught separately; runtime slope templates omit vertical lines.",
    ],
    ["line-slope", "graphed-line-slope"],
  ),
  row(
    "function-property",
    "function-notation",
    ["function", "repair-function", "domain"],
    ["8.F.A.1"],
    "One output per input, duplicate records, conflicting outputs and contextual domains.",
    [
      "Formal function notation and a complete function-family survey are outside this selected treatment.",
    ],
  ),
  row(
    "function-comparisons",
    "compare-functions",
    ["proportional", "nonlinear", "compare-models"],
    ["8.F.A.2", "8.F.A.3"],
    "Compare starting values/rates across selected representations and refute linearity with unequal rates.",
    [
      "No complete function-family coverage; nonlinear work uses square-area samples.",
    ],
  ),
  row(
    "linear-models",
    "linear-models",
    [
      "unequal-steps",
      "intercept",
      "build-model",
      "slope-rule",
      "plan-investigation",
      "whole-inputs",
      "design-plans",
      "design-graph",
    ],
    ["8.F.B.4"],
    "Build and interpret selected linear models with explicit assumptions and domains.",
    [
      "Graph-choice practice supplies point annotations and checks a selection, not bare coordinate reading or model construction.",
      "Open designs and contextual judgments require human review.",
    ],
    ["graph-equation-choice"],
  ),
  row(
    "systems-and-intersections",
    "linear-systems",
    ["intersection", "system", "elimination", "parallel-identical"],
    ["8.EE.C.8", "HSA.REI.C.6"],
    "Shared ordered pairs, substitution, elimination and parallel/identical cases.",
    [
      "The numeric system template returns x only and restricts to unique integer solutions.",
      "No full system modeling survey or nonlinear-system instruction.",
    ],
    ["linear-system-x"],
  ),
  row(
    "points-as-solutions",
    "graph-solution-sets",
    ["build-model", "intersection", "system"],
    ["HSA.REI.D.10"],
    "Check plotted pairs against selected linear equations and systems.",
    ["General implicit and nonlinear equation graphs are not covered."],
  ),
  row(
    "intersections-as-equality",
    "graphical-equation-solving",
    ["intersection", "compare-models", "parallel-identical"],
    ["HSA.REI.D.11"],
    "Relate equality of two linear outputs to shared points and solution sets.",
    ["The broader nonlinear families in this standard are outside the volume."],
  ),
  row(
    "qualitative-change",
    "qualitative-graphs",
    ["qualitative"],
    ["8.F.B.5"],
    "Interpret rising, level and falling distance-from-home segments with explicit route assumptions.",
    [
      "A selected story does not cover all qualitative graphs, speeds or nonlinear rate changes.",
    ],
  ),
  row(
    "retrieval-grouping",
    "numerical-expressions",
    ["entry"],
    ["5.OA.A.1", "5.OA.A.2"],
    "Retrieve grouped arithmetic as an entry probe.",
    ["A single probe does not establish this standard."],
    [],
    "reference",
    ["entry-structure"],
  ),
  row(
    "retrieval-fraction",
    "fraction-multiplication",
    ["entry", "rational-equations"],
    ["5.NF.B.4", "5.NF.B.5", "5.NF.B.6"],
    "Retrieve fraction-of-quantity meaning for algebraic coefficients.",
    ["This is a reminder and selected transfer, not a complete fraction unit."],
    [],
    "reference",
    ["entry-fraction", "fraction-coefficient"],
  ),
  row(
    "retrieval-remainder",
    "multistep-whole-stories",
    ["mixed-return"],
    ["4.OA.A.3"],
    "Revisit complete groups versus required capacity in one contextual comparison.",
    ["One reminder does not establish multistep word-problem mastery."],
    [],
    "reference",
    ["mixed-remainder"],
  ),
];
export function validateBalanceAlignments(
  skills: readonly {
    id: string;
    alignments: readonly { standardId: string }[];
  }[],
  templates: readonly { id: string; skillId: string }[],
  standards: readonly { id: string }[],
  alignments: readonly AlgebraAlignment[] = balanceAlignments,
): void {
  const skillMap = new Map(skills.map((s) => [s.id, s])),
    templateMap = new Map(templates.map((t) => [t.id, t])),
    standardIds = new Set(standards.map((s) => s.id)),
    pages = new Map(balanceAndChange.pages.map((p) => [p.id, p])),
    seen = new Set<string>();
  for (const a of alignments) {
    if (!a.id.trim() || seen.has(a.id))
      throw new Error(`Duplicate or empty algebra alignment: ${a.id}`);
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
