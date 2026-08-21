/**
 * Ambient beds. Continuous, cheap, and the single largest contributor to a
 * prototype feeling like a PLACE rather than a screen.
 *
 * Two parts, always:
 *   1. a continuous filtered-noise bed with slow LFO movement (the air), and
 *   2. sparse, randomly scheduled distant events (the life).
 *
 * (2) is what people forget. A static noise bed is ignored by the brain within
 * seconds — literally, it is adapted out. A distant hammer every 4-9 seconds
 * keeps the place alive at almost zero CPU, and it is the reason the bazaar
 * bed does not become tinnitus.
 */

import { percEnv } from "../dsp/env.ts"
import { mulberry32 } from "../rng.ts"
import { MATERIALS } from "../dsp/materials.ts"
import type { ModalVoiceBank, SharedTables, Tier } from "../types.ts"

export interface AmbienceDeps {
  ctx: AudioContext
  out: AudioNode
  send: AudioNode | null
  tables: SharedTables
  modal: ModalVoiceBank | null
  tier: Tier
}

export type AmbienceId = "bazaar" | "courtyard" | "night" | "workshop"

interface BedSpec {
  kind: "pink" | "brown"
  /** Lowpass centre and how far the LFO moves it. */
  cutoff: number
  wobble: number
  rate: number
  gain: number
  /** Highpass to keep it from eating the mix's low end. */
  highpass: number
  /** Distant event scheduling. */
  eventEvery: [number, number]
  materials: (keyof typeof MATERIALS)[]
  eventFreq: [number, number]
  eventGain: number
}

const BEDS: Record<AmbienceId, BedSpec> = {
  // Hot, wide, busy. Brown air + distant brass and pot strikes.
  bazaar: {
    kind: "brown",
    cutoff: 620,
    wobble: 260,
    rate: 0.07,
    gain: 0.3,
    highpass: 90,
    eventEvery: [2.4, 6.5],
    materials: ["brass", "pot", "wood", "tile"],
    eventFreq: [110, 420],
    eventGain: 0.1,
  },
  // Enclosed, reflective, quieter. Water-adjacent.
  courtyard: {
    kind: "pink",
    cutoff: 900,
    wobble: 320,
    rate: 0.045,
    gain: 0.2,
    highpass: 160,
    eventEvery: [4, 11],
    materials: ["glass", "tile"],
    eventFreq: [420, 1400],
    eventGain: 0.07,
  },
  // Cool and sparse. Almost nothing happens, and that is the point.
  night: {
    kind: "brown",
    cutoff: 380,
    wobble: 140,
    rate: 0.03,
    gain: 0.22,
    highpass: 60,
    eventEvery: [7, 18],
    materials: ["glass", "bell"],
    eventFreq: [700, 2200],
    eventGain: 0.05,
  },
  // Close and industrious — a metalworker's stall.
  workshop: {
    kind: "pink",
    cutoff: 1400,
    wobble: 500,
    rate: 0.11,
    gain: 0.18,
    highpass: 200,
    eventEvery: [0.9, 2.6],
    materials: ["brass", "stone", "wood"],
    eventFreq: [180, 700],
    eventGain: 0.13,
  },
}

interface LiveBed {
  id: AmbienceId
  gain: GainNode
  src: AudioBufferSourceNode
  lfo: OscillatorNode
  timer: ReturnType<typeof setTimeout> | null
}

export class Ambience {
  private live: LiveBed | null = null
  private rnd = mulberry32(0xa11bed)
  private level = 1

  private deps: AmbienceDeps

  constructor(deps: AmbienceDeps) {
    this.deps = deps
  }

  /** Crossfade to a bed. Passing null fades out. Idempotent for the same id. */
  set(id: AmbienceId | null, fade = 1.6): void {
    if (this.live?.id === id) return
    const prev = this.live
    if (prev) this.fadeOutAndStop(prev, fade)
    this.live = id ? this.build(id, fade) : null
  }

  setLevel(v: number, ramp = 0.4): void {
    this.level = Math.max(0, Math.min(1, v))
    const l = this.live
    if (!l) return
    const t = this.deps.ctx.currentTime
    l.gain.gain.cancelScheduledValues(t)
    l.gain.gain.setValueAtTime(l.gain.gain.value, t)
    l.gain.gain.linearRampToValueAtTime(BEDS[l.id].gain * this.level, t + ramp)
  }

