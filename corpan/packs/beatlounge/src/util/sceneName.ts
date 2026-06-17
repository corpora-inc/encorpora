/**
 * beatlounge — Scene NAME generator.
 *
 * A Scene's default name is a datetime prefix + a random two-word name, e.g.
 *   "2026-06-11 · brave-canyon"
 * The user can rename it afterward (like a track name). The two-word part is
 * self-contained here (curated adjective + noun lists) — NO cross-pack import,
 * so the generator travels with the pack and stays deterministic in tests.
 *
 * Determinism: given the same `seed` and the same `now`, `defaultSceneName`
 * returns the same string. Tests inject both; the live module seeds from
 * `Date.now()` + a fresh entropy source. We intentionally do NOT call
 * Date.now()/Math.random() inside the pure functions — the caller passes them.
 */

/** Curated, evocative adjectives — calm, premium, no slang, no negatives. */
const ADJECTIVES: readonly string[] = [
  "amber", "azure", "brave", "calm", "coral", "crimson", "dawn", "deep",
  "distant", "drift", "dusk", "ember", "fading", "feral", "first", "glass",
  "golden", "grave", "hazy", "hidden", "hollow", "jade", "lone", "lunar",
  "mellow", "mute", "neon", "north", "open", "pale", "pearl", "polar",
  "quiet", "rare", "rust", "sable", "silent", "slow", "solar", "still",
  "stray", "swift", "tidal", "umber", "velvet", "vivid", "warm", "wild",
  "winter", "wonder",
]

/** Curated nouns — places, textures, weather; reads like a coordinate. */
const NOUNS: readonly string[] = [
  "anchor", "ardor", "ash", "aurora", "basin", "beacon", "bloom", "canyon",
  "cinder", "cliff", "coast", "comet", "current", "delta", "dune", "echo",
  "ember", "fathom", "fern", "fjord", "garden", "glade", "harbor", "haven",
  "horizon", "lagoon", "lantern", "marrow", "meadow", "mirror", "monsoon",
  "nebula", "oasis", "orbit", "pier", "prairie", "quartz", "ravine", "reef",
  "river", "saffron", "signal", "summit", "thunder", "tide", "vapor", "vesper",
  "willow", "zephyr", "zenith",
]

/**
 * A tiny deterministic PRNG (mulberry32). Given a 32-bit seed, returns a
 * stateful 0..1 generator — same seed ⇒ same sequence, so name generation is
 * reproducible in tests and reroll-stable.
 */
const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Pad to two digits (date parts). */
const p2 = (n: number): string => String(n).padStart(2, "0")

/**
 * Format `now` (epoch ms) as a local `YYYY-MM-DD` date prefix. Local time so the
 * label matches the user's wall clock; pure given the same Date implementation.
 */
export const formatSceneDate = (now: number): string => {
  const d = new Date(now)
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

/**
 * A random two-word name like "brave-canyon". Deterministic given `seed`; the
 * two words are guaranteed distinct strings (adjective ≠ noun is near-certain
 * already, but we also avoid the rare case where they print identically, e.g.
 * "ember-ember"). The adjective is always from ADJECTIVES and the noun from
 * NOUNS, so a hyphenated pair always reads adjective-then-noun.
 */
export const twoWordName = (seed: number): string => {
  const rng = mulberry32(seed)
  const adj = ADJECTIVES[Math.floor(rng() * ADJECTIVES.length)]
  let noun = NOUNS[Math.floor(rng() * NOUNS.length)]
  if (noun === adj) {
    // Re-pick the noun deterministically from the next draw, stepping until distinct.
    let i = NOUNS.indexOf(noun)
    do {
      i = (i + 1) % NOUNS.length
      noun = NOUNS[i]
    } while (noun === adj)
  }
  return `${adj}-${noun}`
}

/**
 * The default Scene name: `"<date> · <adjective>-<noun>"`, e.g.
 * "2026-06-11 · brave-canyon". Deterministic given (`now`, `seed`). The middle
 * dot is U+00B7 (·) to match the pack's existing separators.
 */
export const defaultSceneName = (now: number, seed: number): string =>
  `${formatSceneDate(now)} · ${twoWordName(seed)}`

/** Expose the lists (read-only) for tests / potential reuse. */
export const SCENE_ADJECTIVES = ADJECTIVES
export const SCENE_NOUNS = NOUNS
