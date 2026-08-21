/**
 * Domain `frac` — fractions.
 *
 * CURRICULUM.md prioritizes this domain ahead of breadth anywhere else, and the
 * reason is the strongest single finding in the literature the program is built on:
 * elementary fraction and division knowledge uniquely predicts high-school algebra
 * achievement five to six years later, controlling for IQ, working memory and
 * family income, replicated in US and UK longitudinal samples.
 *
 * Every row is `draft`, and not for want of a generator. Fractions are the domain
 * where the gap is starkest: `PromptSlot` gained a `fraction` kind in this change
 * because until now a question about fractions could not be **stated** — the only
 * way to write three quarters into a prompt was as the `Rational` 3/4, which a
 * renderer can only write as `0.75`. The slot exists now; the renderer that draws
 * it does not. See `render/prompts.ts`.
 *
 * There are two renderer blockers, not one, and they are data rather than this
 * paragraph. `FRACTION_ANSWER_BLOCKED_SKILLS` is all eleven rows: `answerText` in the
 * app returns `null` for a fraction, and everything downstream reads `null` as `""`, so
 * the card draws complete and marks every response wrong.
 * `NON_BINARY_QUESTION_TEMPLATES` is six of them on top of that: the four
 * `frac.equivalence` templates and the two comparisons declare `operator: "none"`, and
 * `2/3 = ☐/12` is an equation between two written fractions rather than `a OP b`. Both
 * clear in the same pack PR, which is the honest reading — a fraction nobody can enter
 * is not an answer, and a fraction nobody can print is not a question.
 *
 * The renderers used to not be the whole of it: nine of these eleven rows also sat
 * under CG-10's variant-space floor on their easiest levels. That half is settled
 * below, and the answer turned out to be the same one nearly every time.
 *
 * ## Small denominators genuinely hold few problems, and that is not a thin draw
 *
 * CG-10's floor of 975 is derived from a model of generators that do not close — it
 * asks whether a forty-item practice run would repeat itself and reads a repeat as
 * evidence of a shallow draw. Fractions are where that model breaks hardest.
 * "Add two fractions with the same denominator, denominators up to eight" is
 * **eighty-eight problems in the world**; there is no eighty-ninth, and no amount of
 * generator work produces one without changing which denominators the rung is about.
 * The whole `build`/`simplify` task tops out at six hundred items even at the family's
 * widest denominator, so no level of `build-equivalent` can ever clear the floor.
 *
 * So every level here whose space is genuinely below the floor declares
 * `closedFactSet`, and every declared count is **exhausted** — drawn until the space
 * stops yielding new items — in `closedSpaces.test.ts`, which is a measurement rather
 * than an argument. Two levels took the other route, widening rather than closing,
 * because their ceiling was arbitrary and not about the content.
 *
 * What stops a closed rung from being a *thin* one is `MIN_RUNG_VARIANTS`: the floor
 * of 24 distinct items in `promotionBlockers.ts`, measured on every level in the
 * graph. It is doing real work here — `equivalence("build", 12, 4, 1)` is 19 items and
 * would have been the natural easiest rung for `build-equivalent`. It is not authored,
 * because nineteen items is a rung that repeats itself twice in a forty-item run.
 *
 * ## The rungs
 *
 * Every row is written out from the smallest denominators the family admits to the
 * largest, so a controller walking a child down this domain has somewhere to go: 51
 * levels across eleven rows where there were 33. Nine of the eleven gain a rung
 * **inserted below their top** rather than appended, which renumbers the levels above
 * it. That is safe because every row here is `draft` and `shipped-ids.json` carries no
 * release, so nothing keys off the old numbering — and the two probes that name a level
 * were checked against it: `add-unlike`'s promotion probe at L2 still draws the rung it
 * was written for, and `mixed-to-improper`'s moved to L3 to follow its.
 *
 * `mis.frac.whole-number-bias` is the root of two of the three mal-rules here, so a
 * child who believes a fraction is two whole numbers stacked up is repaired once
 * rather than twice.
 */

