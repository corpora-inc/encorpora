/**
 * Win-detection concern.
 *
 * The win check (flatten placed blocks into reading order — RTL aware — then
 * store.checkWin, and on success run the reward/bottle/color-cycle sequence) is
 * folded into useGameLogic via `onSentenceChanged()`, so it shares the same
 * timers/mounted-guard as loading and auto-advance. This module re-exports the
 * pure flatten helper (now owned by the cap-squeeze capability) for
 * direct/test use.
 */
export { flattenReadingOrder } from "@shared/capabilities/squeeze/src/readingOrder"
