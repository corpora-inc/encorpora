// Drift micro-story SCENES — pair-agnostic.
//
// Drift never ships hardcoded target-language prose (that would pin a pair and
// break for the other ~49 languages). Instead a "scene" is a mood + an ordered
// list of CONTENT SLOTS. Each slot is filled at mount time from the learner's
// actual corpus (hostApi.getRandomEntries / a journey spec's itemRefs), so the
// prose that appears is always in the learner's TARGET language, with each
// word/phrase carrying its own native gloss for tap-to-reveal.
//
// A scene therefore describes the *cinematic shape* of a Drift (how many
// beats, which evocative visual element resolves on each beat, the tempo),
// not any specific words. This keeps Drift multilingual + pair-agnostic while
// still feeling authored.

/** A single evocative visual element that resolves as its beat is read. */
export type SceneMotif =
  | "dawn"      // a warm light rises
  | "lantern"   // a soft point of light kindles
  | "snow"      // slow drift of particles
  | "tide"      // a gentle horizontal swell
  | "door"      // a soft aperture opens
  | "stars"     // faint points fade in

export type Scene = {
  id: string
  /** Accent hue (deg) — Drift runs cooler than the exercise cards. */
  hue: number
  /** One motif per beat, in reading order. */
  motifs: SceneMotif[]
}

// A small serial set. `motifs.length` is the beat count — 5–6 beats so a
// "catch the drift" run has real length (narrate → catch, ~90s total), while
// the calm night-water aesthetic keeps it a comedown, not a chapter.
export const SCENES: Scene[] = [
  { id: "first-light", hue: 205, motifs: ["dawn", "lantern", "tide", "stars", "lantern"] },
  { id: "quiet-tide", hue: 190, motifs: ["tide", "lantern", "stars", "tide", "lantern", "dawn"] },
  { id: "slow-snow", hue: 225, motifs: ["snow", "lantern", "stars", "snow", "lantern"] },
  { id: "open-door", hue: 210, motifs: ["door", "dawn", "lantern", "tide", "stars", "lantern"] },
]

/** Deterministic-ish pick so a standalone session rotates through the serial. */
export function pickScene(seed: number): Scene {
  const i = Math.abs(Math.floor(seed)) % SCENES.length
  return SCENES[i]
}
