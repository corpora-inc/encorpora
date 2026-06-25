/**
 * beatlounge — multi-zone sampler. Maps `SampleZone` root notes to decoded
 * buffers and plays them with `Tone.Sampler` (repitch mode) or a per-voice
 * `Tone.GrainPlayer`-style stretch (grain mode). Tablas, plucks and other
 * one-shot instruments are this engine driven by ./presets.
 *
 * Real sample assets are resolved lazily through the `AssetLoader` seam in
 * `load()`: each zone's `sampleId` → an ArrayBuffer → an AudioBuffer keyed by
 * the zone's root note. Until a sample set ships, `load()` synthesizes a short
 * tone per zone so a track is never silent; the wiring (zone → buffer map →
 * Tone.Sampler) is identical, so dropping in real buffers is a no-op change.
 */

import * as Tone from "tone"
import type { AssetLoader, Instrument, TriggerNote } from "../contracts/engine"
import type { InstrumentConfig, Midi, SampleZone } from "../model/document"

type SamplerConfig = Extract<InstrumentConfig, { kind: "sampler" }>
const isSampler = (c: InstrumentConfig): c is SamplerConfig => c.kind === "sampler"

/** Render a short, decaying tone at the given MIDI pitch into an AudioBuffer.
 *  Used as the placeholder voice until real samples are loaded. */
const synthesizePlaceholder = (rootNote: Midi, mode: "repitch" | "grain"): AudioBuffer => {
  const ctx = Tone.getContext().rawContext as unknown as BaseAudioContext
  const sampleRate = ctx.sampleRate
  const seconds = 0.9
  const length = Math.floor(sampleRate * seconds)
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)
  const freq = 440 * Math.pow(2, (rootNote - 69) / 12)
  // Grain mode gets a touch more body (longer decay) so the two modes are
  // audibly distinct even on the placeholder.
  const decay = mode === "grain" ? 5 : 8
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate
    const env = Math.exp(-decay * t)
    // Fundamental + a soft second/third partial for a plucky body.
    const s =
      Math.sin(2 * Math.PI * freq * t) +
      0.4 * Math.sin(2 * Math.PI * freq * 2 * t) +
      0.2 * Math.sin(2 * Math.PI * freq * 3 * t)
    data[i] = (s / 1.6) * env
  }
  return buffer
}

const noteName = (pitch: Midi): string => Tone.Frequency(pitch, "midi").toNote()

export const createSamplerInstrument = (config: SamplerConfig): Instrument => {
  const out = new Tone.Gain(1)
  let mode = config.mode
  let zones: SampleZone[] = [...config.zones]

  // Lazily (re)built once buffers exist; until then a no-op output.
  let sampler: Tone.Sampler | null = null

  const buildSampler = (buffers: Record<string, AudioBuffer>) => {
    sampler?.dispose()
    const urls: Record<string, AudioBuffer> = {}
    for (const zone of zones) {
      const buf = buffers[String(zone.rootNote)]
      if (buf) urls[noteName(zone.rootNote)] = buf
    }
    if (Object.keys(urls).length === 0) {
      sampler = null
      return
    }
    sampler = new Tone.Sampler({
      urls,
      // grain mode = longer release tail so stretched/sustained notes bleed;
      // repitch = tighter so transients stay crisp.
      release: mode === "grain" ? 0.6 : 0.1,
      curve: "exponential",
    }).connect(out)
  }

  const loadBuffers = async (assets?: AssetLoader): Promise<Record<string, AudioBuffer>> => {
    const ctx = Tone.getContext().rawContext as unknown as BaseAudioContext
    const buffers: Record<string, AudioBuffer> = {}
    for (const zone of zones) {
      const key = String(zone.rootNote)
      if (buffers[key]) continue
      let decoded: AudioBuffer | null = null
      if (assets) {
        try {
          const bytes = await assets.resolve({ sampleId: zone.sampleId })
          if (bytes.byteLength > 0) {
            decoded = await ctx.decodeAudioData(bytes.slice(0))
          }
        } catch (err) {
          // Noisy, not silent: a missing sample falls back to the placeholder.
          console.warn(
            `[beatlounge] sampler: failed to load sampleId=${zone.sampleId}; using placeholder`,
            err
          )
        }
      }
      buffers[key] = decoded ?? synthesizePlaceholder(zone.rootNote, mode)
    }
    return buffers
  }

  return {
    output: out,
    trigger(note: TriggerNote, when: number) {
      if (!sampler) return
      // Honor microtonal detune by repitching the buffer to the exact frequency
      // (Tone.Sampler accepts a frequency and repitches continuously; AVOID
      // AudioBufferSourceNode.detune — unsupported on Safari/WebKit). 0 cents ⇒
      // the buffer's natural repitch for that MIDI note.
      const freq =
        Tone.Frequency(note.pitch, "midi").toFrequency() *
        Math.pow(2, (note.detuneCents ?? 0) / 1200)
      try {
        sampler.triggerAttackRelease(freq, Math.max(0.05, note.durationSec), when, note.velocity)
      } catch {
        /* sampler can throw on voice exhaustion; ignore */
      }
    },
    async update(next: InstrumentConfig) {
      if (!isSampler(next)) return
      const zonesChanged =
        next.zones.length !== zones.length ||
        next.zones.some((z, i) => {
          const cur = zones[i]
          return !cur || z.sampleId !== cur.sampleId || z.rootNote !== cur.rootNote
        })
      mode = next.mode
      if (zonesChanged) {
        zones = [...next.zones]
        // Re-resolve buffers + rebuild. Uses placeholders if no loader has run.
        const buffers = await loadBuffers()
        buildSampler(buffers)
      }
    },
    setParam() {
      /* no automatable params yet (future: filter / pitch envelope) */
    },
    async load(assets: AssetLoader) {
      const buffers = await loadBuffers(assets)
      buildSampler(buffers)
    },
    dispose() {
      sampler?.dispose()
      out.dispose()
    },
  }
}
