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
 * The renderer is not the whole of it here. Nine of these eleven rows also sit
 * under CG-10's variant-space floor on their easiest levels — small denominators
 * genuinely hold few problems — so promoting them is a generator question as well
 * as a `status` flip. `promotionBlockers.ts` names the levels.
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
  rev: 1,
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
  difficulty: { b: b(-90n), levels: [b(-25n), b(-5n), b(25n)] },
  misconceptions: [MIS_LARGER_DENOMINATOR_LARGER_FRACTION],
  representations: { required: [], optional: [] },
  generator: {
    family: COMPARE_ORDER_FAMILY,
    familyRev: COMPARE_ORDER_FAMILY_REV,
    params: [comparePair(20, true), comparePair(24, true, "lesser"), comparePair(30, true)],
    forms: [COMPARE_FORM],
    minVariants: 80,
    consumes: [],
  },
  probes: [{ level: 0, seed: 1, purpose: "entry" }],
  provides: [CAP_FRAC_COMPARE],
  standards: { ccss: ["3.NF.A.3.D"], sg: ["P3-FR-2"] },
};

const compareUnlike: SkillNode = {
  id: SKILL_COMPARE_UNLIKE,
  rev: 1,
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
  difficulty: { b: b(-90n), levels: [b(-40n), b(-10n), b(30n)] },
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
    params: [comparePair(10, false), comparePair(16, false, "lesser"), comparePair(24, false)],
    forms: [COMPARE_FORM],
    minVariants: 80,
    consumes: [CAP_FRAC_COMPARE],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["4.NF.A.2"] },
};

const buildEquivalent: SkillNode = {
  id: SKILL_BUILD_EQUIVALENT,
  rev: 1,
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
  difficulty: { b: b(-120n), levels: [b(150n), b(290n), b(420n)] },
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: FRAC_EQUIVALENCE_FAMILY,
    familyRev: FRAC_EQUIVALENCE_FAMILY_REV,
    params: [equivalence("build", 24, 6, 1), equivalence("build", 40, 8, 1), equivalence("build", 60, 9, 1)],
    forms: [EQUIV_FORM],
    minVariants: 40,
    consumes: [],
  },
  probes: [{ level: 0, seed: 1, purpose: "entry" }],
  provides: [CAP_FRAC_EQUIVALENT],
  standards: { ccss: ["3.NF.A.3.B", "4.NF.A.1"] },
};

const simplify: SkillNode = {
  id: SKILL_SIMPLIFY,
  rev: 1,
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
  difficulty: { b: b(-120n), levels: [b(90n), b(230n), b(420n)] },
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: FRAC_EQUIVALENCE_FAMILY,
    familyRev: FRAC_EQUIVALENCE_FAMILY_REV,
    params: [
      equivalence("simplify", 24, 4, 1),
      equivalence("simplify", 40, 6, 1),
      equivalence("simplify", 60, 9, 1),
    ],
    forms: [EQUIV_FORM],
    minVariants: 40,
    consumes: [CAP_FRAC_EQUIVALENT],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["4.NF.A.1"] },
};

const improperToMixed: SkillNode = {
  id: SKILL_IMPROPER_TO_MIXED,
  rev: 1,
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
  difficulty: { b: b(-100n), levels: [b(-40n), b(-20n), b(20n)] },
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: FRAC_EQUIVALENCE_FAMILY,
    familyRev: FRAC_EQUIVALENCE_FAMILY_REV,
    params: [
      equivalence("to-mixed", 8, 2, 4),
      equivalence("to-mixed", 12, 2, 9),
      equivalence("to-mixed", 20, 2, 15),
    ],
    forms: [EQUIV_FORM],
    minVariants: 60,
    consumes: [],
  },
  probes: [],
  provides: [CAP_FRAC_MIXED],
  standards: { ccss: ["4.NF.B.3.B", "5.NF.B.3"] },
};

