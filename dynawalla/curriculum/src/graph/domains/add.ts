/**
 * Domain `add` — addition and subtraction.
 *
 * The seed of the V1 graph: the three column-algorithm nodes M2 needs, plus one
 * `draft` node that exists to prove draft rows are excluded from the shipped graph
 * and from all coverage math (CG-7).
 *
 * The full 32-node domain lands in the M4 promotion PR. Every id here is final —
 * ids are mastery keys on learner devices and are immutable forever.
 *
 * `difficulty.levels` restates what `family.difficultyOffset(params)` computes.
 * That is deliberate redundancy: it makes "b is a pure function of generator
 * parameters" a claim a gate can check, and CG-9 fails on any drift between the
 * two.
 */

import { rational } from "../../math/rational.ts";
import type { ColumnOpParams } from "../../generators/columnOp/params.ts";
import {
  COLUMN_OP_FAMILY,
  COLUMN_OP_FAMILY_REV,
  FORM_COLUMN,
  FORM_FREE_ENTRY,
} from "../../generators/columnOp/constants.ts";
import {
  MIS_BORROW_ACROSS_ZERO,
  MIS_CARRY_DROPPED,
  MIS_SMALLER_FROM_LARGER,
  REP_COUNTING_BOARD,
} from "../../malrules/columnOp.ts";
import { capabilityTag, locKey, skillId } from "../../types/ids.ts";
import type { SkillNode } from "../../types/skill.ts";

const CAP_SUB_REGROUP = capabilityTag("cap.arith.sub-regroup");
const CAP_SUB_ACROSS_ZERO = capabilityTag("cap.arith.sub-across-zero");
const CAP_ADD_CARRY = capabilityTag("cap.arith.add-carry");

/** Written out so the level tables below read as tables. */
function sub(
  digits: number,
  operandDigits: number,
  regroupings: number,
  acrossZero: number,
  decimalPlaces = 0,
): ColumnOpParams {
  return { op: "sub", digits, operandDigits, regroupings, acrossZero, decimalPlaces, allowZeroResult: false };
}

function plus(digits: number, operandDigits: number, regroupings: number): ColumnOpParams {
  return {
    op: "add",
    digits,
    operandDigits,
    regroupings,
    acrossZero: 0,
    decimalPlaces: 0,
    allowZeroResult: false,
  };
}

/** Hundredths of a logit, spelled as an exact rational. */
function b(hundredths: bigint) {
  return rational(hundredths, 100n);
}

export const SKILL_SUBTRACT_MULTIDIGIT = skillId("dw.add.regroup.subtract-multidigit");
export const SKILL_SUBTRACT_ACROSS_ZERO = skillId("dw.add.regroup.subtract-across-zero");
export const SKILL_ADD_MULTIDIGIT = skillId("dw.add.regroup.add-multidigit");
export const SKILL_SUBTRACT_TENTHS = skillId("dw.add.regroup.subtract-tenths");

const subtractMultidigit: SkillNode = {
  id: SKILL_SUBTRACT_MULTIDIGIT,
  rev: 1,
  status: "active",
  title: locKey("dw.skill.add.regroup.subtract-multidigit.title"),
  learnerGoal: locKey("dw.skill.add.regroup.subtract-multidigit.goal"),
  domain: "add",
  cluster: "regroup",
  bigIdeas: [locKey("dw.idea.place-value.regroup")],
  gradeBand: { earliest: 1, nominal: 2, latest: 3 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 3, strategic: 1, adaptive: 1 },
  classification: "procedural",
  fluencyTarget: { p50Ms: 12000 },
  prereqs: [],
  difficulty: {
    b: b(-50n),
    levels: [b(5n), b(35n), b(90n), b(120n)],
  },
  misconceptions: [MIS_SMALLER_FROM_LARGER],
  representations: { required: [], optional: [REP_COUNTING_BOARD] },
  generator: {
    family: COLUMN_OP_FAMILY,
    familyRev: COLUMN_OP_FAMILY_REV,
    params: [sub(2, 2, 1, 0), sub(3, 3, 1, 0), sub(3, 3, 2, 0), sub(4, 4, 2, 0)],
    forms: [FORM_FREE_ENTRY, FORM_COLUMN],
    minVariants: 24,
    consumes: [],
  },
  probes: [
    { level: 0, seed: 1, purpose: "entry" },
    { level: 3, seed: 2, purpose: "promotion" },
  ],
  provides: [CAP_SUB_REGROUP],
  standards: { ccss: ["2.NBT.B.5", "3.NBT.A.2"], uk: ["Y3-NPV-2"] },
};

