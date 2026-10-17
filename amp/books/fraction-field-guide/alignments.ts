import { fractionFieldGuide } from "./book.js";

/** These editorial links describe content, never complete-skill or learner mastery. */
export interface BookAlignment {
  id: string;
  skillId: string;
  relation: "taught" | "practiced" | "reference";
  pageIds: string[];
  taskIds: string[];
  templateIds: string[];
  scope: string;
}
export const fractionBookAlignments: readonly BookAlignment[] = [
  {
    id: "meaning-unit",
    skillId: "unit-fractions",
    relation: "taught",
    pageIds: ["whole", "units", "measure"],
    taskIds: ["whole-equal", "units-name", "units-build"],
    templateIds: [],
    scope:
      "Equal parts of a named whole; denominator as unit and numerator as count. No claim of every partition representation.",
  },
  {
    id: "meaning-model",
    skillId: "fraction-model",
    relation: "practiced",
    pageIds: ["whole", "units", "first-expedition"],
    taskIds: ["expedition-draw"],
    templateIds: ["fraction-model"],
    scope:
      "Area and length representations; runtime template provides related shaded-part numeric practice, not explanation assessment.",
  },
  {
    id: "meaning-line",
    skillId: "fractions-number-line",
    relation: "taught",
    pageIds: ["measure", "beyond", "first-expedition", "delayed-return"],
    taskIds: [
      "measure-locate",
      "measure-unit",
      "expedition-locate",
      "return-location",
    ],
    templateIds: [],
    scope:
      "Unit intervals, fractions beyond one, and distinguishing intervals from ticks.",
  },
  {
    id: "meaning-share",
    skillId: "fraction-as-division",
    relation: "taught",
    pageIds: ["sharing", "first-expedition"],
    taskIds: ["sharing-amount", "sharing-check", "expedition-share"],
    templateIds: [],
    scope:
      "Equal sharing of whole-number quantities among a whole-number recipient count.",
  },
  {
    id: "equivalence-model",
    skillId: "equivalent-fractions",
    relation: "taught",
    pageIds: ["subdivide", "regroup"],
    taskIds: ["subdivide-explain", "regroup-error"],
    templateIds: [],
    scope: "Same-quantity reasoning through subdivision and regrouping.",
  },
  {
    id: "equivalence-generate",
    skillId: "fraction-equivalence",
    relation: "practiced",
    pageIds: ["subdivide", "regroup", "equivalence-workshop"],
    taskIds: ["subdivide-name", "regroup-name", "equivalence-invent"],
    templateIds: [],
    scope:
      "Generate equivalent names by multiplying or dividing both counts by a common factor.",
  },
  {
    id: "compare-shared",
    skillId: "compare-fractions",
    relation: "practiced",
    pageIds: ["equivalence-workshop"],
    taskIds: ["equivalence-select", "equivalence-repair"],
    templateIds: [],
    scope:
      "Same numerator and same denominator comparisons; not every fraction comparison case.",
  },
  {
    id: "compare-benchmarks",
    skillId: "fraction-comparison",
    relation: "taught",
    pageIds: ["benchmarks", "compare", "unequal-wholes"],
    taskIds: [
      "benchmarks-near",
      "benchmarks-order",
      "compare-justify",
      "compare-other",
      "unequal-length",
      "unequal-explain",
    ],
    templateIds: ["compare-fractions"],
    scope:
      "Benchmark and common-unit comparisons, with explicit same-whole limitations. Runtime numeric comparison does not assess justification.",
  },
  {
    id: "combine-like",
    skillId: "like-fraction-addition",
    relation: "taught",
    pageIds: ["common-unit"],
    taskIds: ["common-add", "common-error"],
    templateIds: [],
    scope:
      "Add/subtract counts of a shared fractional unit and diagnose adding denominators.",
  },
  {
    id: "mixed-units",
    skillId: "mixed-numbers",
    relation: "taught",
    pageIds: ["beyond", "bridge-one"],
    taskIds: [
      "beyond-name",
      "beyond-reverse",
      "bridge-subtract",
      "bridge-explain",
    ],
    templateIds: [],
    scope:
      "Mixed/improper renaming and subtraction through one whole with like units.",
  },
  {
    id: "combine-unlike",
    skillId: "fraction-addition",
    relation: "taught",
    pageIds: [
      "rename-to-add",
      "subtract",
      "add-estimate",
      "supply-workshop",
      "retrieval-one",
    ],
    taskIds: [
      "rename-add",
      "rename-why",
      "subtract-distance",
      "subtract-check",
      "add-bound",
      "add-repair",
      "supply-total",
      "supply-left",
      "supply-missing",
      "retrieval-one-sum",
    ],
    templateIds: ["add-fractions"],
    scope:
      "Unlike-unit addition/subtraction, context selection, estimates, and inverse checks. Related runtime template covers addition only.",
  },
  {
    id: "multiply-whole",
    skillId: "fraction-times-whole",
    relation: "taught",
    pageIds: ["groups-of"],
    taskIds: ["groups-total"],
    templateIds: [],
    scope:
      "Whole-number groups of a fractional quantity, including improper products.",
  },
  {
    id: "multiply-scale",
    skillId: "fraction-multiplication",
    relation: "taught",
    pageIds: [
      "fraction-of",
      "scale",
      "simplify",
      "garden-workshop",
      "multiplication-investigate",
    ],
    taskIds: [
      "fraction-of-find",
      "fraction-of-explain",
      "scale-small",
      "scale-large",
      "simplify-product",
      "simplify-repair",
      "garden-fraction",
      "garden-measure",
      "investigate-factor",
      "investigate-always",
    ],
    templateIds: ["multiply-fractions"],
    scope:
      "Area intersection, part-of-part, positive scaling, factor simplification, and contextual area. Runtime template is bounded proper-fraction multiplication.",
  },
  {
    id: "divide-unit",
    skillId: "unit-fraction-division",
    relation: "practiced",
    pageIds: ["division-fit"],
    taskIds: ["division-count"],
    templateIds: [],
    scope:
      "A whole number divided by a unit fraction. This link does not claim the reverse unit-fraction-by-whole-number component is completely taught.",
  },
  {
    id: "divide-general",
    skillId: "fraction-division",
    relation: "taught",
    pageIds: [
      "division-fit",
      "division-sharing",
      "partial-group",
      "why-reciprocal",
      "division-prediction",
      "water-workshop",
    ],
    taskIds: [
      "division-unit",
      "division-share",
      "division-contrast",
      "partial-count",
      "partial-meaning",
      "reciprocal-solve",
      "reciprocal-explain",
      "division-estimate",
      "division-repair",
      "water-bottles",
      "water-share",
    ],
    templateIds: ["divide-fractions"],
    scope:
      "Grouping/sharing, positive fractional divisors, partial groups, reciprocal justification, and context units. Runtime template does not grade explanations.",
  },
  {
    id: "rate-reference",
    skillId: "unit-rates",
    relation: "reference",
    pageIds: ["field-report"],
    taskIds: ["report-time", "report-check"],
    templateIds: [],
    scope:
      "One distance/speed/time application with whole-number speed; not a systematic rate lesson.",
  },
  {
    id: "mixed-addition-transfer",
    skillId: "fraction-addition",
    relation: "practiced",
    pageIds: [
      "same-numbers",
      "field-report",
      "design-challenge",
      "delayed-return",
    ],
    taskIds: [
      "same-sum",
      "same-difference",
      "report-distance",
      "design-plan",
      "return-error",
    ],
    templateIds: ["add-fractions"],
    scope:
      "Select and combine operations in unfamiliar situations; open-design reasoning needs discussion or written review.",
  },
  {
    id: "mixed-multiplication-transfer",
    skillId: "fraction-multiplication",
    relation: "practiced",
    pageIds: ["same-numbers", "missing-information", "delayed-return"],
    taskIds: [
      "same-product",
      "missing-decide",
      "missing-create",
      "return-scale",
    ],
    templateIds: ["multiply-fractions"],
    scope:
      "Choose scaling, account for different wholes, and solve missing-information examples.",
  },
  {
    id: "mixed-division-transfer",
    skillId: "fraction-division",
    relation: "practiced",
    pageIds: ["same-numbers", "design-challenge", "delayed-return"],
    taskIds: ["same-quotient", "design-change", "return-share"],
    templateIds: ["divide-fractions"],
    scope:
      "Uncued grouping/sharing retrieval; positive rational quantities only.",
  },
];

