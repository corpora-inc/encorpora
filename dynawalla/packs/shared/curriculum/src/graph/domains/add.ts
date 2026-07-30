/**
 * Domain `add` — addition and subtraction, from `0 + 1` to `4,003 − 87`.
 *
 * Two clusters and two generator families, in one ladder. `facts` binds
 * `gen.arith.number-facts` and holds the recalled facts a child needs before any
 * column procedure means anything; `column` and `regroup` bind
 * `gen.arith.column-op` and hold the procedure. The fact rows are underneath, and
 * the capability tags below are what make that a mechanical fact rather than an
 * editorial ordering — see the note on them.
 *
 * One `draft` node remains, and it earns its place: it proves draft rows are
 * excluded from the shipped graph and from all coverage math (CG-7).
 *
 * Every id here is final — ids are mastery keys on learner devices and are
 * immutable forever.
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
  FORM_FREE_ENTRY as FACTS_FORM_FREE_ENTRY,
  NUMBER_FACTS_FAMILY,
  NUMBER_FACTS_FAMILY_REV,
} from "../../generators/numberFacts/constants.ts";
import type { NumberFactsParams } from "../../generators/numberFacts/params.ts";
import {
  MIS_BORROW_ACROSS_ZERO,
  MIS_CARRY_DROPPED,
  MIS_SMALLER_FROM_LARGER,
  REP_COUNTING_BOARD,
} from "../../malrules/columnOp.ts";
import { REP_TEN_FRAME } from "../../render/representations.ts";
import { capabilityTag, locKey, skillId } from "../../types/ids.ts";
import type { SkillNode } from "../../types/skill.ts";

const CAP_COLUMN_ALIGN = capabilityTag("cap.arith.column-align");
const CAP_SUB_REGROUP = capabilityTag("cap.arith.sub-regroup");
const CAP_SUB_ACROSS_ZERO = capabilityTag("cap.arith.sub-across-zero");
const CAP_ADD_CARRY = capabilityTag("cap.arith.add-carry");

/**
 * The four fact capabilities, and why they are not decoration.
 *
 * A carry happens exactly when a column sum crosses ten, and a borrow happens
 * exactly when a column difference does. So the column rows do not merely follow
 * the fact rows in some editorial ordering — they *consume* them, and CG-6 will
 * name the missing edge if anyone ever cuts one. This is the mechanism that makes
 * the ladder from `0 + 1` to `4003 − 87` continuous rather than asserted.
 */
const CAP_SUMS_WITHIN_TEN = capabilityTag("cap.arith.sums-within-ten");
/**
 * Exported alongside `CAP_SUMS_ACROSS_TEN`, and for the same kind of reason: the
 * equality strand consumes it. `dw.alg.equality.missing-addend` recovers the box in
 * `47 + □ = 68` by taking one number from the other, so a missing addend within ten
 * *is* a difference within ten, and `domains/alg.ts` says so rather than implying it.
 */
export const CAP_DIFFERENCES_WITHIN_TEN = capabilityTag("cap.arith.differences-within-ten");
/**
 * Exported, unlike its three siblings, because the multiplicative strand consumes
 * it: a carry out of a single-digit multiplication pass is a sum across ten, and
 * `dw.mul.multidigit.times-one-digit` says so rather than implying it.
 */
export const CAP_SUMS_ACROSS_TEN = capabilityTag("cap.arith.sums-across-ten");
/**
 * Exported for the same reason as its sibling above: the integer strand consumes
 * it. `3 − 9` is answered by taking three from nine and writing a minus in front,
 * and a child without the difference cannot reach the sign.
 */
export const CAP_DIFFERENCES_ACROSS_TEN = capabilityTag("cap.arith.differences-across-ten");

/** Written out so the fact level tables below read as tables. */
function fact(
  op: "add" | "sub",
  maxTotal: number,
  options: { crossesTen?: boolean; includeZero?: boolean; picture?: boolean } = {},
): NumberFactsParams {
  return {
    op,
    maxTotal,
    crossesTen: options.crossesTen ?? false,
    includeZero: options.includeZero ?? false,
    picture: options.picture ?? false,
  };
}

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

