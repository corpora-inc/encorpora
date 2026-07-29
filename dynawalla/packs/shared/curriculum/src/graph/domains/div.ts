/**
 * Domain `div` — division, from `0 ÷ 1` to a four-digit quotient over a two-digit
 * divisor, with the remainder taken seriously.
 *
 * Two clusters and two generator families, on the shape `add` and `mul` both take:
 * `facts` binds `gen.arith.times-table` and holds the recalled quotients, `whole`
 * binds `gen.arith.long-div` and holds the algorithm. A long division is a
 * sequence of table facts and subtractions, so the procedure rows consume the fact
 * row and CG-6 names the missing edge if anyone cuts it.
 *
 * The four `whole` rows are the four things a remainder can be asked to be:
 * nothing (the division comes out even), the answer itself, the fraction part of a
 * mixed number, and the thing a dropped zero in the quotient hides.
 *
 * `mis.div.divisor-must-be-smaller` is named in CURRICULUM.md and is deliberately
 * absent — `malrules/longDiv.ts` says why: its home is an item where the divisor is
 * the larger number, and whole-number long division never poses one.
 *
 * **Every row here is still `draft`, and CG-10 is no longer the reason.**
 * `divide-exact` L0 was under the variant-space floor and has been widened past it;
 * what remains is that nothing draws a division *question*. The shipped host writes
 * every item it does not recognise with a plus sign, so `1,548 ÷ 6` would reach a
 * child as `1,548 + 6`. `promotionBlockers.ts` names the templates, and
 * `render/prompts.ts` carries the operator each one is written with.
 */

import { rational } from "../../math/rational.ts";
import type { LongDivParams } from "../../generators/longDiv/params.ts";
import {
  FORM_FREE_ENTRY as DIV_FORM,
  LONG_DIV_FAMILY,
  LONG_DIV_FAMILY_REV,
} from "../../generators/longDiv/constants.ts";
import {
  FORM_FREE_ENTRY as TABLE_FORM,
  TIMES_TABLE_FAMILY,
  TIMES_TABLE_FAMILY_REV,
} from "../../generators/timesTable/constants.ts";
import type { TimesTableParams } from "../../generators/timesTable/params.ts";
import { MIS_QUOTIENT_ZERO_SKIPPED, MIS_REMAINDER_DROPPED } from "../../malrules/longDiv.ts";
import { CAP_MUL_ONE_DIGIT, CAP_TABLES_TO_TWELVE, SKILL_TABLES_TO_TWELVE, SKILL_TIMES_ONE_DIGIT } from "./mul.ts";
import { capabilityTag, locKey, skillId } from "../../types/ids.ts";
import type { SkillNode } from "../../types/skill.ts";

export const CAP_DIV_EXACT = capabilityTag("cap.div.exact");
export const CAP_DIV_REMAINDER = capabilityTag("cap.div.remainder");
/** Recalled quotients — `48 ÷ 6` — which every column of a long division is. */
export const CAP_DIVISION_FACTS = capabilityTag("cap.div.facts");

function b(hundredths: bigint) {
  return rational(hundredths, 100n);
}

/** Written out so the fact level table below reads as a table. */
function quotients(maxFactor: number, includeTrivial = false): TimesTableParams {
  return { op: "div", maxFactor, includeTrivial };
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

export const SKILL_DIVISION_FACTS = skillId("dw.div.facts.division-facts");
export const SKILL_DIVIDE_EXACT = skillId("dw.div.whole.divide-exact");
export const SKILL_DIVIDE_REMAINDER = skillId("dw.div.whole.find-the-remainder");
export const SKILL_QUOTIENT_AND_REMAINDER = skillId("dw.div.whole.quotient-and-remainder");
export const SKILL_ZERO_IN_QUOTIENT = skillId("dw.div.whole.zero-in-the-quotient");

/**
 * The bottom of the division strand: the quotients a child recalls.
 *
 * A separate row from `dw.mul.facts.tables-to-twelve` and not a level of it, for
 * the reason `dw.add.facts.subtract-within-ten` is separate from its addition
 * sibling: a child fluent in the tables is routinely not fluent in the quotients,
 * and one mastery record for both would report a fluency the child does not have
 * in the direction that is actually failing. It binds the same family and draws
 * from the same closed set read backwards, which is what makes "the same fact two
 * ways" a fact about the code rather than a claim in a comment.
 *
 * Level 0 admits the facts one operand decides — `0 ÷ 7`, `7 ÷ 1` — and the levels
 * above it do not. They are the rung a child who has slid all the way down this
 * strand lands on.
 */
const divisionFacts: SkillNode = {
  id: SKILL_DIVISION_FACTS,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.div.facts.division-facts.title"),
  learnerGoal: locKey("dw.skill.div.facts.division-facts.goal"),
  domain: "div",
  cluster: "facts",
  bigIdeas: [
    locKey("dw.idea.division.sharing-and-grouping"),
    locKey("dw.idea.equality.undoing-runs-both-ways"),
  ],
  gradeBand: { earliest: 3, nominal: 4, latest: 5 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 1, strategic: 2, adaptive: 1 },
  classification: "fluency",
  /**
   * Ten seconds, one above the tables it inverts.
   *
   * A child answers `48 ÷ 6` by searching the six times table for forty-eight,
   * which is the strategy the walkthrough teaches and it is a search rather than a
   * recall until the fact is over-learned. The cadence table would give this
   * one-digit-answer item a six-second window and refuse to promote the method.
   */
  fluencyTarget: { p50Ms: 10000 },
  prereqs: [{ kind: "requires", to: SKILL_TABLES_TO_TWELVE }],
  // Above the tables it inverts and below the first long division, so the strand
  // is one climb: `48 ÷ 6` at −0.55 to −0.15, then `516 ÷ 4` at 0.20.
  difficulty: { b: b(-105n), levels: [b(-55n), b(-15n), b(15n)] },
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: TIMES_TABLE_FAMILY,
    familyRev: TIMES_TABLE_FAMILY_REV,
    params: [quotients(5, true), quotients(9), quotients(12)],
    forms: [TABLE_FORM],
    minVariants: 26,
    // 6 × 5, then 8², then 11² — `factSetSize` of each level, pinned from the
    // other side by `timesTable.test.ts`, which enumerates each set independently.
    closedFactSet: [30, 64, 121],
    consumes: [CAP_TABLES_TO_TWELVE],
  },
  probes: [
    { level: 0, seed: 1, purpose: "entry" },
    { level: 2, seed: 2, purpose: "promotion" },
  ],
  provides: [CAP_DIVISION_FACTS],
  standards: { ccss: ["3.OA.C.7", "3.OA.B.6"] },
};

