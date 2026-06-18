/**
 * SfxEngine — pure Web Audio. Every sound is decoded ONCE (from inlined base64,
 * src/audio/audioData.ts) into an AudioBuffer and played via a fresh
 * AudioBufferSourceNode straight on the audio hardware clock. That makes onset
 * sample-accurate and LOCKED to the visuals — no scheduling jitter, no fetch, no
 * CORS, fully offline/native. Overlap-safe (a new sound never cuts the previous).
 *
 * iOS requires a user gesture before audio plays, so we resume the shared
 * AudioContext on the first pointerdown/touchend/click. play() is wrapped so a
 * stray error can never throw into the game loop.
 */
import { SFX_WAV_BASE64 } from "./audioData"

export type SfxName =
  | "win"
  | "fill"
  | "place"
  | "pick"
  | "bottleComplete"
  | "jarClose"
  | "snap"
  | "ping"

// Per-event playback gain (0..1). STRONG + crisp across the board: pour, win
// chime, bottle-complete, jar-close, and snap all at full; only the accent ping
// sits a hair under so it layers on the win without clipping.
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

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

class SfxEngineImpl {
  private ctx: AudioContext | null = null
  private buffers = new Map<SfxName, AudioBuffer>()
  private ready = false
  private unlockBound = false

  /** Create the context, decode every sound once, and arm the gesture unlock. */
  preload(): void {
    if (this.ready) return
    this.ready = true
    const Ctor = getAudioContextCtor()
    if (!Ctor) return
    try {
      this.ctx = new Ctor()
    } catch {
      this.ctx = null
      return
    }
    const ctx = this.ctx
    for (const key of Object.keys(SFX_WAV_BASE64) as SfxName[]) {
      const b64 = SFX_WAV_BASE64[key]
      if (!b64) continue
      try {
        // Callback form so older WebKit (no promise return) works. Decoding runs
        // fine while the context is suspended; the gesture only gates playback.
        ctx.decodeAudioData(
          base64ToArrayBuffer(b64),
          (decoded) => this.buffers.set(key, decoded),
          () => undefined
        )
      } catch {
        /* this sound stays silent rather than crashing the load */
      }
    }
    this.bindUnlock()
  }

  /** iOS starts the context suspended; resume it on the first gesture. */
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
