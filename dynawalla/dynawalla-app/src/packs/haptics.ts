// The four named cues, turned into something a hand can actually feel.
//
// ## What was wrong
//
// This app asked for haptics with `navigator.vibrate`. That API does not exist
// in iOS Safari or in WKWebView — not "fails", not "returns false": the
// property is `undefined`, so the guard `navigator.vibrate && ...` was simply
// false on every iPhone and iPad and every cue was a silent no-op. What a child
// on iOS felt was the *sound*. It worked on Android, and it worked in a desktop
// browser, which is exactly why nobody caught it.
//
// ## Why a duration was the wrong unit
//
// `navigator.vibrate(8)` says "run the motor for eight milliseconds". That is
// an Android idiom and it is the whole vocabulary of the API. iOS has no such
// control and never will: Taptic Engine feedback is exposed only as *named
// semantic events* through `UIImpactFeedbackGenerator`,
// `UISelectionFeedbackGenerator` and `UINotificationFeedbackGenerator`. A
// duration cannot be translated into one; a meaning can. So the durations below
// are kept strictly as the web fallback, and the cue → style table is what the
// native path uses.
//
// ## The mapping, and why each one
//
// - `tick` → `selection`. The OS's own "a value changed under your finger"
//   cue. It is not a small impact — it is tuned to stay legible when it repeats
//   at speed, which is the entire life of a tick (a digit entered, a value
//   scrubbed). A stream of light impacts turns to mush; this does not.
// - `seat` → `medium`. A piece arriving where it belongs is a collision, so it
//   wants an impact generator rather than a notification. `light` is lost
//   underneath a finger already in motion, `heavy` reads as something going
//   wrong; medium is the confirming thunk of a thing landing home.
// - `settle` → `success`. The end of an action that went well, which is the
//   literal contract of `UINotificationFeedbackGenerator.success`. Note the old
//   web pattern here was `[12, 40, 12]` — a two-beat "ta-dum", already the
//   shape of the iOS success rhythm, invented by hand.
// - `refuse` → `error`. The canonical rejection. `warning` is the softer
//   "careful" pattern and is what a near-miss would use; a refusal is a
//   "no", and it should not feel like a caution.
//
// ## The trap this file is shaped around
//
// The plugin treats an unknown style as `medium` on both platforms, on purpose
// (a pack must not be able to fail the app by asking for a feel that does not
// exist). The cost is that a misspelled style is INDISTINGUISHABLE at runtime
// from a working one — no error, no log, just the wrong feel forever.
// `haptics.test.ts` therefore reads the plugin's Swift and Kotlin sources and
// asserts every style named below is an explicit case in both.

import type { HapticCue } from "../../../packs/sdk/src/index.ts"

/** The styles `tauri-plugin-haptics` names. Not every style it accepts. */
export type HapticStyle = "selection" | "medium" | "success" | "error"

/** Cue → native feedback style. The reasoning is in the header. */
export const HAPTIC_STYLE: Readonly<Record<HapticCue, HapticStyle>> = {
  tick: "selection",
  seat: "medium",
  settle: "success",
  refuse: "error",
}

/**
 * The web fallback, in milliseconds.
 *
 * Reached on Android's WebView before the plugin answers, and in a plain
 * browser (`npm run dev`, or the pack SDK's standalone harness) where there is
 * no IPC at all. Unchanged from what this app shipped, because on the one
 * platform where it ever did anything it was already right.
 */
export const HAPTIC_PATTERN: Readonly<Record<HapticCue, number | readonly number[]>> = {
  tick: 8,
  seat: 18,
  settle: [12, 40, 12],
  refuse: [40, 30, 60],
}

/**
 * The two ways a cue can reach hardware, as a port.
 *
 * A port rather than a direct `invoke` import so the decision — which cue, which
 * style, which path, and whether the settings toggle allows any of it — is
 * testable in Node with no WebView, no device and no Tauri, exactly as
 * `native.ts` does it for the pack runtime.
 */
export type HapticPorts = {
  /** The native plugin. `null` when this build is not running under Tauri. */
  readonly native: ((style: HapticStyle) => Promise<unknown>) | null
  /** `navigator.vibrate`, bound. `null` where the platform lacks it — iOS. */
  readonly web: ((pattern: number | number[]) => unknown) | null
}

/**
 * Fire one cue. Never throws, never returns a promise anyone can await.
 *
 * Native first, because it is the only path that does anything on iOS and the
 * better path on Android (the plugin drives amplitude-controlled effects that
 * `navigator.vibrate` cannot reach). The web path is the fallback, and it is
 * also the fallback for a *rejected* invoke — a missing capability grant, an
 * older shell — rather than a dead end.
 *
 * The failure of a haptic is never surfaced to a child, and it is not an error
 * in the log either: a device with no vibration motor is not a fault, and this
 * is called on the answer path where noise would be constant.
 */
export function fireHaptic(cue: HapticCue, ports: HapticPorts): void {
  const fallback = () => {
    if (!ports.web) return
    try {
      ports.web(HAPTIC_PATTERN[cue] as number | number[])
    } catch {
      /* no motor, or a WebView that refuses before a gesture — not a fault */
    }
  }
  if (ports.native) {
    try {
      void ports.native(HAPTIC_STYLE[cue]).catch(fallback)
    } catch {
      fallback()
    }
    return
  }
  fallback()
}
