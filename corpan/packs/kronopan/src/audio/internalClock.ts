// The internal synthesized-metronome clock backend.
//
// A Web Audio lookahead scheduler: a setInterval loop wakes every 25 ms and asks
// the pure planner for the clicks due in the next 100 ms, then schedules each at
// its exact audio time. The timer only decides WHEN to look ahead; it never
// schedules a sound itself, and it never reads Date.now or performance.now. All
// musical time comes from the audio context clock.
//
// The visual position (positionPulses) is interpolated from the anchor against
// the context clock and returned as a continuous float in pulses, so a view can
// read it every animation frame and stay phase-locked to what is heard.

import type { Cycle } from "../core"
import { totalPulses } from "../core"
import type { Clock, ClickDensity, ClockState } from "./clock"
import {
  type Anchor,
  secondsPerPulse,
  positionAt,
  reanchorTempo,
  rolesForCycle,
  planWindow,
} from "./clockCore"
import { Metronome } from "./metronome"

const LOOKAHEAD_SEC = 0.1
const TIMER_MS = 25
// A small lead so the first downbeat lands just in the future rather than being
// skipped as already-late at the instant of start.
const START_LEAD_SEC = 0.08
const CYCLE_SWAP_LEAD_SEC = 0.06

type AudioContextCtor = typeof AudioContext

const makeContext = (): AudioContext => {
  const Ctor: AudioContextCtor =
    globalThis.AudioContext ||
    (globalThis as unknown as { webkitAudioContext: AudioContextCtor }).webkitAudioContext
  return new Ctor()
}

export class InternalClock implements Clock {
  private ctx: AudioContext
  private master: GainNode
  private metro: Metronome

  private cycle: Cycle
  private roles = [] as ReturnType<typeof rolesForCycle>
  private total = 0

  private bpm: number
  private density: ClickDensity = "pulse"

  private anchor: Anchor
  private nextPulse = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false
  private frozenPosition = 0

  constructor(cycle: Cycle, bpm = 100) {
    this.ctx = makeContext()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.9
    // A gentle compressor so the loud downbeat cannot clip on a PA.
    const comp = this.ctx.createDynamicsCompressor()
    this.master.connect(comp)
    comp.connect(this.ctx.destination)
    this.metro = new Metronome(this.ctx, this.master)

    this.cycle = cycle
    this.bpm = bpm
    this.applyCycle(cycle)
    this.anchor = {
      anchorPulse: 0,
      anchorTime: 0,
      secondsPerPulse: secondsPerPulse(bpm, cycle.unit),
    }
  }

  private applyCycle(cycle: Cycle): void {
    this.cycle = cycle
    this.roles = rolesForCycle(cycle)
    this.total = totalPulses(cycle)
  }

  async start(): Promise<void> {
    if (this.running) return
    await this.resume()
    const now = this.ctx.currentTime
    this.anchor = {
      anchorPulse: 0,
      anchorTime: now + START_LEAD_SEC,
      secondsPerPulse: secondsPerPulse(this.bpm, this.cycle.unit),
    }
    this.nextPulse = 0
    this.running = true
    this.timer = setInterval(() => this.tick(), TIMER_MS)
    this.tick()
  }

  stop(): void {
    if (!this.running) return
    this.frozenPosition = positionAt(this.anchor, this.ctx.currentTime)
    this.running = false
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  state(): ClockState {
    return this.running ? "running" : "stopped"
  }

  positionPulses(): number {
    if (!this.running) return this.frozenPosition
    return positionAt(this.anchor, this.ctx.currentTime)
  }

  setTempo(bpm: number): void {
    this.bpm = bpm
    const spp = secondsPerPulse(bpm, this.cycle.unit)
    // Re-anchor at the current position so the playhead does not jump. Keep
    // nextPulse untouched so no pulse is scheduled twice.
    this.anchor = this.running
      ? reanchorTempo(this.anchor, this.ctx.currentTime, spp)
      : { ...this.anchor, secondsPerPulse: spp }
  }

  getTempo(): number {
    return this.bpm
  }

  setCycle(cycle: Cycle): void {
    this.applyCycle(cycle)
    // A new cycle restarts the phase at the downbeat, by design.
    const spp = secondsPerPulse(this.bpm, cycle.unit)
    const base = this.running ? this.ctx.currentTime + CYCLE_SWAP_LEAD_SEC : 0
    this.anchor = { anchorPulse: 0, anchorTime: base, secondsPerPulse: spp }
    this.nextPulse = 0
    this.frozenPosition = 0
  }

  setClickDensity(density: ClickDensity): void {
    this.density = density
  }

  getClickDensity(): ClickDensity {
    return this.density
  }

  setVolume(v: number): void {
    const clamped = Math.max(0, Math.min(1, v))
    this.master.gain.setValueAtTime(clamped, this.ctx.currentTime)
  }

  dispose(): void {
    this.stop()
    void this.ctx.close()
  }

  private tick(): void {
    if (!this.running || this.total <= 0) return
    const now = this.ctx.currentTime
    const { clicks, next } = planWindow(
      this.anchor,
      this.nextPulse,
      now,
      LOOKAHEAD_SEC,
      this.roles,
      this.total,
      this.density,
    )
    this.nextPulse = next
    for (const c of clicks) {
      // One bad trigger must never wedge the scheduler.
      try {
        this.metro.trigger(c.role, c.time)
      } catch (err) {
        console.error("[kronopan] click trigger failed; skipping", err)
      }
    }
  }

  private async resume(): Promise<void> {
    if (this.ctx.state !== "running") {
      try {
        await this.ctx.resume()
      } catch {
        // The next real user gesture will resume it.
      }
    }
  }
}