import { rational } from "../../math/rational.ts";
import type { CompareOrderParams } from "../../generators/compareOrder/params.ts";
import {
  COMPARE_ORDER_FAMILY,
  COMPARE_ORDER_FAMILY_REV,
  FORM_FREE_ENTRY as COMPARE_FORM,
} from "../../generators/compareOrder/constants.ts";
import type { FracArithParams } from "../../generators/fracArith/params.ts";
import {
  FORM_FREE_ENTRY as ARITH_FORM,
  FRAC_ARITH_FAMILY,
  FRAC_ARITH_FAMILY_REV,
} from "../../generators/fracArith/constants.ts";
import type { FracEquivalenceParams } from "../../generators/fracEquivalence/params.ts";
import {
  FORM_FREE_ENTRY as EQUIV_FORM,
  FRAC_EQUIVALENCE_FAMILY,
  FRAC_EQUIVALENCE_FAMILY_REV,
} from "../../generators/fracEquivalence/constants.ts";
import { MIS_LARGER_DENOMINATOR_LARGER_FRACTION } from "../../malrules/compareOrder.ts";
import {
  MIS_ADD_NUMERATORS_AND_DENOMINATORS,
  MIS_MIXED_NUMBER_CONCATENATION,
  MIS_SCALE_BOTH_PARTS,
} from "../../malrules/fractions.ts";
import { capabilityTag, locKey, skillId } from "../../types/ids.ts";
import type { SkillNode } from "../../types/skill.ts";

export const CAP_FRAC_COMPARE = capabilityTag("cap.frac.compare");
export const CAP_FRAC_EQUIVALENT = capabilityTag("cap.frac.equivalent");
export const CAP_FRAC_LIKE_SUM = capabilityTag("cap.frac.like-sum");
export const CAP_FRAC_MIXED = capabilityTag("cap.frac.mixed-number");

function b(hundredths: bigint) {
  return rational(hundredths, 100n);
}

function comparePair(maxDenominator: number, sameNumerator: boolean, task: "greater" | "lesser" = "greater"): CompareOrderParams {
  return { numberType: "fraction", task, maxDenominator, sameNumerator };
}

function equivalence(
  task: FracEquivalenceParams["task"],
  maxDenominator: number,
  maxFactor: number,
  maxWhole: number,
): FracEquivalenceParams {
  return { task, maxDenominator, maxFactor, maxWhole };
}

function addSub(
  op: "add" | "sub",
  denominators: "like" | "multiple" | "unlike",
  maxDenominator: number,
  lowestTerms: boolean,
): FracArithParams {
  return { op, denominators, maxDenominator, lowestTerms };
}

function multiply(wholeMultiplier: boolean, maxDenominator: number, maxWhole: number, lowestTerms: boolean): FracArithParams {
  return { op: "mul", wholeMultiplier, maxDenominator, maxWhole, lowestTerms };
}

export const SKILL_COMPARE_SAME_NUMERATOR = skillId("dw.frac.compare.same-numerator");
export const SKILL_COMPARE_UNLIKE = skillId("dw.frac.compare.unlike-fractions");
export const SKILL_BUILD_EQUIVALENT = skillId("dw.frac.equivalence.build-equivalent");
export const SKILL_SIMPLIFY = skillId("dw.frac.equivalence.lowest-terms");
export const SKILL_IMPROPER_TO_MIXED = skillId("dw.frac.equivalence.improper-to-mixed");
export const SKILL_MIXED_TO_IMPROPER = skillId("dw.frac.equivalence.mixed-to-improper");
export const SKILL_ADD_LIKE = skillId("dw.frac.arith.add-like-denominators");
export const SKILL_ADD_UNLIKE = skillId("dw.frac.arith.add-unlike-denominators");
export const SKILL_SUBTRACT = skillId("dw.frac.arith.subtract-fractions");
export const SKILL_MULTIPLY_WHOLE = skillId("dw.frac.arith.multiply-by-a-whole");
export const SKILL_MULTIPLY_FRACTION = skillId("dw.frac.arith.multiply-fractions");

