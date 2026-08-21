/**
 * Domain `ns` — number sense and place value.
 *
 * **Every row here is `draft`, and the reason is not the generator.** Each of these
 * nodes binds a family that generates, checks and diagnoses correctly over hundreds
 * of thousands of seeds. What does not exist is a renderer for the *question*, and the
 * shape of that gap is now data rather than this paragraph:
 * `NON_BINARY_QUESTION_TEMPLATES` in `promotionBlockers.ts`. Every template this domain
 * emits declares `operator: "none"`, and the only thing that serves an item composes a
 * question out of two operands and a glyph, so it refuses all six rows out loud. "In
 * 4,193, what is the digit in the hundreds place worth?" is a numeral and a *place
 * name*; "which is greater, 432 or 737?" is two numbers and a *relation*. Neither is
 * `a OP b`, and promoting either would serve a rung that generates a question, declines
 * to draw it, and asks the child nothing.
 *
 * That blocker used to have company: `dw.ns.place.digit-in-place` L0 and
 * `dw.ns.round.whole-numbers` L0 also sat under CG-10's variant-space floor. Both are
 * resolved below, by the two instruments this package already had — one widened, one
 * declared closed and exhausted — so the domain now waits on the renderer alone.
 *
 * ## The rungs, and why there are more of them than there were
 *
 * Every row here used to hold three or four levels, and every one of them started
 * partway up. `compare.whole-numbers` — a row whose `gradeBand.earliest` is 1 — began
 * at *three-digit* comparison; `round.whole-numbers` began at three digits too. The
 * shipped ladder therefore had no floor a six-year-old could stand on and no ceiling
 * near the millions the standards it cites actually name, so an adaptive controller
 * walking a struggling child down this domain ran out of rungs while the questions
 * were still too hard.
 *
 * So the level tables are written out end to end: down to the smallest question each
 * family can pose, and up to the seven digits `MAX_WHOLE_DIGITS` allows. Two rules
 * govern the result and both are checked rather than asserted:
 *
 * - **A rung is never only its easiest case.** `MIN_RUNG_VARIANTS` in
 *   `promotionBlockers.ts` is the floor and the sweep measures every level against
 *   it. The bottom rung of `round.whole-numbers` is "round a two-digit number to the
 *   nearest ten", which is seventy-two problems — few, and *all* of them, which is
 *   the distinction `closedFactSet` exists to draw.
 * - **A level table only ever goes up.** CG-9 checks that on the active graph and
 *   `families.property.test.ts` now checks it on the whole of it, because a rung that
 *   is easier than the one below it hands a climbing child a *shorter* answering
 *   window for *harder* work in every pack that prices its clock off difficulty.
 *
 * Two rows have a level **prepended** rather than appended, which renumbers the
 * levels above it. That is safe here and only here: both are `draft` and nothing has
 * shipped (`shipped-ids.json` carries no release), so no mastery record keys off the
 * old numbering. On an `active` row a new rung goes on the end.
 *
 * Four `gradeBand` labels move with the tables — three rows reach `latest: 5` now that
 * they reach seven digits, and `round.whole-numbers` reaches `earliest: 2` now that its
 * easiest rung is `47` to the nearest ten. A band is a placement hint for a parent and a
 * seed for onboarding; the scheduler reads prerequisites and nothing reads a band, so
 * each of those is a one-line relabel with no effect on ids, difficulty or ordering.
 *
 * Ids are final. A draft id is as immutable as an active one — it is a mastery key
 * the moment it ships, and the promotion PR must not be free to rename it.
 */

import { rational } from "../../math/rational.ts";
import type { CompareOrderParams } from "../../generators/compareOrder/params.ts";
import {
  COMPARE_ORDER_FAMILY,
  COMPARE_ORDER_FAMILY_REV,
  FORM_FREE_ENTRY as COMPARE_FORM,
} from "../../generators/compareOrder/constants.ts";
import type { PlaceValueParams } from "../../generators/placeValue/params.ts";
import {
  FORM_FREE_ENTRY as PLACE_FORM,
  PLACE_VALUE_FAMILY,
  PLACE_VALUE_FAMILY_REV,
} from "../../generators/placeValue/constants.ts";
import type { RoundEstimateParams } from "../../generators/roundEstimate/params.ts";
import {
  FORM_FREE_ENTRY as ROUND_FORM,
  ROUND_ESTIMATE_FAMILY,
  ROUND_ESTIMATE_FAMILY_REV,
} from "../../generators/roundEstimate/constants.ts";
import { MIS_DIGIT_FOR_VALUE } from "../../malrules/placeValue.ts";
import { MIS_LONGER_IS_BIGGER } from "../../malrules/compareOrder.ts";
import { capabilityTag, locKey, skillId } from "../../types/ids.ts";
import type { SkillNode } from "../../types/skill.ts";

