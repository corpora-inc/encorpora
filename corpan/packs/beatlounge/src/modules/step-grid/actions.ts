/**
 * beatlounge — step-grid module actions. Pure, deterministic-given-rng, and
 * LLM-callable. Each returns commands the bus applies in one undo step plus a
 * human summary. These are the en-masse mutations the (future) command bar
 * exposes to natural language; they also back tile/immersive buttons.
 *
 * Kept free of React so they're unit-testable in isolation.
 */

import type { ActionContext, ActionResult, ModuleAction } from "../../contracts/module"
import type { Command } from "../../model/command"
import { findTrack, isInstrumentTrack, DRUM_PITCH } from "../../model/document"
import { stepsInLoop, tickForStep } from "../../model/timing"

/** Resolve the drum track this module is bound to, else the first drum track. */
const drumTrackId = (ctx: ActionContext): string | undefined => {
  if (ctx.targetTrackId) return ctx.targetTrackId
  const drum = ctx.doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler"
  )
  return drum?.id
}

/** clear — wipe every note from the bound drum track. Destructive (confirm). */
export const clearAction: ModuleAction = {
  name: "clear",
  describe: "Clear every step in the drum pattern.",
  params: {},
  impact: "destructive",
  run(ctx): ActionResult {
    const trackId = drumTrackId(ctx)
    if (!trackId) return { commands: [], summary: "No drum track" }
    const track = findTrack(ctx.doc, trackId)
    const count =
      track && isInstrumentTrack(track) ? track.notes.length : 0
    return {
      commands: [{ t: "clearTrack", trackId }],
      summary: count ? `Cleared ${count} steps` : "Already empty",
    }
  },
}

/**
 * fillEveryOther — place a hat on every other step of the hat lane (a quick
 * eighth-feel skeleton over the track's grid). Mutate (preview-able).
 */
export const fillEveryOtherAction: ModuleAction = {
  name: "fillEveryOther",
  describe: "Fill the hi-hat lane on every other step.",
  params: {
    pitch: {
      type: "int",
      default: DRUM_PITCH.hat,
      describe: "Drum pad pitch to fill (defaults to hi-hat).",
    },
  },
  impact: "mutate",
  run(ctx, params): ActionResult {
    const trackId = drumTrackId(ctx)
    if (!trackId) return { commands: [], summary: "No drum track" }
    const track = findTrack(ctx.doc, trackId)
    if (!track || !isInstrumentTrack(track))
      return { commands: [], summary: "No drum track" }

    const pitch = Number(params.pitch ?? DRUM_PITCH.hat)
    const steps = stepsInLoop(ctx.doc.loopLengthTicks, track.grid)
    const commands: Command[] = []
    let added = 0
    for (let s = 0; s < steps; s += 2) {
      const tick = tickForStep(s, track.grid)
      const occupied = track.notes.some((n) => n.tick === tick && n.pitch === pitch)
      if (!occupied) {
        commands.push({ t: "toggleStep", trackId, step: s, pitch, velocity: 0.5 })
        added++
      }
    }
    return {
      commands: commands.length ? [{ t: "batch", commands, label: "Fill every other" }] : [],
      summary: added ? `+${added} hits` : "Nothing to add",
    }
  },
}

export const stepGridActions: ReadonlyArray<ModuleAction> = [
  clearAction,
  fillEveryOtherAction,
]
