// src/journey/celebration/haptics.ts — the Journey haptic vocabulary
// (PREMIUM_SCROLL §3.2). ONE tiny vocabulary, fired from the celebration
// emitter so every provider (native renderer, pack round, reader) gets it free.
//
// Premium haptics = tactile, never punishing. Gating is deliberate and layered:
//   - capability  — no vibration surface (desktop / iOS WKWebView) ⇒ no-op
//   - reduced-motion — a learner who asked for calm gets no buzz
//   - intensity   — "minimal" juice ⇒ silent + still, so haptics off too
//   - enabled     — mirrors the sound/haptic setting (soundsEnabled)
// All four must pass. The decision is a pure function (`shouldFireHaptic`) so
// the gate is unit-testable without a device.

import { triggerHaptic, type HapticStyle } from "../../util/haptics.ts"

/** The Journey haptic events (PREMIUM_SCROLL §3.2). */
export type JourneyHaptic = "tap" | "land" | "combo" | "miss"

/** Map each Journey event to the underlying device impact style. */
const STYLE: Record<JourneyHaptic, HapticStyle> = {
  tap: "light", // any answer commit — the lightest touch
  land: "medium", // a correct resolve — a satisfying, weighted click
  combo: "success", // a combo milestone — a rising double-tick
  miss: "warning", // a soft, single buzz on a wrong answer (never punishing)
}

export interface HapticGate {
  /** Mirrors the sound/haptic user setting (store `soundsEnabled`). */
  enabled: boolean
  /** The learner asked for reduced motion — no buzz. */
  reducedMotion: boolean
  /** Effective juice intensity — "minimal" silences the whole juice layer. */
  intensity: "full" | "reduced" | "minimal"
}

/** True when this device exposes any vibration surface (web fallback probe;
 *  the native bridge is probed lazily inside `triggerHaptic`). Desktop and
 *  iOS WKWebView return false ⇒ the whole layer no-ops cleanly. */
export function hapticsCapable(): boolean {
  try {
    return typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
  } catch {
    return false
  }
}

/**
 * Pure gate: whether a haptic should fire given the user's settings. Kept
 * separate from the fire so it can be tested without a vibration surface.
 * Capability is checked at the fire site (it depends on the live `navigator`).
 */
export function shouldFireHaptic(gate: HapticGate): boolean {
  if (!gate.enabled) return false
  if (gate.reducedMotion) return false
  if (gate.intensity === "minimal") return false
  return true
}

/**
 * Fire a Journey haptic if the gate + capability allow it. Fire-and-forget,
 * never throws.
 */
export function fireHaptic(event: JourneyHaptic, gate: HapticGate): void {
  if (!shouldFireHaptic(gate)) return
  if (!hapticsCapable()) return
  triggerHaptic(STYLE[event])
}

// --- ambient gate registration ------------------------------------------
// The miss path fires from the sound layer (playSoftMiss), which has no access
// to the user's settings. CelebrationLayer registers the live gate here so a
// miss buzz honors the exact same four-layer gate as every other haptic,
// without prop-drilling or the sound layer reaching into the store.

let liveGate: HapticGate | null = null

/** CelebrationLayer publishes the current gate (or null to disarm on unmount). */
export function registerHapticGate(gate: HapticGate | null): void {
  liveGate = gate
}

/** Fire a haptic using the registered gate — a no-op until one is registered. */
export function fireHapticAmbient(event: JourneyHaptic): void {
  if (!liveGate) return
  fireHaptic(event, liveGate)
}