export function validateFractionBookAlignments(
  skills: readonly { id: string }[],
  templates: readonly { id: string; skillId: string }[],
  alignments: readonly BookAlignment[] = fractionBookAlignments,
): void {
  const skillIds = new Set(skills.map((skill) => skill.id));
  const templateMap = new Map(
    templates.map((template) => [template.id, template]),
  );
  const pageMap = new Map(
    fractionFieldGuide.pages.map((page) => [page.id, page]),
  );
  const ids = new Set<string>();
  for (const alignment of alignments) {
    if (ids.has(alignment.id))
      throw new Error(`Duplicate alignment: ${alignment.id}`);
    ids.add(alignment.id);
    if (!skillIds.has(alignment.skillId))
      throw new Error(`Unknown skill: ${alignment.skillId}`);
    if (!alignment.pageIds.length || !alignment.scope.trim())
      throw new Error(`Missing scope/pages: ${alignment.id}`);
    for (const pageId of alignment.pageIds)
      if (!pageMap.has(pageId)) throw new Error(`Unknown page: ${pageId}`);
    for (const taskId of alignment.taskIds) {
      if (
        !alignment.pageIds.some((pageId) =>
          pageMap
            .get(pageId)!
            .blocks.some(
              (block) => block.kind === "task" && block.id === taskId,
            ),
        )
      )
        throw new Error(`Task outside alignment pages: ${taskId}`);
    }
    for (const templateId of alignment.templateIds) {
      const template = templateMap.get(templateId);
      if (!template) throw new Error(`Unknown template: ${templateId}`);
      if (template.skillId !== alignment.skillId)
        throw new Error(`Template skill mismatch: ${templateId}`);
    }
  }
}
