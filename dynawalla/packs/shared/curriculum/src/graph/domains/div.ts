/**
 * Domain `div` — division, with the remainder taken seriously.
 *
 * `draft`, for the reason `ns.ts` states: the generator is complete and the app
 * cannot draw the question. See `render/prompts.ts`. One level here needs a second
 * thing before it can go active — `dw.div.whole.divide-exact` L0 is under CG-10's
 * variant-space floor. See `promotionBlockers.ts`.
 *
 * The four rows are the four things a remainder can be asked to be: nothing (the
 * division comes out even), the answer itself, the fraction part of a mixed number,
 * and the thing a dropped zero in the quotient hides.
 *
 * `mis.div.divisor-must-be-smaller` is named in CURRICULUM.md and is deliberately
 * absent — `malrules/longDiv.ts` says why: its home is an item where the divisor is
 * the larger number, and whole-number long division never poses one.
 */

import { rational } from "../../math/rational.ts";
import type { LongDivParams } from "../../generators/longDiv/params.ts";
import {
  FORM_FREE_ENTRY as DIV_FORM,
  LONG_DIV_FAMILY,
  LONG_DIV_FAMILY_REV,
} from "../../generators/longDiv/constants.ts";
import { MIS_QUOTIENT_ZERO_SKIPPED, MIS_REMAINDER_DROPPED } from "../../malrules/longDiv.ts";
import { CAP_MUL_ONE_DIGIT } from "./mul.ts";
import { capabilityTag, locKey, skillId } from "../../types/ids.ts";
import type { SkillNode } from "../../types/skill.ts";

export const CAP_DIV_EXACT = capabilityTag("cap.div.exact");
export const CAP_DIV_REMAINDER = capabilityTag("cap.div.remainder");

function b(hundredths: bigint) {
  return rational(hundredths, 100n);
}

function divide(
  task: LongDivParams["task"],
  quotientDigits: number,
  divisorDigits: number,
  exact: boolean,
  quotientZeros = false,
): LongDivParams {
  return { task, quotientDigits, divisorDigits, exact, quotientZeros };
}

export const SKILL_DIVIDE_EXACT = skillId("dw.div.whole.divide-exact");
export const SKILL_DIVIDE_REMAINDER = skillId("dw.div.whole.find-the-remainder");
export const SKILL_QUOTIENT_AND_REMAINDER = skillId("dw.div.whole.quotient-and-remainder");
export const SKILL_ZERO_IN_QUOTIENT = skillId("dw.div.whole.zero-in-the-quotient");

const divideExact: SkillNode = {
  id: SKILL_DIVIDE_EXACT,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.div.whole.divide-exact.title"),
  learnerGoal: locKey("dw.skill.div.whole.divide-exact.goal"),
  domain: "div",
  cluster: "whole",
  bigIdeas: [locKey("dw.idea.division.sharing-and-grouping")],
  gradeBand: { earliest: 3, nominal: 4, latest: 5 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 3, strategic: 1, adaptive: 1 },
  classification: "procedural",
  fluencyTarget: { p50Ms: 18000 },
  prereqs: [],
  difficulty: { b: b(-40n), levels: [b(-10n), b(20n), b(75n), b(105n)] },
  // Nothing is left over, so there is nothing to drop; the interior-zero rule needs
  // a quotient wide enough to hide one, which the last level of this row provides.
  misconceptions: [MIS_QUOTIENT_ZERO_SKIPPED],
  representations: { required: [], optional: [] },
  generator: {
    family: LONG_DIV_FAMILY,
    familyRev: LONG_DIV_FAMILY_REV,
    params: [
      divide("quotient", 2, 1, true),
      divide("quotient", 3, 1, true),
      divide("quotient", 3, 2, true),
      divide("quotient", 4, 2, true),
    ],
    forms: [DIV_FORM],
    minVariants: 80,
    consumes: [CAP_MUL_ONE_DIGIT],
  },
  probes: [{ level: 0, seed: 1, purpose: "entry" }],
  provides: [CAP_DIV_EXACT],
  standards: { ccss: ["4.NBT.B.6", "5.NBT.B.6"] },
};

