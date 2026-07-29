/**
 * Domain `mul` — multiplication, from `0 × 1` to `48,826 × 82,726`.
 *
 * Two clusters and two generator families, in one ladder, on the same shape the
 * `add` domain took: `facts` binds `gen.arith.times-table` and holds the recalled
 * tables a child needs before any written multiplication means anything, and
 * `multidigit` binds `gen.arith.multidigit-mul` and holds the algorithm. The
 * capability tags below are what make that a mechanical fact rather than an
 * editorial ordering — `472 × 6` *is* `2 × 6` and `7 × 6` inside a procedure, so
 * the column rows consume the fact rows and CG-6 names the missing edge if anyone
 * cuts one.
 *
 * **The fact rows were the hole this domain shipped with.** CURRICULUM.md gives
 * `mul` ten fact-recall skills and there were none, on the argument that a table
 * has at most 144 problems in the world and CG-10's floor is 975 — so the floor and
 * the content were in conflict and the conflict was left open. That reconciliation
 * arrived with the addition floor: `GeneratorBinding.closedFactSet` replaces the
 * floor for a level whose problem space is closed, with a *sharper* check in its
 * place (the gate fails when the generator reaches a problem the row says does not
 * exist). There are one hundred and twenty-one multiplications in the tables to
 * twelve, there is no hundred-and-twenty-second, and a floor derived from a model
 * of generators that do not close was never a statement about them.
 *
 * **Four of these six rows are now `active`, and what was blocking them was a plus
 * sign.** They shipped `draft` with finished generators, fact floors and variant
 * spaces, held back by the one thing that draws a multiplication *question*: the
 * shipped host guessed the operator from the shape of the prompt key and wrote
 * every item it could not recognise with a plus, so `dw.mul.facts.tables-to-twelve`
 * reached a child as `5 + 7` with 35 as the answer. It reads
 * `promptOperator(key)` out of `render/prompts.ts` now, which is why those four
 * rows are a `status` flip and nothing else — no generator here changed.
 *
 * **The other two are held by something no gate had ever needed to check: how wide
 * a numeral a game can print.** `dw.mul.scale.times-power-of-ten` and
 * `dw.mul.multidigit.long-multiplication` reach nine and ten characters, and
 * `games/polarity` refuses an answer past eight — its own sweep of the shipping
 * ladder went red on `544,080,000` the moment they went active, which is that gate
 * working. See `NUMERAL_WIDTH_BLOCKED_LEVELS` in `promotionBlockers.ts`: the rows
 * are right and the ceiling is the program's stated one. What is missing is on the
 * pack's side, and `packs/sdk` already has the seam — a pack that can print eight
 * characters caps its stream with `next({ maxDifficulty })` and gets the part of
 * the ladder it can draw.
 */

import { rational } from "../../math/rational.ts";
import type { MultidigitMulParams } from "../../generators/multidigitMul/params.ts";
import {
  FORM_FREE_ENTRY as MUL_FORM,
  MULTIDIGIT_MUL_FAMILY,
  MULTIDIGIT_MUL_FAMILY_REV,
} from "../../generators/multidigitMul/constants.ts";
import {
  FORM_FREE_ENTRY as TABLE_FORM,
  TIMES_TABLE_FAMILY,
  TIMES_TABLE_FAMILY_REV,
} from "../../generators/timesTable/constants.ts";
import type { TimesTableParams } from "../../generators/timesTable/params.ts";
import {
  MIS_CARRY_ADDED_BEFORE_MULTIPLYING,
  MIS_FORGOT_THE_SHIFT,
  MIS_PARTIAL_PRODUCT_MISALIGNED,
} from "../../malrules/multidigitMul.ts";
import { CAP_SUMS_ACROSS_TEN, SKILL_ADD_ACROSS_TEN } from "./add.ts";
import { capabilityTag, locKey, skillId } from "../../types/ids.ts";
import type { SkillNode } from "../../types/skill.ts";

export const CAP_MUL_ONE_DIGIT = capabilityTag("cap.mul.by-one-digit");
export const CAP_MUL_MULTIDIGIT = capabilityTag("cap.mul.multidigit");

