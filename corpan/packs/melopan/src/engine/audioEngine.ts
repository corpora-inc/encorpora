import * as Tone from "tone"
import { createDrumKit, type DrumKit } from "./drumSynths"
import { createVoicePad, type VoicePad } from "./voicePad"
import { createSynthVoice, type SynthVoice } from "./synthVoice"
import type { Project, TrackId, VoiceTrackId, DelayChannelId } from "../model/project"
import { PIANO_ROLL_PITCHES, intervalForSteps, REVERB_ROOM_GRID } from "../model/project"

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

  // Aux-send FX topology — each channel has independent sends per effect.
  //
  //   channel → dry      → masterVol                       (always full)
  //           → delaySend  → delay  → masterDelayWet  → masterVol
  //           → reverbSend → reverb → masterReverbWet → masterVol
  //
  // Effects' internal `wet` stays at 1 (pure wet output). The global
  // "Mix" knobs are the masterDelayWet / masterReverbWet gains. Per-channel
  // send levels (0..1) live on each channel's *Send gain. Off-routing = 0.
  // `maxDelay` must accommodate slowest BPM × longest preset (4n. at
  // BPM 40 = 2.25 s). The Tone default of 1 s would throw when the
  // user picked a dotted quarter at slow tempo — black-screen in v0.2.5.
  const delay = new Tone.FeedbackDelay({
    delayTime: "8n",
    feedback: 0.35,
    wet: 1,
    maxDelay: 3,
  })
  const masterDelayWet = new Tone.Gain(0).connect(masterVol)
  delay.connect(masterDelayWet)
  let delayTimeStr: string = "8n"

  const reverb = new Tone.Freeverb({
    roomSize: 0.40,
    dampening: 3000,
    wet: 1,
  })
  const masterReverbWet = new Tone.Gain(0).connect(masterVol)
  reverb.connect(masterReverbWet)
  let reverbRoomSize: number = 0.40

  const makeChannel = () => {
    const input = new Tone.Gain(1)
    const delaySend = new Tone.Gain(0)
    const reverbSend = new Tone.Gain(0)
    input.connect(masterVol)  // dry path (always unity)
    input.connect(delaySend)
    input.connect(reverbSend)
    delaySend.connect(delay)
    reverbSend.connect(reverb)
    return { input, delaySend, reverbSend }
  }
  const channels: Record<
    DelayChannelId,
    { input: Tone.Gain; delaySend: Tone.Gain; reverbSend: Tone.Gain }
  > = {
    kick:   makeChannel(),
    snare:  makeChannel(),
    hat:    makeChannel(),
    voice1: makeChannel(),
    voice2: makeChannel(),
    synth:  makeChannel(),
  }

  const drums = createDrumKit({
    kick:  channels.kick.input,
    snare: channels.snare.input,
    hat:   channels.hat.input,
  })
  const voicePads: Record<VoiceTrackId, VoicePad> = {
    voice1: createVoicePad(channels.voice1.input),
    voice2: createVoicePad(channels.voice2.input),
  }
  const synth = createSynthVoice(channels.synth.input)

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

    const chIds: DelayChannelId[] = ["kick", "snare", "hat", "voice1", "voice2", "synth"]

    // Sync master delay. Reassigning delayTime cancels in-flight echoes,
    // so guard it — only push the new value when it changed.
    const d = next.delay
    if (d) {
      if (d.time !== delayTimeStr) {
        delay.delayTime.value = d.time
        delayTimeStr = d.time
      }
      delay.feedback.value = Math.max(0, Math.min(0.9, d.feedback))
      masterDelayWet.gain.value = d.enabled ? Math.max(0, Math.min(1, d.wet)) : 0
      for (const ch of chIds) {
        const cfg = d.routing?.[ch]
        const level = cfg ? (cfg.enabled ? Math.max(0, Math.min(1, cfg.level)) : 0) : 1
        channels[ch].delaySend.gain.value = level
      }
    }

    // Sync master reverb.
    const r = next.reverb
    if (r) {
      const preset = REVERB_ROOM_GRID.find((p) => p.id === r.room)
      const rs = preset ? preset.roomSize : 0.4
      if (rs !== reverbRoomSize) {
        reverb.set({ roomSize: rs })
        reverbRoomSize = rs
      }
      const damp = Math.max(0, Math.min(1, r.dampening))
      reverb.set({ dampening: (1 - damp) * 8000 + 1000 })
      masterReverbWet.gain.value = r.enabled ? Math.max(0, Math.min(1, r.wet)) : 0
      for (const ch of chIds) {
        const cfg = r.routing?.[ch]
        const level = cfg ? (cfg.enabled ? Math.max(0, Math.min(1, cfg.level)) : 0) : 1
        channels[ch].reverbSend.gain.value = level
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
      for (const ch of Object.values(channels)) {
        ch.delaySend.dispose()
        ch.reverbSend.dispose()
        ch.input.dispose()
      }
      masterDelayWet.dispose()
      delay.dispose()
      masterReverbWet.dispose()
      reverb.dispose()
      masterVol.dispose()
      limiter.dispose()
    },
  }
}
