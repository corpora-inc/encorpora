/**
 * beatlounge — the ttsFragment instrument: a polyphonic phrase-sampler voice.
 *
 * One `Tone.GrainPlayer` per FRAGMENT (lazily built + cached by fragmentId).
 * A trigger:
 *   - resolves the fragment's audio bytes (AudioSource → IndexedDB cache),
 *     decodes them into the grain player ONCE, and plays it,
 *   - applies the per-step PITCH via `detune = pitchSemis * 100` (the riff),
 *   - applies SCRATCH by driving the player's `playbackRate` along the
 *     `scratchCurve` keyframes across the step (turntable rate envelope),
 *   - honours `stretch` (grain time-stretch independent of pitch) + `reverse`.
 *
 * If a fragment has NO bytes (tier "synthVox", or bytes fail to decode), it
 * falls back to a vocal-ish AMSynth tone pitched by the same semitones — so a
 * cell is NEVER silent (ported from melopan's voicePad synth-vox).
 *
 * Ported pitch/scratch primitive from melopan voicePad + the GrainPlayer detune
 * convention. Implements the frozen `Instrument` contract; the INTEGRATOR wires
 * `createTtsFragmentInstrument` into createInstrument.ts (see report).
 */

import * as Tone from "tone"
import type { Instrument, TriggerNote, AssetLoader } from "../contracts/engine"
import type { InstrumentConfig, Id, FragmentRef } from "../model/document"
import type { AudioSource } from "../phrase/audioSource"
import { decodeFragmentBytes } from "../phrase/decode"

type TtsConfig = Extract<InstrumentConfig, { kind: "ttsFragment" }>

/**
 * What the instrument needs beyond its config: the AudioSource to read cached
 * bytes, and a resolver from a fragmentId → its FragmentRef (so it can find the
 * content hash to look up bytes). Injected by createInstrument.ts at build time.
 */
export interface TtsFragmentDeps {
  audioSource: AudioSource
  /** Resolve a placed fragment's library ref (carries sha256 + text + lang). */
  getFragmentRef: (fragmentId: Id) => FragmentRef | undefined
}

interface FragmentVoice {
  player: Tone.GrainPlayer | null
  /** True once we've attempted to load bytes (avoid repeat IDB hits). */
  loadAttempted: boolean
  /** True when a real, decoded sample is ready (else synth-vox). */
  ready: boolean
  reversed: boolean
}