export const CAP_READ_PLACE = capabilityTag("cap.ns.read-place");
export const CAP_DIGIT_VALUE = capabilityTag("cap.ns.digit-value");
export const CAP_COMPARE_WHOLE = capabilityTag("cap.ns.compare-whole");

/** Hundredths of a logit, spelled as an exact rational. */
function b(hundredths: bigint) {
  return rational(hundredths, 100n);
}

function place(
  task: PlaceValueParams["task"],
  digits: number,
  minPlace: number,
  maxPlace: number,
): PlaceValueParams {
  return { task, digits, minPlace, maxPlace };
}

function whole(digits: number, sharedPrefix: number, task: "greater" | "lesser" = "greater"): CompareOrderParams {
  return { numberType: "whole", task, digits, sharedPrefix };
}

function decimalPair(digits: number, decimalPlaces: number, placeGap: number): CompareOrderParams {
  return { numberType: "decimal", task: "greater", digits, decimalPlaces, placeGap };
}

function decimalPairLesser(digits: number, decimalPlaces: number, placeGap: number): CompareOrderParams {
  return { numberType: "decimal", task: "lesser", digits, decimalPlaces, placeGap };
}

function round(digits: number, minPlace: number, maxPlace: number, ties: boolean): RoundEstimateParams {
  return { digits, minPlace, maxPlace, ties };
}

export const SKILL_DIGIT_IN_PLACE = skillId("dw.ns.place.digit-in-place");
export const SKILL_DIGIT_VALUE = skillId("dw.ns.place.digit-value");
export const SKILL_REGROUPED_COUNT = skillId("dw.ns.place.regrouped-count");
export const SKILL_COMPARE_WHOLE = skillId("dw.ns.compare.whole-numbers");
export const SKILL_COMPARE_DECIMAL = skillId("dw.ns.compare.decimals");
export const SKILL_ROUND_WHOLE = skillId("dw.ns.round.whole-numbers");

const digitInPlace: SkillNode = {
  id: SKILL_DIGIT_IN_PLACE,
  rev: 2,
  status: "draft",
  title: locKey("dw.skill.ns.place.digit-in-place.title"),
  learnerGoal: locKey("dw.skill.ns.place.digit-in-place.goal"),
  domain: "ns",
  cluster: "place",
  bigIdeas: [locKey("dw.idea.place-value.position-carries-value")],
  // `latest` reaches 5 because the level table does: the top rung reads a place in a
  // seven-digit numeral, which is where 4.NBT.A.2 and the grade-5 place-value work
  // sit. A grade band is a placement hint and nothing else reads it — the scheduler
  // reads prerequisites — so widening it is a label change with no other effect.
  gradeBand: { earliest: 1, nominal: 2, latest: 5 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 2, strategic: 0, adaptive: 1 },
  classification: "procedural",
  fluencyTarget: { p50Ms: 8000 },
  prereqs: [],
  difficulty: {
    b: b(-70n),
    levels: [b(-95n), b(-55n), b(-15n), b(25n), b(75n), b(125n)],
  },
  // Reading a digit off the page has no arithmetic in it to get wrong, so it has
  // no mal-rule. The rule this family does carry is defined on the two tasks that
  // ask for a quantity.
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: PLACE_VALUE_FAMILY,
    familyRev: PLACE_VALUE_FAMILY_REV,
    // Two digits through seven: tens and units, then a place anywhere in a numeral up
    // to the millions. The four narrowest rungs include the units column (`minPlace:
    // 0`); the six-digit rung starts at tens and the seven-digit one at hundreds,
    // because "which digit is in the ones place of 4,193,608" is a question about the
    // last character on the card rather than about place value, and a level whose range
    // still admits it would keep drawing it.
    params: [
      place("digit-in-place", 2, 0, 1),
      place("digit-in-place", 3, 0, 2),
      place("digit-in-place", 4, 0, 3),
      place("digit-in-place", 5, 0, 4),
      place("digit-in-place", 6, 1, 5),
      place("digit-in-place", 7, 2, 6),
    ],
    forms: [PLACE_FORM],
    minVariants: 60,
    // L0 is every two-digit numeral asked about either of its two places: 90 × 2 =
    // 180, and there is no 181st. It cannot be widened without making the easiest
    // place-value question in the program a three-digit one, which is the case
    // `closedFactSet` is for — and 180 problems is a rung a child can practise
    // rather than a rung that repeats itself twice a minute. Every level above it
    // clears CG-10's floor on its own; `closedSpaces.test.ts` exhausts the 180.
    closedFactSet: [180, null, null, null, null, null],
    consumes: [],
  },
  probes: [{ level: 0, seed: 1, purpose: "entry" }],
  provides: [CAP_READ_PLACE],
  standards: { ccss: ["1.NBT.B.2", "2.NBT.A.1", "4.NBT.A.2"], uk: ["Y2-NPV-1"] },
};

