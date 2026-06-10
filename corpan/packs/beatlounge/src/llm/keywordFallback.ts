/**
 * beatlounge — the deterministic keyword router.
 *
 * The SAFETY NET: when the host has no LLM, the model is unparseable, or it
 * stalls, this maps the raw utterance straight to a tool call so the user ALWAYS
 * gets a musical result. It targets the SAME closed catalog the model does, so
 * the downstream pipeline (validate → build) is identical.
 *
 * It is intentionally simple and greedy — first confident match wins. The final
 * clause is a catch-all nudge (a small density bump) so we never return null for
 * a non-empty utterance.
 */

import type { ToolCall } from "./protocol"
import { MOOD_NAMES } from "./tools"

const has = (s: string, ...words: string[]): boolean => words.some((w) => s.includes(w))

/** Pull the first integer out of a string, if any. */
const firstInt = (s: string): number | undefined => {
  const m = s.match(/-?\d+/)
  return m ? parseInt(m[0], 10) : undefined
}

/** Resolve a drum lane mentioned in the text (defaults handled by caller). */
const drumIn = (s: string): string | undefined => {
  if (has(s, "kick", "bass drum", "bassdrum", "boom")) return "kick"
  if (has(s, "snare")) return "snare"
  if (has(s, "clap")) return "clap"
  if (has(s, "hat", "hi-hat", "hihat", "cymbal")) return "hat"
  return undefined
}

/**
 * Map an utterance to a tool call deterministically. Returns null ONLY for an
 * empty/whitespace utterance; any real text yields a call (catch-all at the end).
 */
export const keywordRoute = (utterance: string): ToolCall | null => {
  const s = utterance.toLowerCase().trim()
  if (!s) return null

  // --- explicit mood words (highest signal) ---
  for (const mood of MOOD_NAMES) {
    if (s.includes(mood)) return { name: "setMood", args: { mood } }
  }
  if (has(s, "chill", "relax", "calm", "mellow")) return { name: "setMood", args: { mood: "chill" } }
  if (has(s, "hype", "energetic", "pump", "banger", "hard")) return { name: "setMood", args: { mood: "hype" } }
  if (has(s, "dark", "moody", "ominous", "evil")) return { name: "setMood", args: { mood: "dark" } }
  if (has(s, "dreamy", "dream", "floaty", "ethereal", "ambient")) return { name: "setMood", args: { mood: "dreamy" } }
  if (has(s, "latin", "salsa", "clave", "afro", "tropical")) return { name: "setMood", args: { mood: "latin" } }
  if (has(s, "lofi", "lo-fi", "lo fi", "boom bap", "tape", "dusty")) return { name: "setMood", args: { mood: "lofi" } }

  // --- tempo ---
  if (has(s, "bpm", "tempo")) {
    const n = firstInt(s)
    if (n != null) return { name: "setTempo", args: { bpm: n } }
  }
  if (has(s, "faster", "speed up", "quicker", "speed it up")) {
    return { name: "setTempo", args: { bpm: TEMPO_BUMP } } // build clamps; runtime knows current
  }
  if (has(s, "slower", "slow down", "slow it", "chill the tempo", "half time")) {
    return { name: "setTempo", args: { bpm: TEMPO_DROP } }
  }

  // --- swing ---
  if (has(s, "swing", "shuffle", "groove", "bounce", "loosen the feel", "straight")) {
    const heavy = has(s, "heavy", "lots", "more", "hard")
    const straight = has(s, "straight", "no swing", "off") || (has(s, "less") && !heavy)
    const amount = straight ? 0 : heavy ? 0.5 : 0.3
    return { name: "setSwing", args: { amount } }
  }

  // --- euclid ---
  if (has(s, "euclid", "euclidean", "tresillo", "clave", "over")) {
    const nums = s.match(/\d+/g)?.map((n) => parseInt(n, 10)) ?? []
    const pulses = nums[0] ?? 3
    const steps = nums[1] ?? 8
    return { name: "euclid", args: { drum: drumIn(s) ?? "hat", pulses, steps } }
  }

  // --- humanize ---
  if (has(s, "humanize", "human", "loosen", "looser", "natural", "less robotic", "breathe", "feel played")) {
    return { name: "humanize", args: { amount: 0.5 } }
  }

  // --- density (more/less hits) ---
  const wantMore = has(s, "more", "add", "busier", "thicker", "denser", "fill")
  const wantLess = has(s, "less", "fewer", "remove", "thinner", "sparse", "strip", "take out", "drop")
  if (wantMore || wantLess || drumIn(s)) {
    const dir = wantLess && !wantMore ? "less" : "more"
    const amount = firstInt(s)
    const args: Record<string, unknown> = { dir, drum: drumIn(s) ?? "hat" }
    if (amount != null) args.amount = Math.abs(amount)
    return { name: "density", args }
  }

  // --- clear / empty ---
  if (has(s, "clear", "empty", "wipe", "reset the drums")) {
    return { name: "density", args: { dir: "less", drum: "hat", amount: 16 } }
  }

  // --- catch-all: a gentle density nudge, so SOMETHING always happens. ---
  return { name: "density", args: { dir: "more", drum: "hat" } }
}

/** Sentinel BPMs the runtime rewrites to current±delta (build clamps regardless). */
export const TEMPO_BUMP = 999
export const TEMPO_DROP = -999
