/**
 * beatlounge — createBeatloungeAudio: wires the lookahead scheduler + the
 * audio-graph reconciler + the command bus into the AudioFacade the shell
 * consumes. The facade subscribes to the bus for the lifetime of the pack:
 * every doc change reconciles the graph (diff-driven) and re-points the
 * scheduler at the new immutable snapshot. The shell never touches Tone.
 */

import * as Tone from "tone"
import type { AudioFacade, CreateBeatloungeAudio } from "../contracts/audioFacade"
import type { TriggerNote } from "../contracts/engine"
import type { BeatloungeDoc } from "../model/document"
import { findTrack, isInstrumentTrack, DRUM_PITCH } from "../model/document"
import { createAudioGraph } from "./audioGraph"
import { createScheduler } from "./scheduler"
import { createModulationEngine } from "../modulation/engine"
import { bindTempoSource } from "../effects/tempo"

const makeContext = (): AudioContext =>
  new (globalThis.AudioContext ||
    (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)()

export const createBeatloungeAudio: CreateBeatloungeAudio = (bus, opts): AudioFacade => {
  const context = opts?.ctx ?? makeContext()
  const graph = createAudioGraph(context, opts?.fragmentDeps)
  const scheduler = createScheduler({ context })

  let current: BeatloungeDoc = bus.snapshot()
  // Bind the ambient tempo source to the live doc ONCE — tempo-synced effects
  // (delay) read it directly, so BPM is never threaded through the graph. The
  // closure tracks `current`, which is reassigned on every bus update below.
  bindTempoSource(() => current.bpm)
  void graph.reconcile(null, current)
  scheduler.setDoc(current)

  // Autonomous knob-tweakers: drives params each frame via graph.applyParam.
  // Idle (no rAF) until the doc has ≥1 enabled modulator.
  const modulation = createModulationEngine({ bus, graph })

  const offTrigger = scheduler.onTrigger((t) => graph.dispatch(t))
  const offBus = bus.subscribe((doc) => {
    const prev = current
    current = doc
    void graph.reconcile(prev, doc)
    scheduler.setDoc(doc)
  })

  const ensureRunning = async () => {
    if (context.state !== "running") {
      try {
        await Tone.start()
        await context.resume()
      } catch {
        /* will resume on the next user gesture */
      }
    }
  }

  return {
    async start() {
      await ensureRunning()
      await scheduler.start(0)
    },
    stop() {
      scheduler.stop()
    },
    isPlaying: () => scheduler.isPlaying(),
    onPlayhead: (cb) => scheduler.onPlayhead(cb),
    previewTrack(trackId, velocity = 0.9, pitch) {
      const track = findTrack(current, trackId)
      if (!track) return
      void ensureRunning()
      let p = pitch
      if (p == null) {
        p = 60
        if (isInstrumentTrack(track)) {
          p =
            track.instrument.kind === "drumSampler"
              ? DRUM_PITCH.kick
              : (track.notes[0]?.pitch ?? 60)
        }
      }
      const note: TriggerNote = { pitch: p, velocity, durationSec: 0.25 }
      graph.dispatch({ trackId, when: context.currentTime + 0.02, note })
    },
    applyParam(target, value) {
      graph.applyParam(target, value)
    },
    playLiveVoice(trackId, midi, velocity = 0.9) {
      void ensureRunning()
      const live = graph.liveInstrument(trackId)
      if (!live) return undefined
      // A hair ahead of now so the attack lands cleanly on the audio thread.
      const at = context.currentTime + 0.005
      const id = live.startVoice(midi, velocity, at)
      let released = false
      return {
        bend(m: number) {
          if (!released) live.bendVoice(id, m, context.currentTime)
        },
        release() {
          if (released) return
          released = true
          live.endVoice(id, context.currentTime)
        },
      }
    },
    context: () => context,
    dispose() {
      offTrigger()
      offBus()
      modulation.dispose()
      scheduler.dispose()
      graph.dispose()
    },
  }
}
