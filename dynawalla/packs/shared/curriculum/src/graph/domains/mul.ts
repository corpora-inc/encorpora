/**
 * Domain `mul` — multiplication.
 *
 * `draft`, for the reason `ns.ts` states at length: the generator is complete and
 * the app cannot draw the question. See `render/prompts.ts`. One level here needs a
 * second thing before it can go active — `dw.mul.scale.times-power-of-ten` L0 is
 * under CG-10's variant-space floor. See `promotionBlockers.ts`.
 *
 * **What is missing from this domain, and why.** CURRICULUM.md gives `mul` ten
 * fact-recall skills, and there are none here. Times-table facts have at most 144
 * distinct problems in the world; CG-10's variant-space floor is 975, derived from
 * a 40-item practice run repeating no more than one item in fifty. A fact family
 * cannot satisfy it and no amount of generator work will change that — the floor
 * and the content are in genuine conflict, and the resolution belongs with whoever
 * owns CG-10, not in a generator that games the estimator.
 */

import { rational } from "../../math/rational.ts";
import type { MultidigitMulParams } from "../../generators/multidigitMul/params.ts";
import {
  FORM_FREE_ENTRY as MUL_FORM,
  MULTIDIGIT_MUL_FAMILY,
  MULTIDIGIT_MUL_FAMILY_REV,
} from "../../generators/multidigitMul/constants.ts";
import {
  MIS_CARRY_ADDED_BEFORE_MULTIPLYING,
  MIS_FORGOT_THE_SHIFT,
  MIS_PARTIAL_PRODUCT_MISALIGNED,
} from "../../malrules/multidigitMul.ts";
import { capabilityTag, locKey, skillId } from "../../types/ids.ts";
import type { SkillNode } from "../../types/skill.ts";

export const CAP_MUL_ONE_DIGIT = capabilityTag("cap.mul.by-one-digit");
export const CAP_MUL_MULTIDIGIT = capabilityTag("cap.mul.multidigit");

function b(hundredths: bigint) {
  return rational(hundredths, 100n);
}

function times(digits: number, multiplierDigits: number, carries: boolean): MultidigitMulParams {
  return { shape: "general", digits, multiplierDigits, carries };
}

function powerOfTen(digits: number, maxPower: number): MultidigitMulParams {
  return { shape: "power-of-ten", digits, maxPower };
}

export const SKILL_TIMES_POWER_OF_TEN = skillId("dw.mul.scale.times-power-of-ten");
export const SKILL_TIMES_ONE_DIGIT = skillId("dw.mul.multidigit.times-one-digit");
export const SKILL_TIMES_TWO_DIGIT = skillId("dw.mul.multidigit.times-two-digit");

const timesPowerOfTen: SkillNode = {
  id: SKILL_TIMES_POWER_OF_TEN,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.mul.scale.times-power-of-ten.title"),
  learnerGoal: locKey("dw.skill.mul.scale.times-power-of-ten.goal"),
  domain: "mul",
  cluster: "scale",
  bigIdeas: [locKey("dw.idea.place-value.ten-times-moves-a-place")],
  gradeBand: { earliest: 2, nominal: 3, latest: 4 },
  strandRole: "bridge",
  proficiency: { conceptual: 3, procedural: 2, strategic: 1, adaptive: 1 },
  classification: "conceptual",
  prereqs: [],
  difficulty: { b: b(-40n), levels: [b(-75n), b(-45n), b(-15n)] },
  // `47 × 100` answered as `47`: the zeros that move the product up two places
  // were never written. Same root cause as the missing placeholder zero in
  // `47 × 23` — both are `mis.mul.shift-not-applied` — but a different rule and a
  // different repair, because a child multiplying by a hundred is not writing two
  // partial products and misplacing one. The generator already draws the two apart:
  // the `power-of-ten` shape's walkthrough is a place-value shift and emits no
  // partial-product step at all.
  misconceptions: [MIS_FORGOT_THE_SHIFT],
  representations: { required: [], optional: [] },
  generator: {
    family: MULTIDIGIT_MUL_FAMILY,
    familyRev: MULTIDIGIT_MUL_FAMILY_REV,
    params: [powerOfTen(2, 1), powerOfTen(3, 2), powerOfTen(4, 3)],
    forms: [MUL_FORM],
    minVariants: 60,
    consumes: [],
  },
  probes: [{ level: 0, seed: 1, purpose: "entry" }],
  provides: [],
  standards: { ccss: ["4.NBT.A.1", "5.NBT.A.2"] },
};

const timesOneDigit: SkillNode = {
  id: SKILL_TIMES_ONE_DIGIT,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.mul.multidigit.times-one-digit.title"),
  learnerGoal: locKey("dw.skill.mul.multidigit.times-one-digit.goal"),
  domain: "mul",
  cluster: "multidigit",
  bigIdeas: [locKey("dw.idea.place-value.regroup"), locKey("dw.idea.multiplication.equal-groups")],
  gradeBand: { earliest: 3, nominal: 4, latest: 5 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 3, strategic: 1, adaptive: 1 },
  classification: "procedural",
  fluencyTarget: { p50Ms: 15000 },
  prereqs: [],
  difficulty: { b: b(-30n), levels: [b(25n), b(55n), b(85n)] },
  misconceptions: [MIS_CARRY_ADDED_BEFORE_MULTIPLYING],
  representations: { required: [], optional: [] },
  generator: {
    family: MULTIDIGIT_MUL_FAMILY,
    familyRev: MULTIDIGIT_MUL_FAMILY_REV,
    params: [times(3, 1, true), times(4, 1, true), times(5, 1, true)],
    forms: [MUL_FORM],
    minVariants: 80,
    consumes: [],
  },
  probes: [{ level: 0, seed: 1, purpose: "entry" }],
  provides: [CAP_MUL_ONE_DIGIT],
  standards: { ccss: ["4.NBT.B.5"], uk: ["Y4-MD-2"] },
};

const timesTwoDigit: SkillNode = {
  id: SKILL_TIMES_TWO_DIGIT,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.mul.multidigit.times-two-digit.title"),
  learnerGoal: locKey("dw.skill.mul.multidigit.times-two-digit.goal"),
  domain: "mul",
  cluster: "multidigit",
  bigIdeas: [locKey("dw.idea.place-value.regroup"), locKey("dw.idea.multiplication.partial-products")],
  gradeBand: { earliest: 4, nominal: 5, latest: 5 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 3, strategic: 2, adaptive: 2 },
  classification: "procedural",
  prereqs: [
    { kind: "requires", to: SKILL_TIMES_ONE_DIGIT },
    { kind: "supports", to: SKILL_TIMES_POWER_OF_TEN },
  ],
  difficulty: { b: b(-30n), levels: [b(50n), b(80n), b(110n), b(135n)] },
  misconceptions: [MIS_PARTIAL_PRODUCT_MISALIGNED],
  representations: { required: [], optional: [] },
  generator: {
    family: MULTIDIGIT_MUL_FAMILY,
    familyRev: MULTIDIGIT_MUL_FAMILY_REV,
    params: [times(2, 2, true), times(3, 2, true), times(4, 2, true), times(3, 3, true)],
    forms: [MUL_FORM],
    minVariants: 80,
    consumes: [CAP_MUL_ONE_DIGIT],
  },
  probes: [{ level: 3, seed: 41, purpose: "promotion" }],
  provides: [CAP_MUL_MULTIDIGIT],
  standards: { ccss: ["5.NBT.B.5"], uk: ["Y5-MD-1"] },
};

export const mulDomainNodes: readonly SkillNode[] = [timesPowerOfTen, timesOneDigit, timesTwoDigit];
