/**
 * beatlounge — ribbon module actions (LLM-callable, pure, deterministic). The
 * ribbon performs into the melodic "Synth" track (the first non-drum instrument
 * track); recording captures live play as NoteEvents. These actions expose the
 * track-level operations the command bus indexes across modules with no shell
 * change. Kept free of React + audio so they unit-test in isolation.
 */

import type { ActionContext, ActionResult, ModuleAction } from "../../contracts/module"
import { findTrack, isInstrumentTrack } from "../../model/document"

/** Resolve the performance track: the bound track, else the first non-drum synth. */
export const ribbonTrackId = (ctx: ActionContext): string | undefined => {
  if (ctx.targetTrackId) return ctx.targetTrackId
  const synth = ctx.doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler"
  )
  return synth?.id
}

/** clear — wipe every recorded note from the bound performance track. */
export const clearAction: ModuleAction = {
  name: "clearRibbon",
  describe: "Clear every note the ribbon recorded into its track.",
  params: {},
  impact: "destructive",
  run(ctx): ActionResult {
    const trackId = ribbonTrackId(ctx)
    if (!trackId) return { commands: [], summary: "No melodic track" }
    const track = findTrack(ctx.doc, trackId)
    const count = track && isInstrumentTrack(track) ? track.notes.length : 0
    return {
      commands: count ? [{ t: "clearTrack", trackId }] : [],
      summary: count ? `Cleared ${count} notes` : "Already empty",
    }
  },
}

export const ribbonActions: ReadonlyArray<ModuleAction> = [clearAction]