export const createTtsFragmentInstrument = (
  config: TtsConfig,
  deps: TtsFragmentDeps
): Instrument => {
  const out = new Tone.Gain(1)

  // ---- synth-vox fallback (vocal-ish hum), always available ----
  const synthVox = new Tone.AMSynth({
    oscillator: { type: "sine" },
    modulation: { type: "triangle" },
    harmonicity: 1.5,
    envelope: { attack: 0.02, decay: 0.18, sustain: 0.45, release: 0.3 },
    modulationEnvelope: { attack: 0.03, decay: 0.1, sustain: 0.8, release: 0.3 },
    volume: -4,
  })
  const vibrato = new Tone.Vibrato({ frequency: 5, depth: 0.06 })
  synthVox.chain(vibrato, out)

  const voices = new Map<Id, FragmentVoice>()
  let voiceId = config.voiceId
  let disposed = false
  // Live pitch-ribbon offset (semitones), driven by applyParam("pitchOffset").
  // Added to every trigger's baked pitchSemis so a performer can bend the whole
  // phrase track in real time without rewriting the document. NOT persisted.
  let pitchOffset = 0

  const ensureVoice = (fragmentId: Id): FragmentVoice => {
    let v = voices.get(fragmentId)
    if (!v) {
      v = { player: null, loadAttempted: false, ready: false, reversed: false }
      voices.set(fragmentId, v)
    }
    return v
  }

  /** Lazily load + decode a fragment's bytes into its GrainPlayer. */
  const loadVoice = async (fragmentId: Id): Promise<void> => {
    const v = ensureVoice(fragmentId)
    if (v.loadAttempted) return
    v.loadAttempted = true
    const ref = deps.getFragmentRef(fragmentId)
    if (!ref?.sha256) return // no hash ⇒ synth-vox
    try {
      const bytes = await deps.audioSource.getCachedAudio(ref.sha256)
      if (!bytes) return
      const buffer = await decodeFragmentBytes(Tone.getContext().rawContext, bytes)
      if (!buffer || disposed) return
      const player = new Tone.GrainPlayer({
        grainSize: 0.1,
        overlap: 0.05,
        loop: false,
        playbackRate: 1,
        detune: 0,
      }).connect(out)
      player.buffer = new Tone.ToneAudioBuffer(buffer)
      v.player = player
      v.ready = true
    } catch (err) {
      console.warn("[beatlounge/ttsFragment] voice load failed:", fragmentId, err)
    }
  }

  /**
   * Apply a turntable-scratch playbackRate envelope across the step. GrainPlayer
   * exposes `playbackRate` as a plain number (not an automatable Param), so we
   * schedule the keyframes with the context clock: each keyframe flips the rate
   * at its evenly-spaced audio time. The sign of a keyframe sets direction
   * (negative ⇒ reverse scrub); we also flip `reverse` to match. A single
   * keyframe just sets a constant rate.
   */
  const scratchTimers = new Set<ReturnType<typeof setTimeout>>()
  const applyScratch = (
    player: Tone.GrainPlayer,
    curve: number[],
    when: number,
    durationSec: number
  ): void => {
    if (curve.length === 0) return
    const ctxNow = Tone.now()
    const dt = durationSec / Math.max(1, curve.length - 1)
    curve.forEach((rate, i) => {
      const at = when + i * dt
      const delayMs = Math.max(0, (at - ctxNow) * 1000)
      const apply = () => {
        if (disposed) return
        player.reverse = rate < 0
        player.playbackRate = Math.max(0.01, Math.abs(rate) || 0.01)
      }
      if (delayMs <= 0) {
        apply()
      } else {
        const timer = setTimeout(() => {
          scratchTimers.delete(timer)
          apply()
        }, delayMs)
        scratchTimers.add(timer)
      }
    })
  }

  const trigger = (note: TriggerNote, when: number): void => {
    const fragmentId = note.fragmentId
    const semis = (note.pitchSemis ?? 0) + pitchOffset
    const v = fragmentId ? voices.get(fragmentId) : undefined

    if (v?.ready && v.player && v.player.buffer && v.player.buffer.loaded) {
      const p = v.player
      try {
        p.detune = Math.max(-2400, Math.min(2400, semis * 100))
        const reverse = Boolean(note.reverse)
        if (p.reverse !== reverse) p.reverse = reverse
        // stretch: grain time-stretch independent of pitch (1 = natural).
        const stretch = note.stretch && note.stretch > 0 ? note.stretch : 1
        p.playbackRate = 1 / stretch
        if (note.scratchCurve && note.scratchCurve.length > 0) {
          applyScratch(p, note.scratchCurve, when, Math.max(0.05, note.durationSec))
        }
        p.start(when)
        return
      } catch {
        // GrainPlayer can throw on rapid re-trigger; fall through to synth-vox.
      }
    }

    // Lazy-load for next time (async; this trigger uses synth-vox).
    if (fragmentId && (!v || !v.loadAttempted)) void loadVoice(fragmentId)

    // synth-vox floor: a vocal-ish tone pitched by the same semitones.
    const baseMidi = 52 + Math.max(-24, Math.min(24, semis)) // E3 reference
    const name = Tone.Frequency(baseMidi, "midi").toNote()
    try {
      synthVox.triggerAttackRelease(
        name,
        Math.max(0.08, note.durationSec),
        when,
        note.velocity
      )
    } catch {
      /* AMSynth voice exhaustion on rapid retrigger — ignore */
    }
  }

  return {
    output: out,
    trigger,
    update(next: InstrumentConfig) {
      if (next.kind !== "ttsFragment") return
      voiceId = next.voiceId
      void voiceId
    },
    setParam(param: string, value: number) {
      // Live pitch-ribbon bend for the whole phrase track (semitones).
      if (param === "pitchOffset") pitchOffset = Math.max(-24, Math.min(24, value))
    },
    async load(_assets: AssetLoader) {
      // Voices load lazily per fragment on first trigger; nothing eager here.
      void _assets
    },
    dispose() {
      disposed = true
      for (const t of scratchTimers) clearTimeout(t)
      scratchTimers.clear()
      for (const v of voices.values()) v.player?.dispose()
      voices.clear()
      synthVox.dispose()
      vibrato.dispose()
      out.dispose()
    },
  }
}
