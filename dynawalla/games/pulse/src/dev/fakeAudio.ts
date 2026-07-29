/**
 * A Web Audio graph that makes no sound — QA only, never shipped.
 *
 * PULSE's escalation and its gate reporting live in `Run`, and `Run` owns the
 * transport, so the only honest way to test either is to run the real thing.
 * That needs an `AudioContext`, and node does not have one. This is a stand-in
 * with a hand-driven clock: `advance(seconds)` moves `currentTime`, which is
 * the *only* clock the game reads, so a test can play a five-minute run in a
 * few milliseconds and every bar line, note time and judgment window lands
 * exactly where it would on a device.
 *
 * Nothing here models sound. Every node accepts every call and remembers only
 * what the engine reads back (`gain.value`, `frequency.value`, `fftSize`).
 */

class FakeParam {
  value = 0
  setValueAtTime(v: number): this {
    this.value = v
    return this
  }
  linearRampToValueAtTime(v: number): this {
    this.value = v
    return this
  }
  exponentialRampToValueAtTime(v: number): this {
    this.value = v
    return this
  }
  setTargetAtTime(v: number): this {
    this.value = v
    return this
  }
  cancelScheduledValues(): this {
    return this
  }
  setValueCurveAtTime(): this {
    return this
  }
}

class FakeNode {
  readonly gain = new FakeParam()
  readonly frequency = new FakeParam()
  readonly Q = new FakeParam()
  readonly detune = new FakeParam()
  readonly playbackRate = new FakeParam()
  readonly delayTime = new FakeParam()
  readonly threshold = new FakeParam()
  readonly knee = new FakeParam()
  readonly ratio = new FakeParam()
  readonly attack = new FakeParam()
  readonly release = new FakeParam()

  type = "sine"
  curve: Float32Array | null = null
  oversample = "none"
  buffer: unknown = null
  loop = false
  onended: (() => void) | null = null

  fftSize = 2048
  smoothingTimeConstant = 0
  minDecibels = -100
  maxDecibels = 0
  get frequencyBinCount(): number {
    return this.fftSize / 2
  }

  connect<T>(destination: T): T {
    return destination
  }
  disconnect(): void {}
  start(): void {}
  stop(): void {}
  getFloatTimeDomainData(): void {}
  getByteFrequencyData(): void {}
}

class FakeBuffer {
  readonly numberOfChannels: number
  readonly length: number
  readonly sampleRate: number
  private readonly channels = new Map<number, Float32Array>()

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels
    this.length = length
    this.sampleRate = sampleRate
  }

  getChannelData(i: number): Float32Array {
    let ch = this.channels.get(i)
    if (!ch) {
      ch = new Float32Array(Math.max(0, this.length))
      this.channels.set(i, ch)
    }
    return ch
  }
}

export class FakeAudioContext {
  /** The one clock. Tests move it; the game only ever reads it. */
  currentTime = 0
  readonly sampleRate = 48000
  state: "running" | "suspended" | "closed" = "running"
  readonly baseLatency = 0.008
  readonly outputLatency = 0.012
  readonly destination = new FakeNode()

  createGain(): FakeNode {
    return new FakeNode()
  }
  createAnalyser(): FakeNode {
    return new FakeNode()
  }
  createDynamicsCompressor(): FakeNode {
    return new FakeNode()
  }
  createWaveShaper(): FakeNode {
    return new FakeNode()
  }
  createBiquadFilter(): FakeNode {
    return new FakeNode()
  }
  createConvolver(): FakeNode {
    return new FakeNode()
  }
  createDelay(): FakeNode {
    return new FakeNode()
  }
  createOscillator(): FakeNode {
    return new FakeNode()
  }
  createBufferSource(): FakeNode {
    return new FakeNode()
  }
  createBuffer(channels: number, length: number, rate: number): FakeBuffer {
    // Short buffers keep the impulse-response and noise loops cheap; nothing
    // reads a sample back.
    return new FakeBuffer(channels, Math.min(length, 256), rate)
  }
  resume(): Promise<void> {
    this.state = "running"
    return Promise.resolve()
  }
  close(): Promise<void> {
    this.state = "closed"
    return Promise.resolve()
  }
}

/**
 * Publish the fake as `window.AudioContext` and hand back the live instance
 * once something constructs it. Call BEFORE importing anything that builds an
 * engine.
 */
export function installFakeAudio(): { latest(): FakeAudioContext } {
  let latest: FakeAudioContext | null = null
  class Tracked extends FakeAudioContext {
    constructor() {
      super()
      latest = this
    }
  }
  const g = globalThis as unknown as { window?: Record<string, unknown> }
  g.window = { ...(g.window ?? {}), AudioContext: Tracked }
  return {
    latest: () => {
      if (!latest) throw new Error("no AudioContext has been constructed yet")
      return latest
    },
  }
}
