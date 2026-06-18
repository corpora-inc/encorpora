/**
 * SfxEngine — uniform low-latency Web Audio for EVERY sound.
 *
 * At startup we fetch each WAV from the installed pack and `decodeAudioData` it
 * ONCE into an in-memory AudioBuffer. Every play is then a fresh
 * `AudioBufferSourceNode → gain → destination → start(0)` on the shared
 * AudioContext — sample-accurate, instant, overlap-safe, identical for the snap
 * and every other sound. Decoding happens up front (during the load beat), so by
 * the time the first phrase is on screen all buffers are armed; in gameplay there
 * is zero per-play latency difference between sounds.
 *
 * No inlining, no base64, no duplicate assets — the WAVs live once in dist/audio/
 * and are fetched from the pack's own origin (`corpan-pack://…` when installed,
 * the dev server in dev). Same code on iOS and Android (Web Audio + decodeAudioData
 * + the custom-scheme fetch are standard in both webviews; the AudioContext is
 * resumed on the first gesture for both platforms' autoplay policies).
 *
 * Every path is fail-safe — a missing file / failed fetch / decode error / no-Web-
 * Audio env is a silent no-op and never throws into the game loop.
 */

export type SfxName =
  | "win"
  | "fill"
  | "place"
  | "pick"
  | "bottleComplete"
  | "jarClose"
  | "snap"
  | "ping"

// ---- Pack script URL capture (module-load, while currentScript is the pack) --
const PACK_SCRIPT_SRC: string | null = (() => {
  if (typeof document === "undefined") return null
  try {
    const fromScript =
      (document.currentScript as HTMLScriptElement | null)?.dataset?.corpGameSrc ?? null
    if (fromScript) return fromScript
    const tagged = document.querySelector<HTMLScriptElement>("script[data-corp-game-src]")
    return tagged?.dataset?.corpGameSrc ?? null
  } catch {
    return null
  }
})()

/** Resolve `audio/<file>` next to the built dist/app.js (same origin as the pack). */
function audioUrl(file: string): string {
  const rel = `audio/${file}`
  if (PACK_SCRIPT_SRC) {
    try {
      return new URL(rel, PACK_SCRIPT_SRC.split("?")[0]).toString()
    } catch {
      /* fall through */
    }
  }
  return `./${rel}`
}

const FILES: Record<SfxName, string | null> = {
  win: "win.wav",
  fill: "fill.wav",
  bottleComplete: "level-complete.wav",
  jarClose: "jar-close.wav",
  snap: "snap.wav",
  ping: "ping-h-1.wav",
  place: null,
  pick: null,
}

// Per-event playback gain (0..1). STRONG + crisp: pour, win chime, bottle-complete,
// jar-close, and snap at full; only the accent ping a hair under so it layers
// cleanly on the win.
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
    for (const key of Object.keys(FILES) as SfxName[]) {
      const file = FILES[key]
      if (file) void this.loadOne(ctx, key, file)
    }
    this.bindUnlock()
  }

  /** Fetch one WAV from the pack origin + decode it into an AudioBuffer. */
  private async loadOne(ctx: AudioContext, name: SfxName, file: string): Promise<void> {
    try {
      const res = await fetch(audioUrl(file))
      if (!res.ok) return
      const arr = await res.arrayBuffer()
      // Callback form so older WebKit (no-promise decode) works on every webview.
      ctx.decodeAudioData(
        arr,
        (decoded) => this.buffers.set(name, decoded),
        () => undefined
      )
    } catch {
      // Network/CORS/decode failure → this sound stays silent; never crashes.
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
