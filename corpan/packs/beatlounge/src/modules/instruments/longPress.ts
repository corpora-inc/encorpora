/**
 * beatlounge — PURE long-press vs tap decision (no React / no DOM timers).
 *
 * The instruments track switcher wants ONE gesture target that does the common
 * thing on a quick tap (SWITCH to the track) and the rare thing on a deliberate
 * hold (RENAME). This module owns the pure rule so it unit-tests without a DOM:
 *
 *   • a pointer that is RELEASED before `holdMs` and hasn't drifted past
 *     `moveTolerancePx` ⇒ a TAP;
 *   • a pointer still down at `holdMs` (the hold timer fires) ⇒ a LONG-PRESS;
 *   • a pointer that drifts past `moveTolerancePx` ⇒ a DRAG → neither fires
 *     (it's a scroll/slop, not a tap, and the hold is cancelled).
 *
 * The React component (TrackNameEdit) wires a timer + pointer handlers to these
 * decisions; all the branching that's worth testing lives here.
 */

/** Tuning for the long-press gesture (defaults chosen for touch ergonomics). */
export const LONG_PRESS_MS = 450
export const MOVE_TOLERANCE_PX = 8

export interface PressStart {
  x: number
  y: number
  /** When the pointer went down (ms, e.g. performance.now()). */
  t: number
}

/** Has the pointer drifted past the slop radius (⇒ a drag, not a tap/hold)? */
export const isDrag = (
  start: PressStart,
  x: number,
  y: number,
  tolerancePx: number = MOVE_TOLERANCE_PX
): boolean => Math.hypot(x - start.x, y - start.y) > tolerancePx

/**
 * The gesture a RELEASE resolves to, given when it went down and where it ended:
 *   • "drag"  — drifted past tolerance ⇒ ignore (scroll/slop);
 *   • "long"  — held ≥ holdMs (a deliberate hold released right at/after the
 *               threshold) ⇒ rename;
 *   • "tap"   — a quick, in-place release ⇒ switch.
 * (When the hold TIMER fires first, the component acts on "long" immediately and
 * the eventual release is a no-op; this resolves the case where no timer ran.)
 */
export const resolveRelease = (
  start: PressStart,
  end: { x: number; y: number; t: number },
  holdMs: number = LONG_PRESS_MS,
  tolerancePx: number = MOVE_TOLERANCE_PX
): "tap" | "long" | "drag" => {
  if (isDrag(start, end.x, end.y, tolerancePx)) return "drag"
  return end.t - start.t >= holdMs ? "long" : "tap"
}