const digitValue: SkillNode = {
  id: SKILL_DIGIT_VALUE,
  rev: 2,
  status: "draft",
  title: locKey("dw.skill.ns.place.digit-value.title"),
  learnerGoal: locKey("dw.skill.ns.place.digit-value.goal"),
  domain: "ns",
  cluster: "place",
  bigIdeas: [locKey("dw.idea.place-value.position-carries-value")],
  gradeBand: { earliest: 2, nominal: 3, latest: 5 },
  strandRole: "spine",
  proficiency: { conceptual: 3, procedural: 2, strategic: 1, adaptive: 1 },
  classification: "conceptual",
  prereqs: [{ kind: "requires", to: SKILL_DIGIT_IN_PLACE }],
  difficulty: { b: b(-40n), levels: [b(20n), b(60n), b(110n), b(150n), b(200n)] },
  misconceptions: [MIS_DIGIT_FOR_VALUE],
  representations: { required: [], optional: [] },
  generator: {
    family: PLACE_VALUE_FAMILY,
    familyRev: PLACE_VALUE_FAMILY_REV,
    // "What is the digit in the hundreds place worth" through to the millions. The
    // units column is never asked: in units the answer is the digit, which is the
    // question `digit-in-place` already asks and the one item the digit-for-value
    // mal-rule would get right.
    params: [
      place("digit-value", 3, 1, 2),
      place("digit-value", 4, 1, 3),
      place("digit-value", 5, 2, 4),
      place("digit-value", 6, 2, 5),
      place("digit-value", 7, 3, 6),
    ],
    forms: [PLACE_FORM],
    minVariants: 60,
    consumes: [CAP_READ_PLACE],
  },
  probes: [{ level: 1, seed: 17, purpose: "promotion" }],
  provides: [CAP_DIGIT_VALUE],
  standards: { ccss: ["2.NBT.A.1", "4.NBT.A.1"] },
};

const regroupedCount: SkillNode = {
  id: SKILL_REGROUPED_COUNT,
  rev: 2,
  status: "draft",
  title: locKey("dw.skill.ns.place.regrouped-count.title"),
  learnerGoal: locKey("dw.skill.ns.place.regrouped-count.goal"),
  domain: "ns",
  cluster: "place",
  bigIdeas: [
    locKey("dw.idea.place-value.position-carries-value"),
    locKey("dw.idea.place-value.regroup"),
  ],
  gradeBand: { earliest: 3, nominal: 4, latest: 5 },
  strandRole: "bridge",
  proficiency: { conceptual: 3, procedural: 2, strategic: 2, adaptive: 2 },
  classification: "conceptual",
  prereqs: [{ kind: "requires", to: SKILL_DIGIT_VALUE }],
  difficulty: { b: b(-40n), levels: [b(95n), b(135n), b(185n), b(225n)] },
  misconceptions: [MIS_DIGIT_FOR_VALUE],
  representations: { required: [], optional: [] },
  generator: {
    family: PLACE_VALUE_FAMILY,
    familyRev: PLACE_VALUE_FAMILY_REV,
    // "How many hundreds are in 4,193 altogether" — 41, not 1. The family's own
    // validator keeps two digits above the place it counts, so a seven-digit numeral
    // is counted in hundreds through hundred-thousands and no higher.
    params: [
      place("total-in-place", 4, 1, 2),
      place("total-in-place", 5, 1, 3),
      place("total-in-place", 6, 2, 4),
      place("total-in-place", 7, 2, 5),
    ],
    forms: [PLACE_FORM],
    minVariants: 60,
    consumes: [CAP_DIGIT_VALUE],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["4.NBT.A.1"] },
};

