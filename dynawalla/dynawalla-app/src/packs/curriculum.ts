// The one place the host reaches across into `packs/shared/curriculum`.
//
// The path is deep and it is a directory boundary, so it is written once. Two
// consequences worth keeping: `vite.config.ts` has a note about what serving a
// sibling package costs, and moving the curriculum to a real package name is a
// change to this file and nothing else.
//
// Re-exported rather than aliased so the import graph is greppable: everything
// the host uses out of the curriculum is on this page.

export {
  activeNodes,
  allNodes,
  createRng,
  familyById,
  FORM_FREE_ENTRY,
  generatorFamilies,
  nodeById,
  promptOperator,
  promptRegistry,
  rational,
  seedFrom,
  SLOT_BOTTOM,
  SLOT_TOP,
} from "../../../packs/shared/curriculum/src/index.ts"

export type {
  AnswerValue,
  AnyGeneratorFamily,
  Exercise,
  PromptOperator,
  PromptSlot,
  Rational,
  SkillNode,
} from "../../../packs/shared/curriculum/src/index.ts"
