/**
 * Shared game chrome: the things every Dynawalla game needs and none of them
 * should implement twice.
 *
 * `insets`      — the safe rectangle, as numbers a canvas can lay out against.
 * `hostChrome`  — where the HOST draws over the game, so nothing is covered.
 * `instructions`— one "how to play" surface, populated per game.
 */
export { safeInsets, onInsetsChange, safeRect, NO_INSETS, type Insets } from "./insets.ts"
export {
  exitRect,
  helpRect,
  chromeRects,
  hitsHostChrome,
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  type Rect,
} from "./hostChrome.ts"
export {
  createInstructions,
  type Instructions,
  type InstructionsSpec,
  type Section,
} from "./instructions.ts"
