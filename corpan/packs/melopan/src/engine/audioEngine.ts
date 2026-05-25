import * as Tone from "tone"
import { createDrumKit, type DrumKit } from "./drumSynths"
import { createVoicePad, type VoicePad } from "./voicePad"
import { createSynthVoice, type SynthVoice } from "./synthVoice"
import type { Project, TrackId, VoiceTrackId } from "../model/project"
import { PIANO_ROLL_PITCHES, intervalForSteps } from "../model/project"

export type AudioEngine = {
  start: () => Promise<void>
  stop: () => void
  isPlaying: () => boolean
  setBpm: (bpm: number) => void
  setMasterVolume: (v: number) => void
  setProject: (project: Project) => void
  /** Subscribe to the playhead step (0..lengthSteps-1). Returns unsub. */
  onStep: (listener: (step: number) => void) => () => void
  /** Trigger a single track immediately (for click-to-preview). */
  previewTrack: (id: TrackId, velocity?: number) => Promise<void>
  /** Play a single synth note (for piano roll cell preview). */
  previewSynthNote: (midi: number, velocity?: number) => Promise<void>
  /** Per-voice-track pads, exposed so App.tsx can load samples. */
  voicePads: Record<VoiceTrackId, VoicePad>
  drums: DrumKit
  synth: SynthVoice
  dispose: () => void
}

export const createAudioEngine = (): AudioEngine => {
  const limiter = new Tone.Limiter(-1).toDestination()
  const masterVol = new Tone.Volume(Tone.gainToDb(0.8)).connect(limiter)

  const drums = createDrumKit(masterVol)
  const voicePads: Record<VoiceTrackId, VoicePad> = {
    voice1: createVoicePad(masterVol),
    voice2: createVoicePad(masterVol),
  }
  const synth = createSynthVoice(masterVol)

  let project: Project | null = null
  const stepListeners = new Set<(s: number) => void>()
  let currentStep = 0
  // Track the last interval string we applied so we can skip redundant
  // reassignment — Tone.Loop re-sequences on every interval set, which
  // would glitch playback on every pitch/volume edit.
  let loopIntervalStr = "16n"

  const ensureStarted = async (): Promise<void> => {
    if (Tone.context.state !== "running") {
      await Tone.start()
    }
  }

  const loop = new Tone.Loop((time) => {
    if (!project) return
    const step = currentStep % project.lengthSteps

    for (const track of project.tracks) {
      if (track.mute) continue
      if (!track.steps[step]) continue
      const v = Math.max(0, Math.min(1, track.volume))
      if (track.kind === "drum") {
        switch (track.id) {
          case "kick":  drums.kick.trigger(time, v); break
          case "snare": drums.snare.trigger(time, v); break
          case "hat":   drums.hat.trigger(time, v); break
        }
      } else {
        voicePads[track.id].trigger(time, v)
      }
    }

    // Synth (piano roll) — apply per-row accidental at trigger time.
    if (!project.synth.mute) {
      const baseMidi = project.synth.notes[step]
      if (baseMidi != null) {
        const rowIdx = PIANO_ROLL_PITCHES.indexOf(baseMidi)
        const effectiveMidi =
          rowIdx >= 0 ? baseMidi + (project.synth.accidentals[rowIdx] ?? 0) : baseMidi
        const v = Math.max(0, Math.min(1, project.synth.volume))
        synth.trigger(effectiveMidi, time, v)
      }
    }

    const visualStep = step
    Tone.Draw.schedule(() => {
      stepListeners.forEach((fn) => fn(visualStep))
    }, time)

    currentStep = (currentStep + 1) % project.lengthSteps
  }, "16n")

  const start = async () => {
    await Tone.start()
    currentStep = 0
    loop.start(0)
    Tone.Transport.start()
  }

  const stop = () => {
    Tone.Transport.stop()
    loop.stop(0)
    currentStep = 0
    stepListeners.forEach((fn) => fn(-1))
  }

  const isPlaying = () => Tone.Transport.state === "started"

  const setBpm = (bpm: number) => {
    Tone.Transport.bpm.value = Math.max(40, Math.min(240, bpm))
  }

  const setMasterVolume = (v: number) => {
    masterVol.volume.value = Tone.gainToDb(Math.max(0.0001, Math.min(1, v)))
  }

  const setProject = (next: Project) => {
    project = next
    Tone.Transport.bpm.value = next.bpm
    masterVol.volume.value = Tone.gainToDb(Math.max(0.0001, Math.min(1, next.masterVolume)))
    // The step grid resolution depends on lengthSteps × timeSignature;
    // recompute the loop interval so each step is one subdivision.
    // Only reassign when it actually changes — Tone.Loop re-sequences on the
    // setter, which would cause audible glitches on every pitch/volume edit.
    const [top, bottom] = next.timeSignature
    const newInterval = intervalForSteps(top, bottom, next.lengthSteps)
    if (newInterval !== loopIntervalStr) {
      loop.interval = newInterval
      loopIntervalStr = newInterval
    }
    // Sync per-voice-track pitch every time the project changes.
    for (const t of next.tracks) {
      if (t.kind === "voice") {
        voicePads[t.id].setPitch(t.pitchSemis)
      }
    }
  }

  const onStep = (listener: (s: number) => void) => {
    stepListeners.add(listener)
    return () => { stepListeners.delete(listener) }
  }

  const previewTrack = async (id: TrackId, velocity = 0.9) => {
    await ensureStarted()
    const time = Tone.now()
    switch (id) {
      case "kick":   drums.kick.trigger(time, velocity); break
      case "snare":  drums.snare.trigger(time, velocity); break
      case "hat":    drums.hat.trigger(time, velocity); break
      case "voice1": voicePads.voice1.trigger(time, velocity); break
      case "voice2": voicePads.voice2.trigger(time, velocity); break
    }
  }

  const previewSynthNote = async (midi: number, velocity = 0.8) => {
    await ensureStarted()
    synth.trigger(midi, Tone.now(), velocity, 0.25)
  }

  return {
    start, stop, isPlaying,
    setBpm, setMasterVolume, setProject,
    onStep, previewTrack, previewSynthNote,
    voicePads, drums, synth,
    dispose: () => {
      loop.dispose()
      drums.dispose()
      voicePads.voice1.dispose()
      voicePads.voice2.dispose()
      synth.dispose()
      masterVol.dispose()
      limiter.dispose()
    },
  }
}
