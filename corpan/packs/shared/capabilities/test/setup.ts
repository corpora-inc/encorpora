// jsdom test setup: stub Web Audio (§7.3 — "@shared/audio mocked via a stub
// AudioContext") + fetch for pack audio bytes + rAF safety net. Deterministic
// enough that cap-segment-player's real audioEngine plays a 3-segment fixture
// range to completion in ~400ms of wall clock.

class FakeAudioParam {
  value = 1
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  cancelScheduledValues() {}
}

class FakeNode {
  connect(_target?: unknown) {
    return _target
  }
  disconnect() {}
}

class FakeGainNode extends FakeNode {
  gain = new FakeAudioParam()
}

class FakeAnalyserNode extends FakeNode {
  fftSize = 0
  smoothingTimeConstant = 0
  getByteTimeDomainData() {}
  getFloatTimeDomainData() {}
  getByteFrequencyData() {}
}

class FakeBufferSource extends FakeNode {
  buffer: { duration: number } | null = null
  onended: (() => void) | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  start(_when = 0, offsetSec = 0) {
    const dur = Math.max(0, (this.buffer?.duration ?? 0) - offsetSec)
    this.timer = setTimeout(() => {
      this.onended?.()
    }, dur * 1000)
  }
  stop(_when?: number) {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}

class FakeAudioContext {
  state = "running"
  destination = new FakeNode()
  private startedAt = performance.now()
  get currentTime() {
    return (performance.now() - this.startedAt) / 1000
  }
  createGain() {
    return new FakeGainNode()
  }
  createAnalyser() {
    return new FakeAnalyserNode()
  }
  createBuffer(_ch: number, _len: number, _rate: number) {
    return { duration: 0 }
  }
  createBufferSource() {
    return new FakeBufferSource()
  }
  decodeAudioData(_data: ArrayBuffer) {
    // Matches the fixture manifest's duration_ms (120ms tones).
    return Promise.resolve({ duration: 0.12 })
  }
  resume() {
    this.state = "running"
    return Promise.resolve()
  }
  close() {
    this.state = "closed"
    return Promise.resolve()
  }
}

;(globalThis as Record<string, unknown>).AudioContext = FakeAudioContext
;(window as unknown as Record<string, unknown>).AudioContext = FakeAudioContext

// fetch stub for fixture audio bytes (decodeAudioData ignores content).
const realFetch = globalThis.fetch
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.endsWith(".wav") || url.includes("fixture://")) {
    return Promise.resolve(
      new Response(new ArrayBuffer(64), { status: 200 }),
    ) as Promise<Response>
  }
  return realFetch ? realFetch(input, init) : Promise.reject(new Error("no fetch"))
}) as typeof fetch

// rAF safety net (jsdom provides it under pretendToBeVisual; belt+suspenders).
if (typeof globalThis.requestAnimationFrame !== "function") {
  ;(globalThis as Record<string, unknown>).requestAnimationFrame = (
    cb: FrameRequestCallback,
  ) => setTimeout(() => cb(performance.now()), 16)
  ;(globalThis as Record<string, unknown>).cancelAnimationFrame = (id: number) =>
    clearTimeout(id)
}

// jsdom lacks PointerEvent; the modules only need type+coords at runtime.
if (typeof (globalThis as Record<string, unknown>).PointerEvent === "undefined") {
  class FakePointerEvent extends MouseEvent {
    pointerId: number
    pointerType: string
    constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.pointerType = init.pointerType ?? "mouse"
    }
  }
  ;(globalThis as Record<string, unknown>).PointerEvent = FakePointerEvent
  ;(window as unknown as Record<string, unknown>).PointerEvent = FakePointerEvent
}

// Element pointer-capture no-ops (jsdom throws otherwise).
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.hasPointerCapture = () => false
}

// ResizeObserver stub (jsdom lacks it; useBlockSizing observes the scope).
if (typeof (globalThis as Record<string, unknown>).ResizeObserver === "undefined") {
  class FakeResizeObserver {
    constructor(private cb: () => void) {}
    observe() {
      this.cb()
    }
    unobserve() {}
    disconnect() {}
  }
  ;(globalThis as Record<string, unknown>).ResizeObserver = FakeResizeObserver
  ;(window as unknown as Record<string, unknown>).ResizeObserver = FakeResizeObserver
}
