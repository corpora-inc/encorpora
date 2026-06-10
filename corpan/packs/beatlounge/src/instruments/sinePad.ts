/**
 * beatlounge — lush sine/triangle pad. A wide, slowly-evolving pad built from
 * a stack of detuned sine voices through a gentle low-pass, with a slow attack
 * and long release — the "weird pads to play sine waves" instrument. Drones and
 * warm pads are this engine driven by ./presets.
 *
 * It is addressed by the `synth` config kind (osc "sine"/"triangle"); the
 * factory routes sine/triangle-pad PRESETS here while keeping the plain
 * subtractive synth for short, percussive sounds. The detune spread and pad
 * envelope live here rather than in the document so the pad stays a fixed,
 * recognizable character.
 */

import * as Tone from "tone"
import type { Instrument, TriggerNote } from "../contracts/engine"
import type { InstrumentConfig } from "../model/document"

type SynthConfig = Extract<InstrumentConfig, { kind: "synth" }>
const isSynth = (c: InstrumentConfig): c is SynthConfig => c.kind === "synth"

/** Cents of detune for the three-voice unison stack (centre + flat + sharp). */
const DETUNE_SPREAD = 7

export const createSinePadInstrument = (config: SynthConfig): Instrument => {
  const out = new Tone.Gain(1)

  // Gentle low-pass keeps the pad soft and removes any aliasing edge.
  const filter = new Tone.Filter({
    type: config.filter.type,
    frequency: config.filter.frequency,
    Q: config.filter.q,
  }).connect(out)

  // A slow stereo chorus widens the detuned stack into a lush bed.
  const chorus = new Tone.Chorus({ frequency: 0.25, delayTime: 6, depth: 0.6, wet: 0.4 })
    .connect(filter)
    .start()

  const osc = config.osc === "triangle" ? "triangle" : "sine"

  // Each unison voice is its own PolySynth so we can detune the layers.
  const makeLayer = (detune: number, gain: number): Tone.PolySynth => {
    const layer = new Tone.PolySynth(Tone.Synth, {
      detune,
      oscillator: { type: osc },
      envelope: { ...config.env },
    })
    const vol = new Tone.Gain(gain).connect(chorus)
    layer.connect(vol)
    layer.maxPolyphony = 12
    ;(layer as unknown as { _padGain?: Tone.Gain })._padGain = vol
    return layer
  }

  const layers = [
    makeLayer(0, 0.5),
    makeLayer(-DETUNE_SPREAD, 0.32),
    makeLayer(DETUNE_SPREAD, 0.32),
  ]

  const layerGain = (l: Tone.PolySynth): Tone.Gain | undefined =>
    (l as unknown as { _padGain?: Tone.Gain })._padGain

  return {
    output: out,
    trigger(note: TriggerNote, when: number) {
      const name = Tone.Frequency(note.pitch, "midi").toNote()
      // Pads want to breathe: ensure a minimum sustain so the slow attack opens.
      const dur = Math.max(0.3, note.durationSec)
      for (const layer of layers) {
        try {
          layer.triggerAttackRelease(name, dur, when, note.velocity)
        } catch {
          /* ignore voice exhaustion */
        }
      }
    },
    update(next: InstrumentConfig) {
      if (!isSynth(next)) return
      const nextOsc = next.osc === "triangle" ? "triangle" : "sine"
      for (const layer of layers) {
        layer.set({ oscillator: { type: nextOsc }, envelope: { ...next.env } })
      }
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
      for (const layer of layers) {
        layerGain(layer)?.dispose()
        layer.dispose()
      }
      chorus.dispose()
      filter.dispose()
      out.dispose()
    },
  }
}
