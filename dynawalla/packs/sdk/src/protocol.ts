// The host↔pack wire, and the guards that make it a boundary rather than a
// convention.
//
// Everything crossing it is a structured-clone of plain data over a
// `MessagePort`, so every value arriving from a pack is attacker-controlled and
// is validated here before anything else looks at it. The guards are exhaustive
// and they are the only way in: `parseRequest` returns a typed request or a
// reason, never a partially-trusted object.
//
// Shape of one exchange:
//
//     pack → host   { id: 7, method: "items.answer", params: {...} }
//     host → pack   { id: 7, ok: true, result: {...} }
//               or  { id: 7, ok: false, error: { code, message } }
//
// and, unsolicited, host → pack `{ event: "pause" }`.
//
// ── Why the host judges ──────────────────────────────────────────────────────
// `items.next` does not carry the answer. `items.answer` records the attempt
// and *then* returns the canonical value, so a pack cannot learn what is
// correct without spending the attempt it would have to report anyway. The
// consequence is the one that matters for a mathematics product: a game cannot
// be beaten by fiddling with what it renders, because the thing that decides
// whether the child was right is not in the game.
//
// `items.reveal` is the deliberate exception, for a game that must place the
// correct target before the child reaches it. It is a declared capability, it
// is visible to the parent, and it changes nothing about who judges.

import type { Capability, Method } from "./capabilities.ts"
import { isMethod } from "./capabilities.ts"

/** Bumped when a message shape changes in a way an old pack would misread. */
export const PROTOCOL_VERSION = 1

/** The version of this SDK's method surface. Compared with `sdkCompatible`. */
export const SDK_VERSION = "1.0.0"

/**
 * A pack may not queue work faster than a child can cause it. 120 requests per
 * rolling second is roughly two per animation frame — far above any real
 * surface, far below a loop that would starve the host's own event handling.
 */
export const MAX_REQUESTS_PER_SECOND = 120

// ─── Envelopes ───────────────────────────────────────────────────────────────

export type Request = {
  readonly id: number
  readonly method: Method
  readonly params: Readonly<Record<string, unknown>>
}

export type ErrorCode =
  /** The method is not in the SDK at this version. */
  | "unknown_method"
  /** The pack did not declare the capability the method needs. */
  | "denied"
  /** The parameters did not typecheck. */
  | "invalid_params"
  /** Well-formed, but there is nothing to answer with (no item served, etc.). */
  | "no_item"
  /** The pack exceeded `MAX_REQUESTS_PER_SECOND`. */
  | "rate_limited"
  /** The host cannot do this on this device right now (no haptics hardware). */
  | "unavailable"
  /** A budget the pack was told about (storage bytes, key count). */
  | "quota"
  /** The host threw. The pack is told nothing about what. */
  | "internal"

export type Response =
  | { readonly id: number; readonly ok: true; readonly result: unknown }
  | {
      readonly id: number
      readonly ok: false
      readonly error: { readonly code: ErrorCode; readonly message: string }
    }

export type HostEventName = "settings" | "pause" | "resume" | "dispose"

export type HostEvent = { readonly event: HostEventName; readonly data?: unknown }

/**
 * The first message on the port, host → pack: what the pack got and what it
 * did not. A pack reads `granted` and hides the surfaces it cannot drive
 * instead of failing at the first tap.
 */
export type Connect = {
  readonly event: "connect"
  readonly protocol: number
  readonly sdk: string
  readonly host: string
  readonly packId: string
  readonly granted: readonly Capability[]
  readonly settings: Settings
}

// ─── Payloads ────────────────────────────────────────────────────────────────

export type Settings = {
  /** BCP-47. Every string the pack renders should follow it. */
  readonly locale: string
  /** `prefers-reduced-motion`. No information may be carried by motion alone. */
  readonly reducedMotion: boolean
  /** Set from the device, not guessed from the frame rate. */
  readonly quality: "low" | "medium" | "high"
  /** Multiplier on the pack's base type size. */
  readonly textScale: number
  readonly colorScheme: "light" | "dark"
  readonly sound: boolean
  readonly haptics: boolean
  /**
   * The device's safe-area insets in CSS pixels, measured by the HOST.
   *
   * A pack cannot measure these itself. It runs in an iframe sandboxed
   * `allow-scripts` with deliberately no `allow-same-origin`, and
   * `env(safe-area-inset-*)` is a property of the TOP-LEVEL browsing context —
   * a cross-origin child resolves all four to 0. Every pack that tried to read
   * them got zeros and drew its HUD under the notch believing it was safe.
   *
   * Optional so an older host is not a breaking change; a pack that sees
   * `undefined` should fall back to zeros, which is exactly what it was already
   * getting.
   */
  readonly safeArea?: { top: number; right: number; bottom: number; left: number }
}

export type ItemChoice = {
  readonly id: string
  /** Renderable text. Exact decimal — never a float, never rounded. */
  readonly text: string
}

/**
 * One question, as much of it as a pack needs to draw it and no more.
 *
 * `operands`, `text` and every numeric field are **strings**, and they are
 * exact: the curriculum computes in rationals and serialises, and a pack that
 * parses one into a `number` to lay it out has introduced the first floating
 * point error in the system. Layout wants `digits`, which is given.
 */
