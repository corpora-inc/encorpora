/**
 * Procedural music that responds to intensity.
 *
 * Not a loop. There is no bar of audio anywhere — the whole thing is generated
 * one note at a time by a lookahead scheduler, so it never repeats identically
 * and it can change density, register and instrumentation on any bar line
 * without a crossfade artefact.
 *
 * `setIntensity(0..1)` is the only control a prototype needs. It moves:
 *   layers in and out (equal-power, over one bar, never mid-bar)
 *   note density (the arpeggio subdivides)
 *   velocity and brightness
 *   tempo, but only 88 -> 104 BPM. Big tempo jumps read as panic; a child at
 *   a maths game should feel LIFT, not alarm.
 *
 * SCHEDULING — the Chris Wilson lookahead pattern (a `setInterval` that
 * schedules WebAudio events into the near future) is still the correct answer
 * in 2026, because WebAudio's own clock is sample-accurate and JS timers are
 * not. Two traps it does not solve on its own, both handled below:
 *   - background tabs throttle `setInterval` to ~1 Hz, so the scheduler wakes
 *     to find it is seconds behind and fires a stampede of past-dated notes.
 *     We detect the gap and resync instead.
 *   - `setInterval` drift accumulates. We never advance time by "+= interval";
 *     every note time comes from the beat counter, so drift cannot accumulate.
 */

import { percEnv } from "../dsp/env.ts"
import { mulberry32, semi } from "../rng.ts"
import { MATERIALS } from "../dsp/materials.ts"
import type { ModalVoiceBank, SharedTables, StringBank, Tier } from "../types.ts"

const ROOT = 146.83 // D3
/** Hijaz: 1 b2 3 4 5 b6 7 — the mode of the whole bazaar. */
const SCALE = [0, 1, 4, 5, 7, 8, 10]

const degreeHz = (deg: number, octave = 0): number => {
  const i = ((deg % SCALE.length) + SCALE.length) % SCALE.length
  const oct = Math.floor(deg / SCALE.length) + octave
  return ROOT * semi(SCALE[i] + oct * 12)
}

export interface MusicDeps {
  ctx: AudioContext
  out: AudioNode
  send: AudioNode | null
  tables: SharedTables
  strings: StringBank | null
  modal: ModalVoiceBank | null
  tier: Tier
  maxLayers: number
}

type LayerName = "drone" | "pulse" | "bass" | "arp" | "bell" | "shaker"

/** Intensity at which each layer becomes audible. Ordered by musical weight. */
const LAYER_IN: Record<LayerName, number> = {
  drone: 0.0,
  pulse: 0.18,
  bass: 0.3,
  arp: 0.45,
  shaker: 0.6,
  bell: 0.78,
}

const LAYER_ORDER: LayerName[] = ["drone", "pulse", "bass", "arp", "shaker", "bell"]

export class ProceduralMusic {
  private gains = {} as Record<LayerName, GainNode>
  private drone: { osc: OscillatorNode[]; filt: BiquadFilterNode; lfo: OscillatorNode } | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private beat = 0
  private startTime = 0
  private rnd = mulberry32(0x5eed)
  private intensity = 0
  private running = false
  private bpm = 88
  /** Bar the harmony last changed on, and the current chord degree. */
  private chord = 0
  private active: LayerName[]

  /** How far ahead we schedule, and how often we wake. 120/25 is the sweet
   *  spot: shorter lookahead risks dropouts under GC, longer makes an
   *  intensity change feel laggy because notes are already committed. */
  private readonly lookahead = 0.12
  private readonly tick = 25

  private deps: MusicDeps

  constructor(deps: MusicDeps) {
    this.deps = deps
    this.active = LAYER_ORDER.slice(0, Math.max(1, deps.maxLayers))
    for (const l of this.active) {
      const g = deps.ctx.createGain()
      g.gain.value = 0
      g.connect(deps.out)
      this.gains[l] = g
    }
  }

  start(at?: number): void {
    if (this.running) return
    this.running = true
    const ctx = this.deps.ctx
    this.startTime = at ?? ctx.currentTime + 0.08
    this.beat = 0
    this.buildDrone()
    this.timer = setInterval(() => this.schedule(), this.tick)
    this.schedule()
    this.applyLayerGains(0.6)
  }

