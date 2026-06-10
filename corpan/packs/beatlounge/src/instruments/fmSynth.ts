/**
 * beatlounge — FM poly synth instrument (great for basses, bells, metallic
 * leads). Implements the Instrument contract for an "fmSynth" config.
 */

import * as Tone from "tone"
import type { Instrument, TriggerNote } from "../contracts/engine"
import type { InstrumentConfig } from "../model/document"

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

  return {
    output: out,
    trigger(note: TriggerNote, when: number) {
      const name = Tone.Frequency(note.pitch, "midi").toNote()
      try {
        poly.triggerAttackRelease(name, Math.max(0.02, note.durationSec), when, note.velocity)
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
    },
    setParam(param: string, value: number) {
      if (param === "harmonicity") poly.set({ harmonicity: value })
      if (param === "modIndex") poly.set({ modulationIndex: value })
    },
    async load() {},
    dispose() {
      poly.dispose()
      out.dispose()
    },
  }
}
