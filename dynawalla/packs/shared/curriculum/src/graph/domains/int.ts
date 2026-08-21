/**
 * Domain `int` — the integers. Arithmetic below zero, and the pre-algebra on-ramp.
 *
 * ## Why this is a seventh domain and not a cluster of `ns` or `add`
 *
 * The alternative was `dw.ns.integer.*` for the ordering and `dw.add.integer.*`
 * for the arithmetic, and it was rejected because it puts one idea under two
 * mastery namespaces. What a child is learning across all four rows below is a
 * single thing — that a number carries a direction, and that every operation they
 * have has a rule for it — and a scheduler that can see "this child is shaky on
 * integers" needs those rows to share a domain rather than to be scattered across
 * the two domains that own the *unsigned* versions of the same operations.
 *
 * `ns` is number sense and place value: how a numeral is built. `add` and `mul`
 * are the written algorithms. Neither is what this is.
 *
 * **`int` is deliberately absent from `V1_DOMAIN_BANDS`**, the table CG-15 reads.
 * CURRICULUM.md names integers in the V2 cut list, and a coverage matrix that
 * demanded an integer skill in grade 3 would be a gate everybody learns to ignore.
 * The rows exist because the program's stated span reaches pre-algebra and the
 * on-ramp has to be built before it can be climbed; they are not V1 coverage and
 * the matrix does not pretend they are.
 *
 * ## What is here and what is not
 *
 * Four rows: past zero, adding, subtracting, multiplying. Two things a reader
 * might look for are missing on purpose.
 *
 * **Ordering and the number line.** "Which is greater, `−7` or `−3`?" is real
 * content and a genuine misconception magnet, and locating an integer on a number
 * line is how it is taught. Neither is here, because a comparison row would bind
 * `gen.number.compare-order`, whose answer schema is a closed choice that no
 * renderer draws, and a number-line row would be **a card whose question is a
 * picture nobody draws** — a blank. `REP_NUMBER_LINE` is registered and
 * unimplemented; the day a pack draws it, an ordering row is one PR and it is the
 * right first PR into this domain.
 *
 * **Division.** Same sign rule as the multiplication row, and it needs an exact
 * division so the item does not pose a fraction by accident. A row this family can
 * carry, not a gap in what it teaches.
 *
 * ## Every level here declares `closedFactSet`, and why that is honest
 *
 * A level of `gen.arith.signed-int` is bounded by a magnitude, and the bound *is*
 * the content: what the row teaches is which way the answer points, and it teaches
 * it on numbers small enough that nothing else can be the reason a child got it
 * wrong. There are exactly forty-five subtractions within ten that land below zero
 * and there is no forty-sixth, in precisely the sense there are thirty-six
 * additions within ten. See `GeneratorBinding.closedFactSet`: the substituted
 * check is sharper than the floor, not a waiver of it — the gate fails if the
 * generator ever reaches a problem the row says does not exist, and
 * `signedInt.test.ts` pins each set from the other side by enumerating it
 * independently.
 *
 * ## Status
 *
 * All four rows are `draft`, and unlike most of this graph the blocker is
 * specific rather than the standing "no renderer exists" note. Two things:
 *
 *   1. the answer goes below zero, and `answer:integer-signed` is not built. A
 *      digit keypad with no minus key on `(−7) + 4` is not a blank card — it is a
 *      card that looks answerable and marks a correct child wrong;
 *   2. the multiplication row's question is drawn with a `×`, which the shipped
 *      host writes as a `+`. See `promotionBlockers.ts`.
 */

import { rational } from "../../math/rational.ts";
import {
  FORM_FREE_ENTRY as SIGNED_FORM,
  SIGNED_INT_FAMILY,
  SIGNED_INT_FAMILY_REV,
} from "../../generators/signedInt/constants.ts";
import type { SignedIntParams, SignPlacement } from "../../generators/signedInt/params.ts";
import { CAP_DIFFERENCES_ACROSS_TEN, SKILL_SUBTRACT_ACROSS_TEN } from "./add.ts";
import { CAP_TABLES_TO_TWELVE, SKILL_TABLES_TO_TWELVE } from "./mul.ts";
import { capabilityTag, locKey, skillId } from "../../types/ids.ts";
import type { SkillNode } from "../../types/skill.ts";

/** A number can be below zero, and the count carries on down there. */
export const CAP_BELOW_ZERO = capabilityTag("cap.int.below-zero");
/** The two sign rules for addition: signs alike, signs unlike. */
export const CAP_SIGNED_SUM = capabilityTag("cap.int.signed-sum");

