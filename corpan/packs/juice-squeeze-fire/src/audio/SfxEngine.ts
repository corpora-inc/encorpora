/**
 * SfxEngine — hover-runner's exact, proven cross-version pattern.
 *
 * Each WAV is imported as an ES module so vite inlines it as a `data:` URL. Two
 * playback paths, picked per play:
 *   • Web Audio (preferred, sample-accurate): the data URL is fetched + decoded
 *     once into an AudioBuffer; play = a fresh `AudioBufferSourceNode.start(0)`.
 *   • HTMLAudio FALLBACK: a small pool of `new Audio(dataUrl)` elements.
 *
 * WHY the fallback is required (not defensiveness): on some hosts/older WebKit the
 * Web Audio buffer never becomes available (decode/context fails) — that's why the
 * SAME app.js plays on 0.19.0 but was silent on 0.18.0. hover-runner survives this
 * because `playWebAudio` calls `playHtml` whenever the buffer isn't ready, and
 * HTMLAudio (a media element) plays the data URL on every host/version. We mirror
 * that exactly: snappy Web Audio where it works, HTMLAudio everywhere else, never
 * silent.
 *
 * The AudioContext is resumed + media elements unlocked on the first gesture
 * (iOS + Android). Every path is fail-safe — never throws into the game loop.
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

const VOLUME: Partial<Record<SfxName, number>> = {
  win: 1.0,
  fill: 1.0,
  bottleComplete: 1.0,
  jarClose: 1.0,
  snap: 1.0,
  ping: 0.9,
}

const MAX_POOL = 3 // HTMLAudio elements per sound, so rapid repeats overlap

type AudioCtxCtor = typeof AudioContext
function getAudioContextCtor(): AudioCtxCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    AudioContext?: AudioCtxCtor
    webkitAudioContext?: AudioCtxCtor
  }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

type HtmlPool = { url: string; pool: HTMLAudioElement[] }

class SfxEngineImpl {
  private ctx: AudioContext | null = null
  private buffers = new Map<SfxName, AudioBuffer>()
  private htmlPools = new Map<SfxName, HtmlPool>()
  private started = false
  private unlockBound = false
  private htmlUnlocked = false

  preload(): void {
    if (this.started) return
    this.started = true
    const ctx = this.ensureContext()
    if (ctx) {
      for (const key of Object.keys(URLS) as SfxName[]) {
        const url = URLS[key]
        if (url) this.ensureBuffer(ctx, key, url)
      }
    }
    // Prime an HTMLAudio element per sound (the fallback path) up front, too.
    if (typeof Audio !== "undefined") {
      for (const key of Object.keys(URLS) as SfxName[]) {
        const url = URLS[key]
        if (url) this.ensurePool(key, url)
      }
    }
    this.bindUnlock()
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx
    const Ctor = getAudioContextCtor()
    if (!Ctor) return null
    try {
      this.ctx = new Ctor()
    } catch {
      this.ctx = null
    }
    return this.ctx
  }

  /** fetch the data URL + decode into a buffer; on ANY failure the sound stays
   *  on the HTMLAudio fallback (this is what makes it work on 0.18.0). */
  private ensureBuffer(ctx: AudioContext, name: SfxName, url: string): void {
    if (this.buffers.has(name)) return
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then(
        (data) =>
          new Promise<AudioBuffer>((resolve, reject) => {
            // Callback form so older WebKit (no-promise decode) works.
            ctx.decodeAudioData(data, resolve, reject)
          })
      )
      .then((buffer) => this.buffers.set(name, buffer))
      .catch(() => undefined)
  }

  private makeHtml(url: string, volume: number): HTMLAudioElement {
    const a = new Audio(url)
    a.preload = "auto"
    a.volume = clamp(volume, 0, 1)
    return a
  }

  private ensurePool(name: SfxName, url: string): HtmlPool {
    let entry = this.htmlPools.get(name)
    if (!entry) {
      entry = { url, pool: [this.makeHtml(url, VOLUME[name] ?? 1)] }
      this.htmlPools.set(name, entry)
    }
    return entry
  }

  private playHtml(name: SfxName, url: string): void {
    try {
      const entry = this.ensurePool(name, url)
      const vol = VOLUME[name] ?? 1
      let audio = entry.pool.find((a) => a.paused || a.ended)
      if (!audio) {
        if (entry.pool.length < MAX_POOL) {
          audio = this.makeHtml(url, vol)
          entry.pool.push(audio)
        } else {
          audio = entry.pool[0]
        }
      }
      audio.currentTime = 0
      audio.volume = clamp(vol, 0, 1)
      audio.muted = false
      const p = audio.play()
      if (p && typeof p.then === "function") p.catch(() => undefined)
    } catch {
      /* noop */
    }
  }

  /** Play: Web Audio when the buffer is armed (snappy), else HTMLAudio (works
   *  on every host/version) — exactly hover-runner's playWebAudio→playHtml. */
  play(name: SfxName): void {
    const url = URLS[name]
    if (!url) return
    const ctx = this.ctx
    const buffer = this.buffers.get(name)
    if (ctx && buffer) {
      try {
        if (ctx.state === "suspended" && typeof ctx.resume === "function") ctx.resume()
        const src = ctx.createBufferSource()
        src.buffer = buffer
        const gain = ctx.createGain()
        gain.gain.value = VOLUME[name] ?? 1
        src.connect(gain)
        gain.connect(ctx.destination)
        src.start(0)
        return
      } catch {
        /* fall through to HTMLAudio */
      }
    }
    this.playHtml(name, url)
  }

  /** Resume the context + unlock media elements on the first gesture. */
  private bindUnlock(): void {
    if (this.unlockBound || typeof window === "undefined") return
    this.unlockBound = true
    const unlock = () => {
      const ctx = this.ctx
      if (ctx && ctx.state === "suspended" && typeof ctx.resume === "function") {
        try {
          const p = ctx.resume()
          if (p && typeof p.then === "function") p.catch(() => undefined)
        } catch {
          /* noop */
        }
      }
      if (!this.htmlUnlocked) {
        this.htmlUnlocked = true
        for (const entry of this.htmlPools.values()) {
          const a = entry.pool[0]
          if (!a) continue
          try {
            a.muted = true
            const p = a.play()
            if (p && typeof p.then === "function") {
              p.then(() => {
                a.pause()
                a.currentTime = 0
                a.muted = false
              }).catch(() => {
                a.muted = false
              })
            } else {
              a.pause()
              a.currentTime = 0
              a.muted = false
            }
          } catch {
            a.muted = false
          }
        }
      }
    }
    const opts = { passive: true } as AddEventListenerOptions
    window.addEventListener("pointerdown", unlock, opts)
    window.addEventListener("touchend", unlock, opts)
    window.addEventListener("click", unlock, opts)
  }
}

let singleton: SfxEngineImpl | null = null

export function getSfxEngine(): SfxEngineImpl {
  if (!singleton) singleton = new SfxEngineImpl()
  return singleton
}

export type SfxEngine = SfxEngineImpl