const findTheRemainder: SkillNode = {
  id: SKILL_DIVIDE_REMAINDER,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.div.whole.find-the-remainder.title"),
  learnerGoal: locKey("dw.skill.div.whole.find-the-remainder.goal"),
  domain: "div",
  cluster: "whole",
  bigIdeas: [locKey("dw.idea.division.what-is-left-over")],
  gradeBand: { earliest: 3, nominal: 4, latest: 5 },
  strandRole: "bridge",
  proficiency: { conceptual: 3, procedural: 2, strategic: 2, adaptive: 2 },
  classification: "conceptual",
  prereqs: [{ kind: "requires", to: SKILL_DIVIDE_EXACT }],
  difficulty: { b: b(-40n), levels: [b(15n), b(45n), b(100n)] },
  misconceptions: [MIS_REMAINDER_DROPPED],
  representations: { required: [], optional: [] },
  generator: {
    family: LONG_DIV_FAMILY,
    familyRev: LONG_DIV_FAMILY_REV,
    params: [
      divide("remainder", 2, 1, false),
      divide("remainder", 3, 1, false),
      divide("remainder", 3, 2, false),
    ],
    forms: [DIV_FORM],
    minVariants: 60,
    consumes: [CAP_DIV_EXACT],
  },
  probes: [],
  provides: [CAP_DIV_REMAINDER],
  standards: { ccss: ["4.OA.A.3", "4.NBT.B.6"] },
};

const quotientAndRemainder: SkillNode = {
  id: SKILL_QUOTIENT_AND_REMAINDER,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.div.whole.quotient-and-remainder.title"),
  learnerGoal: locKey("dw.skill.div.whole.quotient-and-remainder.goal"),
  domain: "div",
  cluster: "whole",
  bigIdeas: [
    locKey("dw.idea.division.what-is-left-over"),
    locKey("dw.idea.fraction.a-fraction-is-a-division"),
  ],
  gradeBand: { earliest: 4, nominal: 5, latest: 5 },
  strandRole: "bridge",
  proficiency: { conceptual: 3, procedural: 3, strategic: 2, adaptive: 2 },
  classification: "conceptual",
  prereqs: [{ kind: "requires", to: SKILL_DIVIDE_REMAINDER }],
  difficulty: { b: b(-40n), levels: [b(15n), b(45n), b(100n)] },
  misconceptions: [MIS_REMAINDER_DROPPED, MIS_QUOTIENT_ZERO_SKIPPED],
  representations: { required: [], optional: [] },
  generator: {
    family: LONG_DIV_FAMILY,
    familyRev: LONG_DIV_FAMILY_REV,
    params: [
      divide("quotient-and-remainder", 2, 1, false),
      divide("quotient-and-remainder", 3, 1, false),
      divide("quotient-and-remainder", 3, 2, false),
    ],
    forms: [DIV_FORM],
    minVariants: 80,
    consumes: [CAP_DIV_REMAINDER],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["5.NF.B.3", "5.NBT.B.6"] },
};

/**
 * The column where the partial dividend is smaller than the divisor, and the zero
 * that belongs above it. `4,208 ÷ 4` is `1,052`, and the answer children write is
 * `152`.
 */
const zeroInTheQuotient: SkillNode = {
  id: SKILL_ZERO_IN_QUOTIENT,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.div.whole.zero-in-the-quotient.title"),
  learnerGoal: locKey("dw.skill.div.whole.zero-in-the-quotient.goal"),
  domain: "div",
  cluster: "whole",
  bigIdeas: [locKey("dw.idea.place-value.zero-holds-a-place")],
  gradeBand: { earliest: 4, nominal: 5, latest: 5 },
  strandRole: "fluency",
  proficiency: { conceptual: 2, procedural: 3, strategic: 1, adaptive: 2 },
  classification: "procedural",
  prereqs: [{ kind: "requires", to: SKILL_DIVIDE_EXACT }],
  difficulty: { b: b(-40n), levels: [b(55n), b(85n), b(140n)] },
  misconceptions: [MIS_QUOTIENT_ZERO_SKIPPED],
  representations: { required: [], optional: [] },
  generator: {
    family: LONG_DIV_FAMILY,
    familyRev: LONG_DIV_FAMILY_REV,
    params: [
      divide("quotient", 3, 1, true, true),
      divide("quotient", 4, 1, true, true),
      divide("quotient", 4, 2, true, true),
    ],
    forms: [DIV_FORM],
    minVariants: 60,
    consumes: [CAP_DIV_EXACT],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["5.NBT.B.6"] },
};

export const divDomainNodes: readonly SkillNode[] = [
  divideExact,
  findTheRemainder,
  quotientAndRemainder,
  zeroInTheQuotient,
];