const mixedToImproper: SkillNode = {
  id: SKILL_MIXED_TO_IMPROPER,
  rev: 1,
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
  difficulty: { b: b(-100n), levels: [b(-5n), b(15n), b(55n)] },
  misconceptions: [MIS_MIXED_NUMBER_CONCATENATION],
  representations: { required: [], optional: [] },
  generator: {
    family: FRAC_EQUIVALENCE_FAMILY,
    familyRev: FRAC_EQUIVALENCE_FAMILY_REV,
    params: [
      equivalence("to-improper", 8, 2, 4),
      equivalence("to-improper", 12, 2, 9),
      equivalence("to-improper", 20, 2, 15),
    ],
    forms: [EQUIV_FORM],
    minVariants: 60,
    consumes: [CAP_FRAC_MIXED],
  },
  probes: [{ level: 2, seed: 7, purpose: "promotion" }],
  provides: [],
  standards: { ccss: ["4.NF.B.3.B"] },
};

const addLike: SkillNode = {
  id: SKILL_ADD_LIKE,
  rev: 1,
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
  difficulty: { b: b(-80n), levels: [b(-40n), b(0n), b(65n)] },
  misconceptions: [MIS_ADD_NUMERATORS_AND_DENOMINATORS],
  representations: { required: [], optional: [] },
  generator: {
    family: FRAC_ARITH_FAMILY,
    familyRev: FRAC_ARITH_FAMILY_REV,
    params: [addSub("add", "like", 8, false), addSub("add", "like", 16, false), addSub("add", "like", 24, true)],
    forms: [ARITH_FORM],
    minVariants: 40,
    consumes: [],
  },
  probes: [{ level: 0, seed: 1, purpose: "entry" }],
  provides: [CAP_FRAC_LIKE_SUM],
  standards: { ccss: ["4.NF.B.3.A"] },
};

const addUnlike: SkillNode = {
  id: SKILL_ADD_UNLIKE,
  rev: 1,
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
  difficulty: { b: b(-80n), levels: [b(10n), b(35n), b(100n)] },
  misconceptions: [MIS_ADD_NUMERATORS_AND_DENOMINATORS],
  representations: { required: [], optional: [] },
  generator: {
    family: FRAC_ARITH_FAMILY,
    familyRev: FRAC_ARITH_FAMILY_REV,
    params: [
      addSub("add", "multiple", 12, false),
      addSub("add", "unlike", 12, false),
      addSub("add", "unlike", 20, true),
    ],
    forms: [ARITH_FORM],
    minVariants: 40,
    consumes: [CAP_FRAC_LIKE_SUM, CAP_FRAC_EQUIVALENT],
  },
  probes: [{ level: 2, seed: 11, purpose: "promotion" }],
  provides: [],
  standards: { ccss: ["5.NF.A.1"] },
};

const subtractFractions: SkillNode = {
  id: SKILL_SUBTRACT,
  rev: 1,
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
  difficulty: { b: b(-80n), levels: [b(-20n), b(30n), b(100n)] },
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
      addSub("sub", "multiple", 16, false),
      addSub("sub", "unlike", 20, true),
    ],
    forms: [ARITH_FORM],
    minVariants: 40,
    consumes: [CAP_FRAC_LIKE_SUM],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["4.NF.B.3.A", "5.NF.A.1"] },
};

const multiplyByWhole: SkillNode = {
  id: SKILL_MULTIPLY_WHOLE,
  rev: 1,
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
  difficulty: { b: b(-60n), levels: [b(-45n), b(-15n), b(50n)] },
  misconceptions: [MIS_SCALE_BOTH_PARTS],
  representations: { required: [], optional: [] },
  generator: {
    family: FRAC_ARITH_FAMILY,
    familyRev: FRAC_ARITH_FAMILY_REV,
    params: [multiply(true, 10, 6, false), multiply(true, 16, 9, false), multiply(true, 24, 12, true)],
    forms: [ARITH_FORM],
    minVariants: 40,
    consumes: [CAP_FRAC_LIKE_SUM],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["4.NF.B.4", "5.NF.B.4"] },
};

const multiplyFractions: SkillNode = {
  id: SKILL_MULTIPLY_FRACTION,
  rev: 1,
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
  difficulty: { b: b(-60n), levels: [b(-20n), b(0n), b(65n)] },
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: FRAC_ARITH_FAMILY,
    familyRev: FRAC_ARITH_FAMILY_REV,
    params: [multiply(false, 8, 2, false), multiply(false, 12, 2, false), multiply(false, 20, 2, true)],
    forms: [ARITH_FORM],
    minVariants: 40,
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