/**
 * The two fact capabilities, and why they are not decoration.
 *
 * A single-digit pass of the written algorithm is a table fact and a carry: the
 * units column of `472 × 6` is `2 × 6`, and the tens column is `7 × 6` plus what
 * came out of the units. So `dw.mul.multidigit.*` does not merely *follow* the
 * tables in some editorial ordering — it consumes them, and CG-6 fails on a graph
 * that forgets to say so. The split at five is where the tables stop being the
 * small ones a second grader meets and start being the ones England mandates by Y4.
 */
export const CAP_TABLES_WITHIN_FIVE = capabilityTag("cap.mul.tables-within-five");
export const CAP_TABLES_TO_TWELVE = capabilityTag("cap.mul.tables-to-twelve");

function b(hundredths: bigint) {
  return rational(hundredths, 100n);
}

/** Written out so the fact level tables below read as tables. */
function table(maxFactor: number, includeTrivial = false): TimesTableParams {
  return { op: "mul", maxFactor, includeTrivial };
}

function times(digits: number, multiplierDigits: number, carries: boolean): MultidigitMulParams {
  return { shape: "general", digits, multiplierDigits, carries };
}

function powerOfTen(digits: number, maxPower: number): MultidigitMulParams {
  return { shape: "power-of-ten", digits, maxPower };
}

export const SKILL_TABLES_WITHIN_FIVE = skillId("dw.mul.facts.tables-within-five");
export const SKILL_TABLES_TO_TWELVE = skillId("dw.mul.facts.tables-to-twelve");
export const SKILL_TIMES_POWER_OF_TEN = skillId("dw.mul.scale.times-power-of-ten");
export const SKILL_TIMES_ONE_DIGIT = skillId("dw.mul.multidigit.times-one-digit");
export const SKILL_TIMES_TWO_DIGIT = skillId("dw.mul.multidigit.times-two-digit");
export const SKILL_LONG_MULTIPLICATION = skillId("dw.mul.multidigit.long-multiplication");

/**
 * ## The two fact rows: the bottom of the multiplicative strand
 *
 * Before these, the easiest thing this domain could offer was `472 × 6` — a
 * three-digit carrying multiplication — and there was nothing underneath it at
 * all. A child who cannot recall `7 × 6` cannot do that item however well they
 * align, and had nowhere to go.
 *
 * **Why two rows and not one.** A child fluent in the tables to five is routinely
 * not fluent in the sevens and the eights, and one mastery record for both would
 * report a fluency the child does not have in exactly the tables that are failing.
 * The split is also where the two frameworks disagree: Singapore teaches ×2, ×5
 * and ×10 at P2, CCSS puts all of the tables to ten at grade 3, and England
 * mandates to 12 × 12 by Y4. Splitting at five is what lets one graph serve all
 * three without a grade appearing anywhere except as a label.
 *
 * **`closedFactSet` is what makes them possible.** See `GeneratorBinding` for the
 * argument; the short form is that there are one hundred and twenty-one
 * multiplications in the tables to twelve and no hundred-and-twenty-second, and a
 * variant-space floor derived from a model of generators that do not close was
 * never a statement about a closed one. The numbers below are `factSetSize` of
 * each level's parameters, and `timesTable.test.ts` enumerates each set
 * independently and asserts the generator reaches every member of it and nothing
 * outside it.
 */
