import * as Tone from "tone"
import { createDrumKit, type DrumKit } from "./drumSynths"
import { createVoicePad, type VoicePad } from "./voicePad"
import { createSynthVoice, type SynthVoice } from "./synthVoice"
import type { Project, DrumTrackId } from "../model/project"

export type AudioEngine = {
  start: () => Promise<void>
  stop: () => void
  isPlaying: () => boolean
  setBpm: (bpm: number) => void
  setMasterVolume: (v: number) => void
  setProject: (project: Project) => void
  /** Subscribe to the playhead step (0..lengthSteps-1). Returns unsub. */
  onStep: (listener: (step: number) => void) => () => void
  /** Trigger a single drum track immediately (for click-to-preview). */
  previewTrack: (id: DrumTrackId, velocity?: number) => void
  /** Play a single synth note (for piano roll cell preview). */
  previewSynthNote: (midi: number, velocity?: number) => void
  voicePad: VoicePad
  drums: DrumKit
  synth: SynthVoice
  dispose: () => void
}

export const createAudioEngine = (): AudioEngine => {
  const limiter = new Tone.Limiter(-1).toDestination()
  const masterVol = new Tone.Volume(Tone.gainToDb(0.8)).connect(limiter)

  const drums = createDrumKit(masterVol)
  const voicePad = createVoicePad(masterVol)
  const synth = createSynthVoice(masterVol)

  let project: Project | null = null
  const stepListeners = new Set<(s: number) => void>()
  let currentStep = 0

  const loop = new Tone.Loop((time) => {
    if (!project) return
    const step = currentStep % project.lengthSteps

    // Drums + voice pad
    for (const track of project.tracks) {
      if (track.mute) continue
      if (!track.steps[step]) continue
      const v = Math.max(0, Math.min(1, track.volume))
      switch (track.id) {
        case "kick":  drums.kick.trigger(time, v); break
        case "snare": drums.snare.trigger(time, v); break
        case "hat":   drums.hat.trigger(time, v); break
        case "voice": voicePad.trigger(time, v); break
      }
    }

    // Synth (piano roll)
    if (!project.synth.mute) {
      const midi = project.synth.notes[step]
      if (midi != null) {
        const v = Math.max(0, Math.min(1, project.synth.volume))
        synth.trigger(midi, time, v)
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
    voicePad.setPitch(next.voicePad.pitchSemis)
  }

  const onStep = (listener: (s: number) => void) => {
    stepListeners.add(listener)
    return () => { stepListeners.delete(listener) }
  }

  const previewTrack = (id: DrumTrackId, velocity = 0.9) => {
    const time = Tone.now()
    switch (id) {
      case "kick":  drums.kick.trigger(time, velocity); break
      case "snare": drums.snare.trigger(time, velocity); break
      case "hat":   drums.hat.trigger(time, velocity); break
      case "voice": voicePad.trigger(time, velocity); break
    }
  }

  const previewSynthNote = (midi: number, velocity = 0.8) => {
    synth.trigger(midi, Tone.now(), velocity, 0.25)
  }

  return {
    start, stop, isPlaying,
    setBpm, setMasterVolume, setProject,
    onStep, previewTrack, previewSynthNote,
    voicePad, drums, synth,
    dispose: () => {
      loop.dispose()
      drums.dispose()
      voicePad.dispose()
      synth.dispose()
      masterVol.dispose()
      limiter.dispose()
    },
  }
}
