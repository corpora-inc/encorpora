/**
 * beatlounge — PURE hold-duration for the InstrumentRibbon record path (#397).
 *
 * A recorded note is laid at its note-ON one grid step long (see
 * recordPlacement). While the finger is HELD, the note should SUSTAIN — this
 * computes how long, given where the note started and where the playhead is NOW
 * (the next crossing for that finger, or the release). Floors at one step, so a
 * tap stays a step and never collapses to a zero-length dot; quantized recording
 * rounds the held length to whole steps so a sustained note still lands on grid.
 *
 * Pure (no React/Tone) so the note-on → note-off length unit-tests without a DOM.
 */

import type { Grid, Tick } from "../../model/document"
import { gridTicks, stepForTick } from "../../model/timing"

/**
 * Ticks a held note should span from `startTick` to the playhead `nowTick`.
 *  • nowTick < 0 (transport stopped) or no elapsed time ⇒ one step (the default).
 *  • quantize ⇒ whole steps held (min one).
 *  • free timing ⇒ the raw held length, floored at one step.
 */
export const heldNoteDuration = (
  startTick: Tick,
  nowTick: Tick,
  grid: Grid,
  quantize: boolean
): Tick => {
  const step = gridTicks(grid)
  if (nowTick < 0 || nowTick <= startTick) return step
  if (quantize) {
    const steps = Math.max(1, stepForTick(nowTick, grid) - stepForTick(startTick, grid))
    return steps * step
  }
  return Math.max(step, nowTick - startTick)
}
