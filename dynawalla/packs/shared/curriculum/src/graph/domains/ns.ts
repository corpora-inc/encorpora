/**
 * Domain `ns` — number sense and place value.
 *
 * **Every row here is `draft`, and the reason is not the generator.** Each of these
 * nodes binds a family that generates, checks and diagnoses correctly over hundreds
 * of thousands of seeds. What does not exist is a renderer for the *question*: the
 * app reads an item out of `prompt.slots` by matching `prompt.key` against the two
 * column-op templates and draws nothing for any other, so promoting these rows
 * would put an answer keypad on a child's screen with no problem above it. That is
 * the failure gate CG-8 exists for, and `render/prompts.ts` now makes it mechanical
 * rather than a thing somebody has to notice.
 *
 * `PR-2.13` is not the only blocker on every row, and the difference matters to
 * whoever plans the promotion. `dw.ns.place.digit-in-place` L0 and
 * `dw.ns.round.whole-numbers` L0 are also under CG-10's variant-space floor and
 * need a wider draw or a reconciliation with the floor before they can go active;
 * the rest of this domain flips on `status` alone. `promotionBlockers.ts` holds the
 * whole list and the property sweep keeps it honest.
 *
 * Ids are final. A draft id is as immutable as an active one — it is a mastery key
 * the moment it ships, and the promotion PR must not be free to rename it.
 */

import { rational } from "../../math/rational.ts";
import type { CompareOrderParams } from "../../generators/compareOrder/params.ts";
import {
  COMPARE_ORDER_FAMILY,
  COMPARE_ORDER_FAMILY_REV,
  FORM_FREE_ENTRY as COMPARE_FORM,
} from "../../generators/compareOrder/constants.ts";
import type { PlaceValueParams } from "../../generators/placeValue/params.ts";
import {
  FORM_FREE_ENTRY as PLACE_FORM,
  PLACE_VALUE_FAMILY,
  PLACE_VALUE_FAMILY_REV,
} from "../../generators/placeValue/constants.ts";
import type { RoundEstimateParams } from "../../generators/roundEstimate/params.ts";
import {
  FORM_FREE_ENTRY as ROUND_FORM,
  ROUND_ESTIMATE_FAMILY,
  ROUND_ESTIMATE_FAMILY_REV,
} from "../../generators/roundEstimate/constants.ts";
import { MIS_DIGIT_FOR_VALUE } from "../../malrules/placeValue.ts";
import { MIS_LONGER_IS_BIGGER } from "../../malrules/compareOrder.ts";
import { capabilityTag, locKey, skillId } from "../../types/ids.ts";
import type { SkillNode } from "../../types/skill.ts";

export const CAP_READ_PLACE = capabilityTag("cap.ns.read-place");
export const CAP_DIGIT_VALUE = capabilityTag("cap.ns.digit-value");
export const CAP_COMPARE_WHOLE = capabilityTag("cap.ns.compare-whole");

/** Hundredths of a logit, spelled as an exact rational. */
function b(hundredths: bigint) {
  return rational(hundredths, 100n);
}

function place(
  task: PlaceValueParams["task"],
  digits: number,
  minPlace: number,
  maxPlace: number,
): PlaceValueParams {
  return { task, digits, minPlace, maxPlace };
}

function whole(digits: number, sharedPrefix: number, task: "greater" | "lesser" = "greater"): CompareOrderParams {
  return { numberType: "whole", task, digits, sharedPrefix };
}

function decimalPair(digits: number, decimalPlaces: number, placeGap: number): CompareOrderParams {
  return { numberType: "decimal", task: "greater", digits, decimalPlaces, placeGap };
}

function round(digits: number, minPlace: number, maxPlace: number, ties: boolean): RoundEstimateParams {
  return { digits, minPlace, maxPlace, ties };
}

export const SKILL_DIGIT_IN_PLACE = skillId("dw.ns.place.digit-in-place");
export const SKILL_DIGIT_VALUE = skillId("dw.ns.place.digit-value");
export const SKILL_REGROUPED_COUNT = skillId("dw.ns.place.regrouped-count");
export const SKILL_COMPARE_WHOLE = skillId("dw.ns.compare.whole-numbers");
export const SKILL_COMPARE_DECIMAL = skillId("dw.ns.compare.decimals");
export const SKILL_ROUND_WHOLE = skillId("dw.ns.round.whole-numbers");