/**
 * The diagnostic comparison: one numerator, two denominators.
 *
 * With the numerators equal, the larger denominator is the smaller number as a
 * matter of arithmetic, so this level table is where whole-number bias is either
 * visible or absent — and where the mal-rule that names it is wrong on every single
 * item without ever inspecting the answer.
 */
const compareSameNumerator: SkillNode = {
  id: SKILL_COMPARE_SAME_NUMERATOR,
  rev: 2,
  status: "draft",
  title: locKey("dw.skill.frac.compare.same-numerator.title"),
  learnerGoal: locKey("dw.skill.frac.compare.same-numerator.goal"),
  domain: "frac",
  cluster: "compare",
  bigIdeas: [locKey("dw.idea.fraction.more-parts-means-smaller-parts")],
  gradeBand: { earliest: 2, nominal: 3, latest: 4 },
  strandRole: "spine",
  proficiency: { conceptual: 3, procedural: 1, strategic: 2, adaptive: 2 },
  classification: "conceptual",
  prereqs: [],
  difficulty: {
    b: b(-90n),
    levels: [b(-85n), b(-65n), b(-5n), b(25n), b(75n)],
  },
  misconceptions: [MIS_LARGER_DENOMINATOR_LARGER_FRACTION],
  representations: { required: [], optional: [] },
  generator: {
    family: COMPARE_ORDER_FAMILY,
    familyRev: COMPARE_ORDER_FAMILY_REV,
    // Halves through eighths first — `1/3` against `1/8`, the pair a child can hold in
    // their head as two pictures — then twelfths, and on up to fortieths where the two
    // denominators are close enough that only the rule decides it.
    //
    // **There is a gap between twelfths and twenty-fourths, and it is CG-10's, not the
    // content's.** Ceilings of 16 and 20 are the natural rungs there and both are
    // excluded: their true spaces are 1,120 and 2,280 problems, comfortably above the
    // floor of 975, but the gate's `N²/2C` estimator reads them as ~700 and ~880 from
    // a 500-seed sample. Same-numerator pairs are a strongly non-uniform draw — the
    // numerator must sit below both denominators, so small numerators dominate — and
    // that is the regime where the estimator undercounts. Declaring `closedFactSet` for
    // them is not available either: a space above the floor is not "small in the world",
    // and exhausting a 2,280-item space costs six figures of seeds in a PR gate. So the
    // two rungs are left out and the finding is recorded here rather than worked
    // around; whoever owns CG-10 has a measured case to size the estimator against.
    params: [
      comparePair(8, true),
      comparePair(12, true),
      comparePair(24, true, "lesser"),
      comparePair(30, true),
      comparePair(40, true),
    ],
    forms: [COMPARE_FORM],
    minVariants: 80,
    // 112 and 440: every same-numerator pair inside those denominator ceilings, and
    // no more. From twenty-fourths up the space clears CG-10 on its own.
    closedFactSet: [112, 440, null, null, null],
    consumes: [],
  },
  probes: [{ level: 0, seed: 1, purpose: "entry" }],
  provides: [CAP_FRAC_COMPARE],
  standards: { ccss: ["3.NF.A.3.D"], sg: ["P3-FR-2"] },
};

