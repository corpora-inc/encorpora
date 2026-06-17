/**
 * beatlounge — PURE record-placement for the InstrumentRibbon (no React/Tone).
 *
 * Decides, for ONE finger crossing a note, whether to lay a NoteEvent into the
 * bound track at the live playhead. Pulled out of the surface so the dedupe +
 * quantize-on/off + duplicate-cell rules unit-test without a DOM.
 *
 *  • Per-pointer step dedupe: one note per (grid step) crossing for a finger
 *    (don't spam the same step while gliding).
 *  • quantizeRecord = true → snap to the grid step boundary (default).
 *    quantizeRecord = false → place at the RAW playhead tick (free timing).
 *  • Never write a duplicate identical note (same tick + pitch) on a cell.
 */

import type { Command } from "../../model/command"
import type { Grid, Id, NoteEvent } from "../../model/document"
import { gridTicks, tickForStep } from "../../model/timing"

export interface RecordInput {
  /** The track to record into. */
  trackId: Id
  /** The track's notes (for the duplicate-cell guard). */
  notes: readonly NoteEvent[]
  /** The track's grid (step ↔ tick). */
  grid: Grid
  /** Live playhead STEP (-1 when stopped → lays at step 0). */
  playStep: number
  /** Live RAW playhead tick (-1 when stopped). Used when not quantizing. */
  playTick: number
  /** This finger's last recorded step (dedupe). */
  lastRecordedStep: number
  /** Quantize to the grid step (true) or place at the raw tick (false). */
  quantizeRecord: boolean
  /** The (resolved) pitch to record. */
  midi: number
}

export interface RecordResult {
  /** The addNote command to dispatch, or null (deduped / duplicate / no track). */
  command: Command | null
  /** The finger's new lastRecordedStep (carry it back into the touch). */
  lastRecordedStep: number
}

const clampPitch = (midi: number): number =>
  Math.max(0, Math.min(127, Math.round(midi)))

/** Pure record decision for one crossing. */
export const placeRecordedNote = (input: RecordInput): RecordResult => {
  const { trackId, notes, grid, playStep, playTick, lastRecordedStep, quantizeRecord, midi } = input
  const step = playStep >= 0 ? playStep : 0
  // One note per (step) crossing for THIS finger.
  if (step === lastRecordedStep) {
    return { command: null, lastRecordedStep }
  }
  const tick = quantizeRecord
    ? tickForStep(step, grid)
    : Math.max(0, playTick >= 0 ? playTick : tickForStep(step, grid))
  const pitch = clampPitch(midi)
  // Duplicate identical note on the same cell → no-op (but still advance dedupe).
  if (notes.some((n) => n.tick === tick && n.pitch === pitch)) {
    return { command: null, lastRecordedStep: step }
  }
  const command: Command = {
    t: "addNote",
    trackId,
    note: { tick, duration: gridTicks(grid), pitch, velocity: 0.8 },
  }
  return { command, lastRecordedStep: step }
}