  stop(fade = 0.8): void {
    if (!this.running) return
    this.running = false
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    const now = this.deps.ctx.currentTime
    for (const l of this.active) {
      const g = this.gains[l]
      g.gain.cancelScheduledValues(now)
      g.gain.setValueAtTime(g.gain.value, now)
      g.gain.linearRampToValueAtTime(0, now + fade)
    }
    const d = this.drone
    if (d) {
      const stopAt = now + fade + 0.05
      for (const o of d.osc) o.stop(stopAt)
      d.lfo.stop(stopAt)
      this.drone = null
    }
  }

  setIntensity(v: number, glideSec = 2.2): void {
    this.intensity = Math.max(0, Math.min(1, v))
    this.bpm = 88 + this.intensity * 16
    this.applyLayerGains(glideSec)
    if (this.drone) {
      const t = this.deps.ctx.currentTime
      const f = 320 + this.intensity * 900
      this.drone.filt.frequency.cancelScheduledValues(t)
      this.drone.filt.frequency.setValueAtTime(this.drone.filt.frequency.value, t)
      this.drone.filt.frequency.linearRampToValueAtTime(f, t + glideSec)
    }
  }

  private applyLayerGains(glideSec: number): void {
    const t = this.deps.ctx.currentTime
    for (const l of this.active) {
      const g = this.gains[l]
      const inAt = LAYER_IN[l]
      // Equal-power fade across a 0.18-wide band above the threshold.
      const x = Math.max(0, Math.min(1, (this.intensity - inAt) / 0.18))
      const target = Math.sin((x * Math.PI) / 2) * this.layerBase(l)
      g.gain.cancelScheduledValues(t)
      g.gain.setValueAtTime(g.gain.value, t)
      g.gain.linearRampToValueAtTime(target, t + glideSec)
    }
  }

  private layerBase(l: LayerName): number {
    switch (l) {
      case "drone":
        return 0.34
      case "pulse":
        return 0.5
      case "bass":
        return 0.42
      case "arp":
        return 0.34
      case "shaker":
        return 0.24
      case "bell":
        return 0.24
    }
  }

  /**
   * The drone is the only CONTINUOUS element — three detuned saws through a
   * lowpass with a slow LFO. Continuous, so it needs no scheduling and it can
   * never glitch; everything else is one-shot and disposable.
   */
  private buildDrone(): void {
    const { ctx } = this.deps
    const filt = ctx.createBiquadFilter()
    filt.type = "lowpass"
    filt.frequency.value = 340
    filt.Q.value = 1.4
    filt.connect(this.gains.drone)

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.055
    const lfoG = ctx.createGain()
    lfoG.gain.value = 120
    lfo.connect(lfoG)
    lfoG.connect(filt.frequency)
    lfo.start()

    const osc: OscillatorNode[] = []
    const detunes = [-7, 0, 5, 12]
    for (let i = 0; i < detunes.length; i++) {
      const o = ctx.createOscillator()
      o.type = i === 3 ? "sine" : "sawtooth"
      o.frequency.value = ROOT * (i === 3 ? 2 : 1) * 0.5
      o.detune.value = detunes[i] * 1.4
      const g = ctx.createGain()
      g.gain.value = i === 3 ? 0.1 : 0.16
      o.connect(g)
      g.connect(filt)
      o.start()
      osc.push(o)
    }
    if (this.deps.send) {
      const s = ctx.createGain()
      s.gain.value = 0.25
      filt.connect(s)
      s.connect(this.deps.send)
    }
    this.drone = { osc, filt, lfo }
  }

  /** 16th-note grid. Everything is expressed in 16ths from `startTime`. */
  private timeOf(step: number): number {
    return this.startTime + (step * 60) / (this.bpm * 4)
  }

  private schedule(): void {
    if (!this.running) return
    const ctx = this.deps.ctx
    const now = ctx.currentTime
    // Background-throttle guard: if we woke up far behind, do NOT fire the
    // backlog. Rebase the grid onto now and carry on. Without this, a tab that
    // was hidden for 30 s dumps ~2000 notes into the graph the moment it wakes
    // and the audio thread stalls hard enough to be heard as a rip.
    if (this.timeOf(this.beat) < now - 0.4) {
      this.startTime = now + 0.05
      this.beat = 0
    }
    let guard = 0
    while (this.timeOf(this.beat) < now + this.lookahead && guard++ < 64) {
      this.emit(this.beat, this.timeOf(this.beat))
      this.beat++
    }
  }