const tablesWithinFive: SkillNode = {
  id: SKILL_TABLES_WITHIN_FIVE,
  rev: 1,
  status: "active",
  title: locKey("dw.skill.mul.facts.tables-within-five.title"),
  learnerGoal: locKey("dw.skill.mul.facts.tables-within-five.goal"),
  domain: "mul",
  cluster: "facts",
  bigIdeas: [locKey("dw.idea.multiplication.equal-groups")],
  gradeBand: { earliest: 2, nominal: 3, latest: 4 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 1, strategic: 2, adaptive: 1 },
  classification: "fluency",
  /**
   * Eight seconds, two above the addition facts' six, and the two extra seconds
   * are the skip count. A child at this row who has not yet memorised `4 × 3`
   * reaches it by counting four, eight, twelve — which is the strategy the
   * walkthrough teaches and the strategy the row is *for*. Timing them at the
   * cadence table's one-digit p90 of six seconds would classify the entire
   * intended method as too slow to climb.
   */
  fluencyTarget: { p50Ms: 8000 },
  // Repeated addition is what a first table fact is: `3 × 4` is four and four and
  // four, and the skip count that replaces it crosses ten on its second step.
  prereqs: [{ kind: "requires", to: SKILL_ADD_ACROSS_TEN }],
  // Placed so the strand is continuous rather than parallel: `2 × 2` at −1.20 sits
  // just above the hardest addition fact (`15 − 8`, at −1.25) and just below the
  // easiest column sum (`43 + 25`, at −0.90), and the top of this row is under the
  // easiest written multiplication. A table fact must be below every item that
  // *uses* table facts, which `ladder.test.ts` asserts across the whole strand.
  difficulty: { b: b(-110n), levels: [b(-120n), b(-105n), b(-75n), b(-65n)] },
  misconceptions: [],
  // The array model belongs here and is not claimed: nothing in this repository
  // draws a representation, and a row that declared one `required` today would be
  // a curriculum row the app cannot draw. It is not `optional` either, because
  // this family does not emit a rep spec at all — see `timesTable/family.ts`.
  representations: { required: [], optional: [] },
  generator: {
    family: TIMES_TABLE_FAMILY,
    familyRev: TIMES_TABLE_FAMILY_REV,
    // The twos, the threes, the whole of the tables to five, and then the same
    // range with the zero and identity facts taken away.
    params: [table(2, true), table(3, true), table(5, true), table(5)],
    forms: [TABLE_FORM],
    // Eight: level 0's whole set. `minVariants` counts distinct items *in a
    // sample*, so on a closed set it can never assert more than the sample makes
    // reachable; the assertion that matters is the closure test.
    minVariants: 8,
    closedFactSet: [8, 15, 35, 16],
    consumes: [CAP_SUMS_ACROSS_TEN],
  },
  probes: [
    { level: 0, seed: 1, purpose: "entry" },
    { level: 3, seed: 2, purpose: "promotion" },
  ],
  provides: [CAP_TABLES_WITHIN_FIVE],
  standards: { ccss: ["3.OA.A.1", "3.OA.B.5", "3.OA.C.7"], sg: ["P2-MD-1"] },
};

const tablesToTwelve: SkillNode = {
  id: SKILL_TABLES_TO_TWELVE,
  rev: 1,
  status: "active",
  title: locKey("dw.skill.mul.facts.tables-to-twelve.title"),
  learnerGoal: locKey("dw.skill.mul.facts.tables-to-twelve.goal"),
  domain: "mul",
  cluster: "facts",
  bigIdeas: [locKey("dw.idea.multiplication.equal-groups")],
  gradeBand: { earliest: 3, nominal: 4, latest: 5 },
  strandRole: "spine",
  proficiency: { conceptual: 1, procedural: 1, strategic: 2, adaptive: 1 },
  classification: "fluency",
  // Nine, one above its sibling: the same skip count, over more steps of a larger
  // number. Nothing in the cadence table reaches a one-digit question that takes
  // this long, which is the whole reason the field is read at all.
  fluencyTarget: { p50Ms: 9000 },
  prereqs: [{ kind: "requires", to: SKILL_TABLES_WITHIN_FIVE }],
  difficulty: { b: b(-135n), levels: [b(-60n), b(-30n), b(15n)] },
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: TIMES_TABLE_FAMILY,
    familyRev: TIMES_TABLE_FAMILY_REV,
    params: [table(7), table(9), table(12)],
    forms: [TABLE_FORM],
    minVariants: 32,
    closedFactSet: [36, 64, 121],
    consumes: [CAP_TABLES_WITHIN_FIVE],
  },
  probes: [
    { level: 0, seed: 1, purpose: "entry" },
    { level: 2, seed: 2, purpose: "promotion" },
  ],
  provides: [CAP_TABLES_TO_TWELVE],
  standards: { ccss: ["3.OA.C.7"], uk: ["Y4-MD-1"] },
};