const compareUnlike: SkillNode = {
  id: SKILL_COMPARE_UNLIKE,
  rev: 2,
  status: "draft",
  title: locKey("dw.skill.frac.compare.unlike-fractions.title"),
  learnerGoal: locKey("dw.skill.frac.compare.unlike-fractions.goal"),
  domain: "frac",
  cluster: "compare",
  bigIdeas: [locKey("dw.idea.fraction.a-fraction-is-one-number")],
  gradeBand: { earliest: 3, nominal: 4, latest: 5 },
  strandRole: "spine",
  proficiency: { conceptual: 3, procedural: 2, strategic: 2, adaptive: 2 },
  classification: "conceptual",
  prereqs: [{ kind: "requires", to: SKILL_COMPARE_SAME_NUMERATOR }],
  difficulty: { b: b(-90n), levels: [b(-50n), b(-40n), b(-10n), b(30n), b(110n)] },
  // These levels draw the two fractions independently, so a same-numerator pair
  // turns up by chance — measured at roughly one item in eight — and the
  // whole-number-bias rule fires on it. A diagnosis the items emit and the node
  // does not declare reaches the scheduler with nowhere to route, which is what
  // the sweep caught and what CG-12 checks on the active graph.
  misconceptions: [MIS_LARGER_DENOMINATOR_LARGER_FRACTION],
  representations: { required: [], optional: [] },
  generator: {
    family: COMPARE_ORDER_FAMILY,
    familyRev: COMPARE_ORDER_FAMILY_REV,
    params: [
      comparePair(8, false),
      comparePair(10, false),
      comparePair(16, false, "lesser"),
      comparePair(24, false),
      comparePair(40, false),
    ],
    forms: [COMPARE_FORM],
    minVariants: 80,
    // 736 pairs inside eighths, which is all of them. Every level above draws from
    // thousands.
    closedFactSet: [736, null, null, null, null],
    consumes: [CAP_FRAC_COMPARE],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["4.NF.A.2"] },
};

const buildEquivalent: SkillNode = {
  id: SKILL_BUILD_EQUIVALENT,
  rev: 2,
  status: "draft",
  title: locKey("dw.skill.frac.equivalence.build-equivalent.title"),
  learnerGoal: locKey("dw.skill.frac.equivalence.build-equivalent.goal"),
  domain: "frac",
  cluster: "equivalence",
  bigIdeas: [locKey("dw.idea.fraction.same-number-many-writings")],
  gradeBand: { earliest: 3, nominal: 4, latest: 5 },
  strandRole: "spine",
  proficiency: { conceptual: 3, procedural: 2, strategic: 1, adaptive: 1 },
  classification: "conceptual",
  prereqs: [],
  difficulty: { b: b(-120n), levels: [b(50n), b(150n), b(290n), b(420n)] },
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: FRAC_EQUIVALENCE_FAMILY,
    familyRev: FRAC_EQUIVALENCE_FAMILY_REV,
    // `1/2 = ☐/8` before `3/5 = ☐/45`. The prepended rung is the smallest this task
    // admits above `MIN_RUNG_VARIANTS`: at a denominator ceiling of 16 and a factor of
    // 4 there are 35 problems, and the next step down — ceiling 12, factor 4 — is 19,
    // which is a rung a child meets twice in a practice run and is therefore not
    // authored.
    params: [
      equivalence("build", 16, 4, 1),
      equivalence("build", 24, 6, 1),
      equivalence("build", 40, 8, 1),
      equivalence("build", 60, 9, 1),
    ],
    forms: [EQUIV_FORM],
    // Thirty, not forty: L0's whole space is 35 and CG-7 fails a row that claims more
    // variants than its own closed level holds.
    minVariants: 30,
    // Every level of this task is closed and below CG-10's floor, and that is a fact
    // about the mathematics rather than about this generator: a built equivalent is a
    // reduced fraction times a factor, so the space is bounded by the denominator
    // ceiling the *child reads*, and at the family's widest — sixtieths, factors to
    // nine — it is six hundred problems. Widening is not available; the numbers below
    // are exhausted in `closedSpaces.test.ts`.
    closedFactSet: [35, 87, 265, 600],
    consumes: [],
  },
  probes: [{ level: 0, seed: 1, purpose: "entry" }],
  provides: [CAP_FRAC_EQUIVALENT],
  standards: { ccss: ["3.NF.A.3.B", "4.NF.A.1"] },
};

