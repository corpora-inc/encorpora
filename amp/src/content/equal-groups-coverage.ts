import { standards } from "../curriculum/catalog.js";
import { equalGroupsDefinitions } from "./equal-groups-definitions.js";
import { templates } from "../math/engine.js";
import {
  equalGroupsPracticeBindings,
  validateEqualGroupsPracticeBindings,
} from "../../books/equal-groups-workshop/practice.js";
/** A component checklist for this slice, not an exhaustive standards inventory. */
const rows: [string, string, string, string[], string][] = [
  [
    "pairing",
    "2.OA.C.3",
    "Count the unpaired remainder within twenty",
    ["pairing-leftover"],
    "Explain equal-addend and parity arguments; classify new cases without a pairing cue.",
  ],
  [
    "small-arrays",
    "2.OA.C.4",
    "Count unit arrays through five by five",
    ["small-array-total"],
    "Write repeated-addition equations and construct arrays independently.",
  ],
  [
    "group-product",
    "3.OA.A.1",
    "Find equal-group totals with named units",
    ["equal-tray-total", "zero-one-groups"],
    "Create a context and explain which factor counts groups and which counts items per group.",
  ],
  [
    "sharing",
    "3.OA.A.2",
    "Find the size of each equal share",
    ["share-whole-items"],
    "Represent sharing independently and explain the quotient unit.",
  ],
  [
    "measuring",
    "3.OA.A.2",
    "Count fixed-size groups",
    ["measure-whole-pieces"],
    "Contrast grouping with sharing and create quotient contexts.",
  ],
  [
    "unprompted-operation",
    "3.OA.A.3",
    "Select operations across equal-group and measurement contexts",
    [],
    "Mixed unprompted operation selection, student equations, and drawings require separate evidence.",
  ],
  [
    "unknown-factor",
    "3.OA.A.4",
    "Find an unknown factor",
    ["unknown-group-size"],
    "Assess each factor position in symbolic and contextual forms.",
  ],
  [
    "unknown-dividend",
    "3.OA.A.4",
    "Rebuild the total in a division equation",
    ["unknown-dividend"],
    "Unknown divisors and multiple equation orientations require further assessment.",
  ],
  [
    "distributive-part",
    "3.OA.B.5",
    "Find a disjoint partial product",
    ["split-array-part"],
    "Construct the split and explain why the partial products sum to the whole.",
  ],
  [
    "nested-groups",
    "3.OA.B.5",
    "Combine groups nested in groups",
    ["nested-bag-total"],
    "Compare two associations and justify equality without changing factor roles.",
  ],
  [
    "commutative-argument",
    "3.OA.B.5",
    "Explain rotated factors",
    [],
    "A numeric product does not assess a commutative argument or distinguish equal totals from different group arrangements.",
  ],
  [
    "inverse-explanation",
    "3.OA.B.6",
    "Explain division using a missing product factor",
    [],
    "Matching arithmetic answers alone do not show the learner used the inverse relationship.",
  ],
  [
    "fluent-recall",
    "3.OA.C.7",
    "Recall all one-digit products and related quotients",
    [],
    "Require delayed retrieval across the domain; speed and one response do not establish fluency.",
  ],
  [
    "two-step-stock",
    "3.OA.D.8",
    "Combine equal deliveries then subtract use",
    ["delivery-then-use"],
    "Other operation combinations, learner equations, and estimation remain unassessed.",
  ],
  [
    "two-step-change",
    "3.OA.D.8",
    "Find equal-item cost then payment change",
    ["purchase-change"],
    "Assess reasonableness and new contexts without fixed procedure cues.",
  ],
  [
    "neighbor-products",
    "3.OA.D.9",
    "Find the increase from one extra equal row",
    ["neighbor-product-change"],
    "Explain the pattern generally and compare other arithmetic-table patterns.",
  ],
  [
    "comparison-quantity",
    "4.OA.A.1",
    "Compute a times-as-many quantity",
    ["comparison-amount"],
    "Translate both comparison directions into equations and explain factor meanings.",
  ],
  [
    "comparison-factor",
    "4.OA.A.2",
    "Find a times-as-many factor",
    ["comparison-factor"],
    "Distinguish additive from multiplicative comparison across unprompted mixed tasks.",
  ],
  [
    "full-groups",
    "4.OA.A.3",
    "Interpret quotient as complete kits",
    ["full-kits"],
    "This is a one-step interpretation component, not the entire multistep standard.",
  ],
  [
    "capacity-round-up",
    "4.OA.A.3",
    "Interpret quotient as minimum sufficient capacity",
    ["seats-needed"],
    "Justify minimality and integrate the capacity decision into multistep situations.",
  ],
  [
    "remainder-unit",
    "4.OA.A.3",
    "Return unused whole items",
    ["kit-leftovers"],
    "Explain why the remainder is smaller than the divisor and distinguish divisible materials.",
  ],
  [
    "estimation",
    "4.OA.A.3",
    "Assess reasonableness by estimates",
    [],
    "Rounding, bounds, and explicit reasonableness judgments are not graded here.",
  ],
  [
    "factor-pair",
    "4.OA.B.4",
    "Complete one specified factor pair through one hundred",
    ["factor-partner"],
    "Enumerate all factor pairs; assess multiples, primality, zero/one distinctions, and exhaustive reasoning separately.",
  ],
  [
    "pattern-generation",
    "4.OA.C.5",
    "Generate and explain features of a rule-based pattern",
    [],
    "This slice does not assess grade-four pattern generation.",
  ],
  [
    "tens-partial-product",
    "4.NBT.B.5",
    "Use tens place value in one partial product",
    ["tens-contribution"],
    "Complete products, four-digit by one-digit and two-digit by two-digit domains, and learner-created models remain outside this template.",
  ],
  [
    "multidigit-division",
    "4.NBT.B.6",
    "Divide through four-digit dividends",
    [],
    "Small-item remainder decisions do not provide the required multidigit place-value and algorithm evidence.",
  ],
];
export const equalGroupsRequirements = rows.map(
  ([id, standardId, objective, templateIds, remainingRequirements]) => ({
    id: `equal-groups.${id}`,
    standardId,
    objective,
    templateIds,
    remainingRequirements,
    status: templateIds.length
      ? ("partial-numeric-practice" as const)
      : ("planned" as const),
    sourceUrl: `https://www.thecorestandards.org/Math/Content/${standardId.split(".")[0]}/${standardId.split(".")[1]}/`,
    reviewed: "2026-10-17",
  }),
);
export function validateEqualGroupsCoverage(): void {
  validateEqualGroupsPracticeBindings(templates);
  const ids = new Set<string>();
  for (const row of equalGroupsRequirements) {
    if (
      !standards.some((s) => s.id === row.standardId) ||
      ids.has(row.id) ||
      !row.remainingRequirements.trim()
    )
      throw new Error(`Invalid requirement: ${row.id}`);
    ids.add(row.id);
    for (const id of row.templateIds)
      if (!equalGroupsDefinitions.some((d) => d.id === id))
        throw new Error(`Unknown component template: ${id}`);
  }
  for (const d of equalGroupsDefinitions) {
    if (!d.domain?.trim()) throw new Error(`Missing numeric domain: ${d.id}`);
    if (!equalGroupsRequirements.some((r) => r.templateIds.includes(d.id)))
      throw new Error(`Missing numeric component: ${d.id}`);
    if (
      !equalGroupsPracticeBindings.some(
        (b) => b.templateId === d.id && b.skillId === d.skillId,
      )
    )
      throw new Error(`Missing book binding: ${d.id}`);
  }
}