function b(hundredths: bigint) {
  return rational(hundredths, 100n);
}

/** Written out so the level tables below read as tables. */
function signed(op: SignedIntParams["op"], maxMagnitude: number, negatives: SignPlacement): SignedIntParams {
  return { op, maxMagnitude, negatives };
}

export const SKILL_PAST_ZERO = skillId("dw.int.arith.subtract-past-zero");
export const SKILL_ADD_SIGNED = skillId("dw.int.arith.add-signed");
export const SKILL_SUBTRACT_SIGNED = skillId("dw.int.arith.subtract-signed");
export const SKILL_MULTIPLY_SIGNED = skillId("dw.int.arith.multiply-signed");

/**
 * The on-ramp: `3 − 9`.
 *
 * Not a minus sign anywhere on the card, and the answer has one. That is the whole
 * row, and it is a separate mastery key from every row above it because the thing
 * a child does not yet have is not a rule for signs — it is the fact that the count
 * does not stop at zero. A child who answers `6` here is not misapplying a sign
 * rule; they are subtracting the only way subtraction has ever worked for them,
 * smaller from larger, which is `mis.add.smaller-from-larger` arriving in the one
 * place it is nearly right.
 */
const subtractPastZero: SkillNode = {
  id: SKILL_PAST_ZERO,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.int.arith.subtract-past-zero.title"),
  learnerGoal: locKey("dw.skill.int.arith.subtract-past-zero.goal"),
  domain: "int",
  cluster: "arith",
  bigIdeas: [locKey("dw.idea.number.the-count-goes-below-zero")],
  gradeBand: { earliest: 5, nominal: 6, latest: 7 },
  strandRole: "bridge",
  proficiency: { conceptual: 3, procedural: 1, strategic: 2, adaptive: 2 },
  classification: "conceptual",
  /**
   * Ten seconds. The arithmetic is a within-twenty difference the child already
   * has and the cadence table would give the item six; what the extra four seconds
   * pay for is the decision, which is the entire content of the row. A window cut
   * to the arithmetic would promote only the children who had stopped thinking
   * about the sign.
   */
  fluencyTarget: { p50Ms: 10000 },
  prereqs: [{ kind: "requires", to: SKILL_SUBTRACT_ACROSS_TEN }],
  difficulty: { b: b(125n), levels: [b(140n), b(165n), b(190n)] },
  misconceptions: [],
  // The number line belongs here and is not claimed. See the note at the top.
  representations: { required: [], optional: [] },
  generator: {
    family: SIGNED_INT_FAMILY,
    familyRev: SIGNED_INT_FAMILY_REV,
    params: [signed("sub", 10, "none"), signed("sub", 15, "none"), signed("sub", 20, "none")],
    forms: [SIGNED_FORM],
    minVariants: 40,
    // m(m−1)/2 at ten, fifteen and twenty: the triangle `a < b`, which is every
    // subtraction within the bound that lands below zero and no other.
    closedFactSet: [45, 105, 190],
    consumes: [CAP_DIFFERENCES_ACROSS_TEN],
  },
  probes: [
    { level: 0, seed: 1, purpose: "entry" },
    { level: 2, seed: 2, purpose: "promotion" },
  ],
  provides: [CAP_BELOW_ZERO],
  standards: { ccss: ["6.NS.C.5", "7.NS.A.1"] },
};

const addSigned: SkillNode = {
  id: SKILL_ADD_SIGNED,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.int.arith.add-signed.title"),
  learnerGoal: locKey("dw.skill.int.arith.add-signed.goal"),
  domain: "int",
  cluster: "arith",
  bigIdeas: [
    locKey("dw.idea.number.the-count-goes-below-zero"),
    locKey("dw.idea.number.a-number-carries-a-direction"),
  ],
  gradeBand: { earliest: 6, nominal: 6, latest: 7 },
  strandRole: "spine",
  proficiency: { conceptual: 3, procedural: 2, strategic: 2, adaptive: 2 },
  classification: "conceptual",
  // Twelve. Two more than the row below it, for the second decision: the sizes
  // have to be compared before either of them is used.
  fluencyTarget: { p50Ms: 12000 },
  prereqs: [{ kind: "requires", to: SKILL_PAST_ZERO }],
  difficulty: { b: b(140n), levels: [b(160n), b(185n), b(235n)] },
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: SIGNED_INT_FAMILY,
    familyRev: SIGNED_INT_FAMILY_REV,
    // The minus on the front, then the minus in the middle, then both. The order
    // is the difficulty coefficients' order and it is the claim they make: two
    // signs side by side is harder to read than one at the start.
    params: [signed("add", 10, "first"), signed("add", 12, "second"), signed("add", 20, "both")],
    forms: [SIGNED_FORM],
    minVariants: 90,
    closedFactSet: [100, 144, 400],
    consumes: [CAP_BELOW_ZERO, CAP_DIFFERENCES_ACROSS_TEN],
  },
  probes: [
    { level: 0, seed: 1, purpose: "entry" },
    { level: 2, seed: 2, purpose: "promotion" },
  ],
  provides: [CAP_SIGNED_SUM],
  standards: { ccss: ["7.NS.A.1"] },
};

