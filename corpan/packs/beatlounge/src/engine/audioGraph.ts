/**
 * beatlounge — the audio graph + diff-driven reconciler.
 *
 * Per track:  Instrument → Panner → trackGain → masterVol → Limiter(-1) → out
 * (the master tail is melopan's proven on-device chain). Mute/solo is a derived
 * GAIN (ramped, click-free), never a scheduler branch. reconcile(prev, next)
 * touches ONLY the nodes that changed between two docs — a single note edit
 * rebuilds nothing; a volume change ramps one gain.
 */

import * as Tone from "tone"
import type { AudioGraph, Instrument, ScheduledTrigger } from "../contracts/engine"
import type { BeatloungeDoc, Normalized, Track } from "../model/document"
import { isTrackAudible } from "../model/document"
import { createInstrument, instrumentKindOf } from "../instruments/createInstrument"

interface TrackNodes {
  instrument: Instrument
  panner: Tone.Panner
  gain: Tone.Gain
  kind: string
}

const RAMP = 0.008 // 8ms — click-free

const targetGain = (doc: BeatloungeDoc, track: Track): number =>
  isTrackAudible(doc, track) ? Math.max(0, Math.min(1, track.volume)) : 0

export const createAudioGraph = (ctx: AudioContext): AudioGraph => {
  // Ensure Tone uses our context so node times line up with the scheduler.
  Tone.setContext(ctx)

  const limiter = new Tone.Limiter(-1).toDestination()
  const masterVol = new Tone.Volume(Tone.gainToDb(0.8)).connect(limiter)

  const nodes = new Map<string, TrackNodes>()

  const build = (track: Track): TrackNodes => {
    const instrument = createInstrument(track.instrument)
    const gain = new Tone.Gain(0).connect(masterVol)
    const panner = new Tone.Panner(track.pan).connect(gain)
    instrument.output.connect(panner)
    void instrument.load({
      resolve: async () => new ArrayBuffer(0),
      url: async () => "",
    })
    return { instrument, panner, gain, kind: instrumentKindOf(track.instrument) }
  }

  const disposeTrack = (n: TrackNodes) => {
    n.instrument.dispose()
    n.panner.dispose()
    n.gain.dispose()
  }

  return {
    reconcile(prev, next) {
      const nextIds = new Set(next.tracks.map((t) => t.id))

      // Removed tracks.
      for (const [id, n] of nodes) {
        if (!nextIds.has(id)) {
          disposeTrack(n)
          nodes.delete(id)
        }
      }

      const when = ctx.currentTime
      for (const track of next.tracks) {
        let n = nodes.get(track.id)
        const kind = instrumentKindOf(track.instrument)
        if (n && n.kind !== kind) {
          // Instrument engine changed → rebuild this track only.
          disposeTrack(n)
          nodes.delete(track.id)
          n = undefined
        }
        if (!n) {
          n = build(track)
          nodes.set(track.id, n)
        } else {
          void n.instrument.update(track.instrument)
        }
        // Always reconcile mute/solo-derived gain + pan (cheap, idempotent).
        n.gain.gain.cancelScheduledValues(when)
        n.gain.gain.setTargetAtTime(targetGain(next, track), when, RAMP)
        n.panner.pan.setTargetAtTime(track.pan, when, RAMP)
      }

      if (!prev || prev.masterVolume !== next.masterVolume) {
        this.setMasterVolume(next.masterVolume)
      }
    },

    dispatch(t: ScheduledTrigger) {
      const n = nodes.get(t.trackId)
      if (n) n.instrument.trigger(t.note, t.when)
    },

    setMasterVolume(v: Normalized) {
      masterVol.volume.value = Tone.gainToDb(Math.max(0.0001, Math.min(1, v)))
    },

    dispose() {
      for (const n of nodes.values()) disposeTrack(n)
      nodes.clear()
      masterVol.dispose()
      limiter.dispose()
    },
  }
}