export const SKILL_ADD_WITHIN_TEN = skillId("dw.add.facts.add-within-ten");
export const SKILL_SUBTRACT_WITHIN_TEN = skillId("dw.add.facts.subtract-within-ten");
export const SKILL_ADD_ACROSS_TEN = skillId("dw.add.facts.add-across-ten");
export const SKILL_SUBTRACT_ACROSS_TEN = skillId("dw.add.facts.subtract-across-ten");

export const SKILL_ADD_NO_REGROUP = skillId("dw.add.column.add-no-regroup");
export const SKILL_SUBTRACT_NO_REGROUP = skillId("dw.add.column.subtract-no-regroup");
export const SKILL_ADD_SHORT_ADDEND = skillId("dw.add.regroup.add-short-addend");
export const SKILL_SUBTRACT_SHORT_SUBTRAHEND = skillId("dw.add.regroup.subtract-short-subtrahend");
export const SKILL_SUBTRACT_MULTIDIGIT = skillId("dw.add.regroup.subtract-multidigit");
export const SKILL_SUBTRACT_ACROSS_ZERO = skillId("dw.add.regroup.subtract-across-zero");
export const SKILL_ADD_MULTIDIGIT = skillId("dw.add.regroup.add-multidigit");
export const SKILL_SUBTRACT_TENTHS = skillId("dw.add.regroup.subtract-tenths");

/**
 * ## The four fact rows: the bottom of the graph
 *
 * Before these, the easiest thing this program could give a child was
 * `plus(2, 2, 0)` — a two-digit sum. There was no first grade in the curriculum
 * at all, and a five-year-old opening the product met second-grade column
 * arithmetic on the first card.
 *
 * Four rows, and each one is here because something specific is missing without
 * it. Two candidates were considered and cut, and they are named below the rows
 * so that the next person does not re-propose them.
 *
 * **Why they are `active` and not `draft`.** Every other draft row in this graph
 * waits on a statement renderer that no pack has landed, and so do these: CG-8
 * warns on all of them and fails under `--strict-renderers`, which is unchanged.
 * What is different is that these rows are the *floor of every game's difficulty
 * range*. An adaptive controller that walks down when a child struggles walks
 * down through `activeNodes`, and a draft row is not in it — so a struggling
 * second grader slides to `43 + 25` and stops there, which is the exact failure
 * this change exists to fix. A row nobody can draw is a warning; a floor that is
 * not the floor is a child stuck.
 *
 * ## rev 2: "easy" means `4 + 5`, not the nine smallest facts
 *
 * These rows shipped with the sum ceiling as the ramp — `maxTotal` 3, then 5,
 * then 10, then 10 without the identities — and level 0 of that ramp is
 * `{0..3}²` minus `0 + 0`. **Nine problems**, every operand 0, 1, 2 or 3. The
 * founder played four different games for an hour and reported the same thing
 * from each of them:
 *
 * > "easy also means 4+5 not just 2+0 over and over again for an hour."
 *
 * He is right, and the brief that produced the nine-item level is the thing that
 * was wrong. It asked for the trivial identities and said not to skip them —
 * which was correct — and the level table answered by making them *the whole
 * floor*. `4 + 5` was not reachable at the bottom of this product. Neither was
 * `6 + 3`, `7 + 2` or `5 + 5`.
 *
 * **What replaces it, and why the sum ceiling is the wrong ramp.** The ramp is
 * now the *scaffold* coming away, over the whole within-ten table at every rung:
 *
 * | level | set | what changes |
 * |---|---|---|
 * | L0 | 65 | every sum within ten, identities in, drawn in a ten-frame |
 * | L1 | 45 | the frame stays, the identities come out |
 * | L2 | 45 | numerals alone |
 *
 * The argument is `numberFacts/constants.ts`, unchanged and load-bearing: the
 * range coefficient is **0.05 per unit** and the frame is **−0.35**, so the
 * whole distance from `2 + 1` to `9 + 1` is 0.35 logits — exactly what the drawn
 * frame is worth by itself. The frame, not the size of the numbers, is what
 * makes the floor easy: with ten counters on the screen `7 + 2` is the same act
 * as `2 + 1`. Spending the two easiest rungs on a knob the difficulty function
 * prices at a twentieth of a logit per step is what produced a nine-item floor,
 * and it bought no gradation worth having.
 *
 * **The identities are still here, and they are still reachable.** Twenty of
 * level 0's sixty-five facts have a zero in them, and twenty of
 * `subtract-within-ten` L0's sixty-five are `n − 0` or `n − n`. A child on the
 * bottom rung meets one about every third question — a first taste rather than
 * the whole meal — and `numberFacts.test.ts` names `0 + 1`, `1 + 0`, `n − 0` and
 * `n − n` individually so that dropping `includeZero`, which is one word, fails.
 * Nothing about the floor is made harder to look more respectable; it is made
 * *wider*, which is a different thing.
 *
 * **The crossing rows widened for the same reason.** `add-across-ten` L0 was
 * sums to twelve — fifteen facts — and is now sums to fourteen, which is
 * twenty-six. Still every one of them a first bridge just past ten; eleven more
 * sums in the set and a rung that is a session rather than a loop.
 *
 * **What this costs, stated rather than glossed.** A child whose written
 * curriculum is CCSS K.OA.A.5 — "within 5" — now meets sums to ten on the bottom
 * rung, where before they met sums to three and then to five. The trade is
 * deliberate and the frame is what pays for it: within-five facts are still 20 of
 * the 65 and still drawn, the counters are on the screen for all of them, and the
 * alternative was a rung a five-year-old exhausts in nine questions and then
 * repeats for an hour. A within-five band, if one is ever wanted, is a **ceiling a
 * pack asks for** — `next({ maxDifficulty })`, which `packs/sdk` already has and
 * `polarity` already uses — and not a narrower floor for every child in the
 * product.
 *
 * **The one gap that is honest and not filled.** Sorted, the twelve fact levels
 * run −3.00, −2.90, −2.85, −2.75, −2.55, −2.40, then −1.60, −1.55, −1.50, −1.45,
 * −1.40, −1.35, and the easiest column item is −0.90. Every step is 0.05 to 0.20
 * except one: **0.80, between −2.40 and −1.60**, where the ladder leaves ten
 * behind. That is not an authoring oversight. Crossing ten *is* the discontinuity
 * of first-grade arithmetic, and the coefficient that produces the step is
 * column-op's regrouping coefficient reused unchanged, on the argument that
 * crossing ten and regrouping are one phenomenon measured twice. A row invented
 * to sit in the gap would be a row with no mathematics of its own. It is wider
 * than it was because the rungs on both sides of it moved inward onto their own
 * widest honest sets, which is the change; the gap itself is the same
 * discontinuity it always was.
 */