const timesPowerOfTen: SkillNode = {
  id: SKILL_TIMES_POWER_OF_TEN,
  /**
   * rev 2: the level table starts a digit wider and reaches a power further.
   *
   * `powerOfTen(2, 1)` was two-digit multiplicands times ten — ninety problems in
   * the world, against CG-10's floor of 975, and the row could not be promoted
   * while it was the entry level. It is not a closed fact set: the bound is a digit
   * count that could be widened at any time and nothing about the content asks for
   * it to be ninety, which is exactly the case `GeneratorBinding.closedFactSet`
   * forbids declaring. So the level was widened instead, which is the resolution
   * the gate was asking for. `472 × 100` is the same skill `47 × 100` was.
   */
  rev: 2,
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
  prereqs: [{ kind: "requires", to: SKILL_TABLES_WITHIN_FIVE }],
  difficulty: { b: b(-40n), levels: [b(-45n), b(-15n), b(15n)] },
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
    params: [powerOfTen(3, 2), powerOfTen(4, 3), powerOfTen(5, 4)],
    forms: [MUL_FORM],
    minVariants: 60,
    consumes: [CAP_TABLES_WITHIN_FIVE],
  },
  probes: [{ level: 0, seed: 1, purpose: "entry" }],
  provides: [],
  standards: { ccss: ["4.NBT.A.1", "5.NBT.A.2"] },
};

const timesOneDigit: SkillNode = {
  id: SKILL_TIMES_ONE_DIGIT,
  /**
   * rev 2: gained the two prerequisites it always had and never declared. Each
   * single-digit pass of `472 × 6` is a table fact, and the carry out of it is a
   * sum across ten — so a child without either cannot do this row however well
   * they set it out. Before the fact rows existed there was nothing to declare;
   * the row sat at the bottom of its own domain with no floor under it.
   */
  rev: 2,
  status: "active",
  title: locKey("dw.skill.mul.multidigit.times-one-digit.title"),
  learnerGoal: locKey("dw.skill.mul.multidigit.times-one-digit.goal"),
  domain: "mul",
  cluster: "multidigit",
  bigIdeas: [locKey("dw.idea.place-value.regroup"), locKey("dw.idea.multiplication.equal-groups")],
  gradeBand: { earliest: 3, nominal: 4, latest: 5 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 3, strategic: 1, adaptive: 1 },
  classification: "procedural",
  /**
   * Fifteen seconds, kept as authored, and now with a reason on it.
   *
   * The number is read by the host's climb rule, which takes the wider of the
   * cadence table's p90 at the item's width and 2.5× this median. The table was
   * measured on column *addition*, where a three-digit item is three sums; a
   * three-digit multiplication is three products, three carries and three sums,
   * and the table's 27 s window at that width would refuse to promote a child who
   * did the whole of `472 × 6` correctly in half a minute. Fifteen seconds is the
   * row's median across its three levels — L2 is a five-digit multiplicand, where
   * the table already dominates — so the declared number binds only at width three,
   * where it widens 27 s to 37.5 s.
   */
  fluencyTarget: { p50Ms: 15000 },
  prereqs: [
    { kind: "requires", to: SKILL_TABLES_TO_TWELVE },
    { kind: "requires", to: SKILL_ADD_ACROSS_TEN },
  ],
  difficulty: { b: b(-30n), levels: [b(25n), b(55n), b(85n)] },
  misconceptions: [MIS_CARRY_ADDED_BEFORE_MULTIPLYING],
  representations: { required: [], optional: [] },
  generator: {
    family: MULTIDIGIT_MUL_FAMILY,
    familyRev: MULTIDIGIT_MUL_FAMILY_REV,
    params: [times(3, 1, true), times(4, 1, true), times(5, 1, true)],
    forms: [MUL_FORM],
    minVariants: 80,
    consumes: [CAP_TABLES_TO_TWELVE, CAP_SUMS_ACROSS_TEN],
  },
  probes: [{ level: 0, seed: 1, purpose: "entry" }],
  provides: [CAP_MUL_ONE_DIGIT],
  standards: { ccss: ["4.NBT.B.5"], uk: ["Y4-MD-2"] },
};

