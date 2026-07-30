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
 * ## One row is active now, and four are not
 *
 * The domain was entirely `draft` because the host could not state its questions:
 * every shape here puts the unknown *inside* the expression, and a two-operand string
 * cannot say that. `render/prompts.ts` grew `PromptBlank` and the host draws
 * `47 + □ = 68` — so `dw.alg.equality.missing-addend` is `active`, and it is the first
 * equality row this program has ever served a child.
 *
 * The other four are still draft and **not** for that reason any more. Each has its
 * own blocker, measured rather than assumed, and each is named in
 * `promotionBlockers.ts` with what would clear it:
 *
 * - `missing-subtrahend` — `93 − □ = 47`. The pack drops the minus in front of a box.
 * - `missing-factor` — `□ × 15 = 165`. The pack's apparatus adds; a missing factor
 *   multiplies.
 * - `unknown-minuend` — `□ − 47 = 68`. Draws correctly; its own prerequisite is one
 *   of the two above, so CG-4 makes it unreachable until that one moves.
 * - `balance-meaning` — `8 + 4 = □ + 5`. Three numbers and an operator on each side of
 *   the relation, which `PromptBlank` does not reach; and the row requires the balance
 *   scale, which `Item` has no field to ask a pack for.
 *
 * ## CG-10 at L0, which was never the right blocker for this row
 *
 * A one-digit missing addend has 9 × 9 = 81 items in the world and CG-10's floor is
 * 975, so every row here sat under it at L0. That is not a thin draw and no generator
 * work changes it: it is the eighty-one single-digit missing addends, the same closed
 * set of facts `dw.add.facts.add-within-ten` already declares a *nine*-item slice of.
 * `missing-addend` therefore declares `closedFactSet` at L0 and `null` above it, where
 * its 7,400 and 19,800 measured problems clear the floor on their own — see
 * `GeneratorBinding.closedFactSet` for why an entry may now be `null`, and
 * `families.test.ts`, which enumerates the eighty-one and pins them.
 *
 * `dw.alg.equality.balance-meaning` is the one row in this domain that requires a
 * representation: the balance scale, whose renderer **does** exist (PR-2.12). It is
 * declared `required` rather than `optional` because on that row the scale is the
 * skill — two pans that do not balance, and the question is what makes them.
 *
 * ## `fluencyTarget.p50Ms`, by one rule
 *
 * A blank statement's median is the median of the operation it **inverts**, not of the
 * one it is written with, because that is the work: reading `=` as a relation and then
 * undoing. Both anchors are numbers already in this tree rather than invented ones —
 * the additive rows take 10 s, the multiplicative row takes the 18 s `dw.div.*`
 * declares, since `OFFSET_MUL_UNKNOWN`'s own comment is that "a missing factor is a
 * division nobody wrote down". `balance-meaning` declares none: it is
 * `classification: "conceptual"`, and comprehension is measured, never budgeted.
 *
 * A declared median can only ever *widen* a climb window (`itemPace` takes
 * `max(table, declared)`), so these move the one- and two-digit levels off the
 * cadence table's 2.8 s and 6 s and are dominated by the table from three digits up —
 * which is right, because at three digits the work really is the column arithmetic the
 * table already prices.
 */

import { rational } from "../../math/rational.ts";
import { CAP_DIFFERENCES_WITHIN_TEN, SKILL_SUBTRACT_WITHIN_TEN } from "./add.ts";
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

/**
 * `47 + □ = 68`, and the first equality row this program serves.
 *
 * Grade 1, and the bottom of the domain. The prerequisite is
 * `dw.add.facts.subtract-within-ten` rather than nothing, which is both what the
 * mathematics says — a child recovers the box by taking one number from the other, so
 * a missing addend within ten *is* a difference within ten — and what the active graph
 * requires: `ladder.test.ts` holds `activeNodes()` to a single root, and a row with no
 * active prerequisite would be a second one, a rung a child can stand on with no route
 * down from it.
 */
const missingAddend: SkillNode = {
  id: SKILL_MISSING_ADDEND,
  rev: 1,
  status: "active",
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
  prereqs: [{ kind: "requires", to: SKILL_SUBTRACT_WITHIN_TEN }],
  difficulty: { b: b(-40n), levels: [b(-105n), b(-75n), b(-45n)] },
  misconceptions: [MIS_ADD_ALL_NUMBERS],
  representations: { required: [], optional: [REP_BALANCE_SCALE] },
  generator: {
    family: MISSING_OPERAND_FAMILY,
    familyRev: MISSING_OPERAND_FAMILY_REV,
    params: [sentence("add-unknown", 1), sentence("add-unknown", 2), sentence("add-unknown", 3)],
    forms: [ALG_FORM],
    minVariants: 40,
    // L0 is the eighty-one one-digit missing addends and there is no eighty-second;
    // L1 and L2 measure 7,406 and 19,757 problems and take the ordinary floor. Both
    // numbers are pinned by enumeration in `families.test.ts`.
    closedFactSet: [81, null, null],
    consumes: [CAP_DIFFERENCES_WITHIN_TEN],
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
  // The additive anchor: `93 − □ = 47` is the same relational read as a missing
  // addend, undone the other way. See the rule at the top of this file.
  fluencyTarget: { p50Ms: 10000 },
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
  // Additive anchor again, and the shape whose undoing runs the *other* way: the box
  // is the number being taken from, so recovering it is an addition.
  fluencyTarget: { p50Ms: 10000 },
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
  // The multiplicative anchor, and the one the founder asked for. 18 s is what
  // `dw.div.*` declares, and it is the right number here for the reason
  // `OFFSET_MUL_UNKNOWN` already gives: a missing factor is a division nobody wrote
  // down. Pricing `□ × 15 = 165` at the 15 s of the multiplication it inverts would
  // budget the inversion at nothing, which is the entire work of the row.
  fluencyTarget: { p50Ms: 18000 },
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