const addWithinTen: SkillNode = {
  id: SKILL_ADD_WITHIN_TEN,
  /**
   * rev 2: the level table. Four rungs ramped by sum ceiling became three ramped
   * by scaffold, and the floor went from nine problems to sixty-five.
   *
   * **Why a `rev` on a live id and not a new id.** The rule is that changing what
   * a skill *teaches* is a new skill, because a mastery record keyed on the id
   * would silently change meaning. This row still teaches addition within ten —
   * that was always its whole set; the level table only chose which slice of it
   * each rung served. And the durable state that would have been at risk does not
   * exist yet: `@dynawalla/engine` is unwired (`dynawalla-app/src/learner/
   * record.ts`), the host stores two integers, and the ladder position is
   * session-scoped. There is no `FactKey` of the form `skill:…#L3#free-entry` on
   * any device to orphan. If there were, this would be a new id.
   */
  rev: 2,
  status: "active",
  title: locKey("dw.skill.add.facts.add-within-ten.title"),
  learnerGoal: locKey("dw.skill.add.facts.add-within-ten.goal"),
  domain: "add",
  cluster: "facts",
  bigIdeas: [locKey("dw.idea.number.counting-tells-how-many")],
  // Grade 0 is kindergarten. `earliest` is what the coverage matrix reads and the
  // scheduler reads nothing at all: readiness is the prerequisite graph, and this
  // row has no prerequisites, so it is the entry point at any age.
  gradeBand: { earliest: 0, nominal: 0, latest: 2 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 1, strategic: 1, adaptive: 0 },
  classification: "fluency",
  fluencyTarget: { p50Ms: 6000 },
  prereqs: [],
  // b = −2.90, so L0 still lands on exactly −3.00: the bottom of the ladder does
  // not move, only what stands on it. Every rung above is measured from the same
  // origin it always was.
  difficulty: { b: b(-290n), levels: [b(-300n), b(-290n), b(-255n)] },
  misconceptions: [],
  // Optional and not required, on the same terms as every other row in this file:
  // no pack draws a representation yet, and a row that declared one `required`
  // today would be a curriculum row the app cannot draw. The generator emits the
  // spec on the first two levels regardless, so the picture arrives with the
  // renderer rather than after a second authoring pass.
  representations: { required: [], optional: [REP_TEN_FRAME] },
  generator: {
    family: NUMBER_FACTS_FAMILY,
    familyRev: NUMBER_FACTS_FAMILY_REV,
    // The whole within-ten table on every rung. What comes away is the scaffold:
    // the frame with the identities, then the frame, then nothing. See the note
    // above for why the sum ceiling is not the ramp.
    params: [
      fact("add", 10, { includeZero: true, picture: true }),
      fact("add", 10, { picture: true }),
      fact("add", 10),
    ],
    forms: [FACTS_FORM_FREE_ENTRY],
    // Twenty-four. `minVariants` counts distinct items *in a sample*, so it is
    // bounded by the sample and not by the mathematics: the smallest gate sample
    // is forty seeds, which reaches 31 of L0's 65 and 25 of L1's and L2's 45. It
    // is also the floor `MIN_RUNG_VARIANTS` states for a rung, so a level table
    // narrowed back towards nine fails here as well as there. The assertion that
    // matters is in `numberFacts.test.ts` — it enumerates each level's set from
    // the level's stated rules and checks the generator reaches every member.
    minVariants: 24,
    closedFactSet: [65, 45, 45],
    consumes: [],
  },
  probes: [
    { level: 0, seed: 1, purpose: "entry" },
    { level: 2, seed: 2, purpose: "promotion" },
  ],
  provides: [CAP_SUMS_WITHIN_TEN],
  standards: { ccss: ["K.OA.A.5", "1.OA.C.6"] },
};

