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
} from "../../model/document"
import { stepForTick, tickForStep } from "../../model/timing"

const DECAY = 0.82 // per-frame multiplier between playhead ticks

/** Peak velocity of any note landing on `step` of a track's grid. */
const hitAt = (doc: BeatloungeDoc, trackId: Id, step: number): number => {
  const track = doc.tracks.find((t) => t.id === trackId)
  if (!track) return 0
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
    return audio.onPlayhead((tick) => {
      const doc = store.vanilla.getState().doc
      const next: Record<Id, number> = {}
      for (const id of trackIds) {
        const prev = ref.current[id] ?? 0
        let lvl = prev * DECAY
        if (tick >= 0) {
          const track = doc.tracks.find((t) => t.id === id)
          if (track && isTrackAudible(doc, track)) {
            const step = stepForTick(tick, track.grid)
            const hit = hitAt(doc, id, step) * Math.max(0, Math.min(1, track.volume))
            if (hit > lvl) lvl = hit
          }
        } else {
          lvl = 0
        }
        next[id] = lvl
      }
      ref.current = next
      setLevels(next)
    })
  }, [store, audio, trackIds.join(",")]) // eslint-disable-line react-hooks/exhaustive-deps

  return levels
}