const digitInPlace: SkillNode = {
  id: SKILL_DIGIT_IN_PLACE,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.ns.place.digit-in-place.title"),
  learnerGoal: locKey("dw.skill.ns.place.digit-in-place.goal"),
  domain: "ns",
  cluster: "place",
  bigIdeas: [locKey("dw.idea.place-value.position-carries-value")],
  gradeBand: { earliest: 1, nominal: 2, latest: 3 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 2, strategic: 0, adaptive: 1 },
  classification: "procedural",
  fluencyTarget: { p50Ms: 8000 },
  prereqs: [],
  difficulty: { b: b(-70n), levels: [b(-95n), b(-55n), b(-15n)] },
  // Reading a digit off the page has no arithmetic in it to get wrong, so it has
  // no mal-rule. The rule this family does carry is defined on the two tasks that
  // ask for a quantity.
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: PLACE_VALUE_FAMILY,
    familyRev: PLACE_VALUE_FAMILY_REV,
    params: [place("digit-in-place", 2, 0, 1), place("digit-in-place", 3, 0, 2), place("digit-in-place", 4, 0, 3)],
    forms: [PLACE_FORM],
    minVariants: 60,
    consumes: [],
  },
  probes: [{ level: 0, seed: 1, purpose: "entry" }],
  provides: [CAP_READ_PLACE],
  standards: { ccss: ["1.NBT.B.2", "2.NBT.A.1", "4.NBT.A.2"], uk: ["Y2-NPV-1"] },
};

const digitValue: SkillNode = {
  id: SKILL_DIGIT_VALUE,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.ns.place.digit-value.title"),
  learnerGoal: locKey("dw.skill.ns.place.digit-value.goal"),
  domain: "ns",
  cluster: "place",
  bigIdeas: [locKey("dw.idea.place-value.position-carries-value")],
  gradeBand: { earliest: 2, nominal: 3, latest: 4 },
  strandRole: "spine",
  proficiency: { conceptual: 3, procedural: 2, strategic: 1, adaptive: 1 },
  classification: "conceptual",
  prereqs: [{ kind: "requires", to: SKILL_DIGIT_IN_PLACE }],
  difficulty: { b: b(-40n), levels: [b(20n), b(60n), b(110n)] },
  misconceptions: [MIS_DIGIT_FOR_VALUE],
  representations: { required: [], optional: [] },
  generator: {
    family: PLACE_VALUE_FAMILY,
    familyRev: PLACE_VALUE_FAMILY_REV,
    params: [place("digit-value", 3, 1, 2), place("digit-value", 4, 1, 3), place("digit-value", 5, 2, 4)],
    forms: [PLACE_FORM],
    minVariants: 60,
    consumes: [CAP_READ_PLACE],
  },
  probes: [{ level: 1, seed: 17, purpose: "promotion" }],
  provides: [CAP_DIGIT_VALUE],
  standards: { ccss: ["2.NBT.A.1", "4.NBT.A.1"] },
};

const regroupedCount: SkillNode = {
  id: SKILL_REGROUPED_COUNT,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.ns.place.regrouped-count.title"),
  learnerGoal: locKey("dw.skill.ns.place.regrouped-count.goal"),
  domain: "ns",
  cluster: "place",
  bigIdeas: [
    locKey("dw.idea.place-value.position-carries-value"),
    locKey("dw.idea.place-value.regroup"),
  ],
  gradeBand: { earliest: 3, nominal: 4, latest: 5 },
  strandRole: "bridge",
  proficiency: { conceptual: 3, procedural: 2, strategic: 2, adaptive: 2 },
  classification: "conceptual",
  prereqs: [{ kind: "requires", to: SKILL_DIGIT_VALUE }],
  difficulty: { b: b(-40n), levels: [b(95n), b(135n), b(185n)] },
  misconceptions: [MIS_DIGIT_FOR_VALUE],
  representations: { required: [], optional: [] },
  generator: {
    family: PLACE_VALUE_FAMILY,
    familyRev: PLACE_VALUE_FAMILY_REV,
    params: [
      place("total-in-place", 4, 1, 2),
      place("total-in-place", 5, 1, 3),
      place("total-in-place", 6, 2, 4),
    ],
    forms: [PLACE_FORM],
    minVariants: 60,
    consumes: [CAP_DIGIT_VALUE],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["4.NBT.A.1"] },
};