const subtractWithinTen: SkillNode = {
  id: SKILL_SUBTRACT_WITHIN_TEN,
  /** rev 2: the same re-levelling as its addition sibling, for the same reason. */
  rev: 2,
  status: "active",
  title: locKey("dw.skill.add.facts.subtract-within-ten.title"),
  learnerGoal: locKey("dw.skill.add.facts.subtract-within-ten.goal"),
  domain: "add",
  cluster: "facts",
  bigIdeas: [
    locKey("dw.idea.number.counting-tells-how-many"),
    locKey("dw.idea.equality.undoing-runs-both-ways"),
  ],
  gradeBand: { earliest: 0, nominal: 1, latest: 2 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 1, strategic: 1, adaptive: 0 },
  classification: "fluency",
  fluencyTarget: { p50Ms: 6000 },
  // A separate row and not a level of its sibling: a child fluent in sums within
  // ten is routinely not fluent in the differences, and one mastery record for
  // both would report a fluency the child does not have in the direction that is
  // actually failing.
  prereqs: [{ kind: "requires", to: SKILL_ADD_WITHIN_TEN }],
  // b = −2.90, the same anchor as its sibling; the +0.15 subtraction term is what
  // puts L0 at −2.85 rather than −3.00, exactly as before.
  difficulty: { b: b(-290n), levels: [b(-285n), b(-275n), b(-240n)] },
  misconceptions: [],
  representations: { required: [], optional: [REP_TEN_FRAME] },
  generator: {
    family: NUMBER_FACTS_FAMILY,
    familyRev: NUMBER_FACTS_FAMILY_REV,
    params: [
      fact("sub", 10, { includeZero: true, picture: true }),
      fact("sub", 10, { picture: true }),
      fact("sub", 10),
    ],
    forms: [FACTS_FORM_FREE_ENTRY],
    minVariants: 24,
    closedFactSet: [65, 45, 45],
    consumes: [CAP_SUMS_WITHIN_TEN],
  },
  probes: [
    { level: 0, seed: 1, purpose: "entry" },
    { level: 2, seed: 2, purpose: "promotion" },
  ],
  provides: [CAP_DIFFERENCES_WITHIN_TEN],
  standards: { ccss: ["K.OA.A.5", "1.OA.C.6"] },
};

