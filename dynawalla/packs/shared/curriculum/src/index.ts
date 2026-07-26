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

export { columnOpFamily, InfeasibleParamsError } from "./generators/columnOp/family.ts";
export { columnOpParamSchema } from "./generators/columnOp/params.ts";
export type { ColumnOpParams } from "./generators/columnOp/params.ts";
export * from "./generators/columnOp/constants.ts";
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

export { answerRendererId, findRenderer, rendererRegistry, repRendererId } from "./render/registry.ts";
export type { RendererDeclaration } from "./render/registry.ts";

export { digitsOf, plainDigits, readProblem, writtenAnswer } from "./board/problem.ts";
export type { ColumnOp, ColumnProblem } from "./board/problem.ts";
export { countingBoard } from "./board/countingBoard.ts";
export type { BoardCheck, BoardColumn, CountingBoard } from "./board/countingBoard.ts";