  private build(id: AmbienceId, fade: number): LiveBed {
    const { ctx, out, tables } = this.deps
    const spec = BEDS[id]
    const g = ctx.createGain()
    g.gain.value = 0
    g.connect(out)
    const t = ctx.currentTime
    g.gain.linearRampToValueAtTime(spec.gain * this.level, t + fade)

    const src = ctx.createBufferSource()
    src.buffer = spec.kind === "brown" ? tables.brown() : tables.pink()
    src.loop = true
    // A loop point in a 2 s noise buffer is audible as a click if the buffer
    // is not seamless. Ours is generated, so we simply detune the playback rate
    // per instance — the loop period stops being a round number and the ear
    // stops locking onto it.
    src.playbackRate.value = 0.82 + this.rnd() * 0.3

    const lp = ctx.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.value = spec.cutoff
    lp.Q.value = 0.9
    const hp = ctx.createBiquadFilter()
    hp.type = "highpass"
    hp.frequency.value = spec.highpass

    const lfo = ctx.createOscillator()
    lfo.frequency.value = spec.rate
    const lfoG = ctx.createGain()
    lfoG.gain.value = spec.wobble
    lfo.connect(lfoG)
    lfoG.connect(lp.frequency)

    src.connect(hp)
    hp.connect(lp)
    lp.connect(g)
    if (this.deps.send) {
      const s = ctx.createGain()
      s.gain.value = 0.3
      lp.connect(s)
      s.connect(this.deps.send)
    }
    src.start(t, this.rnd() * 1.5)
    lfo.start(t)

    const bed: LiveBed = { id, gain: g, src, lfo, timer: null }
    this.scheduleEvent(bed, spec)
    return bed
  }

  /** One distant strike, then set the next timer. Never a fixed interval. */
  private scheduleEvent(bed: LiveBed, spec: BedSpec): void {
    const [lo, hi] = spec.eventEvery
    const wait = (lo + this.rnd() * (hi - lo)) * 1000
    bed.timer = setTimeout(() => {
      if (this.live !== bed) return
      const modal = this.deps.modal
      const ctx = this.deps.ctx
      const at = ctx.currentTime + 0.02
      const mat = spec.materials[Math.floor(this.rnd() * spec.materials.length)]
      const f = spec.eventFreq[0] + this.rnd() * (spec.eventFreq[1] - spec.eventFreq[0])
      const panPos = (this.rnd() * 2 - 1) * 0.85
      if (modal) {
        modal.strike({
          when: at,
          material: MATERIALS[mat],
          freq: f,
          velocity: 0.25 + this.rnd() * 0.3,
          modes: this.deps.tier === "low" ? 3 : 5,
          damp: 0.35,
          pan: panPos,
          gain: spec.eventGain * this.level,
          rand: this.rnd,
        })
      } else {
        // No worklet: a filtered noise knock still reads as "something happened
        // over there", which is the whole job of this layer.
        const src = ctx.createBufferSource()
        src.buffer = this.deps.tables.velvet()
        const bp = ctx.createBiquadFilter()
        bp.type = "bandpass"
        bp.frequency.value = f * 3
        bp.Q.value = 6
        const g = ctx.createGain()
        const end = percEnv(g.gain, at, spec.eventGain * this.level, 0.002, 0.18)
        src.connect(bp)
        bp.connect(g)
        g.connect(bed.gain)
        src.start(at, this.rnd() * 0.3)
        src.stop(end + 0.02)
      }
      this.scheduleEvent(bed, spec)
    }, wait)
  }

  private fadeOutAndStop(bed: LiveBed, fade: number): void {
    const t = this.deps.ctx.currentTime
    if (bed.timer) clearTimeout(bed.timer)
    bed.gain.gain.cancelScheduledValues(t)
    bed.gain.gain.setValueAtTime(bed.gain.gain.value, t)
    bed.gain.gain.linearRampToValueAtTime(0, t + fade)
    bed.src.stop(t + fade + 0.05)
    bed.lfo.stop(t + fade + 0.05)
  }

  dispose(): void {
    if (this.live) this.fadeOutAndStop(this.live, 0.1)
    this.live = null
  }
}
