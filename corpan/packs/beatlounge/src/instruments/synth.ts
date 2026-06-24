/**
 * beatlounge — subtractive poly synth instrument (ported from melopan's
 * synthVoice, generalized to the Instrument contract). Triangle/saw/square/sine
 * core → low-pass filter → output. Used for lead/bass/pad tracks; tamburas /
 * drones are this engine with long-release presets.
 */

import * as Tone from "tone"
import type { Instrument, TriggerNote } from "../contracts/engine"
import type { InstrumentConfig } from "../model/document"
import { createMonoSynthLive } from "./monoSynthLive"

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

  // Live multitouch path: a small pool of mono Tone.Synth voices through the
  // SAME filter/output, so live play matches the sequencer voice but each
  // finger can glide pitch continuously.
  let liveOsc: SynthConfig["osc"] = config.osc
  let liveEnv = { ...config.env }
  const live = createMonoSynthLive({
    dest: filter,
    make: () => new Tone.Synth({ oscillator: { type: liveOsc }, envelope: { ...liveEnv } }),
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
        /* PolySynth can throw under voice exhaustion on rapid retriggers; ignore */
      }
    },
    update(next: InstrumentConfig) {
      if (!isSynth(next)) return
      poly.set({ oscillator: { type: next.osc }, envelope: { ...next.env } })
      liveOsc = next.osc
      liveEnv = { ...next.env }
      live.refresh((v) => v.set({ oscillator: { type: liveOsc }, envelope: { ...liveEnv } }))
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
      live.dispose()
      poly.dispose()
      filter.dispose()
      out.dispose()
    },
  }
}