const simplify: SkillNode = {
  id: SKILL_SIMPLIFY,
  rev: 2,
  status: "draft",
  title: locKey("dw.skill.frac.equivalence.lowest-terms.title"),
  learnerGoal: locKey("dw.skill.frac.equivalence.lowest-terms.goal"),
  domain: "frac",
  cluster: "equivalence",
  bigIdeas: [locKey("dw.idea.fraction.same-number-many-writings")],
  gradeBand: { earliest: 4, nominal: 5, latest: 5 },
  strandRole: "fluency",
  proficiency: { conceptual: 2, procedural: 3, strategic: 2, adaptive: 1 },
  classification: "procedural",
  prereqs: [{ kind: "requires", to: SKILL_BUILD_EQUIVALENT }],
  difficulty: { b: b(-120n), levels: [b(50n), b(90n), b(230n), b(420n)] },
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: FRAC_EQUIVALENCE_FAMILY,
    familyRev: FRAC_EQUIVALENCE_FAMILY_REV,
    params: [
      equivalence("simplify", 16, 4, 1),
      equivalence("simplify", 24, 4, 1),
      equivalence("simplify", 40, 6, 1),
      equivalence("simplify", 60, 9, 1),
    ],
    forms: [EQUIV_FORM],
    minVariants: 30,
    // Closed for the same reason `build-equivalent` is, and to the same ceiling: the
    // two tasks are one space read in two directions.
    closedFactSet: [35, 77, 247, 600],
    consumes: [CAP_FRAC_EQUIVALENT],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["4.NF.A.1"] },
};

const improperToMixed: SkillNode = {
  id: SKILL_IMPROPER_TO_MIXED,
  rev: 2,
  status: "draft",
  title: locKey("dw.skill.frac.equivalence.improper-to-mixed.title"),
  learnerGoal: locKey("dw.skill.frac.equivalence.improper-to-mixed.goal"),
  domain: "frac",
  cluster: "equivalence",
  bigIdeas: [
    locKey("dw.idea.fraction.same-number-many-writings"),
    locKey("dw.idea.fraction.a-fraction-is-a-division"),
  ],
  gradeBand: { earliest: 3, nominal: 4, latest: 5 },
  strandRole: "bridge",
  proficiency: { conceptual: 3, procedural: 2, strategic: 1, adaptive: 1 },
  classification: "conceptual",
  prereqs: [],
  difficulty: {
    b: b(-100n),
    levels: [b(-40n), b(-20n), b(0n), b(20n), b(70n), b(120n)],
  },
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: FRAC_EQUIVALENCE_FAMILY,
    familyRev: FRAC_EQUIVALENCE_FAMILY_REV,
    // `9/4` as `2 1/4`, up to fortieths and a whole part of twenty. Sixtieths are not
    // authored: `1,187/60` is a division problem wearing a fraction, and the row that
    // owns division of that size is `dw.div.whole.quotient-and-remainder`.
    params: [
      equivalence("to-mixed", 8, 2, 4),
      equivalence("to-mixed", 12, 2, 9),
      equivalence("to-mixed", 16, 2, 12),
      equivalence("to-mixed", 20, 2, 15),
      equivalence("to-mixed", 30, 2, 18),
      equivalence("to-mixed", 40, 2, 20),
    ],
    forms: [EQUIV_FORM],
    minVariants: 60,
    // 112 and 594 are whole spaces; from sixteenths up the ordinary floor is cleared.
    closedFactSet: [112, 594, null, null, null, null],
    consumes: [],
  },
  probes: [],
  provides: [CAP_FRAC_MIXED],
  standards: { ccss: ["4.NF.B.3.B", "5.NF.B.3"] },
};