const compareWhole: SkillNode = {
  id: SKILL_COMPARE_WHOLE,
  rev: 2,
  status: "draft",
  title: locKey("dw.skill.ns.compare.whole-numbers.title"),
  learnerGoal: locKey("dw.skill.ns.compare.whole-numbers.goal"),
  domain: "ns",
  cluster: "compare",
  bigIdeas: [locKey("dw.idea.magnitude.numbers-have-order")],
  gradeBand: { earliest: 1, nominal: 2, latest: 5 },
  strandRole: "spine",
  proficiency: { conceptual: 2, procedural: 2, strategic: 1, adaptive: 1 },
  classification: "procedural",
  fluencyTarget: { p50Ms: 9000 },
  prereqs: [{ kind: "requires", to: SKILL_DIGIT_IN_PLACE }],
  difficulty: {
    b: b(-60n),
    levels: [b(-60n), b(-30n), b(5n), b(70n), b(135n), b(200n), b(265n)],
  },
  // The whole-number comparisons this level table poses are between two numbers of
  // the same written width, so "the longer number is bigger" is not a rule that can
  // fire on them — and where it could, it would be right.
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: COMPARE_ORDER_FAMILY,
    familyRev: COMPARE_ORDER_FAMILY_REV,
    // A rung is **prepended** here: `whole(2, 0)` — "which is more, 47 or 82?" — is
    // the smallest comparison this family can pose, and it is where a row whose
    // `gradeBand.earliest` is 1 has to start. It began at three digits, which is why
    // an adaptive controller had nowhere left to walk a struggling child down to. The
    // renumbering is safe because the row is draft and nothing has shipped; the entry
    // probe at L0 now lands on the two-digit rung, which is what an entry probe is
    // for. From there: three digits, three digits sharing a leading digit, and on up
    // to seven sharing five, where every comparison is decided in the tens.
    params: [
      whole(2, 0),
      whole(3, 0),
      whole(3, 1, "lesser"),
      whole(4, 2),
      whole(5, 3, "lesser"),
      whole(6, 4),
      whole(7, 5, "lesser"),
    ],
    forms: [COMPARE_FORM],
    minVariants: 80,
    consumes: [CAP_READ_PLACE],
  },
  probes: [{ level: 0, seed: 3, purpose: "entry" }],
  provides: [CAP_COMPARE_WHOLE],
  standards: { ccss: ["1.NBT.B.3", "2.NBT.A.4", "4.NBT.A.2"] },
};

/**
 * Draft twice over.
 *
 * The prompt renderer is one blocker and the number layer is the other:
 * `NumberFormat` — the decimal separator, grouping, numbering system and direction
 * — is PR-2.2 and does not exist, so CG-14's locale round-trip cannot run on a
 * decimal answer. `dw.add.regroup.subtract-tenths` is here on the same footing and
 * has been since M2. Both blockers are named so a promotion PR knows it needs both.
 */
const compareDecimal: SkillNode = {
  id: SKILL_COMPARE_DECIMAL,
  rev: 2,
  status: "draft",
  title: locKey("dw.skill.ns.compare.decimals.title"),
  learnerGoal: locKey("dw.skill.ns.compare.decimals.goal"),
  domain: "ns",
  cluster: "compare",
  bigIdeas: [
    locKey("dw.idea.magnitude.numbers-have-order"),
    locKey("dw.idea.place-value.position-carries-value"),
  ],
  gradeBand: { earliest: 4, nominal: 5, latest: 5 },
  strandRole: "bridge",
  proficiency: { conceptual: 3, procedural: 2, strategic: 1, adaptive: 2 },
  classification: "conceptual",
  prereqs: [{ kind: "requires", to: SKILL_COMPARE_WHOLE }],
  difficulty: { b: b(-40n), levels: [b(-30n), b(20n), b(50n), b(100n)] },
  misconceptions: [MIS_LONGER_IS_BIGGER],
  representations: { required: [], optional: [] },
  generator: {
    family: COMPARE_ORDER_FAMILY,
    familyRev: COMPARE_ORDER_FAMILY_REV,
    // The top rung asks for the *lesser* of two numbers written to two and four
    // places, which is where the longer-is-bigger rule is most tempting and where
    // asking for the smaller one stops a child from answering "the long one" by
    // reflex on every card.
    params: [decimalPair(1, 1, 1), decimalPair(2, 1, 2), decimalPair(3, 2, 1), decimalPairLesser(4, 2, 2)],
    forms: [COMPARE_FORM],
    minVariants: 80,
    consumes: [CAP_COMPARE_WHOLE],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["4.NF.C.7", "5.NBT.A.3"] },
};

