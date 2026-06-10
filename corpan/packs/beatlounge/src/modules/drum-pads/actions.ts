/**
 * beatlounge — drum-pads module actions. Pure, deterministic-given-rng, and
 * LLM-callable. `randomPattern` lays a fresh, musical kit pattern by giving
 * each canonical lane its own Euclidean rhythm (kick/snare/hat/clap), seeded by
 * ctx.rng so a reroll is reproducible. Backs the immersive header button AND
 * the (future) command bar's natural-language surface.
 *
 * Bound to the drum track — the first drumSampler instrument track. Kept free
 * of React so it's unit-testable in isolation.
 */

import type { ActionContext, ActionResult, ModuleAction } from "../../contracts/module"
import type { NoteEvent } from "../../model/document"
import { DRUM_PITCH, findTrack, isInstrumentTrack } from "../../model/document"
import { gridTicks, stepsInLoop, tickForStep } from "../../model/timing"
import { euclidIndices } from "../../music/euclid"

/** Resolve the drum track: the bound track, else the first drumSampler track. */
export const drumTrackId = (ctx: ActionContext): string | undefined => {
  if (ctx.targetTrackId) return ctx.targetTrackId
  const drum = ctx.doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler"
  )
  return drum?.id
}

/** A lane's generative recipe: pitch, a pulse range, base velocity. */
interface LaneRecipe {
  pitch: number
  minPulses: number
  maxPulses: number
  velocity: number
}

/** Canonical kit recipes — musical pulse ranges per lane. */
const LANE_RECIPES: LaneRecipe[] = [
  { pitch: DRUM_PITCH.kick, minPulses: 3, maxPulses: 5, velocity: 0.95 },
  { pitch: DRUM_PITCH.snare, minPulses: 2, maxPulses: 4, velocity: 0.85 },
  { pitch: DRUM_PITCH.hat, minPulses: 6, maxPulses: 12, velocity: 0.5 },
  { pitch: DRUM_PITCH.clap, minPulses: 1, maxPulses: 3, velocity: 0.7 },
]

const pick = (rng: () => number, lo: number, hi: number): number =>
  lo + Math.floor(rng() * (hi - lo + 1))

/**
 * randomPattern — replace the drum track with a fresh kit: each canonical lane
 * gets its own Euclidean rhythm with a per-lane pulse count + rotation drawn
 * from ctx.rng. Deterministic given the seed (reroll = new seed).
 */
export const randomPatternAction: ModuleAction = {
  name: "randomPattern",
  describe: "Generate a fresh kit pattern (a Euclidean rhythm per lane).",
  params: {
    density: {
      type: "number",
      min: 0,
      max: 1,
      default: 0.5,
      describe: "0 = sparse, 1 = busy; scales each lane's pulse count.",
    },
  },
  stochastic: true,
  impact: "mutate",
  run(ctx, params): ActionResult {
    const trackId = drumTrackId(ctx)
    if (!trackId) return { commands: [], summary: "No drum track" }
    const track = findTrack(ctx.doc, trackId)
    if (!track || !isInstrumentTrack(track))
      return { commands: [], summary: "No drum track" }

    const steps = stepsInLoop(ctx.doc.loopLengthTicks, track.grid)
    if (steps <= 0) return { commands: [], summary: "Empty loop" }

    const density = Math.max(0, Math.min(1, Number(params.density ?? 0.5)))
    const dur = Math.round(gridTicks(track.grid) / 2)
    const notes: Omit<NoteEvent, "id">[] = []

    for (const lane of LANE_RECIPES) {
      // Density biases pulses toward the lane's max; rng adds variation.
      const span = lane.maxPulses - lane.minPulses
      const base = lane.minPulses + Math.round(span * density)
      const pulses = Math.max(
        lane.minPulses,
        Math.min(steps, pick(ctx.rng, Math.max(lane.minPulses, base - 1), Math.min(lane.maxPulses, base + 1)))
      )
      const rotate = pick(ctx.rng, 0, Math.max(0, steps - 1))
      for (const step of euclidIndices(pulses, steps, rotate)) {
        notes.push({
          tick: tickForStep(step, track.grid),
          duration: dur,
          pitch: lane.pitch,
          velocity: lane.velocity,
        })
      }
    }

    notes.sort((a, b) => a.tick - b.tick)
    return {
      commands: [{ t: "setNotes", trackId, notes }],
      summary: `New pattern · ${notes.length} hits`,
    }
  },
}

export const drumPadsActions: ReadonlyArray<ModuleAction> = [randomPatternAction]
