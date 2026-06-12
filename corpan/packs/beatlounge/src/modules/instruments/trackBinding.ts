/**
 * beatlounge — PURE track-binding helpers for the Instruments page (no React).
 *
 * The page keeps a single bound melodic track. As tracks are added / removed /
 * renamed it must keep that binding valid: re-bind to the first melodic track
 * when the bound one vanishes, and never delete the LAST melodic track (the page
 * needs one to play). These rules are pure so they unit-test without a DOM.
 */

import { isInstrumentTrack, type Id, type Track } from "../../model/document"

/** A melodic (non-drum) instrument track — the page's re-voiceable target. */
export const isMelodicTrack = (t: Track): boolean =>
  isInstrumentTrack(t) && t.instrument.kind !== "drumSampler"

/** The melodic tracks of a doc, in render order. */
export const melodicTracks = (tracks: readonly Track[]): Track[] =>
  tracks.filter(isMelodicTrack)

/**
 * Resolve the bound track id after a doc change: keep `current` if it is still a
 * melodic track, else fall back to the first melodic track (or undefined when
 * none remain). Mirrors the page's re-bind effect.
 */
export const rebindTrackId = (
  tracks: readonly Track[],
  current: Id | undefined
): Id | undefined => {
  const melodic = melodicTracks(tracks)
  if (current && melodic.some((t) => t.id === current)) return current
  return melodic[0]?.id
}

/** May this melodic track be removed? (Never the last one.) */
export const canRemoveTrack = (tracks: readonly Track[], id: Id): boolean => {
  const melodic = melodicTracks(tracks)
  return melodic.length > 1 && melodic.some((t) => t.id === id)
}

/** The track to bind AFTER removing `removingId` (the next melodic, else same). */
export const trackIdAfterRemoval = (
  tracks: readonly Track[],
  current: Id | undefined,
  removingId: Id
): Id | undefined => {
  if (current !== removingId) return current
  const melodic = melodicTracks(tracks)
  return melodic.find((t) => t.id !== removingId)?.id
}
