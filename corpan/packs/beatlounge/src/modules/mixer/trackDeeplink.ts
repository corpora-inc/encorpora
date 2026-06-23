/**
 * beatlounge — the per-track DEEPLINK resolver (pure, no React/store).
 *
 * The mixer's killer feature: tapping a track strip opens THAT track's dedicated
 * immersive page. The mapping is by track KIND so a strip always lands on the
 * right editor:
 *   • a DRUM track  (instrument · drumSampler) → the Drums step-grid (`step-grid`)
 *   • a MELODIC track (any other instrument)   → the Instruments page (`instruments`),
 *     bound to THAT synth via the selected-instrument slice
 *   • a PHRASE track (fragment / ttsFragment)  → Phrase Jam (`phrase-jam`)
 *
 * Pure so the (kind → module id) contract is unit-testable without a DOM. The
 * caller (MixerConsole) does the side effects: set the instrument selection for
 * melodic tracks, then `host.enterImmersive(moduleId)`.
 */

import { isFragmentTrack, isInstrumentTrack, type Track } from "../../model/document"

/** The immersive module ids a mixer strip can deeplink to. */
export type DeeplinkModuleId = "step-grid" | "instruments" | "phrase-jam"

export interface TrackDeeplink {
  /** The immersive module to open. */
  moduleId: DeeplinkModuleId
  /**
   * For a melodic track, the track id the Instruments page must bind to (set via
   * `setSelectedInstrumentTrackId` before entering). Undefined for drums/phrases
   * — those modules resolve their own (singleton) track.
   */
  selectInstrumentTrackId?: string
}

/** Is this a drum-kit track (the step-grid's target)? */
const isDrumTrack = (t: Track): boolean =>
  isInstrumentTrack(t) && t.instrument.kind === "drumSampler"

/**
 * Resolve which immersive a mixer strip opens for `track`, and (for melodic
 * tracks) which instrument the Instruments page should bind to. Pure.
 */
export const resolveTrackDeeplink = (track: Track): TrackDeeplink => {
  if (isFragmentTrack(track)) return { moduleId: "phrase-jam" }
  if (isDrumTrack(track)) return { moduleId: "step-grid" }
  // Every other instrument track is melodic → the Instruments page, bound to it.
  return { moduleId: "instruments", selectInstrumentTrackId: track.id }
}

/** A short label for the strip's "open" affordance, by deeplink target. */
export const deeplinkLabel = (target: DeeplinkModuleId): string => {
  switch (target) {
    case "step-grid":
      return "Drums"
    case "instruments":
      return "Synth"
    case "phrase-jam":
      return "Phrases"
  }
}