const subtractAcrossZero: SkillNode = {
  id: SKILL_SUBTRACT_ACROSS_ZERO,
  rev: 1,
  status: "active",
  title: locKey("dw.skill.add.regroup.subtract-across-zero.title"),
  learnerGoal: locKey("dw.skill.add.regroup.subtract-across-zero.goal"),
  domain: "add",
  cluster: "regroup",
  bigIdeas: [locKey("dw.idea.place-value.regroup"), locKey("dw.idea.place-value.zero-holds-a-place")],
  gradeBand: { earliest: 2, nominal: 3, latest: 4 },
  strandRole: "spine",
  proficiency: { conceptual: 3, procedural: 3, strategic: 1, adaptive: 2 },
  classification: "procedural",
  prereqs: [{ kind: "requires", to: SKILL_SUBTRACT_MULTIDIGIT }],
  difficulty: {
    b: b(0n),
    levels: [b(165n), b(195n), b(275n)],
  },
  misconceptions: [MIS_BORROW_ACROSS_ZERO, MIS_SMALLER_FROM_LARGER],
  representations: {
    // The counting board becomes `required` in PR-2.10, with the Stage-2 LOCATE
    // contrast pair; until that renderer exists, claiming it here would be a
    // curriculum row the app cannot draw, which is exactly what CG-8 exists to stop.
    required: [],
    optional: [REP_COUNTING_BOARD],
  },
  generator: {
    family: COLUMN_OP_FAMILY,
    familyRev: COLUMN_OP_FAMILY_REV,
    params: [sub(3, 3, 2, 1), sub(4, 4, 2, 1), sub(4, 4, 3, 2)],
    forms: [FORM_FREE_ENTRY, FORM_COLUMN],
    minVariants: 24,
    consumes: [CAP_SUB_REGROUP],
  },
  probes: [{ level: 2, seed: 5001, purpose: "promotion" }],
  provides: [CAP_SUB_ACROSS_ZERO],
  standards: { ccss: ["3.NBT.A.2", "4.NBT.B.4"] },
};

const addMultidigit: SkillNode = {
  id: SKILL_ADD_MULTIDIGIT,
  rev: 1,
  status: "active",
  title: locKey("dw.skill.add.regroup.add-multidigit.title"),
  learnerGoal: locKey("dw.skill.add.regroup.add-multidigit.goal"),
  domain: "add",
  cluster: "regroup",
  bigIdeas: [locKey("dw.idea.place-value.regroup")],
  gradeBand: { earliest: 1, nominal: 2, latest: 3 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 3, strategic: 1, adaptive: 1 },
  classification: "procedural",
  fluencyTarget: { p50Ms: 12000 },
  prereqs: [],
  difficulty: {
    b: b(-60n),
    levels: [b(-5n), b(25n), b(80n)],
  },
  misconceptions: [MIS_CARRY_DROPPED],
  representations: { required: [], optional: [REP_COUNTING_BOARD] },
  generator: {
    family: COLUMN_OP_FAMILY,
    familyRev: COLUMN_OP_FAMILY_REV,
    params: [plus(2, 2, 1), plus(3, 3, 1), plus(3, 3, 2)],
    forms: [FORM_FREE_ENTRY, FORM_COLUMN],
    minVariants: 24,
    consumes: [],
  },
  probes: [{ level: 0, seed: 1, purpose: "entry" }],
  provides: [CAP_ADD_CARRY],
  standards: { ccss: ["2.NBT.B.5", "3.NBT.A.2"] },
};

/**
 * Draft: subtraction of tenths. The generator already handles it exactly — a
 * decimal problem is an integer problem plus a decimal-point position — but the
 * number layer that owns the decimal separator does not exist until M2, so CG-14
 * cannot run and this row must not be `active`. It is here to keep the draft path
 * exercised: a draft node is excluded from the shipped graph and from all coverage
 * math, and if that ever stops being true a test fails.
 */
const subtractTenths: SkillNode = {
  id: SKILL_SUBTRACT_TENTHS,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.add.regroup.subtract-tenths.title"),
  learnerGoal: locKey("dw.skill.add.regroup.subtract-tenths.goal"),
  domain: "add",
  cluster: "regroup",
  bigIdeas: [locKey("dw.idea.place-value.regroup")],
  gradeBand: { earliest: 4, nominal: 5, latest: 6 },
  strandRole: "bridge",
  proficiency: { conceptual: 3, procedural: 2, strategic: 1, adaptive: 2 },
  classification: "procedural",
  prereqs: [{ kind: "requires", to: SKILL_SUBTRACT_ACROSS_ZERO }],
  difficulty: { b: b(0n), levels: [b(105n)] },
  misconceptions: [MIS_SMALLER_FROM_LARGER],
  representations: { required: [], optional: [] },
  generator: {
    family: COLUMN_OP_FAMILY,
    familyRev: COLUMN_OP_FAMILY_REV,
    params: [sub(3, 3, 1, 0, 1)],
    forms: [FORM_FREE_ENTRY],
    minVariants: 24,
    consumes: [CAP_SUB_ACROSS_ZERO],
  },
  probes: [],
  provides: [],
};

export const addDomainNodes: readonly SkillNode[] = [
  subtractMultidigit,
  subtractAcrossZero,
  addMultidigit,
  subtractTenths,
];