const addAcrossTen: SkillNode = {
  id: SKILL_ADD_ACROSS_TEN,
  /**
   * rev 2: L0 was sums to twelve, which is fifteen facts in the world — a rung a
   * forty-question sitting walks around nearly three times. Sums to fourteen is
   * twenty-six, and every one of them is still a first bridge just past ten.
   */
  rev: 2,
  status: "active",
  title: locKey("dw.skill.add.facts.add-across-ten.title"),
  learnerGoal: locKey("dw.skill.add.facts.add-across-ten.goal"),
  domain: "add",
  cluster: "facts",
  bigIdeas: [locKey("dw.idea.number.ten-is-a-landmark")],
  gradeBand: { earliest: 1, nominal: 1, latest: 3 },
  strandRole: "spine",
  // Strategic rather than procedural: the level table is a range of sums, and the
  // thing being learned is the bridge through ten, not a sequence of steps.
  proficiency: { conceptual: 2, procedural: 1, strategic: 2, adaptive: 1 },
  classification: "fluency",
  fluencyTarget: { p50Ms: 8000 },
  prereqs: [{ kind: "requires", to: SKILL_ADD_WITHIN_TEN }],
  // b = −2.70, so L0 still lands on exactly −1.60 and nothing above it moves.
  difficulty: { b: b(-270n), levels: [b(-160n), b(-150n), b(-140n)] },
  misconceptions: [],
  // No frame: a sum past ten does not fit in one, and by this row the numerals
  // are the thing being read. The picture is a scaffold for cardinality, not a
  // decoration to carry up the ladder.
  representations: { required: [], optional: [] },
  generator: {
    family: NUMBER_FACTS_FAMILY,
    familyRev: NUMBER_FACTS_FAMILY_REV,
    params: [
      fact("add", 14, { crossesTen: true }),
      fact("add", 16, { crossesTen: true }),
      fact("add", 18, { crossesTen: true }),
    ],
    forms: [FACTS_FORM_FREE_ENTRY],
    // Twenty, which is what a forty-seed sample reaches of level 0's twenty-six.
    // See the note on the within-ten rows: on a closed set this number is bounded
    // by the sample, not by the mathematics.
    minVariants: 20,
    closedFactSet: [26, 33, 36],
    consumes: [CAP_SUMS_WITHIN_TEN],
  },
  probes: [
    { level: 0, seed: 1, purpose: "entry" },
    { level: 2, seed: 2, purpose: "promotion" },
  ],
  provides: [CAP_SUMS_ACROSS_TEN],
  standards: { ccss: ["1.OA.C.6", "2.OA.B.2"] },
};

const subtractAcrossTen: SkillNode = {
  id: SKILL_SUBTRACT_ACROSS_TEN,
  /** rev 2: the same widening as its addition sibling, for the same reason. */
  rev: 2,
  status: "active",
  title: locKey("dw.skill.add.facts.subtract-across-ten.title"),
  learnerGoal: locKey("dw.skill.add.facts.subtract-across-ten.goal"),
  domain: "add",
  cluster: "facts",
  bigIdeas: [
    locKey("dw.idea.number.ten-is-a-landmark"),
    locKey("dw.idea.equality.undoing-runs-both-ways"),
  ],
  gradeBand: { earliest: 1, nominal: 1, latest: 3 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 1, strategic: 2, adaptive: 1 },
  classification: "fluency",
  fluencyTarget: { p50Ms: 8000 },
  // Two prerequisites because `15 − 8` is reached two ways and both are taught:
  // down through ten from the difference side, and as the addition fact `8 + 7`
  // read backwards. Cutting either edge would leave a child who has only one of
  // them eligible for a row they cannot get into.
  prereqs: [
    { kind: "requires", to: SKILL_SUBTRACT_WITHIN_TEN },
    { kind: "requires", to: SKILL_ADD_ACROSS_TEN },
  ],
  // b = −2.80, so L0 still lands on exactly −1.55 and nothing above it moves.
  difficulty: { b: b(-280n), levels: [b(-155n), b(-145n), b(-135n)] },
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: NUMBER_FACTS_FAMILY,
    familyRev: NUMBER_FACTS_FAMILY_REV,
    params: [
      fact("sub", 14, { crossesTen: true }),
      fact("sub", 16, { crossesTen: true }),
      fact("sub", 18, { crossesTen: true }),
    ],
    forms: [FACTS_FORM_FREE_ENTRY],
    // Twenty-two, which is what a forty-seed sample reaches of level 0's
    // twenty-six. See the note on the within-ten rows: on a closed set this
    // number is bounded by the sample, not by the mathematics.
    minVariants: 22,
    closedFactSet: [26, 33, 36],
    consumes: [CAP_DIFFERENCES_WITHIN_TEN, CAP_SUMS_ACROSS_TEN],
  },
  probes: [
    { level: 0, seed: 1, purpose: "entry" },
    { level: 2, seed: 2, purpose: "promotion" },
  ],
  provides: [CAP_DIFFERENCES_ACROSS_TEN],
  standards: { ccss: ["1.OA.C.6", "2.OA.B.2"] },
};

