// The sound of the gallery. Synthesised in this pack's own `AudioContext` — the
// host's `feedback.sound` capability is a different thing and is not declared.
//
// Wood, brass and coin. The hammer is a struck block, a sale is two brass coins
// landing, and a lot that did not sell is the same block struck dead with the
// felt on it. **There is no buzzer in this pack**, because nothing in this game is
// a buzz: being wrong costs more lots, and more lots is a sound you hear arriving
// rather than a noise pointed at you.
//
// Everything leaves through `createSafetyBus`, never `ctx.destination`. A
// `GainNode` defaults to a gain of 1 and MOSAIC reached +22.9 dBFS that way; the
// shared bus is a limiter and a hard −1 dBFS ceiling, and `MIN_ATTACK` is why no
// envelope here opens faster than six milliseconds.

import { createSafetyBus, safeAttack } from "../../../../packs/shared/game-audio/index.ts"

type Ctor = typeof AudioContext

function contextCtor(): Ctor | null {
  const g = globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }
  return g.AudioContext ?? g.webkitAudioContext ?? null
}

export class Audio {
  private ctx: AudioContext | null = null
  private bus: GainNode | null = null
  private noise: AudioBuffer | null = null

  /** Web Audio needs a gesture. The first touch in the game is the first one. */
  resume(): void {
    if (!this.ctx) {
      const Ctx = contextCtor()
      if (!Ctx) return
      try {
        this.ctx = new Ctx()
      } catch (error) {
        console.warn("[gavel] no audio context", error)
        return
      }
      this.bus = this.ctx.createGain()
      this.bus.gain.value = 0.62
      const safety = createSafetyBus(this.ctx)
      this.bus.connect(safety.input)
      this.noise = this.makeNoise(this.ctx)
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch((error: unknown) => {
        console.warn("[gavel] audio could not resume", error)
      })
    }
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.9), ctx.sampleRate)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < data.length; i++) {
      last = (last + Math.random() * 2 - 1) * 0.5
      data[i] = last
    }
    return buf
  }

  private knock(when: number, dur: number, freq: number, gain: number, q: number): void {
    const ctx = this.ctx
    const bus = this.bus
    if (!ctx || !bus || !this.noise) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = 0.8 + Math.random() * 0.4
    const filter = ctx.createBiquadFilter()
    filter.type = "bandpass"
    filter.frequency.value = freq
    filter.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(gain, when + safeAttack(0.008))
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    src.connect(filter).connect(g).connect(bus)
    src.start(when)
    src.stop(when + dur + 0.05)
  }

  private tone(when: number, dur: number, from: number, to: number, gain: number): void {
    const ctx = this.ctx
    const bus = this.bus
    if (!ctx || !bus) return
    const osc = ctx.createOscillator()
    osc.type = "triangle"
    osc.frequency.setValueAtTime(from, when)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), when + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(gain, when + safeAttack(0.01))
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    osc.connect(g).connect(bus)
    osc.start(when)
    osc.stop(when + dur + 0.05)
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime + 0.005 : 0
  }

  /** A digit on the paddle. Tiny; it happens a lot. */
  tick(): void {
    if (!this.ctx) return
    this.knock(this.now(), 0.045, 1900, 0.07, 3.2)
  }

  /** A brass pin dropping on a tablet. */
  mark(): void {
    if (!this.ctx) return
    const t = this.now()
    this.knock(t, 0.06, 2600, 0.08, 4)
    this.tone(t, 0.1, 880, 700, 0.05)
  }

  release(): void {
    if (!this.ctx) return
    this.knock(this.now(), 0.05, 1100, 0.05, 2)
  }

  /** The hammer. One strike, wood on wood. */
  hammer(): void {
    if (!this.ctx) return
    const t = this.now()
    this.knock(t, 0.13, 420, 0.34, 1.1)
    this.tone(t, 0.1, 190, 90, 0.16)
  }

  /** Coins into the strongbox. `n` is the profit, so a bigger flip rings longer. */
  coins(n: number): void {
    if (!this.ctx) return
    const t = this.now()
    const count = Math.min(6, Math.max(1, n))
    for (let i = 0; i < count; i++) {
      this.tone(t + 0.06 + i * 0.062, 0.24, 1180 + i * 96, 880 + i * 70, 0.075)
      this.knock(t + 0.06 + i * 0.062, 0.05, 3200, 0.04, 5)
    }
  }

  /** A lot that did not sell. The block struck with the felt on it. */
  dull(): void {
    if (!this.ctx) return
    const t = this.now()
    this.knock(t, 0.2, 240, 0.22, 0.8)
    this.tone(t, 0.34, 128, 74, 0.12)
  }

  /** A consignment sold out. A short brass fifth, and then quiet. */
  cleared(): void {
    if (!this.ctx) return
    const t = this.now()
    this.tone(t, 0.4, 523, 784, 0.1)
    this.tone(t + 0.16, 0.5, 784, 1046, 0.085)
  }

  dispose(): void {
    const ctx = this.ctx
    this.ctx = null
    this.bus = null
    this.noise = null
    if (!ctx) return
    void ctx.close().catch(() => {
      // A context that was already closed is not news.
    })
  }
}