const compareWhole: SkillNode = {
  id: SKILL_COMPARE_WHOLE,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.ns.compare.whole-numbers.title"),
  learnerGoal: locKey("dw.skill.ns.compare.whole-numbers.goal"),
  domain: "ns",
  cluster: "compare",
  bigIdeas: [locKey("dw.idea.magnitude.numbers-have-order")],
  gradeBand: { earliest: 1, nominal: 2, latest: 4 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 2, strategic: 1, adaptive: 1 },
  classification: "procedural",
  fluencyTarget: { p50Ms: 9000 },
  prereqs: [{ kind: "requires", to: SKILL_DIGIT_IN_PLACE }],
  difficulty: { b: b(-60n), levels: [b(-30n), b(5n), b(70n), b(135n)] },
  // The whole-number comparisons this level table poses are between two numbers of
  // the same written width, so "the longer number is bigger" is not a rule that can
  // fire on them — and where it could, it would be right.
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: COMPARE_ORDER_FAMILY,
    familyRev: COMPARE_ORDER_FAMILY_REV,
    params: [whole(3, 0), whole(3, 1, "lesser"), whole(4, 2), whole(5, 3, "lesser")],
    forms: [COMPARE_FORM],
    minVariants: 80,
    consumes: [CAP_READ_PLACE],
  },
  probes: [{ level: 0, seed: 3, purpose: "entry" }],
  provides: [CAP_COMPARE_WHOLE],
  standards: { ccss: ["1.NBT.B.3", "2.NBT.A.4", "4.NBT.A.2"] },
};

/**
 * Draft twice over.
 *
 * The prompt renderer is one blocker and the number layer is the other:
 * `NumberFormat` — the decimal separator, grouping, numbering system and direction
 * — is PR-2.2 and does not exist, so CG-14's locale round-trip cannot run on a
 * decimal answer. `dw.add.regroup.subtract-tenths` is here on the same footing and
 * has been since M2. Both blockers are named so a promotion PR knows it needs both.
 */
const compareDecimal: SkillNode = {
  id: SKILL_COMPARE_DECIMAL,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.ns.compare.decimals.title"),
  learnerGoal: locKey("dw.skill.ns.compare.decimals.goal"),
  domain: "ns",
  cluster: "compare",
  bigIdeas: [
    locKey("dw.idea.magnitude.numbers-have-order"),
    locKey("dw.idea.place-value.position-carries-value"),
  ],
  gradeBand: { earliest: 4, nominal: 5, latest: 5 },
  strandRole: "bridge",
  proficiency: { conceptual: 3, procedural: 2, strategic: 1, adaptive: 2 },
  classification: "conceptual",
  prereqs: [{ kind: "requires", to: SKILL_COMPARE_WHOLE }],
  difficulty: { b: b(-40n), levels: [b(-30n), b(20n), b(50n)] },
  misconceptions: [MIS_LONGER_IS_BIGGER],
  representations: { required: [], optional: [] },
  generator: {
    family: COMPARE_ORDER_FAMILY,
    familyRev: COMPARE_ORDER_FAMILY_REV,
    params: [decimalPair(1, 1, 1), decimalPair(2, 1, 2), decimalPair(3, 2, 1)],
    forms: [COMPARE_FORM],
    minVariants: 80,
    consumes: [CAP_COMPARE_WHOLE],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["4.NF.C.7", "5.NBT.A.3"] },
};

const roundWhole: SkillNode = {
  id: SKILL_ROUND_WHOLE,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.ns.round.whole-numbers.title"),
  learnerGoal: locKey("dw.skill.ns.round.whole-numbers.goal"),
  domain: "ns",
  cluster: "round",
  bigIdeas: [locKey("dw.idea.magnitude.nearest-landmark")],
  gradeBand: { earliest: 3, nominal: 4, latest: 5 },
  strandRole: "application",
  proficiency: { conceptual: 2, procedural: 3, strategic: 2, adaptive: 2 },
  classification: "procedural",
  prereqs: [
    { kind: "requires", to: SKILL_COMPARE_WHOLE },
    { kind: "supports", to: SKILL_DIGIT_VALUE },
  ],
  difficulty: { b: b(-30n), levels: [b(20n), b(60n), b(110n), b(145n)] },
  // No mal-rule, and `malrules/placeValue.ts` and this family's own header say why:
  // every documented rounding bug produces the correct answer on about half of all
  // items, and the only routes to CG-12's 95% divergence are to bias the content
  // towards rounding up or to have `applies()` decline the items where the bug is
  // right. The second is the self-filtering the mal-rule contract forbids.
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: ROUND_ESTIMATE_FAMILY,
    familyRev: ROUND_ESTIMATE_FAMILY_REV,
    params: [round(3, 1, 1, false), round(4, 1, 2, false), round(5, 2, 3, false), round(5, 2, 3, true)],
    forms: [ROUND_FORM],
    minVariants: 80,
    consumes: [CAP_READ_PLACE],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["3.NBT.A.1", "4.NBT.A.3"] },
};

export const nsDomainNodes: readonly SkillNode[] = [
  digitInPlace,
  digitValue,
  regroupedCount,
  compareWhole,
  compareDecimal,
  roundWhole,
];
