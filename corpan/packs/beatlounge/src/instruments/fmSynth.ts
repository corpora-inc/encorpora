/**
 * beatlounge — FM poly synth instrument (great for basses, bells, metallic
 * leads). Implements the Instrument contract for an "fmSynth" config.
 */

import * as Tone from "tone"
import type { Instrument, TriggerNote } from "../contracts/engine"
import type { InstrumentConfig } from "../model/document"
import { createMonoSynthLive } from "./monoSynthLive"

type FmConfig = Extract<InstrumentConfig, { kind: "fmSynth" }>
const isFm = (c: InstrumentConfig): c is FmConfig => c.kind === "fmSynth"

export const createFmInstrument = (config: FmConfig): Instrument => {
  const out = new Tone.Gain(1)
  const poly = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: config.harmonicity,
    modulationIndex: config.modIndex,
    envelope: { ...config.env },
  }).connect(out)
  poly.maxPolyphony = 12

  // Live multitouch path: mono FM voices with continuous-pitch glide.
  let fm = { harmonicity: config.harmonicity, modIndex: config.modIndex, env: { ...config.env } }
  const live = createMonoSynthLive({
    dest: out,
    make: () =>
      new Tone.FMSynth({
        harmonicity: fm.harmonicity,
        modulationIndex: fm.modIndex,
        envelope: { ...fm.env },
      }),
  })

  return {
    output: out,
    live: live.api,
    trigger(note: TriggerNote, when: number) {
      // Detuned frequency = 12-TET freq × 2^(cents/1200). 0 cents ⇒ unchanged.
      const freq =
        Tone.Frequency(note.pitch, "midi").toFrequency() *
        Math.pow(2, (note.detuneCents ?? 0) / 1200)
      try {
        poly.triggerAttackRelease(freq, Math.max(0.02, note.durationSec), when, note.velocity)
      } catch {
        /* ignore voice exhaustion */
      }
    },
    update(next: InstrumentConfig) {
      if (!isFm(next)) return
      poly.set({
        harmonicity: next.harmonicity,
        modulationIndex: next.modIndex,
        envelope: { ...next.env },
      })
      fm = { harmonicity: next.harmonicity, modIndex: next.modIndex, env: { ...next.env } }
      live.refresh((v) =>
        v.set({ harmonicity: fm.harmonicity, modulationIndex: fm.modIndex, envelope: { ...fm.env } })
      )
    },
    setParam(param: string, value: number) {
      if (param === "harmonicity") poly.set({ harmonicity: value })
      if (param === "modIndex") poly.set({ modulationIndex: value })
    },
    async load() {},
    dispose() {
      live.dispose()
      poly.dispose()
      out.dispose()
    },
  }
}