  private emit(step: number, at: number): void {
    const bar = Math.floor(step / 16)
    const s = step % 16
    if (s === 0) {
      // Harmony moves on bar lines only: i - VI - iv - V, the shape that makes
      // Hijaz sound like a place rather than a scale exercise.
      this.chord = [0, 5, 3, 4][bar % 4]
    }
    const I = this.intensity

    // --- pulse: a darbuka pattern. Doum on 1 and 9, tek on the offbeats. ----
    if (this.gains.pulse && this.deps.modal) {
      const doum = s === 0 || s === 6 || s === 10
      const tek = s === 4 || s === 12 || (I > 0.55 && (s === 7 || s === 14))
      const ghost = I > 0.7 && s % 2 === 1 && this.rnd() < 0.22
      if (doum || tek || ghost) {
        this.deps.modal.strike({
          when: at,
          material: MATERIALS.skin,
          freq: doum ? 96 : 168,
          velocity: doum ? 0.62 : ghost ? 0.16 : 0.4,
          modes: this.deps.tier === "low" ? 3 : 6,
          sustain: doum ? 1 : 0.55,
          pan: doum ? 0 : this.rnd() * 0.5 - 0.25,
          gain: 0.55,
          rand: this.rnd,
        })
      }
    }

    // --- bass: plucked, root of the chord, on 1 and the "and" of 3 ---------
    if (this.gains.bass && this.deps.strings && (s === 0 || s === 6 || (I > 0.6 && s === 11))) {
      this.deps.strings.pluck({
        when: at,
        freq: degreeHz(this.chord, -1),
        velocity: 0.6,
        decay: 0.9,
        damping: 0.55,
        position: 0.3,
        pan: 0,
        gain: 0.5,
      })
    }

    // --- arp: santur figure across the chord, subdividing with intensity ---
    if (this.gains.arp && this.deps.strings) {
      const div = I > 0.8 ? 1 : I > 0.62 ? 2 : 4
      if (s % div === 0) {
        const deg = this.chord + [0, 2, 4, 2, 5, 4, 2, 0][(step / div) % 8 | 0]
        this.deps.strings.pluck({
          when: at,
          freq: degreeHz(deg, 1),
          velocity: 0.3 + this.rnd() * 0.2 + I * 0.15,
          decay: 1.2,
          damping: 0.22,
          position: 0.18 + this.rnd() * 0.1,
          pan: (this.rnd() * 2 - 1) * 0.45,
          gain: 0.34,
        })
      }
    }

    // --- shaker: 16ths with a swung accent -------------------------------
    if (this.gains.shaker && s % 2 === 1) {
      this.shaker(at, s % 4 === 3 ? 0.4 : 0.2)
    }

    // --- bell: sparse ornament high above, only when it is really going ---
    if (this.gains.bell && this.deps.modal && s === 8 && this.rnd() < 0.35 + I * 0.3) {
      this.deps.modal.strike({
        when: at,
        material: MATERIALS.bell,
        freq: degreeHz(this.chord + 4, 2),
        velocity: 0.35,
        modes: 4,
        sustain: 1.2,
        pan: (this.rnd() * 2 - 1) * 0.6,
        gain: 0.35,
        rand: this.rnd,
      })
    }
  }

  private shaker(at: number, amp: number): void {
    const { ctx, tables } = this.deps
    const src = ctx.createBufferSource()
    src.buffer = tables.velvet()
    src.playbackRate.value = 0.85 + this.rnd() * 0.3
    const bp = ctx.createBiquadFilter()
    bp.type = "bandpass"
    bp.frequency.value = 6200 + this.rnd() * 1800
    bp.Q.value = 1.6
    const g = ctx.createGain()
    const end = percEnv(g.gain, at, amp, 0.001, 0.035)
    src.connect(bp)
    bp.connect(g)
    g.connect(this.gains.shaker)
    src.start(at, this.rnd() * 0.4)
    src.stop(end + 0.02)
  }

  dispose(): void {
    this.stop(0.05)
    for (const l of this.active) this.gains[l]?.disconnect()
  }
}
