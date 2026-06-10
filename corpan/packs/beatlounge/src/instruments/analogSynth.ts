/**
 * beatlounge — analog/subtractive synth instrument.
 *
 * WAVE STUB: a functional 2-osc subtractive voice so the `analogSynth` track
 * kind makes sound today. The analog-synth team REPLACES this with the premium
 * engine (dual osc + sub + noise, filter with its own envelope, amp envelope,
 * LFO, drive, glide). The exported factory signature is the contract.
 */

import * as Tone from "tone"
import type { Instrument, TriggerNote } from "../contracts/engine"
import type { InstrumentConfig } from "../model/document"

type AnalogConfig = Extract<InstrumentConfig, { kind: "analogSynth" }>
const isAnalog = (c: InstrumentConfig): c is AnalogConfig => c.kind === "analogSynth"

const num = (p: AnalogConfig["params"], k: string, d: number): number => {
  const v = p[k]
  return typeof v === "number" ? v : d
}

export const createAnalogSynthInstrument = (config: AnalogConfig): Instrument => {
  const out = new Tone.Gain(1)
  const filter = new Tone.Filter({
    type: "lowpass",
    frequency: num(config.params, "cutoff", 2200),
    Q: num(config.params, "resonance", 4),
  }).connect(out)
  const poly = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "fatsawtooth", count: 2, spread: num(config.params, "osc2Detune", 7) },
    envelope: {
      attack: num(config.params, "ampAttack", 0.005),
      decay: num(config.params, "ampDecay", 0.2),
      sustain: num(config.params, "ampSustain", 0.6),
      release: num(config.params, "ampRelease", 0.3),
    },
  }).connect(filter)
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
      if (!isAnalog(next)) return
      filter.frequency.value = num(next.params, "cutoff", 2200)
      filter.Q.value = num(next.params, "resonance", 4)
    },
    setParam(param: string, value: number, when: number) {
      if (param === "cutoff") filter.frequency.setValueAtTime(value, when)
      if (param === "resonance") filter.Q.setValueAtTime(value, when)
    },
    async load() {},
    dispose() {
      poly.dispose()
      filter.dispose()
      out.dispose()
    },
  }
}
