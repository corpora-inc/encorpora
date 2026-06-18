/**
 * SfxEngine — uniform low-latency Web Audio, hover-runner's proven pattern.
 *
 * Each sound is imported as an ES module so VITE resolves its asset URL correctly
 * for the pack origin (`corpan-pack://…` when installed, the dev server in dev) —
 * that vite-resolved URL is the one fetch() can actually load (hand-building it
 * with `new URL()` mis-resolves the custom scheme, which is what broke audio in
 * the installed pack). At startup we `fetch(url) → arrayBuffer → decodeAudioData`
 * each into an AudioBuffer; every play is a fresh `AudioBufferSourceNode.start(0)`
 * — sample-accurate and instant for every sound. No host command, no inlined
 * base64, no version dependency: it's the same path hover-runner has shipped
 * since 0.9.x, on iOS / Android / desktop, online or off.
 *
 * Every step is fail-safe — a failed fetch / decode / no-Web-Audio env is a silent
 * no-op and never throws into the game loop. The AudioContext is resumed on the
 * first gesture (iOS + Android autoplay).
 */
import winUrl from "./assets/win.wav"
import fillUrl from "./assets/fill.wav"
import levelCompleteUrl from "./assets/level-complete.wav"
import jarCloseUrl from "./assets/jar-close.wav"
import snapUrl from "./assets/snap.wav"
import pingUrl from "./assets/ping-h-1.wav"

export type SfxName =
  | "win"
  | "fill"
  | "place"
  | "pick"
  | "bottleComplete"
  | "jarClose"
  | "snap"
  | "ping"

// vite-resolved asset URLs (correct for the pack origin).
const URLS: Record<SfxName, string | null> = {
  win: winUrl,
  fill: fillUrl,
  bottleComplete: levelCompleteUrl,
  jarClose: jarCloseUrl,
  snap: snapUrl,
  ping: pingUrl,
  place: null,
  pick: null,
}

// Per-event playback gain (0..1). STRONG + crisp; only the accent ping a hair under.
const VOLUME: Partial<Record<SfxName, number>> = {
  win: 1.0,
  fill: 1.0,
  bottleComplete: 1.0,
  jarClose: 1.0,
  snap: 1.0,
  ping: 0.9,
}

type AudioCtxCtor = typeof AudioContext
function getAudioContextCtor(): AudioCtxCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    AudioContext?: AudioCtxCtor
    webkitAudioContext?: AudioCtxCtor
  }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

class SfxEngineImpl {
  private ctx: AudioContext | null = null
  private buffers = new Map<SfxName, AudioBuffer>()
  private started = false
  private unlockBound = false

  /** Create the context, fetch + decode every sound once, arm the gesture unlock. */
  preload(): void {
    if (this.started) return
    this.started = true
    const Ctor = getAudioContextCtor()
    if (!Ctor) return
    try {
      this.ctx = new Ctor()
    } catch {
      this.ctx = null
      return
    }
    const ctx = this.ctx
    for (const key of Object.keys(URLS) as SfxName[]) {
      const url = URLS[key]
      if (url) void this.loadOne(ctx, key, url)
    }
    this.bindUnlock()
  }

  /** fetch the vite-resolved URL + decode into an AudioBuffer. */
  private async loadOne(ctx: AudioContext, name: SfxName, url: string): Promise<void> {
    try {
      const res = await fetch(url)
      if (!res.ok) return
      const data = await res.arrayBuffer()
      // Callback form so older WebKit (no-promise decode) works on every webview.
      ctx.decodeAudioData(
        data,
        (decoded) => this.buffers.set(name, decoded),
        () => undefined
      )
    } catch {
      // Fetch/decode failure → this sound stays silent; never crashes.
    }
  }

  /** iOS + Android start the context suspended; resume it on the first gesture. */
  private bindUnlock(): void {
    if (this.unlockBound || typeof window === "undefined") return
    this.unlockBound = true
    const resume = () => {
      const ctx = this.ctx
      if (!ctx) return
      try {
        if (ctx.state === "suspended" && typeof ctx.resume === "function") {
          const p = ctx.resume()
          if (p && typeof p.then === "function") p.catch(() => undefined)
        }
      } catch {
        /* noop */
      }
    }
    const opts = { passive: true } as AddEventListenerOptions
    window.addEventListener("pointerdown", resume, opts)
    window.addEventListener("touchend", resume, opts)
    window.addEventListener("click", resume, opts)
  }

  /** Play a sound: fresh source on the audio clock — instant, overlap-safe. */
  play(name: SfxName): void {
    const ctx = this.ctx
    const buffer = this.buffers.get(name)
    if (!ctx || !buffer) return
    try {
      if (ctx.state === "suspended" && typeof ctx.resume === "function") ctx.resume()
      const src = ctx.createBufferSource()
      src.buffer = buffer
      const gain = ctx.createGain()
      gain.gain.value = VOLUME[name] ?? 1
      src.connect(gain)
      gain.connect(ctx.destination)
      src.start(0)
    } catch {
      /* never throw into the game loop */
    }
  }
}

let singleton: SfxEngineImpl | null = null

export function getSfxEngine(): SfxEngineImpl {
  if (!singleton) singleton = new SfxEngineImpl()
  return singleton
}

export type SfxEngine = SfxEngineImpl