const divideExact: SkillNode = {
  id: SKILL_DIVIDE_EXACT,
  /**
   * rev 2: a wider entry level, and the two prerequisites it always had.
   *
   * L0 was a two-digit quotient over a one-digit divisor — ninety quotients times
   * eight divisors is 720 problems, against CG-10's floor of 975, and the row could
   * not be promoted while that was its entry level. It is not a closed fact set:
   * the bound is a digit count that nothing about the content asks to be two, which
   * is exactly the case `GeneratorBinding.closedFactSet` forbids declaring. So the
   * level was widened to a three-digit quotient, which is the resolution the gate
   * was asking for and 7,200 problems instead.
   *
   * The prerequisites are the mathematics: every column of a long division picks a
   * quotient digit out of a times table and then multiplies it back.
   */
  rev: 2,
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
  /**
   * Eighteen seconds, kept as authored, and now with a reason on it.
   *
   * The host takes the wider of the cadence table's p90 at the item's width and
   * 2.5× this median. A three-digit quotient over a one-digit divisor is three
   * table searches, three multiplications back and three subtractions; the table,
   * measured on column addition, would give the four-digit dividend a 40 s window
   * and the three-digit one 27 s. Eighteen widens both to 45 s. It is the row's
   * median across four levels whose hardest is a four-digit quotient over a
   * two-digit divisor, where every column is a *guess* at the quotient digit.
   */
  fluencyTarget: { p50Ms: 18000 },
  prereqs: [
    { kind: "requires", to: SKILL_DIVISION_FACTS },
    { kind: "requires", to: SKILL_TIMES_ONE_DIGIT },
  ],
  difficulty: { b: b(-40n), levels: [b(20n), b(50n), b(75n), b(105n)] },
  // Nothing is left over, so there is nothing to drop; the interior-zero rule needs
  // a quotient wide enough to hide one, which the last level of this row provides.
  misconceptions: [MIS_QUOTIENT_ZERO_SKIPPED],
  representations: { required: [], optional: [] },
  generator: {
    family: LONG_DIV_FAMILY,
    familyRev: LONG_DIV_FAMILY_REV,
    params: [
      divide("quotient", 3, 1, true),
      divide("quotient", 4, 1, true),
      divide("quotient", 3, 2, true),
      divide("quotient", 4, 2, true),
    ],
    forms: [DIV_FORM],
    minVariants: 80,
    consumes: [CAP_DIVISION_FACTS, CAP_MUL_ONE_DIGIT],
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
  // The same procedure as its prerequisite, so the same median. What is different
  // is the question, not the work: the child divides and then reports what is
  // over instead of what came out.
  fluencyTarget: { p50Ms: 18000 },
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
  // Twenty: the division, and then a mixed number to write. The extra two seconds
  // are the writing, which on this row is part of the answer and not overhead.
  fluencyTarget: { p50Ms: 20000 },
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
  // Twenty: the column where the partial dividend is smaller than the divisor is
  // the one a child stops at, and stopping to think there is the skill.
  fluencyTarget: { p50Ms: 20000 },
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
  divisionFacts,
  divideExact,
  findTheRemainder,
  quotientAndRemainder,
  zeroInTheQuotient,
];
