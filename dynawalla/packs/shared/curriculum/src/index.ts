/**
 * `@dynawalla/curriculum` — the graph, the generators, the mal-rules.
 *
 * The app imports from here. The validator imports the gates directly; they are
 * tooling and are deliberately not part of this surface.
 */

export * from "./types/ids.ts";
export * from "./types/answer.ts";
export type * from "./types/exercise.ts";
export type * from "./types/skill.ts";
export type * from "./types/generator.ts";
export type * from "./types/malrule.ts";
export { erase } from "./types/generator.ts";

export * as rational from "./math/rational.ts";
export type { Rational } from "./math/rational.ts";

export { createRng, fnv1a32, seedFrom, SEED_SEPARATOR } from "./rng/rng.ts";
export type { Rng } from "./rng/rng.ts";
export { fnv1a64, fnv1a64Hex } from "./rng/hash.ts";

export { fingerprintItem, serializeExercise } from "./serialize.ts";

export { activeNodes, allNodes, nodeById, nodeIndex } from "./graph/graph.ts";
export { addDomainNodes } from "./graph/domains/add.ts";
export { algDomainNodes } from "./graph/domains/alg.ts";
export { divDomainNodes } from "./graph/domains/div.ts";
export { fracDomainNodes } from "./graph/domains/frac.ts";
export { intDomainNodes } from "./graph/domains/int.ts";
export { mulDomainNodes } from "./graph/domains/mul.ts";
export { nsDomainNodes } from "./graph/domains/ns.ts";

export { columnOpFamily, InfeasibleParamsError } from "./generators/columnOp/family.ts";
export { columnOpParamSchema } from "./generators/columnOp/params.ts";
export type { ColumnOpParams } from "./generators/columnOp/params.ts";
export * from "./generators/columnOp/constants.ts";
export { compareOrderFamily } from "./generators/compareOrder/family.ts";
export { compareOrderParamSchema } from "./generators/compareOrder/params.ts";
export type { CompareOrderParams } from "./generators/compareOrder/params.ts";
export { fracArithFamily } from "./generators/fracArith/family.ts";
export { fracArithParamSchema } from "./generators/fracArith/params.ts";
export type { FracArithParams } from "./generators/fracArith/params.ts";
export { fracEquivalenceFamily } from "./generators/fracEquivalence/family.ts";
export { fracEquivalenceParamSchema } from "./generators/fracEquivalence/params.ts";
export type { FracEquivalenceParams } from "./generators/fracEquivalence/params.ts";
export { longDivFamily } from "./generators/longDiv/family.ts";
export { longDivParamSchema } from "./generators/longDiv/params.ts";
export type { LongDivParams } from "./generators/longDiv/params.ts";
export { missingOperandFamily } from "./generators/missingOperand/family.ts";
export { missingOperandParamSchema } from "./generators/missingOperand/params.ts";
export type { MissingOperandParams } from "./generators/missingOperand/params.ts";
export { numberFactsFamily } from "./generators/numberFacts/family.ts";
export { numberFactsParamSchema } from "./generators/numberFacts/params.ts";
export type { NumberFactsParams } from "./generators/numberFacts/params.ts";
export { factSet, factSetSize } from "./generators/numberFacts/facts.ts";
export type { Fact } from "./generators/numberFacts/facts.ts";
// Named rather than `export *`: `gen.arith.column-op` already exports its whole
// constants module here, and both families have a `PROMPT_KEY_ADD`.
export {
  NUMBER_FACTS_FAMILY,
  NUMBER_FACTS_FAMILY_REV,
  NUMBER_FACTS_FORMS,
  NUMBER_FACTS_LOC_KEYS,
} from "./generators/numberFacts/constants.ts";
export { timesTableFamily } from "./generators/timesTable/family.ts";
export { timesTableParamSchema } from "./generators/timesTable/params.ts";
export type { TimesTableParams } from "./generators/timesTable/params.ts";
export { factSet as timesTableSet, factSetSize as timesTableSetSize } from "./generators/timesTable/facts.ts";
// Named rather than `export *`: three families now define a `PROMPT_KEY_MUL`.
export {
  TIMES_TABLE_FAMILY,
  TIMES_TABLE_FAMILY_REV,
  TIMES_TABLE_FORMS,
  TIMES_TABLE_LOC_KEYS,
} from "./generators/timesTable/constants.ts";
export { signedIntFamily } from "./generators/signedInt/family.ts";
export { signedIntParamSchema } from "./generators/signedInt/params.ts";
export type { SignedIntParams, SignedOp, SignPlacement } from "./generators/signedInt/params.ts";
export { pairSet, pairSetSize } from "./generators/signedInt/pairs.ts";
export type { Pair } from "./generators/signedInt/pairs.ts";
export {
  SIGNED_INT_FAMILY,
  SIGNED_INT_FAMILY_REV,
  SIGNED_INT_FORMS,
  SIGNED_INT_LOC_KEYS,
} from "./generators/signedInt/constants.ts";
export { multidigitMulFamily } from "./generators/multidigitMul/family.ts";
export { multidigitMulParamSchema } from "./generators/multidigitMul/params.ts";
export type { MultidigitMulParams } from "./generators/multidigitMul/params.ts";
export { placeValueFamily } from "./generators/placeValue/family.ts";
export { placeValueParamSchema } from "./generators/placeValue/params.ts";
export type { PlaceValueParams } from "./generators/placeValue/params.ts";
export { roundEstimateFamily } from "./generators/roundEstimate/family.ts";
export { roundEstimateParamSchema } from "./generators/roundEstimate/params.ts";
export type { RoundEstimateParams } from "./generators/roundEstimate/params.ts";
export { InfeasibleLevelError } from "./generators/shared/errors.ts";
export { familyById, generatorFamilies } from "./generators/registry.ts";

