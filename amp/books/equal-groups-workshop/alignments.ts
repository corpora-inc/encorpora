import { equalGroupsDefinitions } from "../../src/content/equal-groups-definitions.js";
import { equalGroupsWorkshop } from "./book.js";
/** Editorial content relationships; none certify a complete standard or learner mastery. */
export interface WorkshopAlignment {
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
  relation: WorkshopAlignment["relation"],
  pageIds: string[],
  taskIds: string[],
  standardIds: string[],
  scope: string,
  unassessedRequirements: string[],
  templateIds: string[] = [],
): WorkshopAlignment => ({
  id,
  skillId,
  relation,
  pageIds,
  taskIds,
  standardIds,
  scope,
  unassessedRequirements,
  templateIds,
});
const authoredAlignments: readonly WorkshopAlignment[] = [
  row(
    "entry-equal-groups",
    "multiplication-meaning",
    "practiced",
    ["entry"],
    ["entry-groups"],
    ["3.OA.A.1"],
    "Entry probe connects equal-group addition with a total.",
    ["This probe alone does not establish multiplication understanding."],
  ),
  row(
    "entry-sharing",
    "division-meaning",
    "practiced",
    ["entry"],
    ["entry-share"],
    ["3.OA.A.2"],
    "Concrete equal sharing before symbolic division.",
    ["Oral and object-based explanations need an observer."],
  ),
  row(
    "parity",
    "odd-and-even",
    "taught",
    ["pairs"],
    ["pairs-even", "pairs-odd"],
    ["2.OA.C.3"],
    "Pairing and equal-addend arguments within 20.",
    ["A few written examples do not establish independent generalization."],
  ),
  row(
    "array-structure",
    "arrays",
    "taught",
    ["array"],
    ["array-rows", "array-columns"],
    ["2.OA.C.4"],
    "Arrays through 5 by 5 with repeated-addition equations.",
    ["No claim of every array orientation or all quantities."],
  ),
  row(
    "multiplication-roles",
    "multiplication-meaning",
    "taught",
    [
      "equal-groups",
      "symbols",
      "turn",
      "jumps",
      "zero-one",
      "meaning-workshop",
    ],
    [
      "groups-total",
      "groups-repair",
      "symbols-story",
      "turn-story",
      "jumps-count",
      "jumps-repair",
      "zero-products",
      "zero-not-add",
      "meaning-draw",
      "meaning-choose",
      "meaning-change",
    ],
    ["3.OA.A.1"],
    "Group count, group size, total, units, zero/one, and length models.",
    ["Learner-created models and explanations need human or oral review."],
  ),
  row(
    "factor-unknowns",
    "missing-factor",
    "taught",
    ["symbols", "unknown"],
    ["symbols-unknown", "unknown-equations", "unknown-story"],
    ["3.OA.A.4"],
    "Unknown factors, divisors, dividends, and word-story positions.",
    ["Selected values and unknown positions do not exhaust contextual forms."],
  ),
  row(
    "operation-properties",
    "operation-properties",
    "taught",
    [
      "turn",
      "double",
      "split-five",
      "nines",
      "associative",
      "choose-strategy",
      "split-area",
    ],
    [
      "turn-product",
      "double-four",
      "double-eight",
      "split-seven",
      "split-repair",
      "nine-six",
      "nine-eight",
      "associate-total",
      "associate-change",
      "strategy-choose",
      "strategy-counter",
      "area-split",
      "area-explain",
    ],
    ["3.OA.B.5"],
    "Commutative, associative, and distributive reasoning through exact models and errors.",
    ["Runtime numeric answers do not assess the property justification."],
  ),
  row(
    "fact-strategies",
    "multiplication-facts",
    "practiced",
    [
      "twos-fives-tens",
      "split-five",
      "strategy-workshop",
      "fluency-routine",
      "delayed-return",
    ],
    [
      "anchors-products",
      "anchors-half",
      "strategy-estimate",
      "strategy-model",
      "recall-one",
      "recall-explain",
      "return-facts",
      "return-reason",
    ],
    ["3.OA.C.7"],
    "Anchor facts, flexible derivation, small mixed retrieval sets, and delayed return.",
    [
      "All one-digit products from memory require broader independent delayed assessment.",
      "No timing or worksheet-completion mastery certificate.",
    ],
    ["multiply-facts"],
  ),
  row(
    "rectangle-measure",
    "rectangle-area",
    "taught",
    ["area-units", "split-area"],
    ["area-count", "area-unit", "area-split", "area-explain"],
    ["3.MD.C.5", "3.MD.C.6", "3.MD.C.7"],
    "Unit squares, rectangular products, and disjoint rectangular splits.",
    [
      "Rectilinear composite figures required by 3.MD.C.7d are not systematically taught.",
      "Non-square covering units and construction tasks require further assessment.",
    ],
    ["rectangle-area"],
  ),
  row(
    "partial-products",
    "whole-multiplication",
    "taught",
    ["tens", "strategy-workshop"],
    ["tens-product", "tens-repair", "strategy-transfer"],
    ["4.NBT.B.5"],
    "Two-digit-by-one-digit place-value illustrations.",
    [
      "Four-digit-by-one-digit and two-digit-by-two-digit domains are not covered.",
    ],
  ),
  row(
    "division-roles",
    "division-meaning",
    "taught",
    ["share", "measure-groups", "division-zero"],
    [
      "share-amount",
      "share-check",
      "groups-number",
      "groups-contrast",
      "divide-zero",
      "divide-impossible",
    ],
    ["3.OA.A.2"],
    "Sharing versus measuring groups; units of quotient; zero dividend and undefined zero divisor.",
    [
      "Interpretation and constructed stories require discussion or written review.",
    ],
  ),
  row(
    "inverse-facts",
    "division-facts",
    "taught",
    ["inverse", "measure-groups", "division-workshop", "delayed-return"],
    [
      "inverse-family",
      "inverse-check",
      "division-packs",
      "division-sharing",
      "return-facts",
    ],
    ["3.OA.B.6", "3.OA.C.7"],
    "Use missing multiplication factors to derive and check quotients.",
    [
      "Fluent independent recall across the entire fact domain is not established.",
    ],
    ["divide-facts"],
  ),
  row(
    "equal-group-stories",
    "multiplicative-stories",
    "practiced",
    ["division-workshop", "mixed-workshop"],
    [
      "division-packs",
      "division-sharing",
      "division-total",
      "mixed-choice",
      "mixed-missing",
    ],
    ["3.OA.A.3"],
    "Choose total, group-count, or group-size operations in mixed contexts.",
    [
      "No automatic grading of constructed explanations or missing-information arguments.",
    ],
  ),
  row(
    "quotient-chunks",
    "whole-division",
    "taught",
    ["chunk-division", "remainder", "remainder-check"],
    [
      "chunk-quotient",
      "chunk-check",
      "remainder-count",
      "remainder-unit",
      "remainder-repair",
      "remainder-invent",
    ],
    ["4.NBT.B.6"],
    "Small two-digit dividends, one-digit divisors, partial quotients, and remainder bounds.",
    [
      "Full four-digit dividend range and diverse place-value representations are outside this unit.",
    ],
  ),
  row(
    "remainder-decisions",
    "multistep-whole-stories",
    "practiced",
    ["full-boxes", "seats", "share-remainder", "delayed-return"],
    [
      "boxes-full",
      "boxes-why",
      "seats-needed",
      "seats-check",
      "share-whole",
      "return-remainder",
    ],
    ["4.OA.A.3"],
    "Compare complete-group counts with minimum capacity and whole-object sharing.",
    [
      "The full multistep story domain, all operations, and rounding estimates need additional tasks.",
    ],
  ),
  row(
    "fraction-bridge",
    "fraction-as-division",
    "reference",
    ["share-remainder"],
    ["share-divisible"],
    ["5.NF.B.3"],
    "Optional divisible-length connection contrasts a fractional share with whole-object leftovers.",
    ["This is one bridge example, not grade-five fraction instruction."],
  ),
  row(
    "comparison",
    "multiplicative-comparison",
    "taught",
    ["compare"],
    ["compare-times", "compare-missing"],
    ["4.OA.A.1", "4.OA.A.2"],
    "Multiplicative versus additive comparison, including unknown reference amount.",
    [
      "No exhaustive range of comparison story forms or unknown multiplier tasks.",
    ],
  ),
  row(
    "factors-primes",
    "factors-multiples",
    "taught",
    ["factors", "prime", "kit-design"],
    [
      "factors-list",
      "factors-test",
      "prime-classify",
      "prime-claim",
      "kit-plans",
      "kit-change",
    ],
    ["4.OA.B.4"],
    "Factor pairs, primes/composites, one, and common divisibility in an inventory design.",
    [
      "Systematic factor-pair and primality assessment throughout 1 to 100 is not supplied.",
    ],
  ),
  row(
    "arithmetic-regularity",
    "arithmetic-patterns",
    "taught",
    ["patterns"],
    ["pattern-even", "pattern-three"],
    ["3.OA.D.9"],
    "Explain even products and alternating parity by grouping.",
    [
      "Multiplication-table and other arithmetic patterns need broader assessment.",
    ],
  ),
  row(
    "two-step-models",
    "multi-operation-stories",
    "taught",
    ["two-step", "unknown-story-workshop"],
    ["steps-total", "steps-share", "story-unknown", "story-check"],
    ["3.OA.D.8"],
    "Mixed two-step contexts, a letter unknown, inverse checks, and plausibility.",
    ["Only selected whole-number two-step forms and estimates are included."],
  ),
  row(
    "representation-reflection",
    "multiplication-meaning",
    "practiced",
    ["reflection"],
    ["reflect-model", "reflect-error"],
    ["3.OA.A.1"],
    "Connect learner-chosen story, drawing, and equation; diagnose a plausible misconception.",
    ["Open responses require a reader and are not graded by numeric practice."],
  ),
];
export const equalGroupsAlignments: readonly WorkshopAlignment[] =
  authoredAlignments.map((alignment) => ({
    ...alignment,
    templateIds: [
      ...alignment.templateIds,
      ...equalGroupsDefinitions
        .filter(
          (d) =>
            d.skillId === alignment.skillId &&
            alignment.pageIds.includes(d.pageId),
        )
        .map((d) => d.id),
    ],
  }));
