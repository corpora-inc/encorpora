/**
 * Shared game chrome: the things every Dynawalla game needs and none of them
 * should implement twice.
 *
 * `insets`      — the safe rectangle, as numbers a canvas can lay out against.
 * `hostChrome`  — where the HOST draws over the game, so nothing is covered.
 * `instructions`— one "how to play" surface, populated per game.
 * `audioHold`   — the pack's sound, stopped while that surface is up. Mounting
 *                 the manual arms it; no game imports it or calls it.
 */
export { safeInsets, setHostInsets, onInsetsChange, safeRect, NO_INSETS, type Insets } from "./insets.ts"
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
  sheetTop,
  type Instructions,
  type InstructionsSpec,
  type Section,
} from "./instructions.ts"
// `forgetAudioContexts` is deliberately NOT re-exported. It drops the registry
// and zeroes the depth, so a game that reached for it would silently defeat the
// hold for the whole pack. It stays importable from `./audioHold.ts` by the
// tests that need it and by nothing else.
export { installAudioHold, holdAudio, releaseAudio, isAudioHeld } from "./audioHold.ts"
