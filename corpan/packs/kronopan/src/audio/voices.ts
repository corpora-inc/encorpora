// Synthesized metronome voices. No samples, so nothing to load.
//
// Each kit renders the four click roles (cycle downbeat, group head, plain
// pulse, subdivision) with a distinct timbre, always accenting the downbeat and
// lightening toward the subdivision. Everything is built from two primitives, a
// pitch-enveloped oscillator and a filtered noise burst, so a whole kit is a few
// lines. The dumbek kit follows the tradition the research confirmed: the low
// DUM lands on the downbeat and group heads (so the additive grouping is
// audible) and the high KA/tek fills the interior pulses.

import type { ClickRole } from "./clock"

export type VoiceKitId =
  | "tonal"
  | "dumbek"
  | "woodblock"
  | "rim"
  | "cowbell"
  | "shaker"

export const VOICE_KITS: { id: VoiceKitId; name: string }[] = [
  { id: "tonal", name: "Tonal" },
  { id: "dumbek", name: "Dumbek" },
  { id: "woodblock", name: "Woodblock" },
  { id: "rim", name: "Rim" },
  { id: "cowbell", name: "Cowbell" },
  { id: "shaker", name: "Shaker" },
]

// What a stroke built: the gain bus to fade for a clean cancel, and the source
// nodes to stop.
export type StrokeResult = {
  bus: GainNode
  sources: AudioScheduledSourceNode[]
}

const FLOOR = 0.0006

// One shared half-second of white noise per context, reused by every noise
// stroke.
const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>()
const getNoise = (ctx: AudioContext): AudioBuffer => {
  let buf = noiseBuffers.get(ctx)
  if (!buf) {
    buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseBuffers.set(ctx, buf)
  }
  return buf
}

const ampEnv = (
  ctx: AudioContext,
  time: number,
  peak: number,
  attack: number,
  decay: number,
): GainNode => {
  const g = ctx.createGain()
  g.gain.setValueAtTime(FLOOR, time)
  g.gain.exponentialRampToValueAtTime(peak, time + attack)
  g.gain.exponentialRampToValueAtTime(FLOOR, time + attack + decay)
  return g
}

type ToneOpts = {
  freq: number
  to?: number // pitch-drop target
  drop?: number // pitch-drop time
  type?: OscillatorType
  peak: number
  decay: number
  attack?: number
}

const addTone = (
  ctx: AudioContext,
  bus: GainNode,
  time: number,
  o: ToneOpts,
): AudioScheduledSourceNode => {
  const osc = ctx.createOscillator()
  osc.type = o.type ?? "sine"
  osc.frequency.setValueAtTime(o.freq, time)
  if (o.to && o.drop) osc.frequency.exponentialRampToValueAtTime(o.to, time + o.drop)
  const attack = o.attack ?? 0.002
  const g = ampEnv(ctx, time, o.peak, attack, o.decay)
  osc.connect(g)
  g.connect(bus)
  osc.start(time)
  osc.stop(time + attack + o.decay + 0.05)
  return osc
}

type NoiseOpts = {
  filter: BiquadFilterType
  freq: number
  Q?: number
  peak: number
  decay: number
  attack?: number
}

const addNoise = (
  ctx: AudioContext,
  bus: GainNode,
  time: number,
  o: NoiseOpts,
): AudioScheduledSourceNode => {
  const src = ctx.createBufferSource()
  src.buffer = getNoise(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = o.filter
  filter.frequency.value = o.freq
  if (o.Q) filter.Q.value = o.Q
  const attack = o.attack ?? 0.001
  const g = ampEnv(ctx, time, o.peak, attack, o.decay)
  src.connect(filter)
  filter.connect(g)
  g.connect(bus)
  src.start(time)
  src.stop(time + attack + o.decay + 0.05)
  return src
}

// Role intensity, 0 (subdivision) to 1 (downbeat). Kits scale gain by this.
const accentOf = (role: ClickRole): number =>
  role === "downbeat" ? 1 : role === "group-head" ? 0.72 : role === "pulse" ? 0.5 : 0.28

export const renderStroke = (
  ctx: AudioContext,
  out: AudioNode,
  kit: VoiceKitId,
  role: ClickRole,
  time: number,
): StrokeResult => {
  const bus = ctx.createGain()
  bus.gain.value = 1
  bus.connect(out)
  const sources: AudioScheduledSourceNode[] = []
  const a = accentOf(role)

  switch (kit) {
    case "tonal": {
      const freq = role === "downbeat" ? 1760 : role === "group-head" ? 1174 : 880
      const type: OscillatorType = role === "downbeat" || role === "group-head" ? "triangle" : "sine"
      sources.push(addTone(ctx, bus, time, { freq, type, peak: a, decay: 0.03 + a * 0.02 }))
      break
    }
    case "dumbek": {
      if (role === "downbeat" || role === "group-head") {
        // DUM: a low membrane with a falling pitch.
        const peak = role === "downbeat" ? 1 : 0.82
        sources.push(
          addTone(ctx, bus, time, {
            freq: role === "downbeat" ? 175 : 155,
            to: role === "downbeat" ? 74 : 70,
            drop: 0.06,
            type: "sine",
            peak,
            decay: role === "downbeat" ? 0.22 : 0.18,
          }),
        )
      } else {
        // KA/tek: a bright rim snap, noise plus a high ping.
        sources.push(
          addNoise(ctx, bus, time, { filter: "bandpass", freq: 2100, Q: 3, peak: a, decay: 0.05 }),
        )
        sources.push(addTone(ctx, bus, time, { freq: 620, type: "triangle", peak: a * 0.5, decay: 0.045 }))
      }
      break
    }
    case "woodblock": {
      // A hollow woody knock: square tone, lower on strong beats, plus a tick.
      const freq = role === "downbeat" ? 900 : role === "group-head" ? 1120 : 1400
      sources.push(addTone(ctx, bus, time, { freq, type: "square", peak: a * 0.85, decay: 0.04 }))
      sources.push(
        addNoise(ctx, bus, time, { filter: "bandpass", freq: freq * 1.8, Q: 5, peak: a * 0.3, decay: 0.018 }),
      )
      break
    }
    case "rim": {
      // A tight electronic tick: short high-passed noise plus a high ping.
      sources.push(
        addNoise(ctx, bus, time, { filter: "highpass", freq: 2600, peak: a * 0.8, decay: 0.016 }),
      )
      sources.push(addTone(ctx, bus, time, { freq: 2200, type: "square", peak: a * 0.3, decay: 0.012 }))
      break
    }
    case "cowbell": {
      // Two detuned squares through the bus for the metallic ring.
      const base = role === "downbeat" ? 540 : role === "group-head" ? 560 : 620
      sources.push(addTone(ctx, bus, time, { freq: base, type: "square", peak: a * 0.55, decay: 0.09 + a * 0.05 }))
      sources.push(addTone(ctx, bus, time, { freq: base * 1.48, type: "square", peak: a * 0.5, decay: 0.09 + a * 0.05 }))
      break
    }
    case "shaker": {
      // Soft airy noise, easy on the ears.
      const freq = role === "downbeat" ? 4200 : role === "group-head" ? 5200 : 6200
      sources.push(
        addNoise(ctx, bus, time, { filter: "highpass", freq, peak: a * 0.5, decay: 0.045, attack: 0.004 }),
      )
      break
    }
  }

  return { bus, sources }
}
