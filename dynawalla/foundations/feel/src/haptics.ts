// Haptics. Three back-ends, one call, and two traps that cost real time.
//
// ## Trap 1 — `navigator.vibrate` does not exist in iOS WKWebView
//
// It is not that it fails; it is that it is `undefined`, so a naive
// `navigator.vibrate?.(10)` is a silent no-op on every iPhone and iPad. A
// WebView-only haptics implementation therefore *works in the simulator on
// desktop Chrome*, passes review, and ships with no haptics on half the fleet.
// The repo already carries `tauri-plugin-haptics` for exactly this reason
// (`impact(style)` → `UIImpactFeedbackGenerator` / `UINotificationFeedback-
// Generator` on iOS, `Vibrator`/`VibrationEffect` on Android). This module
// prefers the plugin and falls back to `navigator.vibrate` only where it exists.
//
// ## Trap 2 — the plugin call is async IPC, so haptics land late
//
// `invoke()` crosses the WebView bridge. Measured on this machine the desktop
// round trip is single-digit ms, but the *scheduling* is the problem: fire the
// haptic from a rAF callback after the render and it lands a frame or more
// after the pixel. Touch is more latency-sensitive than vision — a haptic
// 40 ms after the flash reads as a second, unrelated event.
//
// So: haptics fire **first**, at the top of the reaction, before any visual
// work is queued, and they are fire-and-forget (never awaited on the answer
// path). `feel.react()` calls `haptics.fire()` as its first statement.
//
// ## Trap 3 — rate limiting
//
// iOS coalesces feedback generators that fire faster than roughly 40 ms apart
// into mush, and a child mashing a keypad generates exactly that. A minimum
// interval is enforced here rather than in every prototype, and a stronger
// style always wins over a weaker one inside the window.

export type HapticStyle = "light" | "medium" | "heavy" | "success" | "warning"

const WEIGHT: Record<HapticStyle, number> = {
  light: 1,
  medium: 2,
  warning: 3,
  heavy: 4,
  success: 5,
}

/** Android `navigator.vibrate` fallback durations, ms. */
const VIBRATE_MS: Record<HapticStyle, number> = {
  light: 8,
  medium: 16,
  heavy: 28,
  success: 12,
  warning: 20,
}

type Invoke = (cmd: string, args: Record<string, unknown>) => Promise<unknown>

export interface HapticsOptions {
  /** Minimum ms between two haptics. Below this the stronger one wins. */
  minIntervalMs?: number
  /** Injected for tests. */
  now?: () => number
}

export class Haptics {
  enabled = true
  private readonly minIntervalMs: number
  private readonly now: () => number
  private last = -1e9
  private lastWeight = 0
  private invoke: Invoke | null = null
  private vibrate: ((p: number | number[]) => boolean) | null = null

  /** Counts, for the bench and for the "is it actually firing" question. */
  fired = 0
  coalesced = 0

  constructor(opts: HapticsOptions = {}) {
    this.minIntervalMs = opts.minIntervalMs ?? 40
    const g = globalThis as unknown as { performance?: { now(): number } }
    this.now = opts.now ?? (g.performance ? () => g.performance!.now() : () => Date.now())
  }

  /**
   * Trap 4, found by reading the console rather than by reasoning: Chrome
   * **blocks** `navigator.vibrate` until the frame has been tapped, and logs an
   * error every time it is called before then. A juice layer that fires a
   * haptic on every state change therefore fills the console with errors during
   * boot animations and any scripted demo — noise that hides real errors.
   * The gate is the same shape as the audio one and is set by the same gesture.
   */
  private gestured = false

  /**
   * Wire up the platform. Call once at boot.
   *
   * Deliberately takes `invoke` rather than importing `@tauri-apps/api`, so the
   * kit has no Tauri dependency and a browser prototype has nothing to stub.
   */
  attach(opts: { invoke?: Invoke | null } = {}): void {
    this.invoke = opts.invoke ?? null
    const g = globalThis as unknown as {
      navigator?: Navigator
      addEventListener?: (t: string, f: () => void, o?: object) => void
    }
    const nav = g.navigator
    this.vibrate = nav && typeof nav.vibrate === "function" ? nav.vibrate.bind(nav) : null
    const mark = () => {
      this.gestured = true
    }
    g.addEventListener?.("pointerdown", mark, { once: true, passive: true })
    g.addEventListener?.("keydown", mark, { once: true })
  }

  /** True if anything at all will actually happen. Prototypes can branch on it. */
  get available(): boolean {
    return this.invoke !== null || this.vibrate !== null
  }

  /**
   * Fire and forget. Never returns a promise the answer path could await.
   *
   * Within the coalescing window a stronger style replaces a weaker one that
   * has already fired — a child who taps a digit (`light`) and immediately
   * commits a correct answer (`success`) 20 ms later should feel the success,
   * not have it swallowed.
   */
  fire(style: HapticStyle | null): void {
    if (!this.enabled || style === null) return
    const t = this.now()
    const w = WEIGHT[style]
    if (t - this.last < this.minIntervalMs) {
      if (w <= this.lastWeight) {
        this.coalesced++
        return
      }
    }
    this.last = t
    this.lastWeight = w
    this.fired++

    if (this.invoke) {
      // Errors are swallowed on purpose: a missing capability grant must not
      // reject into the answer path.
      void this.invoke("plugin:haptics|impact", { args: { style } }).catch(() => {})
      return
    }
    // Only after a real gesture — see `gestured` above.
    if (this.vibrate && this.gestured) this.vibrate(VIBRATE_MS[style])
  }
}