export { classify, classifyAll, malRuleById, malRules, malRulesForFamily } from "./malrules/registry.ts";
export {
  borrowAcrossZero,
  carryDropped,
  columnOpMalRules,
  smallerFromLarger,
  MIS_BORROW_ACROSS_ZERO,
  MIS_CARRY_DROPPED,
  MIS_SMALLER_FROM_LARGER,
  REP_COUNTING_BOARD,
} from "./malrules/columnOp.ts";

export { compareOrderMalRules, MIS_LARGER_DENOMINATOR_LARGER_FRACTION, MIS_LONGER_IS_BIGGER } from "./malrules/compareOrder.ts";
export {
  fracArithMalRules,
  fracEquivalenceMalRules,
  MIS_ADD_NUMERATORS_AND_DENOMINATORS,
  MIS_MIXED_NUMBER_CONCATENATION,
  MIS_SCALE_BOTH_PARTS,
} from "./malrules/fractions.ts";
export { longDivMalRules, MIS_QUOTIENT_ZERO_SKIPPED, MIS_REMAINDER_DROPPED } from "./malrules/longDiv.ts";
export { missingOperandMalRules, MIS_ADD_ALL_NUMBERS, MIS_EQUALS_AS_OPERATOR } from "./malrules/missingOperand.ts";
export {
  multidigitMulMalRules,
  MIS_CARRY_ADDED_BEFORE_MULTIPLYING,
  MIS_PARTIAL_PRODUCT_MISALIGNED,
} from "./malrules/multidigitMul.ts";
export { placeValueMalRules, MIS_DIGIT_FOR_VALUE } from "./malrules/placeValue.ts";
export { MIS_WHOLE_NUMBER_BIAS } from "./malrules/roots.ts";

export {
  answerRendererId,
  answerRendererIdFor,
  findRenderer,
  rendererRegistry,
  repRendererId,
} from "./render/registry.ts";
export { findPromptTemplate, promptOperator, promptRegistry } from "./render/prompts.ts";
export type { PromptOperator, PromptTemplateDeclaration } from "./render/prompts.ts";
export type { RendererDeclaration } from "./render/registry.ts";
export {
  balanceLowerPan,
  numberLinePoint,
  repSpecDefect,
  REP_BALANCE_SCALE,
  REP_GEAR_TRAIN,
  REP_NUMBER_LINE,
  REP_TEN_FRAME,
  REQUIRED_REP_PARAMS,
  TEN_FRAME_CAPACITIES,
  V1_REPRESENTATIONS,
} from "./render/representations.ts";

export { digitsOf, plainDigits, readProblem, writtenAnswer } from "./board/problem.ts";
export type { ColumnOp, ColumnProblem } from "./board/problem.ts";
export { countingBoard } from "./board/countingBoard.ts";
export type { BoardCheck, BoardColumn, CountingBoard } from "./board/countingBoard.ts";