export const equalGroupsSources = [
  {
    url: "https://www.thecorestandards.org/Math/Content/2/OA/",
    scope: "Small arrays and parity",
  },
  {
    url: "https://www.thecorestandards.org/Math/Content/3/OA/",
    scope:
      "Multiplication/division meanings, properties, facts, stories, patterns",
  },
  {
    url: "https://www.thecorestandards.org/Math/Content/3/MD/",
    scope: "Area by unit squares and rectangular products",
  },
  {
    url: "https://www.thecorestandards.org/Math/Content/4/OA/",
    scope: "Comparison, remainder interpretation, factors and primality",
  },
  {
    url: "https://www.thecorestandards.org/Math/Content/4/NBT/",
    scope: "Partial illustrations of multidigit products and quotients",
  },
  {
    url: "https://www.thecorestandards.org/Math/Content/5/NF/",
    scope: "Optional fraction-as-division bridge",
  },
].map((source) => ({ ...source, reviewedOn: "2026-10-17" }));
export function validateEqualGroupsAlignments(
  skills: readonly {
    id: string;
    alignments: readonly { standardId: string }[];
  }[],
  templates: readonly { id: string; skillId: string }[],
  standards: readonly { id: string }[],
  alignments: readonly WorkshopAlignment[] = equalGroupsAlignments,
): void {
  const skillMap = new Map(skills.map((s) => [s.id, s])),
    standardIds = new Set(standards.map((s) => s.id));
  const templateMap = new Map(templates.map((t) => [t.id, t]));
  const pageMap = new Map(equalGroupsWorkshop.pages.map((p) => [p.id, p]));
  const ids = new Set<string>();
  for (const a of alignments) {
    if (ids.has(a.id)) throw new Error(`Duplicate alignment: ${a.id}`);
    ids.add(a.id);
    if (!skillMap.has(a.skillId))
      throw new Error(`Unknown skill: ${a.skillId}`);
    if (
      !a.scope.trim() ||
      !a.pageIds.length ||
      !a.standardIds.length ||
      !a.unassessedRequirements.length ||
      a.unassessedRequirements.some((x) => !x.trim())
    )
      throw new Error(`Missing scope or limitations: ${a.id}`);
    for (const id of a.standardIds) {
      if (!standardIds.has(id)) throw new Error(`Unknown standard: ${id}`);
      if (
        !skillMap
          .get(a.skillId)!
          .alignments.some((link) => link.standardId === id)
      )
        throw new Error(
          `Standard is outside skill crosswalk: ${a.skillId}/${id}`,
        );
    }
    for (const id of a.pageIds)
      if (!pageMap.has(id)) throw new Error(`Unknown page: ${id}`);
    for (const id of a.taskIds)
      if (
        !a.pageIds.some((p) =>
          pageMap.get(p)!.blocks.some((b) => b.kind === "task" && b.id === id),
        )
      )
        throw new Error(`Task outside alignment pages: ${id}`);
    for (const id of a.templateIds) {
      const t = templateMap.get(id);
      if (!t) throw new Error(`Unknown template: ${id}`);
      if (t.skillId !== a.skillId)
        throw new Error(`Template skill mismatch: ${id}`);
    }
  }
}
