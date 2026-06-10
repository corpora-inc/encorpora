/**
 * beatlounge — PARAMETRIC synth drum kit instrument.
 *
 * Originally a hand-wired bank of Tone voices; now a parametric synth that
 * BUILDS its 16 voices from a `ResolvedKit` (the drum-kit corpus, ../kits).
 * Triggers are routed by MIDI pitch (DRUM_PITCH + the drum-pads PAD_BANK) to a
 * voice ROLE, exactly as before. No samples — pure synthesis parameters.
 *
 * The DEFAULT kit ("studio") is a parameter-for-parameter transcription of the
 * original hardcoded kit, so nothing regresses when a track has no `kitId`.
 *
 * Kit swap is LIVE: `update(config)` re-reads `config.kitId`, and if the kit
 * changed it disposes the old voices and rebuilds from the new KitDef — the new
 * sound is heard immediately (the audioGraph reconciler calls `update()` on any
 * instrument-config change; see engine/audioGraph.ts). Output node is stable
 * across a swap so the track wiring (inserts/sends) is untouched.
 */

import * as Tone from "tone"
import type { Instrument, TriggerNote } from "../contracts/engine"
import type { InstrumentConfig } from "../model/document"
import { buildVoice, type BuiltVoice } from "../kits/buildVoice"
import { resolveKitId, roleForPitch, type ResolvedKit, type VoiceRole } from "../kits"

/** Roles that historically floored their velocity at 0.3 (so a quiet pad still
 *  speaks). Preserved 1:1 from the original `clamp` usage in triggerForPitch. */
const VELOCITY_FLOORED: ReadonlySet<VoiceRole> = new Set<VoiceRole>([
  "rim",
  "closedHat",
  "pedalHat",
  "openHat",
  "crash",
  "ride",
  "cowbell",
  "tamb",
  "shaker",
  "click",
])

const floor = (v: number) => Math.max(0.3, Math.min(1, v))

const kitIdOf = (config: InstrumentConfig): string | undefined =>
  config.kind === "drumSampler" ? config.kitId : undefined

export const createDrumKitInstrument = (config: InstrumentConfig): Instrument => {
  const out = new Tone.Gain(1)

  let currentKitId: string | undefined = kitIdOf(config)
  let voices: Record<VoiceRole, BuiltVoice> = {} as Record<VoiceRole, BuiltVoice>

  /** Build all 16 voices from a resolved kit and connect them to `out`. */
  const buildKit = (kit: ResolvedKit) => {
    const next = {} as Record<VoiceRole, BuiltVoice>
    for (const role of Object.keys(kit.voices) as VoiceRole[]) {
      next[role] = buildVoice(kit.voices[role], out)
    }
    voices = next
  }

  const disposeVoices = () => {
    for (const v of Object.values(voices)) {
      try {
        v.dispose()
      } catch {
        /* a voice can throw mid-tail; keep disposing the rest */
      }
    }
    voices = {} as Record<VoiceRole, BuiltVoice>
  }

  // Initial build.
  buildKit(resolveKitId(currentKitId))

  const triggerForPitch = (pitch: number, when: number, v: number) => {
    // Unknown pad → lo-tom voice (matches the original `default` branch:
    // "a pitched tom so it's at least distinct, not silent").
    const role: VoiceRole = roleForPitch(pitch) ?? "loTom"
    const voice = voices[role]
    if (!voice) return
    const velocity = VELOCITY_FLOORED.has(role) ? floor(v) : v
    voice.trigger(when, velocity)
  }

  return {
    output: out,
    trigger(n: TriggerNote, when: number) {
      try {
        triggerForPitch(n.pitch, when, n.velocity)
      } catch {
        /* drum synths can throw on rapid retrigger; ignore */
      }
    },
    /** Live kit swap: rebuild the voices when `kitId` changes (noisy-not-silent:
     *  an unknown id warns + falls back to the default in resolveKitId). */
    update(next: InstrumentConfig) {
      if (next.kind !== "drumSampler") return
      const nextKitId = kitIdOf(next)
      if (nextKitId === currentKitId) return
      currentKitId = nextKitId
      disposeVoices()
      buildKit(resolveKitId(nextKitId))
    },
    setParam() {},
    async load() {},
    dispose() {
      disposeVoices()
      out.dispose()
    },
  }
}