/**
 * Subtracting a signed number, which is the row the whole domain turns on.
 *
 * `7 − (−4)` is where "two negatives make a positive" is *correct*, and it is the
 * same sentence that makes `(−7) + (−4) = 11` on the row below. Separate mastery
 * keys, because a child can hold the rule for one and not the other and a single
 * record would average the two into a number that describes neither.
 */
const subtractSigned: SkillNode = {
  id: SKILL_SUBTRACT_SIGNED,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.int.arith.subtract-signed.title"),
  learnerGoal: locKey("dw.skill.int.arith.subtract-signed.goal"),
  domain: "int",
  cluster: "arith",
  bigIdeas: [
    locKey("dw.idea.number.a-number-carries-a-direction"),
    locKey("dw.idea.equality.undoing-runs-both-ways"),
  ],
  gradeBand: { earliest: 6, nominal: 6, latest: 7 },
  strandRole: "spine",
  proficiency: { conceptual: 3, procedural: 2, strategic: 3, adaptive: 2 },
  classification: "conceptual",
  // Fourteen: the item becomes an addition first and is then the row below it.
  // Two moves, and the median is the two of them.
  fluencyTarget: { p50Ms: 14000 },
  prereqs: [{ kind: "requires", to: SKILL_ADD_SIGNED }],
  difficulty: { b: b(155n), levels: [b(190n), b(215n), b(265n)] },
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: SIGNED_INT_FAMILY,
    familyRev: SIGNED_INT_FAMILY_REV,
    params: [signed("sub", 10, "first"), signed("sub", 12, "second"), signed("sub", 20, "both")],
    forms: [SIGNED_FORM],
    minVariants: 90,
    closedFactSet: [100, 144, 400],
    consumes: [CAP_SIGNED_SUM],
  },
  probes: [
    { level: 1, seed: 1, purpose: "entry" },
    { level: 2, seed: 2, purpose: "promotion" },
  ],
  provides: [],
  standards: { ccss: ["7.NS.A.1"] },
};

const multiplySigned: SkillNode = {
  id: SKILL_MULTIPLY_SIGNED,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.int.arith.multiply-signed.title"),
  learnerGoal: locKey("dw.skill.int.arith.multiply-signed.goal"),
  domain: "int",
  cluster: "arith",
  bigIdeas: [
    locKey("dw.idea.number.a-number-carries-a-direction"),
    locKey("dw.idea.multiplication.equal-groups"),
  ],
  gradeBand: { earliest: 6, nominal: 7, latest: 7 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 2, strategic: 2, adaptive: 2 },
  classification: "procedural",
  // Twelve: a table fact, and then one decision that is a rule rather than a
  // comparison. Below its subtraction sibling on purpose — see the coefficients.
  fluencyTarget: { p50Ms: 12000 },
  prereqs: [
    { kind: "requires", to: SKILL_ADD_SIGNED },
    { kind: "requires", to: SKILL_TABLES_TO_TWELVE },
  ],
  difficulty: { b: b(170n), levels: [b(195n), b(225n), b(235n)] },
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: SIGNED_INT_FAMILY,
    familyRev: SIGNED_INT_FAMILY_REV,
    params: [signed("mul", 9, "first"), signed("mul", 12, "second"), signed("mul", 12, "both")],
    forms: [SIGNED_FORM],
    minVariants: 72,
    closedFactSet: [81, 144, 144],
    consumes: [CAP_SIGNED_SUM, CAP_TABLES_TO_TWELVE],
  },
  probes: [
    { level: 0, seed: 1, purpose: "entry" },
    { level: 2, seed: 2, purpose: "promotion" },
  ],
  provides: [],
  standards: { ccss: ["7.NS.A.2"] },
};

export const intDomainNodes: readonly SkillNode[] = [
  subtractPastZero,
  addSigned,
  subtractSigned,
  multiplySigned,
];