const mixedToImproper: SkillNode = {
  id: SKILL_MIXED_TO_IMPROPER,
  rev: 2,
  status: "draft",
  title: locKey("dw.skill.frac.equivalence.mixed-to-improper.title"),
  learnerGoal: locKey("dw.skill.frac.equivalence.mixed-to-improper.goal"),
  domain: "frac",
  cluster: "equivalence",
  bigIdeas: [locKey("dw.idea.fraction.same-number-many-writings")],
  gradeBand: { earliest: 4, nominal: 5, latest: 5 },
  strandRole: "bridge",
  proficiency: { conceptual: 3, procedural: 2, strategic: 1, adaptive: 2 },
  classification: "conceptual",
  prereqs: [{ kind: "requires", to: SKILL_IMPROPER_TO_MIXED }],
  difficulty: {
    b: b(-100n),
    levels: [b(-5n), b(15n), b(35n), b(55n), b(105n), b(155n)],
  },
  misconceptions: [MIS_MIXED_NUMBER_CONCATENATION],
  representations: { required: [], optional: [] },
  generator: {
    family: FRAC_EQUIVALENCE_FAMILY,
    familyRev: FRAC_EQUIVALENCE_FAMILY_REV,
    params: [
      equivalence("to-improper", 8, 2, 4),
      equivalence("to-improper", 12, 2, 9),
      equivalence("to-improper", 16, 2, 12),
      equivalence("to-improper", 20, 2, 15),
      equivalence("to-improper", 30, 2, 18),
      equivalence("to-improper", 40, 2, 20),
    ],
    forms: [EQUIV_FORM],
    minVariants: 60,
    closedFactSet: [112, 513, null, null, null, null],
    consumes: [CAP_FRAC_MIXED],
  },
  // Level 3 is `equivalence("to-improper", 20, 2, 15)`, which is the rung this probe
  // was written against; it moved from index 2 when the sixteenths rung was inserted.
  probes: [{ level: 3, seed: 7, purpose: "promotion" }],
  provides: [],
  standards: { ccss: ["4.NF.B.3.B"] },
};

const addLike: SkillNode = {
  id: SKILL_ADD_LIKE,
  rev: 2,
  status: "draft",
  title: locKey("dw.skill.frac.arith.add-like-denominators.title"),
  learnerGoal: locKey("dw.skill.frac.arith.add-like-denominators.goal"),
  domain: "frac",
  cluster: "arith",
  bigIdeas: [locKey("dw.idea.fraction.add-the-parts-not-the-wholes")],
  gradeBand: { earliest: 3, nominal: 4, latest: 5 },
  strandRole: "spine",
  proficiency: { conceptual: 3, procedural: 2, strategic: 1, adaptive: 2 },
  classification: "conceptual",
  prereqs: [],
  difficulty: { b: b(-80n), levels: [b(-40n), b(-20n), b(20n), b(65n)] },
  misconceptions: [MIS_ADD_NUMERATORS_AND_DENOMINATORS],
  representations: { required: [], optional: [] },
  generator: {
    family: FRAC_ARITH_FAMILY,
    familyRev: FRAC_ARITH_FAMILY_REV,
    // Eighths, twelfths, twentieths, then twenty-fourths with the sum reduced. The
    // twelfths rung is inserted rather than appended: the step from eighths to the top
    // was the widest in the row and this is the middle of it.
    //
    // Twentieths and not sixteenths at L2, and by measurement: a ceiling of 16 holds
    // 1,008 problems, which clears CG-10's floor of 975 in truth and reads as ~780
    // through the gate's estimator, so the rung would have stayed blocked for a
    // sampling artifact. A ceiling of 20 holds 2,100 and reads as ~1,180. This is the
    // widening the blocker list asks for — a level that could be widened and simply
    // had not been.
    params: [
      addSub("add", "like", 8, false),
      addSub("add", "like", 12, false),
      addSub("add", "like", 20, false),
      addSub("add", "like", 24, true),
    ],
    forms: [ARITH_FORM],
    minVariants: 40,
    // 88 and 380 whole spaces: every pair of numerators over every denominator inside
    // the ceiling. The two rungs above draw from thousands.
    closedFactSet: [88, 380, null, null],
    consumes: [],
  },
  probes: [{ level: 0, seed: 1, purpose: "entry" }],
  provides: [CAP_FRAC_LIKE_SUM],
  standards: { ccss: ["4.NF.B.3.A"] },
};

