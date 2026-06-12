/**
 * beatlounge — wavetable poly synth. A `Tone.PolySynth` whose voices use a
 * custom `PeriodicWave` built from one of the built-in wavetables (see
 * ./wavetables), through a low-pass filter. Good for organs, glassy pads and
 * vocal-ish leads; warm-pad / bell presets are this engine + ./presets.
 */

import * as Tone from "tone"
import type { Instrument, TriggerNote } from "../contracts/engine"
import type { InstrumentConfig } from "../model/document"
import { resolveWavetable } from "./wavetables"
import { createMonoSynthLive } from "./monoSynthLive"

type WavetableConfig = Extract<InstrumentConfig, { kind: "wavetable" }>
const isWavetable = (c: InstrumentConfig): c is WavetableConfig =>
  c.kind === "wavetable"

/** Build a Tone partials option from a wavetable: Tone takes the sine
 *  (imag) coefficients for harmonics 1..N as `partials`. */
const partialsFor = (tableId: string): number[] => {
  const { imag } = resolveWavetable(tableId)
  return imag.slice(1) // drop DC; index 0 ⇒ fundamental
}

export const createWavetableInstrument = (config: WavetableConfig): Instrument => {
  const out = new Tone.Gain(1)
  const filter = new Tone.Filter({
    type: config.filter.type,
    frequency: config.filter.frequency,
    Q: config.filter.q,
  }).connect(out)

  const poly = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "custom", partials: partialsFor(config.tableId) },
    envelope: { ...config.env },
  }).connect(filter)
  poly.maxPolyphony = 16

  let tableId = config.tableId
  let liveEnv = { ...config.env }

  // Live multitouch path: mono custom-partials voices through the SAME filter,
  // glided per finger.
  const live = createMonoSynthLive({
    dest: filter,
    make: () =>
      new Tone.Synth({
        oscillator: { type: "custom", partials: partialsFor(tableId) },
        envelope: { ...liveEnv },
      }),
  })

  return {
    output: out,
    live: live.api,
    trigger(note: TriggerNote, when: number) {
      const name = Tone.Frequency(note.pitch, "midi").toNote()
      try {
        poly.triggerAttackRelease(name, Math.max(0.02, note.durationSec), when, note.velocity)
      } catch {
        /* ignore voice exhaustion on rapid retriggers */
      }
    },
    update(next: InstrumentConfig) {
      if (!isWavetable(next)) return
      if (next.tableId !== tableId) {
        tableId = next.tableId
        poly.set({ oscillator: { type: "custom", partials: partialsFor(tableId) } })
        live.refresh((v) =>
          v.set({ oscillator: { type: "custom", partials: partialsFor(tableId) } })
        )
      }
      poly.set({ envelope: { ...next.env } })
      liveEnv = { ...next.env }
      live.refresh((v) => v.set({ envelope: { ...liveEnv } }))
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
      /* tables are built-in; no async assets */
    },
    dispose() {
      live.dispose()
      poly.dispose()
      filter.dispose()
      out.dispose()
    },
  }
}
