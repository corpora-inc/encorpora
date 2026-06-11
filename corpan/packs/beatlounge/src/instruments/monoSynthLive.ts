/**
 * beatlounge — adapter that turns ANY monophonic Tone instrument
 * (Tone.Synth / Tone.FMSynth — both extend `Monophonic`) into a continuous
 * live-performance voice for the multitouch surface. Each finger gets one mono
 * node; pitch glides via a short ramp on the node's `frequency` Signal (NOT a
 * hard `setValueAtTime`), so a dragging finger sweeps smoothly with no zipper
 * noise. attack/release drive the node's own amp envelope (click-free).
 *
 * Voices are created lazily by the engine's `make()` (so they match the live
 * config) and wired into the engine's filter/output `dest`. `refresh` re-applies
 * config to already-built voices without re-allocating.
 */

import * as Tone from "tone"
import type { Instrument } from "../contracts/engine"
import {
  createLivePool,
  type LiveVoice,
  type LiveVoiceFactory,
} from "./liveVoices"

/** A monophonic Tone instrument we can drive: a frequency Signal + an envelope
 *  release time + attack/release triggers. Both Tone.Synth and Tone.FMSynth
 *  satisfy this (they extend `Monophonic`); we type it structurally so either
 *  can be passed without fighting Tone's heavy generic option types. */
export interface MonoNode {
  connect(dest: Tone.ToneAudioNode): unknown
  frequency: Tone.Signal<"frequency">
  envelope: { release: Tone.Unit.Time }
  triggerAttack(note: Tone.Unit.Frequency, time?: Tone.Unit.Time, velocity?: number): unknown
  triggerRelease(time?: Tone.Unit.Time): unknown
  set(props: Record<string, unknown>): unknown
  dispose(): unknown
}

export interface MonoSynthLiveOpts {
  /** Node the live voices feed into (the engine's filter or output). */
  dest: Tone.ToneAudioNode
  /** Build one fresh monophonic voice configured to match the engine. */
  make: () => MonoNode
  maxVoices?: number
  glideSec?: number
}

export interface MonoSynthLive {
  api: NonNullable<Instrument["live"]>
  /** Re-apply config to every already-built live voice. */
  refresh(apply: (v: MonoNode) => void): void
  dispose(): void
}

const RELEASE_FALLBACK = 0.3

export const createMonoSynthLive = (opts: MonoSynthLiveOpts): MonoSynthLive => {
  // Every built voice, so config refresh reaches them (the pool hides them).
  const built: MonoNode[] = []

  const factory: LiveVoiceFactory = {
    maxVoices: opts.maxVoices ?? 8,
    glideSec: opts.glideSec ?? 0.06,
    create(): LiveVoice {
      const node = opts.make()
      node.connect(opts.dest)
      built.push(node)
      return {
        attack(velocity, when) {
          try {
            node.triggerAttack(node.frequency.value, when, velocity)
          } catch {
            /* re-attack under heavy retrigger — ignore */
          }
        },
        setHz(hz, when, glideSec) {
          const f = node.frequency
          if (glideSec > 0) {
            // Ramp from the live value for a click-free portamento.
            const cur = typeof f.value === "number" ? f.value : hz
            try {
              f.cancelScheduledValues(when)
              f.setValueAtTime(Math.max(1, cur), when)
              f.exponentialRampToValueAtTime(Math.max(1, hz), when + glideSec)
            } catch {
              f.value = Math.max(1, hz)
            }
          } else {
            try {
              f.cancelScheduledValues(when)
              f.setValueAtTime(Math.max(1, hz), when)
            } catch {
              f.value = Math.max(1, hz)
            }
          }
        },
        release(when) {
          try {
            node.triggerRelease(when)
          } catch {
            /* ignore */
          }
          const r = Tone.Time(node.envelope.release).toSeconds()
          return Number.isFinite(r) ? r : RELEASE_FALLBACK
        },
        dispose() {
          const i = built.indexOf(node)
          if (i >= 0) built.splice(i, 1)
          node.dispose()
        },
      }
    },
  }

  const pool = createLivePool(factory)

  return {
    api: pool,
    refresh(apply) {
      for (const v of built) {
        try {
          apply(v)
        } catch {
          /* defensive: a transient set under teardown — ignore */
        }
      }
    },
    dispose() {
      pool.dispose()
    },
  }
}
