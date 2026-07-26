/**
 * Domain `alg` — equality and early algebra.
 *
 * **This domain starts at grade 1**, which is the one place CURRICULUM.md departs
 * from every framework it otherwise follows, and the evidence is specific: on
 * `8 + 4 = ☐ + 5` roughly 5% of grade 1–2 children answer 7, in one sample all 145
 * sixth graders answered 12 or 17, and equal-sign knowledge at second grade predicts
 * fourth-grade algebra competence. A child who reads `=` as "and now write the
 * answer" is not making an arithmetic mistake, and waiting until grade 6 to find out
 * is how it survives to grade 6.
 *
 * Every row is `draft` — the generator is complete, the app cannot draw the
 * question. See `render/prompts.ts`. **Every row in this domain is also under
 * CG-10's variant-space floor at L0**, and here the conflict is real rather than a
 * thin draw: a one-digit missing addend has 9 x 9 = 81 items in the world and the
 * floor is 975. These rows need more shapes or a reconciled floor, not a field
 * flip. See `promotionBlockers.ts`.
 *
 * `dw.alg.equality.balance-meaning` is the one row in this change that requires a
 * representation: the balance scale, whose renderer **does** exist (PR-2.12). It is
 * declared `required` rather than `optional` because on that row the scale is the
 * skill — two pans that do not balance, and the question is what makes them.
 */

import { rational } from "../../math/rational.ts";
import type { MissingOperandParams } from "../../generators/missingOperand/params.ts";
import {
  FORM_FREE_ENTRY as ALG_FORM,
  MISSING_OPERAND_FAMILY,
  MISSING_OPERAND_FAMILY_REV,
  REP_BALANCE_SCALE,
} from "../../generators/missingOperand/constants.ts";
import { MIS_ADD_ALL_NUMBERS, MIS_EQUALS_AS_OPERATOR } from "../../malrules/missingOperand.ts";
import { capabilityTag, locKey, skillId } from "../../types/ids.ts";
import type { SkillNode } from "../../types/skill.ts";

export const CAP_MISSING_ADDEND = capabilityTag("cap.alg.missing-addend");
export const CAP_EQUALS_IS_A_RELATION = capabilityTag("cap.alg.equals-is-a-relation");

function b(hundredths: bigint) {
  return rational(hundredths, 100n);
}

function sentence(
  shape: MissingOperandParams["shape"],
  digits: number,
  balance = false,
): MissingOperandParams {
  return { shape, digits, balance };
}

export const SKILL_MISSING_ADDEND = skillId("dw.alg.equality.missing-addend");
export const SKILL_BALANCE_MEANING = skillId("dw.alg.equality.balance-meaning");
export const SKILL_MISSING_SUBTRAHEND = skillId("dw.alg.equality.missing-subtrahend");
export const SKILL_UNKNOWN_MINUEND = skillId("dw.alg.equality.unknown-minuend");
export const SKILL_MISSING_FACTOR = skillId("dw.alg.equality.missing-factor");

const missingAddend: SkillNode = {
  id: SKILL_MISSING_ADDEND,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.alg.equality.missing-addend.title"),
  learnerGoal: locKey("dw.skill.alg.equality.missing-addend.goal"),
  domain: "alg",
  cluster: "equality",
  bigIdeas: [locKey("dw.idea.equality.the-two-sides-are-the-same")],
  gradeBand: { earliest: 1, nominal: 1, latest: 3 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 2, strategic: 2, adaptive: 1 },
  classification: "procedural",
  fluencyTarget: { p50Ms: 10000 },
  prereqs: [],
  difficulty: { b: b(-40n), levels: [b(-105n), b(-75n), b(-45n)] },
  misconceptions: [MIS_ADD_ALL_NUMBERS],
  representations: { required: [], optional: [REP_BALANCE_SCALE] },
  generator: {
    family: MISSING_OPERAND_FAMILY,
    familyRev: MISSING_OPERAND_FAMILY_REV,
    params: [sentence("add-unknown", 1), sentence("add-unknown", 2), sentence("add-unknown", 3)],
    forms: [ALG_FORM],
    minVariants: 40,
    consumes: [],
  },
  probes: [{ level: 0, seed: 1, purpose: "entry" }],
  provides: [CAP_MISSING_ADDEND],
  standards: { ccss: ["1.OA.D.8", "2.OA.B.2"] },
};

/**
 * `8 + 4 = ☐ + 5`, with the scale beside it.
 *
 * Grade 1, deliberately. This is the row the domain exists for, and it is the one
 * item in the program where the two documented wrong answers — the total of the
 * complete side, and every number on the card added up — are both produced by
 * running a procedure rather than by guessing at one.
 */
