/**
 * beatlounge — phrase-JAM module actions. Pure, deterministic-given-rng, and
 * LLM-callable. `scramble` (re)places SAVED bank snippets across the phrase
 * track's grid for happy accidents: it clears the track's current placements
 * and lays a fresh, one-snippet-per-column pattern with an in-scale pitch
 * ladder (an instant riff). Seeded by ctx.rng so a reroll is reproducible and
 * the whole thing is one undo step (the bus wraps the command list in a batch).
 *
 * Bound to the FragmentTrack — the bound track, else the first kind:"fragment"
 * track. Kept free of React so it's unit-testable in isolation.
 */

import type { ActionContext, ActionResult, ModuleAction } from "../../contracts/module"
import type { Command } from "../../model/command"
import type { FragmentEvent } from "../../model/document"
import { findTrack, isFragmentTrack } from "../../model/document"
import { stepsInLoop, tickForStep } from "../../model/timing"
import { bankSnippets } from "../../phrase/bank"
import { planScramble } from "./jamModel"

/** Resolve the phrase track: the bound track, else the first fragment track. */
export const phraseTrackId = (ctx: ActionContext): string | undefined => {
  if (ctx.targetTrackId) return ctx.targetTrackId
  return ctx.doc.tracks.find(isFragmentTrack)?.id
}

/**
 * scramble — clear the phrase track and re-place bank snippets stochastically
 * (one snippet per chosen step column), pitched up an in-scale ladder. No-op
 * with a clear summary when there's no track / empty bank.
 */
export const scrambleAction: ModuleAction = {
  name: "scramble",
  describe:
    "Randomly (re)place your saved phrase snippets across the beat for a happy-accident riff.",
  params: {
    density: {
      type: "number",
      min: 0,
      max: 1,
      default: 0.6,
      describe: "0 = sparse, 1 = busy; how many step columns get a snippet.",
    },
  },
  stochastic: true,
  impact: "mutate",
  run(ctx: ActionContext, params: Record<string, unknown>): ActionResult {
    const trackId = phraseTrackId(ctx)
    if (!trackId) return { commands: [], summary: "No phrase track yet" }
    const track = findTrack(ctx.doc, trackId)
    if (!track || !isFragmentTrack(track))
      return { commands: [], summary: "No phrase track yet" }

    const bank = bankSnippets(ctx.doc)
    if (bank.length === 0)
      return { commands: [], summary: "Save some phrases first" }

    const steps = stepsInLoop(ctx.doc.loopLengthTicks, track.grid)
    if (steps <= 0) return { commands: [], summary: "Empty loop" }

    const density = Math.max(0, Math.min(1, Number(params.density ?? 0.6)))
    const plan = planScramble(bank.length, steps, ctx.rng, density)

    const commands: Command[] = []
    // Clear current placements first (so scramble REPLACES, like the drum kit).
    for (const ev of track.fragments) {
      commands.push({ t: "removeFragment", trackId, fragId: ev.id })
    }
    for (const p of plan) {
      const ref = bank[p.laneIndex]
      if (!ref) continue
      const frag: Omit<FragmentEvent, "id"> = {
        tick: tickForStep(p.step, track.grid),
        fragmentId: ref.id,
        gain: 0.9,
        pitchSemis: p.pitchSemis,
      }
      commands.push({ t: "placeFragment", trackId, frag })
    }

    if (commands.length === 0) return { commands: [], summary: "Nothing to scramble" }
    return { commands, summary: `Scrambled · ${plan.length} snippets` }
  },
}

export const phraseJamActions: ReadonlyArray<ModuleAction> = [scrambleAction]
