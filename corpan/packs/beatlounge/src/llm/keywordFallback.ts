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
import { TEMPLATE_NAMES } from "../music/templates"
import { SCALE_NAMES } from "../music/harmony"

const has = (s: string, ...words: string[]): boolean => words.some((w) => s.includes(w))

/** Detect a key (note name) mentioned in the text, e.g. "in D", "key of Eb". */
const keyIn = (s: string): string | undefined => {
  // Look for a standalone note letter, optionally with an accidental.
  const m = s.match(/\b(?:in|key of|key)\s+([a-g])(\s?(#|sharp|b|flat))?\b/)
  if (m) {
    let k = m[1].toUpperCase()
    const acc = m[3]
    if (acc === "#" || acc === "sharp") k += "#"
    else if (acc === "b" || acc === "flat") k += "b"
    return k
  }
  return undefined
}

/** Detect a mode/scale name in the text (dorian, minor, mixolydian, …). */
const modeIn = (s: string): string | undefined => {
  for (const name of SCALE_NAMES) {
    // Match the lowercased scale name, plus a couple of friendly aliases below.
    const lower = name.toLowerCase()
    if (s.includes(lower)) return name
  }
  if (has(s, "minor", "sad", "dark")) return "minor"
  if (has(s, "major", "happy")) return "major"
  return undefined
}

/** Detect a feel (melody / arp / chords / bass) in the text. */
const feelIn = (s: string): string | undefined => {
  if (has(s, "arp", "arpeggi")) return "arp"
  if (has(s, "bassline", "bass line", "bass")) return "bass"
  if (has(s, "chord", "comp", "pads")) return "chords"
  if (has(s, "melody", "lead", "solo", "tune")) return "melody"
  return undefined
}

/** Detect a named progression template in the text. */
const templateIn = (s: string): string | undefined => {
  for (const name of TEMPLATE_NAMES) if (s.includes(name)) return name
  // Friendly synonyms → templates.
  if (has(s, "doo-wop", "doo wop", "50s", "fifties")) return "doowop"
  if (has(s, "epic", "cinematic", "heroic")) return "epic"
  if (has(s, "sad", "melancholy", "plaintive")) return "sad"
  if (has(s, "jazzy", "ii-v", "2-5-1")) return "jazz"
  if (has(s, "twelve bar", "12 bar")) return "blues"
  if (has(s, "pachelbel")) return "canon"
  if (has(s, "spanish", "flamenco")) return "andalusian"
  return undefined
}

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

  // --- autonomous modulation agents (Wave 3 headline; high signal) ---
  // These come first so "breathe"/"calm" route to tweakers, not humanize/mood.
  if (has(s, "stop tweaking", "stop the tweak", "stop modulat", "calm down", "settle down", "hold still", "stop evolving", "freeze")) {
    return { name: "calm", args: {} }
  }
  if (has(s, "chaos", "go wild", "go crazy", "freak out", "glitch out", "lose it")) {
    return { name: "chaos", args: { amount: 1.5 } }
  }
  if (has(s, "evolve", "evolving", "morph", "keep changing", "tweak itself", "drive the knobs", "modulate")) {
    return { name: "vibe", args: { name: "evolve" } }
  }
  if (has(s, "drift", "wander", "meander", "float around")) {
    return { name: "vibe", args: { name: "drift" } }
  }
  if (has(s, "pulse", "throb", "pump it", "pulsate")) {
    return { name: "vibe", args: { name: "pulse" } }
  }
  if (has(s, "breathe", "breathing", "swell", "come alive", "bring it alive", "make it alive")) {
    return { name: "vibe", args: { name: "breathe" } }
  }

  // --- harmony: jam + named progressions (high signal) ---
  // A named progression template, or an explicit "progression/chords in <key>".
  const tpl = templateIn(s)
  if (tpl || has(s, "progression", "chord progression", "changes")) {
    const args: Record<string, unknown> = { template: tpl ?? "pop" }
    const k = keyIn(s)
    const mode = modeIn(s)
    const feel = feelIn(s)
    if (k) args.key = k
    if (mode) args.mode = mode
    if (feel) args.feel = feel
    return { name: "progression", args }
  }
  // "jam in D dorian", "play a melody in G minor", "arpeggiate in C". A bare
  // feel word ("more bass") is NOT enough — it must pair with a jam/play/compose
  // verb or a key/mode, so drum-density phrasing still routes to `density`.
  const jamVerb = has(s, "jam", "play in", "play a", "play me", "noodle", "improv", "compose", "arpeggiate")
  if (jamVerb || ((feelIn(s) || modeIn(s)) && (keyIn(s) || has(s, "scale", "mode", "in the key")))) {
    const args: Record<string, unknown> = {}
    const k = keyIn(s)
    const mode = modeIn(s)
    const feel = feelIn(s)
    if (k) args.key = k
    if (mode) args.mode = mode
    if (feel) args.feel = feel
    return { name: "jam", args }
  }

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
  if (has(s, "humanize", "human", "loosen", "looser", "natural", "less robotic", "feel played")) {
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