/**
 * ## Two rows that were considered and are deliberately absent
 *
 * **Doubles (`7 + 7`, `8 + 8`).** A real anchor strategy, and not a row: there
 * are nine doubles in the world and five of them cross ten, so a doubles level
 * would be a five-item set carved out of `add-across-ten`. What doubles are for
 * is anchoring the neighbours — `7 + 8` from `7 + 7` — and that is a *hint*, which
 * belongs in the walkthrough of the row that already contains both facts.
 *
 * **Make-ten (`7 + 3`, `6 + 4`).** As a result-unknown question, `7 + 3` is
 * already an item of `add-within-ten` and a make-ten row would draw the same
 * cards under a second mastery key. The question that makes it a *strategy* is
 * `7 + ☐ = 10`, where the unknown is the addend — which is a different family
 * (`gen.arith.missing-operand`) and already has an id,
 * `dw.alg.equality.missing-addend`. It stays draft here because promoting it is
 * that row's own decision and not this change's; the note is so nobody mints a
 * duplicate.
 */
const subtractMultidigit: SkillNode = {
  id: SKILL_SUBTRACT_MULTIDIGIT,
  // rev 2: gained the prerequisite it always had and never declared. Aligning the
  // columns and subtracting without regrouping is not the same skill as regrouping,
  // and a graph whose spine started at the harder one had no entry point.
  //
  // rev 3: gained the second one. A borrow happens exactly when a column
  // difference crosses ten, so `52 − 27` is `12 − 7` inside a procedure, and a
  // child who cannot do `12 − 7` cannot do this row however well they align.
  rev: 3,
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
  prereqs: [
    { kind: "requires", to: SKILL_SUBTRACT_NO_REGROUP },
    { kind: "requires", to: SKILL_SUBTRACT_ACROSS_TEN },
  ],
  difficulty: {
    b: b(-50n),
    levels: [b(5n), b(35n), b(90n), b(120n)],
  },
  // Borrow-across-zero is declared here as well as on the node named for it: this
  // level table does not *ask* for a zero in the minuend, but a drawn digit is a
  // zero often enough that the items emit that diagnosis on their own (measured:
  // 155 of 4,000 items in the full sweep). A diagnosis the scheduler can receive
  // and the node does not declare has nowhere to route. CG-12 checks both
  // directions.
  misconceptions: [MIS_SMALLER_FROM_LARGER, MIS_BORROW_ACROSS_ZERO],
  representations: { required: [], optional: [REP_COUNTING_BOARD] },
  generator: {
    family: COLUMN_OP_FAMILY,
    familyRev: COLUMN_OP_FAMILY_REV,
    params: [sub(2, 2, 1, 0), sub(3, 3, 1, 0), sub(3, 3, 2, 0), sub(4, 4, 2, 0)],
    forms: [FORM_FREE_ENTRY, FORM_COLUMN],
    minVariants: 24,
    consumes: [CAP_COLUMN_ALIGN, CAP_DIFFERENCES_ACROSS_TEN],
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
  /**
   * rev 2: same as its sibling — the non-regrouping column sum is its prerequisite.
   * rev 3: and so is the crossing-ten fact. A carry happens exactly when a column
   * sum crosses ten, so `47 + 25` is `7 + 5` inside a procedure.
   */
  rev: 3,
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
  prereqs: [
    { kind: "requires", to: SKILL_ADD_NO_REGROUP },
    { kind: "requires", to: SKILL_ADD_ACROSS_TEN },
  ],
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
    consumes: [CAP_COLUMN_ALIGN, CAP_SUMS_ACROSS_TEN],
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

/**
 * The two rows the spine was missing: line the columns up and subtract, with
 * nothing to regroup.
 *
 * Both are `active`, and they are the only rows this change promotes. Column-op is
 * the one family whose *question* a renderer ever read — it was the only prompt
 * template the host's practice loop matched — so it is the one family whose rows
 * sit alongside the column-op rows already active on trunk. Everything else this
 * change adds is `draft` behind `render/prompts.ts`.
 *
 * `active` is a statement about the curriculum side being complete, and since
 * ADR-0022 it is nothing more than that: the loop that drew column-op went with
 * the host, and no pack has replaced it. CG-8 warns on every row in the graph for
 * that reason and fails under `--strict-renderers`, which is what stops a release
 * in which nothing draws a question.
 *
 * Neither row carries a mal-rule, and the reason is in `malrules/columnOp.ts`:
 * with nothing to regroup, taking the smaller digit from the larger *is* the
 * correct procedure, so `applies()` is false on every item here. A level table
 * that declared it would be claiming a diagnosis its items can never emit.
 */
const subtractNoRegroup: SkillNode = {
  id: SKILL_SUBTRACT_NO_REGROUP,
  /**
   * rev 2: gained the prerequisite it always had. Every column of a no-regroup
   * subtraction is a difference within ten, so this row consumes the fact row
   * outright — and until the fact row existed, the graph's entry point was a
   * two-digit column subtraction with nothing underneath it.
   */
  rev: 2,
  status: "active",
  title: locKey("dw.skill.add.column.subtract-no-regroup.title"),
  learnerGoal: locKey("dw.skill.add.column.subtract-no-regroup.goal"),
  domain: "add",
  cluster: "column",
  bigIdeas: [locKey("dw.idea.place-value.line-up-the-columns")],
  gradeBand: { earliest: 1, nominal: 1, latest: 2 },
  strandRole: "spine",
  proficiency: { conceptual: 1, procedural: 3, strategic: 0, adaptive: 1 },
  classification: "procedural",
  fluencyTarget: { p50Ms: 10000 },
  prereqs: [{ kind: "requires", to: SKILL_SUBTRACT_WITHIN_TEN }],
  difficulty: { b: b(-90n), levels: [b(-90n), b(-60n), b(-30n)] },
  misconceptions: [],
  representations: { required: [], optional: [REP_COUNTING_BOARD] },
  generator: {
    family: COLUMN_OP_FAMILY,
    familyRev: COLUMN_OP_FAMILY_REV,
    params: [sub(2, 2, 0, 0), sub(3, 3, 0, 0), sub(4, 4, 0, 0)],
    forms: [FORM_FREE_ENTRY, FORM_COLUMN],
    minVariants: 24,
    consumes: [CAP_DIFFERENCES_WITHIN_TEN],
  },
  probes: [{ level: 0, seed: 1, purpose: "entry" }],
  provides: [CAP_COLUMN_ALIGN],
  standards: { ccss: ["1.NBT.C.6", "2.NBT.B.5"] },
};

const addNoRegroup: SkillNode = {
  id: SKILL_ADD_NO_REGROUP,
  /** rev 2: same as its sibling — every column here is a sum within ten. */
  rev: 2,
  status: "active",
  title: locKey("dw.skill.add.column.add-no-regroup.title"),
  learnerGoal: locKey("dw.skill.add.column.add-no-regroup.goal"),
  domain: "add",
  cluster: "column",
  bigIdeas: [locKey("dw.idea.place-value.line-up-the-columns")],
  gradeBand: { earliest: 1, nominal: 1, latest: 2 },
  strandRole: "spine",
  proficiency: { conceptual: 1, procedural: 3, strategic: 0, adaptive: 1 },
  classification: "procedural",
  fluencyTarget: { p50Ms: 10000 },
  prereqs: [{ kind: "requires", to: SKILL_ADD_WITHIN_TEN }],
  difficulty: { b: b(-90n), levels: [b(-90n), b(-60n), b(-30n)] },
  misconceptions: [],
  representations: { required: [], optional: [REP_COUNTING_BOARD] },
  generator: {
    family: COLUMN_OP_FAMILY,
    familyRev: COLUMN_OP_FAMILY_REV,
    params: [plus(2, 2, 0), plus(3, 3, 0), plus(4, 4, 0)],
    forms: [FORM_FREE_ENTRY, FORM_COLUMN],
    minVariants: 24,
    consumes: [CAP_SUMS_WITHIN_TEN],
  },
  probes: [{ level: 0, seed: 1, purpose: "entry" }],
  provides: [CAP_COLUMN_ALIGN],
  standards: { ccss: ["1.NBT.C.4", "2.NBT.B.5"] },
};

/**
 * A short second operand under a long first one — `4,003 − 87`.
 *
 * A separate row rather than a level of the multidigit ones because the thing that
 * goes wrong is different: the columns that have no digit underneath them are the
 * ones children misalign, and `mis.add.misaligned-columns` is the mal-rule this row
 * is waiting for. It is not shipped here — the buggy procedure needs to know where
 * the child *wrote* the operand, which the exercise contract does not carry.
 */
const subtractShortSubtrahend: SkillNode = {
  id: SKILL_SUBTRACT_SHORT_SUBTRAHEND,
  rev: 1,
  status: "active",
  title: locKey("dw.skill.add.regroup.subtract-short-subtrahend.title"),
  learnerGoal: locKey("dw.skill.add.regroup.subtract-short-subtrahend.goal"),
  domain: "add",
  cluster: "regroup",
  bigIdeas: [locKey("dw.idea.place-value.line-up-the-columns"), locKey("dw.idea.place-value.regroup")],
  gradeBand: { earliest: 2, nominal: 3, latest: 4 },
  strandRole: "fluency",
  proficiency: { conceptual: 2, procedural: 3, strategic: 1, adaptive: 2 },
  classification: "procedural",
  prereqs: [{ kind: "requires", to: SKILL_SUBTRACT_MULTIDIGIT }],
  difficulty: { b: b(-50n), levels: [b(65n), b(150n), b(235n)] },
  misconceptions: [MIS_SMALLER_FROM_LARGER, MIS_BORROW_ACROSS_ZERO],
  representations: { required: [], optional: [REP_COUNTING_BOARD] },
  generator: {
    family: COLUMN_OP_FAMILY,
    familyRev: COLUMN_OP_FAMILY_REV,
    params: [sub(4, 2, 1, 0), sub(5, 3, 2, 0), sub(6, 3, 3, 0)],
    forms: [FORM_FREE_ENTRY, FORM_COLUMN],
    minVariants: 24,
    consumes: [CAP_SUB_REGROUP],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["3.NBT.A.2", "4.NBT.B.4"] },
};

const addShortAddend: SkillNode = {
  id: SKILL_ADD_SHORT_ADDEND,
  rev: 1,
  status: "active",
  title: locKey("dw.skill.add.regroup.add-short-addend.title"),
  learnerGoal: locKey("dw.skill.add.regroup.add-short-addend.goal"),
  domain: "add",
  cluster: "regroup",
  bigIdeas: [locKey("dw.idea.place-value.line-up-the-columns"), locKey("dw.idea.place-value.regroup")],
  gradeBand: { earliest: 2, nominal: 3, latest: 4 },
  strandRole: "fluency",
  proficiency: { conceptual: 2, procedural: 3, strategic: 1, adaptive: 2 },
  classification: "procedural",
  prereqs: [{ kind: "requires", to: SKILL_ADD_MULTIDIGIT }],
  difficulty: { b: b(-60n), levels: [b(55n), b(140n), b(195n)] },
  misconceptions: [MIS_CARRY_DROPPED],
  representations: { required: [], optional: [REP_COUNTING_BOARD] },
  generator: {
    family: COLUMN_OP_FAMILY,
    familyRev: COLUMN_OP_FAMILY_REV,
    params: [plus(4, 2, 1), plus(5, 2, 2), plus(5, 3, 3)],
    forms: [FORM_FREE_ENTRY, FORM_COLUMN],
    minVariants: 24,
    consumes: [CAP_ADD_CARRY],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["3.NBT.A.2", "4.NBT.B.4"] },
};

export const addDomainNodes: readonly SkillNode[] = [
  addWithinTen,
  subtractWithinTen,
  addAcrossTen,
  subtractAcrossTen,
  addNoRegroup,
  subtractNoRegroup,
  subtractMultidigit,
  subtractAcrossZero,
  addMultidigit,
  addShortAddend,
  subtractShortSubtrahend,
  subtractTenths,
];