const balanceMeaning: SkillNode = {
  id: SKILL_BALANCE_MEANING,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.alg.equality.balance-meaning.title"),
  learnerGoal: locKey("dw.skill.alg.equality.balance-meaning.goal"),
  domain: "alg",
  cluster: "equality",
  bigIdeas: [
    locKey("dw.idea.equality.the-two-sides-are-the-same"),
    locKey("dw.idea.equality.equals-is-not-an-instruction"),
  ],
  gradeBand: { earliest: 1, nominal: 2, latest: 5 },
  strandRole: "spine",
  proficiency: { conceptual: 3, procedural: 1, strategic: 3, adaptive: 3 },
  classification: "conceptual",
  prereqs: [{ kind: "requires", to: SKILL_MISSING_ADDEND }],
  difficulty: { b: b(-40n), levels: [b(-15n), b(15n), b(45n)] },
  misconceptions: [MIS_EQUALS_AS_OPERATOR, MIS_ADD_ALL_NUMBERS],
  // Required, not optional: on this row the scale is the skill. Its renderer
  // exists (PR-2.12), which is why the requirement can be stated at all.
  representations: { required: [REP_BALANCE_SCALE], optional: [] },
  generator: {
    family: MISSING_OPERAND_FAMILY,
    familyRev: MISSING_OPERAND_FAMILY_REV,
    params: [sentence("both-sides", 1, true), sentence("both-sides", 2, true), sentence("both-sides", 3, true)],
    forms: [ALG_FORM],
    minVariants: 40,
    consumes: [CAP_MISSING_ADDEND],
  },
  probes: [
    { level: 0, seed: 1, purpose: "entry" },
    { level: 2, seed: 84, purpose: "promotion" },
  ],
  provides: [CAP_EQUALS_IS_A_RELATION],
  standards: { ccss: ["1.OA.D.7", "3.OA.D.8"] },
};

const missingSubtrahend: SkillNode = {
  id: SKILL_MISSING_SUBTRAHEND,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.alg.equality.missing-subtrahend.title"),
  learnerGoal: locKey("dw.skill.alg.equality.missing-subtrahend.goal"),
  domain: "alg",
  cluster: "equality",
  bigIdeas: [locKey("dw.idea.equality.the-two-sides-are-the-same")],
  gradeBand: { earliest: 2, nominal: 3, latest: 4 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 3, strategic: 2, adaptive: 2 },
  classification: "procedural",
  prereqs: [{ kind: "requires", to: SKILL_MISSING_ADDEND }],
  difficulty: { b: b(-40n), levels: [b(-70n), b(-40n), b(-10n)] },
  misconceptions: [MIS_ADD_ALL_NUMBERS],
  representations: { required: [], optional: [] },
  generator: {
    family: MISSING_OPERAND_FAMILY,
    familyRev: MISSING_OPERAND_FAMILY_REV,
    params: [sentence("sub-unknown", 1), sentence("sub-unknown", 2), sentence("sub-unknown", 3)],
    forms: [ALG_FORM],
    minVariants: 40,
    consumes: [CAP_MISSING_ADDEND],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["1.OA.D.8", "3.OA.D.8"] },
};

const unknownMinuend: SkillNode = {
  id: SKILL_UNKNOWN_MINUEND,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.alg.equality.unknown-minuend.title"),
  learnerGoal: locKey("dw.skill.alg.equality.unknown-minuend.goal"),
  domain: "alg",
  cluster: "equality",
  bigIdeas: [locKey("dw.idea.equality.undoing-runs-both-ways")],
  gradeBand: { earliest: 3, nominal: 4, latest: 5 },
  strandRole: "bridge",
  proficiency: { conceptual: 3, procedural: 2, strategic: 3, adaptive: 2 },
  classification: "reasoning",
  prereqs: [{ kind: "requires", to: SKILL_MISSING_SUBTRAHEND }],
  difficulty: { b: b(-40n), levels: [b(-45n), b(-15n), b(15n)] },
  // On `☐ − a = c`, adding every number on the card gives the correct answer, so
  // the add-all rule is not instantiated here and this row declares nothing. A
  // wrong answer is unclassified, which is the honest outcome.
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: MISSING_OPERAND_FAMILY,
    familyRev: MISSING_OPERAND_FAMILY_REV,
    params: [
      sentence("sub-unknown-minuend", 1),
      sentence("sub-unknown-minuend", 2),
      sentence("sub-unknown-minuend", 3),
    ],
    forms: [ALG_FORM],
    minVariants: 40,
    consumes: [],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["3.OA.D.8", "4.OA.A.3"] },
};

const missingFactor: SkillNode = {
  id: SKILL_MISSING_FACTOR,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.alg.equality.missing-factor.title"),
  learnerGoal: locKey("dw.skill.alg.equality.missing-factor.goal"),
  domain: "alg",
  cluster: "equality",
  bigIdeas: [locKey("dw.idea.equality.undoing-runs-both-ways")],
  gradeBand: { earliest: 3, nominal: 4, latest: 5 },
  strandRole: "bridge",
  proficiency: { conceptual: 3, procedural: 2, strategic: 3, adaptive: 2 },
  classification: "reasoning",
  prereqs: [{ kind: "requires", to: SKILL_MISSING_ADDEND }],
  difficulty: { b: b(-40n), levels: [b(-25n), b(5n)] },
  // `mis.alg.add-all-numbers` is not defined on a missing factor: nothing on the
  // card is an addition, and a child reaching for one is not making this mistake.
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: MISSING_OPERAND_FAMILY,
    familyRev: MISSING_OPERAND_FAMILY_REV,
    params: [sentence("mul-unknown", 1), sentence("mul-unknown", 2)],
    forms: [ALG_FORM],
    minVariants: 40,
    consumes: [],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["3.OA.A.4", "4.OA.A.1"] },
};

export const algDomainNodes: readonly SkillNode[] = [
  missingAddend,
  balanceMeaning,
  missingSubtrahend,
  unknownMinuend,
  missingFactor,
];