const timesTwoDigit: SkillNode = {
  id: SKILL_TIMES_TWO_DIGIT,
  rev: 1,
  status: "active",
  title: locKey("dw.skill.mul.multidigit.times-two-digit.title"),
  learnerGoal: locKey("dw.skill.mul.multidigit.times-two-digit.goal"),
  domain: "mul",
  cluster: "multidigit",
  bigIdeas: [locKey("dw.idea.place-value.regroup"), locKey("dw.idea.multiplication.partial-products")],
  gradeBand: { earliest: 4, nominal: 5, latest: 5 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 3, strategic: 2, adaptive: 2 },
  classification: "procedural",
  /**
   * Twenty-five seconds, and this row is the one the field exists for.
   *
   * `47 × 23` is two digits wide, and the cadence table — measured on two-digit
   * column *addition* — gives a two-digit item a 14 s window. The item is two
   * partial products, four table facts, four carries and a three-digit sum. A
   * child who writes all of that correctly in twenty seconds is fluent and would
   * never climb: the window would be narrower than the work. Declaring 25 s widens
   * it to 62.5 s, which is the slow tail of a 25 s median rather than a target.
   */
  fluencyTarget: { p50Ms: 25000 },
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

/**
 * The top of the domain: every partial product, at the widths the program says it
 * reaches.
 *
 * A separate row from `times-two-digit` and not three more levels of it, because
 * what a child is doing changes: at two partial products the sum at the bottom is
 * an addition they already have, and at five it is a five-addend column addition
 * that is its own source of error. The row's own name is the mathematics — long
 * multiplication is every digit of the multiplier against every digit of the
 * multiplicand — and not a width, so widening it later is a level and not a new id.
 *
 * **`48,826 × 82,726` is level 2 of this row.** That number is the program's stated
 * ceiling, and before this row the widest multiplication in the graph was three
 * digits by three: the parameter schema itself stopped at a three-digit multiplier,
 * so the item was not expressible at all rather than merely unauthored.
 */
const longMultiplication: SkillNode = {
  id: SKILL_LONG_MULTIPLICATION,
  rev: 1,
  status: "draft",
  title: locKey("dw.skill.mul.multidigit.long-multiplication.title"),
  learnerGoal: locKey("dw.skill.mul.multidigit.long-multiplication.goal"),
  domain: "mul",
  cluster: "multidigit",
  bigIdeas: [
    locKey("dw.idea.place-value.regroup"),
    locKey("dw.idea.multiplication.partial-products"),
  ],
  gradeBand: { earliest: 5, nominal: 5, latest: 5 },
  strandRole: "fluency",
  proficiency: { conceptual: 2, procedural: 3, strategic: 2, adaptive: 2 },
  classification: "procedural",
  /**
   * Seventy-five seconds, measured against L1 — a five-digit multiplicand and a
   * four-digit multiplier — which is the row's middle level and its median item.
   *
   * This is far outside the cadence table, which stops meaning anything above four
   * digits: at width five it reads 53 s, and `48,826 × 82,726` is five partial
   * products of five digits each and then a five-addend sum. The declared median
   * widens the window to 187 s. That is not a target and nothing paces a child at
   * it; it is the number that stops a correct answer to the hardest item in the
   * program from being classified as a slow one.
   */
  fluencyTarget: { p50Ms: 75000 },
  prereqs: [{ kind: "requires", to: SKILL_TIMES_TWO_DIGIT }],
  difficulty: { b: b(-30n), levels: [b(165n), b(250n), b(305n)] },
  misconceptions: [MIS_PARTIAL_PRODUCT_MISALIGNED],
  representations: { required: [], optional: [] },
  generator: {
    family: MULTIDIGIT_MUL_FAMILY,
    familyRev: MULTIDIGIT_MUL_FAMILY_REV,
    params: [times(4, 3, true), times(5, 4, true), times(5, 5, true)],
    forms: [MUL_FORM],
    minVariants: 80,
    consumes: [CAP_MUL_MULTIDIGIT],
  },
  probes: [{ level: 2, seed: 48826, purpose: "promotion" }],
  provides: [],
  standards: { ccss: ["5.NBT.B.5"] },
};

export const mulDomainNodes: readonly SkillNode[] = [
  tablesWithinFive,
  tablesToTwelve,
  timesPowerOfTen,
  timesOneDigit,
  timesTwoDigit,
  longMultiplication,
];