const addUnlike: SkillNode = {
  id: SKILL_ADD_UNLIKE,
  rev: 2,
  status: "draft",
  title: locKey("dw.skill.frac.arith.add-unlike-denominators.title"),
  learnerGoal: locKey("dw.skill.frac.arith.add-unlike-denominators.goal"),
  domain: "frac",
  cluster: "arith",
  bigIdeas: [locKey("dw.idea.fraction.add-the-parts-not-the-wholes")],
  gradeBand: { earliest: 4, nominal: 5, latest: 5 },
  strandRole: "spine",
  proficiency: { conceptual: 3, procedural: 3, strategic: 2, adaptive: 2 },
  classification: "conceptual",
  prereqs: [
    { kind: "requires", to: SKILL_ADD_LIKE },
    { kind: "requires", to: SKILL_BUILD_EQUIVALENT },
  ],
  difficulty: { b: b(-80n), levels: [b(10n), b(35n), b(100n), b(120n)] },
  misconceptions: [MIS_ADD_NUMERATORS_AND_DENOMINATORS],
  representations: { required: [], optional: [] },
  generator: {
    family: FRAC_ARITH_FAMILY,
    familyRev: FRAC_ARITH_FAMILY_REV,
    params: [
      addSub("add", "multiple", 12, false),
      addSub("add", "unlike", 12, false),
      addSub("add", "unlike", 20, true),
      addSub("add", "unlike", 24, true),
    ],
    forms: [ARITH_FORM],
    minVariants: 40,
    // 184: every pair of denominators up to twelve where one divides the other, with
    // both numerators. The unlike levels draw from thousands.
    closedFactSet: [184, null, null, null],
    consumes: [CAP_FRAC_LIKE_SUM, CAP_FRAC_EQUIVALENT],
  },
  probes: [{ level: 2, seed: 11, purpose: "promotion" }],
  provides: [],
  standards: { ccss: ["5.NF.A.1"] },
};

const subtractFractions: SkillNode = {
  id: SKILL_SUBTRACT,
  rev: 2,
  status: "draft",
  title: locKey("dw.skill.frac.arith.subtract-fractions.title"),
  learnerGoal: locKey("dw.skill.frac.arith.subtract-fractions.goal"),
  domain: "frac",
  cluster: "arith",
  bigIdeas: [locKey("dw.idea.fraction.add-the-parts-not-the-wholes")],
  gradeBand: { earliest: 4, nominal: 5, latest: 5 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 3, strategic: 2, adaptive: 2 },
  classification: "procedural",
  prereqs: [{ kind: "requires", to: SKILL_ADD_LIKE }],
  difficulty: { b: b(-80n), levels: [b(-20n), b(0n), b(30n), b(100n), b(120n)] },
  // The documented whole-number-bias rule is stated for addition. Its subtraction
  // analogue divides by zero on like denominators and cannot be shown to diverge on
  // the rest, so it is not shipped: never invent a bug.
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: FRAC_ARITH_FAMILY,
    familyRev: FRAC_ARITH_FAMILY_REV,
    params: [
      addSub("sub", "like", 12, false),
      addSub("sub", "like", 16, false),
      addSub("sub", "multiple", 16, false),
      addSub("sub", "unlike", 20, true),
      addSub("sub", "unlike", 24, true),
    ],
    forms: [ARITH_FORM],
    minVariants: 40,
    // 220, 560 and 518 whole spaces. The counts are not monotone across the levels and
    // do not have to be — the *difficulty* is, and a difference over denominators one
    // of which divides the other is harder work than a difference over sixteenths
    // however many of each there happen to be.
    closedFactSet: [220, 560, 518, null, null],
    consumes: [CAP_FRAC_LIKE_SUM],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["4.NF.B.3.A", "5.NF.A.1"] },
};