const roundWhole: SkillNode = {
  id: SKILL_ROUND_WHOLE,
  rev: 2,
  status: "draft",
  title: locKey("dw.skill.ns.round.whole-numbers.title"),
  learnerGoal: locKey("dw.skill.ns.round.whole-numbers.goal"),
  domain: "ns",
  cluster: "round",
  bigIdeas: [locKey("dw.idea.magnitude.nearest-landmark")],
  gradeBand: { earliest: 2, nominal: 4, latest: 5 },
  strandRole: "application",
  proficiency: { conceptual: 2, procedural: 3, strategic: 2, adaptive: 2 },
  classification: "procedural",
  prereqs: [
    { kind: "requires", to: SKILL_COMPARE_WHOLE },
    { kind: "supports", to: SKILL_DIGIT_VALUE },
  ],
  difficulty: {
    b: b(-30n),
    levels: [b(-10n), b(20n), b(30n), b(70n), b(110n), b(145n), b(205n)],
  },
  // No mal-rule, and `malrules/placeValue.ts` and this family's own header say why:
  // every documented rounding bug produces the correct answer on about half of all
  // items, and the only routes to CG-12's 95% divergence are to bias the content
  // towards rounding up or to have `applies()` decline the items where the bug is
  // right. The second is the self-filtering the mal-rule contract forbids.
  misconceptions: [],
  representations: { required: [], optional: [] },
  generator: {
    family: ROUND_ESTIMATE_FAMILY,
    familyRev: ROUND_ESTIMATE_FAMILY_REV,
    // A rung is **prepended**: `round(2, 1, 1, false)` is "round 47 to the nearest
    // ten", the smallest rounding question there is, and the row began at three
    // digits. The rung after it is unchanged; the one after *that* widens the place
    // range to ten-or-hundred, which is the reconciliation
    // `dw.ns.round.whole-numbers L0` was waiting on — a level that could be widened
    // and simply had not been.
    //
    // L4 and L5 are the same parameters with `ties` turned on, and stay that way. The
    // one thing that pair teaches is that a halfway number rounds up, so isolating it
    // is the whole point of it and a wider place range on L4 would have hidden the
    // difference inside a harder question. The reach to six digits therefore goes
    // above them rather than between them.
    params: [
      round(2, 1, 1, false),
      round(3, 1, 1, false),
      round(3, 1, 2, false),
      round(4, 1, 3, false),
      round(5, 2, 3, false),
      round(5, 2, 3, true),
      round(6, 3, 5, true),
    ],
    forms: [ROUND_FORM],
    // Sixty rather than eighty, because L0's whole problem space is seventy-two and
    // `minVariants` is one number for the row: CG-7 fails a row that declares more
    // variants than its own closed level holds. Every level above L1 clears CG-10's
    // floor of 975 by an order of magnitude, so nothing above is measured by this.
    minVariants: 60,
    // The two to-the-nearest-ten rungs are closed and small in the world, and the count
    // follows from the family's own two exclusions: the part below the rounding place is
    // never 0, because the number would already be round, and on a level that poses no
    // ties it is never 5 either. So a two-digit item is nine tens-digits by eight
    // units-digits — 72 — and a three-digit one is ninety by eight, which is 720. Both
    // are exhausted in `closedSpaces.test.ts`. L2 is the same content with the hundreds
    // place added and has 1,602 problems, which is why widening was the right instrument
    // there and closure is the right one here.
    closedFactSet: [72, 720, null, null, null, null, null],
    consumes: [CAP_READ_PLACE],
  },
  probes: [],
  provides: [],
  standards: { ccss: ["3.NBT.A.1", "4.NBT.A.3"] },
};

export const nsDomainNodes: readonly SkillNode[] = [
  digitInPlace,
  digitValue,
  regroupedCount,
  compareWhole,
  compareDecimal,
  roundWhole,
];
