/**
 * SfxEngine — sound-effects via HTMLAudioElement (NOT Web Audio fetch+decode).
 *
 * Why HTMLAudioElement: the pack is served from the dev server (or, when
 * installed, the host's pack scheme) which is a DIFFERENT ORIGIN than the
 * webview the pack runs in. A Web Audio `fetch()` of the WAV is therefore a
 * cross-origin request and is BLOCKED by CORS (the dev server sends no CORS
 * headers) → the buffer never loads → silence. Media elements (`<audio>`/`Audio`)
 * load cross-origin media WITHOUT CORS (same as <img>/<video>), so this path
 * works both on the dev manifest and when installed.
 *
 * Design (mobile-first, fail-safe):
 *  - Preload one base `Audio` per sound (resolved relative to the pack script).
 *  - iOS needs a user gesture before the FIRST playback; we "unlock" by doing a
 *    muted play()/pause() on the first pointerdown/touchend/click.
 *  - play(name) clones the base element so repeats/overlaps don't cut each other.
 *  - EVERY path is wrapped so a missing file / blocked play / no-Audio env is a
 *    silent no-op — it must NEVER throw into the game loop.
 *
 * Asset resolution: the host injects the pack SCRIPT URL as `data-corp-game-src`
 * (= the built `dist/app.js`); the WAVs are copied to `dist/audio/` beside it, so
 * we resolve `audio/<file>` RELATIVE TO THAT SRC.
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

// Per-event playback gain (HTMLAudioElement volume 0..1). Full volume on the
// chime + level-complete so they stay clean; the glug a touch under; the
// tap-snap + accent ping sit well UNDER the voice so they never compete with it.
const VOLUME: Partial<Record<SfxName, number>> = {
  win: 1.0,
  fill: 0.85,
  bottleComplete: 1.0,
  jarClose: 0.9,
  snap: 0.5,
  ping: 0.5,
}

class SfxEngineImpl {
  private base = new Map<SfxName, HTMLAudioElement>()
  private unlocked = false
  private unlockBound = false
  private unsupported = typeof Audio === "undefined"

  /** Preload one base element per known sound. Safe to call repeatedly. */
  preload(): void {
    if (this.unsupported) return
    this.ensure("win")
    this.ensure("fill")
    this.ensure("bottleComplete")
    this.ensure("jarClose")
    this.ensure("snap")
    this.ensure("ping")
    this.bindUnlock()
  }

  private ensure(name: SfxName): HTMLAudioElement | null {
    if (this.unsupported) return null
    const cached = this.base.get(name)
    if (cached) return cached
    const file = FILES[name]
    if (!file) return null
    try {
      const a = new Audio()
      a.src = audioUrl(file)
      a.preload = "auto"
      a.crossOrigin = null // media playback does NOT need CORS; keep it unset
      a.load()
      this.base.set(name, a)
      return a
    } catch {
      return null
    }
  }

  /** iOS unlocks media after the first gesture-initiated play(). */
  private bindUnlock() {
    if (this.unlockBound || typeof window === "undefined") return
    this.unlockBound = true
    const unlock = () => {
      if (this.unlocked) return
      this.unlocked = true
      for (const a of this.base.values()) {
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
    const opts = { passive: true } as AddEventListenerOptions
    window.addEventListener("pointerdown", unlock, opts)
    window.addEventListener("touchend", unlock, opts)
    window.addEventListener("click", unlock, opts)
  }

  /** Play a sound. Clones the base element so repeats/overlaps don't clip. */
  play(name: SfxName): void {
    try {
      const baseEl = this.ensure(name)
      if (!baseEl) return
      // Clone so a new completion doesn't cut off the previous one (and so the
      // fill + win can overlap). Cloned nodes share the cached media resource.
      const el = baseEl.cloneNode(true) as HTMLAudioElement
      el.volume = VOLUME[name] ?? 1
      el.muted = false
      const p = el.play()
      if (p && typeof p.then === "function") p.catch(() => undefined)
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