const multiplyByWhole: SkillNode = {
  id: SKILL_MULTIPLY_WHOLE,
  rev: 2,
  status: "draft",
  title: locKey("dw.skill.frac.arith.multiply-by-a-whole.title"),
  learnerGoal: locKey("dw.skill.frac.arith.multiply-by-a-whole.goal"),
  domain: "frac",
  cluster: "arith",
  bigIdeas: [locKey("dw.idea.fraction.a-fraction-of-a-number")],
  gradeBand: { earliest: 4, nominal: 5, latest: 5 },
  strandRole: "bridge",
  proficiency: { conceptual: 3, procedural: 2, strategic: 2, adaptive: 2 },
  classification: "conceptual",
  prereqs: [{ kind: "requires", to: SKILL_ADD_LIKE }],
  difficulty: { b: b(-60n), levels: [b(-45n), b(-35n), b(-15n), b(50n)] },
  misconceptions: [MIS_SCALE_BOTH_PARTS],
  representations: { required: [], optional: [] },
  generator: {
    family: FRAC_ARITH_FAMILY,
    familyRev: FRAC_ARITH_FAMILY_REV,
    params: [
      multiply(true, 10, 6, false),
      multiply(true, 12, 6, false),
      multiply(true, 16, 9, false),
      multiply(true, 24, 12, true),
    ],
    forms: [ARITH_FORM],
    minVariants: 40,
    // 184, 278 and 840 whole spaces: a fraction inside the ceiling times a whole
    // number that is never one.
    closedFactSet: [184, 278, 840, null],
    consumes: [CAP_FRAC_LIKE_SUM],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["4.NF.B.4", "5.NF.B.4"] },
};

const multiplyFractions: SkillNode = {
  id: SKILL_MULTIPLY_FRACTION,
  rev: 2,
  status: "draft",
  title: locKey("dw.skill.frac.arith.multiply-fractions.title"),
  learnerGoal: locKey("dw.skill.frac.arith.multiply-fractions.goal"),
  domain: "frac",
  cluster: "arith",
  bigIdeas: [locKey("dw.idea.fraction.a-fraction-of-a-number")],
  gradeBand: { earliest: 4, nominal: 5, latest: 5 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 3, strategic: 2, adaptive: 2 },
  classification: "procedural",
  prereqs: [{ kind: "requires", to: SKILL_MULTIPLY_WHOLE }],
  difficulty: { b: b(-60n), levels: [b(-20n), b(0n), b(65n), b(85n)] },
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: FRAC_ARITH_FAMILY,
    familyRev: FRAC_ARITH_FAMILY_REV,
    params: [
      multiply(false, 8, 2, false),
      multiply(false, 12, 2, false),
      multiply(false, 20, 2, true),
      multiply(false, 24, 2, true),
    ],
    forms: [ARITH_FORM],
    minVariants: 40,
    // 784 pairs of proper fractions inside eighths. Above that the product space runs
    // into the thousands and takes the ordinary floor.
    closedFactSet: [784, null, null, null],
    consumes: [],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["5.NF.B.4"] },
};

export const fracDomainNodes: readonly SkillNode[] = [
  compareSameNumerator,
  compareUnlike,
  buildEquivalent,
  simplify,
  improperToMixed,
  mixedToImproper,
  addLike,
  addUnlike,
  subtractFractions,
  multiplyByWhole,
  multiplyFractions,
];
