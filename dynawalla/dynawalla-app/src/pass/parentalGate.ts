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
 * How often the **year** form is drawn rather than the word form.
 *
 * Both forms exist because a single fixed form is a single thing to memorise.
 * They are not, however, equally hard, and the split used to be even:
 *
 *   * The **word** form is the real barrier. Fourteen letters of a word a
 *     primary-school child has no reason to have typed, copied without losing
 *     the place — that is minutes of work for a seven-year-old and four seconds
 *     for an adult, which is exactly the asymmetry a gate wants.
 *   * The **year** form is instant for an adult and it is *also* instant for a
 *     nine-year-old. This is a maths app; its audience writes the date at the
 *     top of a page every day. At an even split, half of every child's attempts
 *     landed on the one form they can beat.
 *
 * So the year is the occasional form, not the coin-flip one: still reachable,
 * so the gate is never one memorisable thing, but the word is what a child
 * meets four times in five.
 */
const YEAR_SHARE = 0.2

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
  if (random() < YEAR_SHARE) {
    return { kind: "year", answer: String(new Date(now).getFullYear()) }
  }
  const index = Math.min(GATE_WORDS.length - 1, Math.floor(random() * GATE_WORDS.length))
  const word = GATE_WORDS[index] ?? GATE_WORDS[0] ?? "TRANSMISSION"
  return { kind: "word", word, answer: word }
}

/**
 * A fresh challenge **of the same form** as the one that was just missed.
 *
 * Why the form is held constant: the two forms are not the same height on the
 * screen. A word challenge renders a line of display type above the field; a
 * year challenge does not. Swapping one for the other on a wrong answer takes
 * that line out of the layout — so the field and the "Continue" button jump up
 * the screen, under the finger that is already reaching for them, at the exact
 * moment the person is being told they got it wrong. "Text that jumps as state
 * changes" is one of the named web-view tells, and this is where the sheet had
 * one.
 *
 * It is still a *different* challenge, which is the property that matters: a
 * word is replaced by one of the other seventeen, never by itself, so the gate
 * cannot be defeated by pressing Continue twice. A year has nothing to vary —
 * the current year is the current year — and it does not need to: it is not a
 * question you get closer to by being asked it again.
 */
export function reissue(
  challenge: Challenge,
  random: () => number = Math.random,
  now: number = Date.now(),
): Challenge {
  if (challenge.kind === "year") {
    return { kind: "year", answer: String(new Date(now).getFullYear()) }
  }
  const pool = GATE_WORDS.filter((word) => word !== challenge.word)
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length))
  const word = pool[index] ?? challenge.word
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