export type Item = {
  /** Opaque, one serve. `items.answer` quotes it back. */
  readonly id: string
  readonly skillId: string
  /**
   * The level *within* the skill, as the generator numbers its own parameter
   * sets. Not a difficulty: two skills' level 2 are not comparable, and the
   * shipped graph only goes to 3. For "how hard is this compared to everything
   * else the host has", read `difficulty`.
   */
  readonly level: number
  /**
   * Where this item sits on the host's whole ladder: 0 is the easiest content
   * the host can generate and 1 the hardest.
   *
   * The one difficulty number that is comparable across skills, and the one a
   * pack should read. It is relative on purpose — a pack has no way to know how
   * many rungs the host has, and when the curriculum grows rungs below the
   * current floor, 0 follows them down without a pack changing.
   *
   * Optional so an older host is not a breaking change; a pack that sees
   * `undefined` should fall back to `level`, which is what it was already
   * doing.
   */
  readonly difficulty?: number
  readonly form: "binary-op" | "value" | "compare" | "sequence"
  readonly operator?: "+" | "-" | "×" | "÷" | "<" | ">" | "="
  readonly operands: readonly string[]
  /** The whole question as text, for a screen reader and for speech. */
  readonly prompt: string
  /** Present only for a closed item. Absent means free entry. */
  readonly choices?: readonly ItemChoice[]
  readonly answerKind: "integer" | "rational" | "choice"
  /** Entry slots a keypad should show. Absent for a choice item. */
  readonly digits?: number
}

export type Judgement = {
  readonly correct: boolean
  /** The right answer, returned only once the attempt above is recorded. */
  readonly canonical: string
  /** A named misconception, when the response matched exactly one mal-rule. */
  readonly diagnosis?: string
  /** The host's decision, not the pack's: whether to move on. */
  readonly advance: boolean
}

export type LearnerSummary = {
  readonly skills: readonly {
    readonly id: string
    readonly level: "new" | "practiced" | "mastered" | "retired"
  }[]
}

/** Named, so a pack cannot invent a waveform or a duration. */
export type HapticCue = "tick" | "seat" | "settle" | "refuse"
export type SoundCue = "tick" | "seat" | "settle" | "refuse" | "arrive"

/**
 * A natural stopping point, named by the pack that reached it.
 *
 * **This is the whole of the day pass's mechanism, and it is a place rather
 * than a duration.** The host never counts minutes and never shows a clock; it
 * waits to be told that something ended by itself. Which of these a game sends
 * is the game's judgement about its own shape — the host treats all three the
 * same and only ever acts on the first one it hears in a day.
 *
 * The rule a pack author has to keep: **a transition is a thing the child
 * finished, never a thing that beat them.** A defeat, a failed run, a wrong
 * answer, a timer running out — none of those is a transition, because a
 * purchase surface must never sit next to a failure (ADR-0013). Send one after
 * a level is cleared, a run is completed, a boss is down.
 */
export type TransitionKind =
  /** A level, stage or chapter was cleared. */
  | "level"
  /** A complete run reached its own end. */
  | "run"
  /** A named set piece — a boss, a final wave — was beaten. */
  | "boss"

export const TRANSITION_KINDS: readonly TransitionKind[] = ["level", "run", "boss"]

export function isTransitionKind(value: unknown): value is TransitionKind {
  return value === "level" || value === "run" || value === "boss"
}

// ─── Guards ──────────────────────────────────────────────────────────────────

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export type ParsedRequest = { ok: true; request: Request } | { ok: false; code: ErrorCode; message: string }

/**
 * The one entry point for anything a pack sends.
 *
 * Ordering is deliberate: shape, then method, then capability (at the bridge,
 * which owns the grant set), then parameters. A denial must never depend on
 * what the parameters were.
 */
export function parseRequest(value: unknown): ParsedRequest {
  if (!isRecord(value)) {
    return { ok: false, code: "invalid_params", message: "message is not an object" }
  }
  const id = value["id"]
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 0) {
    return { ok: false, code: "invalid_params", message: "id must be a non-negative integer" }
  }
  const method = value["method"]
  if (!isMethod(method)) {
    return { ok: false, code: "unknown_method", message: `no such method: ${String(method)}` }
  }
  const params = value["params"]
  if (params !== undefined && !isRecord(params)) {
    return { ok: false, code: "invalid_params", message: "params must be an object" }
  }
  return { ok: true, request: { id, method, params: isRecord(params) ? params : {} } }
}

/** A string parameter, present and non-empty and not absurdly long. */
export function stringParam(
  params: Readonly<Record<string, unknown>>,
  key: string,
  maxLength = 256,
): string | null {
  const value = params[key]
  if (typeof value !== "string") return null
  if (value.length === 0 || value.length > maxLength) return null
  return value
}

/**
 * A 0..1 parameter, clamped rather than rejected.
 *
 * `numberParam(params, key, 1)` is not this: it returns `null` for a negative,
 * which at a call site that treats `null` as "absent" turns an out-of-range
 * request into no request at all — silently, which is the failure mode this
 * codebase keeps being bitten by. A number is a number; only a non-number is
 * absent.
 */
export function unitParam(params: Readonly<Record<string, unknown>>, key: string): number | null {
  const value = params[key]
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.max(0, Math.min(1, value))
}

/** A finite non-negative number parameter, clamped rather than rejected. */
export function numberParam(
  params: Readonly<Record<string, unknown>>,
  key: string,
  max: number,
): number | null {
  const value = params[key]
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null
  return Math.min(value, max)
}

export function isConnect(value: unknown): value is Connect {
  if (!isRecord(value)) return false
  if (value["event"] !== "connect") return false
  if (typeof value["protocol"] !== "number") return false
  if (typeof value["packId"] !== "string") return false
  return Array.isArray(value["granted"]) && isRecord(value["settings"])
}

export function isResponse(value: unknown): value is Response {
  if (!isRecord(value)) return false
  if (typeof value["id"] !== "number") return false
  if (value["ok"] === true) return true
  return value["ok"] === false && isRecord(value["error"])
}

export function isHostEvent(value: unknown): value is HostEvent {
  if (!isRecord(value)) return false
  const name = value["event"]
  return name === "settings" || name === "pause" || name === "resume" || name === "dispose"
}
