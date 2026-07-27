// The parental gate: the challenge, generated and checked. No DOM.
//
// Apple's Kids Category and Play's Families Policy both require one in front of
// a purchase flow, and this product needs one in front of the **price display**
// as well (ADR-0013) — a child at a natural stopping point sees no money at
// all until an adult is holding the tablet.
//
// **The challenge is never arithmetic, and here that is not a preference.**
// Apple's canonical gate is a multiplication problem. This is a mathematics app
// for grades 1–6. A child who has been practising `6 × 7` for a week beats
// their parent to it, and a gate the audience is being trained to defeat is not
// a gate. `noArithmetic` below is a test, not a comment.
//
// What is left is **reading and typing load**, which is the real asymmetry
// between a six-year-old and an adult:
//
//   * `year`   — "Enter the current four-digit year." Requires knowing it.
//   * `word`   — a long, ordinary, multi-syllable word to copy out. Requires
//                reading and typing thirteen letters without losing the place.
//
// Randomized per presentation and **never persisted**: nothing about a passed
// gate survives the sheet closing, so a child cannot learn one answer, and a
// tablet left unlocked does not stay unlocked.

export type Challenge =
  | { readonly kind: "year"; readonly answer: string }
  | { readonly kind: "word"; readonly word: string; readonly answer: string }

/**
 * The words.
 *
 * Every one is **thirteen letters or more, four syllables or more, and not a
 * word a primary-school child has any reason to have typed before.** That
 * combination is the barrier, and each part of it is doing work: length makes
 * it a transcription task rather than a recognition one, and unfamiliarity
 * means it cannot be typed from memory after the first glance.
 *
 * Rejected as too easy, and worth recording so they do not come back:
 * TELEVISION, UNIVERSITY, HELICOPTERS, WATERMELONS. A nine-year-old reads and
 * types all four without hesitating, which makes them decoration.
 *
 * Deliberately **not** curricular — no number words, no shape names, no
 * operations, nothing a maths app has spent a week teaching.
 */
export const GATE_WORDS: readonly string[] = [
  "ACCOMMODATION",
  "ADMINISTRATIVE",
  "CIRCUMSTANTIAL",
  "CORRESPONDENCE",
  "DETERMINATION",
  "EXTRAORDINARY",
  "INFRASTRUCTURE",
  "INTERNATIONAL",
  "JURISDICTIONAL",
  "MANUFACTURING",
  "PARTICIPATION",
  "PHILOSOPHICAL",
  "PROFESSIONALLY",
  "RECONSTRUCTED",
  "REPRESENTATIVE",
  "THERMODYNAMICS",
  "TRANSPORTATION",
  "UNPRECEDENTED",
]

/**
 * Build a challenge.
 *
 * `random` and `now` are injected so the test is a test rather than a coin
 * toss. In the app both are the real ones.
 */
export function makeChallenge(
  random: () => number = Math.random,
  now: number = Date.now(),
): Challenge {
  // Two forms, roughly evenly. Two rather than one because a single fixed form
  // is a single thing to memorise, and the year is the one an adult answers
  // instantly while being the one a young child is least likely to know.
  if (random() < 0.5) {
    return { kind: "year", answer: String(new Date(now).getFullYear()) }
  }
  const index = Math.min(GATE_WORDS.length - 1, Math.floor(random() * GATE_WORDS.length))
  const word = GATE_WORDS[index] ?? GATE_WORDS[0] ?? "TRANSMISSION"
  return { kind: "word", word, answer: word }
}

/**
 * Whether what was typed passes.
 *
 * Case-insensitive and whitespace-trimmed: an adult who types `refrigerator`
 * into a field showing `REFRIGERATOR` has demonstrated everything the gate is
 * there to demonstrate, and rejecting them teaches nobody anything.
 */
export function passes(challenge: Challenge, typed: string): boolean {
  return typed.trim().toUpperCase() === challenge.answer.toUpperCase()
}
