// The one place the app reaches into `dynawalla/curriculum`.
//
// A relative path, deliberately, and exactly one of them. `@dynawalla/curriculum`
// is a private package with no `main`, no `exports` and no build step — its
// source is the artifact — so a bare specifier would resolve under Vite (an
// alias) and not under `node --experimental-strip-types --test`, which is what
// runs this app's tests. One relative import that all three toolchains resolve
// identically is worth more than a specifier that needs a config entry per tool.
//
// Everything the work surface uses passes through here, so when the package does
// gain a resolvable name, one file changes.

export {
  activeNodes,
  answerEquals,
  answerToString,
  classify,
  columnOpFamily,
  columnOpParamSchema,
  createRng,
  familyById,
  malRuleById,
  malRules,
  nodeById,
  skillId,
  COLUMN_OP_FAMILY,
  FORM_FREE_ENTRY,
  MIS_BORROW_ACROSS_ZERO,
  MIS_CARRY_DROPPED,
  MIS_SMALLER_FROM_LARGER,
  PROMPT_KEY_ADD,
  PROMPT_KEY_SUB,
  REP_COUNTING_BOARD,
  SLOT_BOTTOM,
  SLOT_TOP,
} from "../../../curriculum/src/index.ts"

// The exact-rational module, as a namespace. Every number that reaches a
// comparison or a rendered digit goes through it; nothing on this path is a
// JavaScript `number` that came from arithmetic.
export { rational as exact } from "../../../curriculum/src/index.ts"

export type {
  AnswerSchema,
  AnswerSchemaKind,
  AnswerValue,
  ColumnOpParams,
  Exercise,
  MalRuleId,
  PromptSlot,
  Rational,
  RepId,
  SkillId,
  SkillNode,
  Verdict,
} from "../../../curriculum/src/index.ts"
