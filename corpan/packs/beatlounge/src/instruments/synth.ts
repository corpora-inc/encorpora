/**
 * beatlounge — subtractive poly synth instrument (ported from melopan's
 * synthVoice, generalized to the Instrument contract). Triangle/saw/square/sine
 * core → low-pass filter → output. Used for lead/bass/pad tracks; tamburas /
 * drones are this engine with long-release presets.
 */

import * as Tone from "tone"
import type { Instrument, TriggerNote } from "../contracts/engine"
import type { InstrumentConfig } from "../model/document"

type SynthConfig = Extract<InstrumentConfig, { kind: "synth" }>

const isSynth = (c: InstrumentConfig): c is SynthConfig => c.kind === "synth"

export const createSynthInstrument = (config: SynthConfig): Instrument => {
  const out = new Tone.Gain(1)
  const filter = new Tone.Filter({
    type: config.filter.type,
    frequency: config.filter.frequency,
    Q: config.filter.q,
  }).connect(out)
  const poly = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: config.osc },
    envelope: { ...config.env },
  }).connect(filter)
  poly.maxPolyphony = 16

  return {
    output: out,
    trigger(note: TriggerNote, when: number) {
      const name = Tone.Frequency(note.pitch, "midi").toNote()
      try {
        poly.triggerAttackRelease(name, Math.max(0.02, note.durationSec), when, note.velocity)
      } catch {
        /* PolySynth can throw under voice exhaustion on rapid retriggers; ignore */
      }
    },
    update(next: InstrumentConfig) {
      if (!isSynth(next)) return
      poly.set({ oscillator: { type: next.osc }, envelope: { ...next.env } })
      filter.type = next.filter.type
      filter.frequency.value = next.filter.frequency
      filter.Q.value = next.filter.q
    },
    setParam(param: string, value: number, when: number) {
      switch (param) {
        case "cutoff":
        case "frequency":
          filter.frequency.setValueAtTime(value, when)
          break
        case "q":
          filter.Q.setValueAtTime(value, when)
          break
      }
    },
    async load() {
      /* no assets */
    },
    dispose() {
      poly.dispose()
      filter.dispose()
      out.dispose()
    },
  }
}
