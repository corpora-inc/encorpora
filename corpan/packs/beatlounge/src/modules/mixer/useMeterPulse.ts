/**
 * beatlounge — a synthetic per-track meter pulse derived from the playhead.
 *
 * The engine doesn't yet report real RMS (see Meter's doc note), so the mixer
 * shows a musically-honest stand-in: a track's meter lights when a note sits at
 * (or just before) the current playhead step, scaled by that note's velocity ×
 * the track's audible gain, with a short decay. Stopped ⇒ all dark. This is
 * purely visual; it never touches audio. Swap to real RMS taps later without a
 * UI change (same 0..1 contract per trackId).
 */

import { useEffect, useRef, useState } from "react"
import type { AudioFacade } from "../../contracts/audioFacade"
import type { BeatloungeStore } from "../../store/store"
import {
  isInstrumentTrack,
  isTrackAudible,
  type BeatloungeDoc,
  type Id,
  type Track,
} from "../../model/document"
import { stepForTick, tickForStep } from "../../model/timing"

const DECAY = 0.82 // per-frame multiplier between playhead ticks
/** Below this, a meter has effectively settled to dark — stop re-rendering for it. */
const SETTLE_EPS = 0.004

/** Peak velocity of any note landing on `step` of a track's grid. */
const hitAt = (track: Track, step: number): number => {
  if (isInstrumentTrack(track)) {
    const tick = tickForStep(step, track.grid)
    let peak = 0
    for (const n of track.notes) if (n.tick === tick && n.velocity > peak) peak = n.velocity
    return peak
  }
  const tick = tickForStep(step, track.grid)
  let peak = 0
  for (const f of track.fragments) if (f.tick === tick && f.gain > peak) peak = f.gain
  return peak
}

/** Returns a map trackId → 0..1 level, updated on the playhead, decaying. */
export const useMeterPulse = (
  store: BeatloungeStore,
  audio: AudioFacade,
  trackIds: Id[]
): Record<Id, number> => {
  const [levels, setLevels] = useState<Record<Id, number>>({})
  const ref = useRef<Record<Id, number>>({})

  useEffect(() => {
    // Cache a trackId→Track map keyed by doc IDENTITY — the doc reference only
    // changes on an edit, not per playhead frame, so we rebuild the map ~never
    // instead of doing two .find() scans per track per frame (the hot path).
    let cachedDoc: BeatloungeDoc | null = null
    let trackMap: Map<Id, Track> = new Map()
    return audio.onPlayhead((tick) => {
      const doc = store.vanilla.getState().doc
      if (doc !== cachedDoc) {
        cachedDoc = doc
        trackMap = new Map(doc.tracks.map((t) => [t.id, t]))
      }
      const next: Record<Id, number> = {}
      let changed = false
      for (const id of trackIds) {
        const prev = ref.current[id] ?? 0
        let lvl = prev * DECAY
        if (tick >= 0) {
          const track = trackMap.get(id)
          if (track && isTrackAudible(doc, track)) {
            const step = stepForTick(tick, track.grid)
            const hit = hitAt(track, step) * Math.max(0, Math.min(1, track.volume))
            if (hit > lvl) lvl = hit
          }
        } else {
          lvl = 0
        }
        next[id] = lvl
        if (Math.abs(lvl - prev) > SETTLE_EPS) changed = true
      }
      ref.current = next
      // Skip the re-render once every meter has settled (all within SETTLE_EPS of
      // their prior value) — e.g. a held/stopped mix stops churning React entirely.
      if (changed) setLevels(next)
    })
  }, [store, audio, trackIds.join(",")]) // eslint-disable-line react-hooks/exhaustive-deps

  return levels
}
