// THE SILENCE GUARD — how long the arena waits, and why it is not a clock.
//
// **There is no time limit on a Resonance.** A child may look at the question
// for as long as they like. They may put the tablet on the table, take out a
// piece of paper, work `34,801 ÷ 37` out in columns, and come back to four
// spheres still sitting exactly where they left them. That is the founder's
// instruction, verbatim:
//
//   > "if you can do something like 34801 / 37 in your head in 5 seconds you
//   >  are a total math stud .. the higher levels need to come more gently and
//   >  not jump right into Max Cohen mode ... maybe they allow infinite time and
//   >  even invite the kid to take out a piece of paper and work it out for 10
//   >  minutes for the points instead of just encouraging them to make a quick
//   >  guess."
//
// ── What was here before ────────────────────────────────────────────────────
//
// `World.resonanceSeconds`, and it was a curve on the pacing controller:
//
//     valueAt(intensity, 26, 6, "gentle")
//
// 26 s at the floor of the ladder, earning down to 6 s at the top. That was
// deliberate and it was defended — the shrinking window was ARENA's *reward for
// mastery*, a countdown a player opted into by proving they were fast, never one
// imposed on a struggling child. On the content it was written for it was right.
//
// It is not right for the content the ladder actually reaches. `EXPERIENCE_DESIGN.md`
// puts long division on five digits in the **16 s p50 / 40 s p90** class. A 6 s
// window is a third of the *median* and a seventh of the p90 — so the one player
// the curve rewarded with a countdown is the only player whose questions were too
// long to answer inside it. Excitement and comprehension were on one knob, and
// the knob was labelled excitement.
//
// `docs/PACING_AUDIT_2026-07.md` names that as one design error replicated across
// seventeen games and states the invariant this module exists to satisfy:
//
//     **`window(d)` must be MONOTONE NON-DECREASING in item difficulty, and a
//     pure function of the item.** A harder question may never get less time
//     than an easier one.
//
// **So nothing about the run may reach this file.** No intensity, no rung, no
// depth, no mass, no speed, no elapsed time, no answer count. There is nothing in
// this module's imports that could supply one, because there are no imports —
// `window.test.ts` asserts that by reading this file's own source, the way
// `games/runner/src/game/comprehension.ts` does.
//
// ── What replaced it, and why it is a different kind of thing ────────────────
//
// Not a longer window. **No window.** `games/claim` (#673) and
// `games/counterweight` (#707) both reached the same conclusion and deleted
// theirs, and `claim` wrote down the rule:
//
//     **A clock may never take anything away from a child.**
//
// What is left is an **allowance**, and every one of its properties is the
// opposite of a countdown:
//
//   1. **It is derived from the item**, monotone non-decreasing in its
//      difficulty, which is what the invariant above asks for — and it is TEN
//      TIMES the p90 of the arithmetic rather than one, so it is not a pace
//      anybody is held to. Sixty seconds on `7 + 5`; ten minutes on
//      `34,801 ÷ 37`.
//   2. **It is not drawn.** Nothing in `render/` or `ui/` reads it. There is no
//      bar, no ring, no number and no draining anything, so there is nothing for
//      a child to watch being taken away. `games/counterweight` found that a
//      visible draining countdown is an anxiety cue *regardless of how much time
//      it grants* — "the action is rushed by the timer going down" — and that is
//      the property this satisfies, not the length.
//   3. **On running out it reports nothing and takes nothing.** That was already
//      true of ARENA's timeout before this pass and it stays true: the beat
//      fades, the host is never told, the pacing controller never moves, and the
//      question comes back later. A child who was still carrying the hundreds
//      column has told us nothing about what they know.
//   4. **And the seconds are free in the world too.** The arena is inert during a
//      beat, so `World.playTime` excludes them and the depth clock, the
//      overdrive and the quiet tide all ride that. A child cannot come back from
//      the paper to a meaner ocean. Without this the guard would simply have
//      moved the bill rather than cancelled it — measured, ten minutes of
//      thinking sank a run six depth bands.
//
// ── Why it is NOT refilled by input, where claim and counterweight refill ────
//
// Both of those reset their guard on any hand on the controls, and both are right
// to: in `counterweight` a hand on the rack is *striking the plates that answer
// the question*, so input is engagement.
//
// ARENA's only control is **steering**, and steering is not answering. A first cut
// of this refilled on aim movement and inverted the two populations it cares
// about: a child working on paper has their hands off the glass, so their aim is
// still and the guard ran down on the one child it exists to protect — while a
// child ignoring the question and swimming about held the beat open forever,
// which is the "a window that never closes is a game that never resumes" failure
// `world.ts` has always warned about.
//
// So the allowance runs, and it treats every child alike. This is `beam`'s
// pattern — a pure item window — at ten times the p90, wearing claim's and
// counterweight's rules about what a clock may never do.
//
// ── The size of it, and where ten minutes comes from ────────────────────────
//
// `docs/EXPERIENCE_DESIGN.md` instruments a cadence table, p50/p90, which is the
// product's own measured account of how long these things take:
//
//     single-digit fact           2.8 s / 6 s
//     two-digit with regrouping     6 s / 14 s
//     the `5,001 − 2,798` class     16 s / 40 s
//
// The **p90** column is the scale, not the p50: the p50 is the time the median
// child needs, and a guard sized at what the median child needs fires on
// everybody else. A guard has to clear the tail, not sit on top of it.
//
// And then `ABANDON_FACTOR` is **ten**, which is the founder's own figure rather
// than a comfort margin. The hardest thing ARENA serves is five-column long
// division; this table's p90 for that is 60 s; ten times 60 s is **ten minutes**,
// which is the number he named for exactly that item. Every easier class falls
// out of the same multiplication:
//
// Every figure below is printed by `window.test.ts` rather than restated here
// from memory, and the `was` column is the old curve read at both of its ends:
//
//     item             p90    guard          was (floor → ceiling of the ladder)
//     7 + 5             6 s   1 min          26 s → 6 s
//     43 + 25          11 s   1 min 50 s     26 s → 6 s
//     47 + 25          14 s   2 min 20 s     26 s → 6 s
//     473 + 168        23 s   3 min 50 s     26 s → 6 s
//     5,001 − 2,798    40 s   6 min 40 s     26 s → 6 s
//     34,801 ÷ 37      60 s   10 min         26 s → 6 s
//
// Read the last two rows against the `was` column and the defect is plain: the
// two hardest classes in the product were the two whose p90 most exceeded the
// window they were given, at *every* point on the old curve — 40 s of arithmetic
// into 26 s at best and 6 s at worst.
//
// A full minute of stillness on `7 + 5` is not a child thinking; it is a child
// who has gone to get a drink. Ten minutes on five-digit long division is a
// child with a pencil, which is the point.
//
// ── Speed is still rewarded ─────────────────────────────────────────────────
//
// Removing the countdown does not remove the payoff for being fast, and it must
// not: the founder's rule is that a fast answer earns MORE and a slow one still
// wins. `World.resolveResonance` pays `quickness(FLOW, took)` as up to **+70% of
// the mass reward** and scales the celebration with it. That is the whole of
// ARENA's relationship with the clock now — a bonus a fast player gains, never a
// window a slow player loses. `game-pacing/flow.ts` states the same distinction:
// "a countdown that kills you and a bonus that accrues when you are fast read the
// same clock and produce opposite emotional experiences."

/** What this module needs of an item. The host's own strings, unparsed. */
export type Item = {
  /** As the child reads it: `34801 ÷ 37`. */
  readonly prompt: string
  /** The canonical answer text the host revealed. Never computed here. */
  readonly answer: string
}

/**
 * Which operation a prompt is asking for. `other` takes the cautious branch.
 *
 * ARENA serves the whole ladder — addition facts at the bottom, long division and
 * long multiplication at the top — so unlike `beam` and `counterweight`, whose
 * tables only classify `+` and `−`, this one has to know the operator. `runner`
 * made the same finding: multi-digit `×` and `÷` are partial products and trial
 * quotients all the way down, and cost a row more than their width suggests.
 */
export type Op = "add" | "sub" | "mul" | "div" | "other"

/**
 * Seconds by column count — the p90 column of the house cadence table.
 *
 * Index 1 is the single-digit fact's p90 (6 s). Index 2 and index 4 are the two
 * rows the table names outright: `6 + 8 = 14` is two-digit-with-regrouping
 * exactly, and `32 + 8 = 40` is the `5,001 − 2,798` class exactly. Index 3 sits
 * between them.
 *
 * Index 5 is **extrapolated and says so.** The table stops at four columns and
 * ARENA's ladder does not — the curriculum's `dw.div.whole.divide-exact` L1
 * reaches `29838 ÷ 6` and L3 reaches `721308 ÷ 84`. The measured rows grow by
 * roughly half again each step (6 → 11 → 18 → 32), so index 5 continues that at
 * 48, and `REGROUPING` continues 3 → 5 → 8 at 12. Sixty seconds for five-column
 * work is the figure that makes `ABANDON_FACTOR` land on the founder's ten
 * minutes, and it is the only number in this file that is not read straight off
 * an instrumented row.
 *
 * Strictly increasing, which is half of the monotonicity claim.
 */
const BY_COLUMNS = [6, 6, 11, 18, 32, 48] as const

/**
 * What needing to regroup is worth on top, per column count.
 *
 * Each entry is small enough that `BY_COLUMNS[n] + REGROUPING[n] <= BY_COLUMNS[n + 1]`,
 * which is the other half of the monotonicity claim — a regrouping item at `n`
 * columns never outranks a plain item at `n + 1` — and `window.test.ts` asserts
 * it over the whole cross product rather than leaving it to inspection.
 */
const REGROUPING = [0, 0, 3, 5, 8, 12] as const

/**
 * The widest content the table describes. Beyond it, the last row stands.
 *
 * A literal rather than `BY_COLUMNS.length - 1` so that indexing the tables with
 * it narrows to a number instead of `number | undefined` — and `window.test.ts`
 * asserts it against both tables' lengths, so the literal cannot drift away from
 * the rows it is meant to name.
 */
export const MAX_COLUMNS = 5

/** The p90 of the widest row: five columns, regrouping. Ten times this is the guard's ceiling. */
const WIDEST_P90 = BY_COLUMNS[MAX_COLUMNS] + REGROUPING[MAX_COLUMNS]

/**
 * How many multiples of the arithmetic's own p90 count as "nobody is there".
 *
 * Ten, and derived rather than tuned: ten times the 60 s p90 of five-column long
 * division is the ten minutes the founder named for `34801 / 37`. See the module
 * note.
 */
export const ABANDON_FACTOR = 10

/**
 * The shortest silence that can end a Resonance, whatever the item.
 *
 * A floor rather than a budget. `ABANDON_FACTOR × BY_COLUMNS[1]` already gives
 * the easiest item in the product a full minute, so this binds only if the table
 * is ever edited downward; it exists so that a malformed prompt cannot produce a
 * guard a child could actually meet.
 */
export const MIN_GUARD_SECONDS = 60

/**
 * The longest silence anything can ask for.
 *
 * Not a cap on the child — it is `ABANDON_FACTOR × (BY_COLUMNS[5] + REGROUPING[5])`,
 * which is what the widest row of the table already yields, restated as a
 * constant so the ten-minute claim can be asserted directly. A prompt that parses
 * as nine columns is treated as the widest row the table knows about, so nothing
 * can reach past it.
 */
export const MAX_GUARD_SECONDS = ABANDON_FACTOR * WIDEST_P90

/**
 * The operator, from the first operator glyph in the prompt.
 *
 * `−` is the typographic minus the curriculum writes and `-` is what a stub
 * host writes; both are here, as are `÷` and `/`. A prompt with no operator at
 * all — `factor of 48`, `less than 1000`, a word problem — reads as `other`,
 * which is treated as the HARDER branch. This function's failure mode must be
 * "the child got more silence than they needed".
 */
export function opOf(prompt: string): Op {
  for (const ch of prompt) {
    if (ch === "+") return "add"
    if (ch === "-" || ch === "−" || ch === "–" || ch === "—") return "sub"
    if (ch === "×" || ch === "*" || ch === "·") return "mul"
    if (ch === "÷" || ch === "/" || ch === ":") return "div"
  }
  return "other"
}

/**
 * The widest column count in the item — **the operands, not the answer.**
 *
 * `beam` and `counterweight` count the answer too, on the argument that a child
 * reading a five-digit total is reading five columns. That is true of reading and
 * false of working, and it misfiles the one row the cadence table names most
 * explicitly: `7 + 5 = 12` has a two-digit answer, and it is a *single-digit
 * fact*, retrieved rather than computed. Counting its answer put it in the
 * two-column row at 14 s — more than twice the table's own 6 s figure for it, on
 * the easiest item in the product. `runner` reached this first and states it:
 * "The operands and not the answer: `7 + 8` is a single-digit fact whose answer
 * has two digits, and the cadence table calls that 2.8s, not 6."
 *
 * The answer is still read, but only as a **fallback** — an item with no digits in
 * its prompt at all (`factor of forty-eight`) has nothing else to be measured by,
 * and falling back is more generous than defaulting to one column.
 *
 * Read as text throughout. ARENA's answers reach ten digits and there is no reason
 * to leave the string domain to count a length.
 */
export function widestColumn(item: Item): number {
  let widest = 0
  for (const run of item.prompt.match(/\d+/g) ?? []) widest = Math.max(widest, run.length)
  if (widest > 0) return widest
  for (const run of item.answer.match(/\d+/g) ?? []) widest = Math.max(widest, run.length)
  return Math.max(1, widest)
}

const OPERANDS = /\d+/g

/**
 * Does this item need a carry or a borrow anywhere?
 *
 * An item this cannot read as two decimal operands reads as **true**, which is
 * the longer silence. Multi-digit `×` and `÷` also read as true, because there is
 * no column in a partial product or a trial quotient that does not carry.
 *
 * Guessing in the child's favour is the only direction this function is allowed
 * to be wrong in.
 */
export function needsRegrouping(item: Item): boolean {
  OPERANDS.lastIndex = 0
  const runs = item.prompt.match(OPERANDS) ?? []
  if (runs.length !== 2) return true
  const op = opOf(item.prompt)
  if (op === "other") return true
  // An equation is not a column sum, whatever its two operands look like.
  // `x + 17 = 42` parses as two operands under a `+` that do not carry, and
  // reading it as a plain two-column addition scored it 11 s — but the work is
  // solving for the unknown, not adding. Any `=`, or a second operator glyph,
  // means this function is not looking at what it thinks it is looking at.
  if (item.prompt.includes("=")) return true
  let operators = 0
  for (const ch of item.prompt) {
    if ("+-−–—×*·÷/:".includes(ch)) operators++
  }
  if (operators !== 1) return true
  if (op === "mul" || op === "div") return (runs[0] as string).length > 1 || (runs[1] as string).length > 1
  const a = Number(runs[0])
  const b = Number(runs[1])
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return true
  const add = op === "add"
  let x = a
  let y = b
  while (x > 0 || y > 0) {
    if (add && (x % 10) + (y % 10) >= 10) return true
    if (!add && x % 10 < y % 10) return true
    x = Math.floor(x / 10)
    y = Math.floor(y / 10)
  }
  return false
}

/**
 * Columns, clamped into the table.
 *
 * A `×` or `÷` past a single digit is **a row harder than its width**, which is
 * `runner`'s finding restated: `12 × 34` is four single-digit products and a
 * two-column sum, not a two-column anything. `other` takes the same shift for the
 * same reason it takes the regrouping branch — this file does not know what it is
 * looking at, so it assumes the work is there.
 *
 * The clamp is also the ceiling on the whole guard, which is why
 * `MAX_GUARD_SECONDS` is derived from the last row rather than declared
 * independently: a nine-column prompt is treated as the widest item the table
 * knows about.
 */
function columnsOf(item: Item): number {
  const op = opOf(item.prompt)
  const width = widestColumn(item)
  const heavy = (op === "mul" || op === "div" || op === "other") && width > 1 ? 1 : 0
  return Math.max(1, Math.min(MAX_COLUMNS, width + heavy))
}

/**
 * The arithmetic's own p90, off the house table. Nothing else is in here.
 *
 * **This is measured, never limited.** `EXPERIENCE_DESIGN.md`: "`T=0→C`
 * COMPREHENSION | not budgeted | The child's time. Measured, never limited." It
 * is not a budget anybody is held to — nothing is — it is only the scale the
 * guard is sized against.
 */
export function comprehensionSeconds(item: Item): number {
  const columns = columnsOf(item)
  const base = BY_COLUMNS[columns] ?? BY_COLUMNS[MAX_COLUMNS]
  const extra = needsRegrouping(item) ? (REGROUPING[columns] ?? 0) : 0
  return base + extra
}

/**
 * How long the arena waits in silence before withdrawing this question, in
 * seconds.
 *
 * Monotone non-decreasing in both of its inputs — more columns is never less
 * patience, and needing to regroup is never less patience than not needing to —
 * and a function of the item alone.
 *
 * Refilled by any input, so it measures a pause and not a round. Never drawn. On
 * firing it reports nothing to the host and takes nothing from the child.
 */
export function guardSeconds(item: Item): number {
  const seconds = ABANDON_FACTOR * comprehensionSeconds(item)
  return Math.min(MAX_GUARD_SECONDS, Math.max(MIN_GUARD_SECONDS, seconds))
}

/**
 * Is this item long enough that a child might reasonably reach for paper?
 *
 * The one thing outside this module that the item's class decides, and it decides
 * a **label**, not a limit: `Hud` prints `NO TIMER · USE PAPER` above the prompt
 * on items this returns true for, and `RESONANCE` on the rest. Two facts, no
 * metaphor, no praise — and on `7 + 5` it never appears at all, because telling a
 * child to fetch a pencil for a single-digit fact is the patronising version of
 * the same idea.
 *
 * The threshold is the `5,001 − 2,798` class: the row the cadence table itself
 * marks at a 40-second p90, which is where written work stops being optional for
 * most children.
 */
export function invitesPaper(item: Item): boolean {
  return comprehensionSeconds(item) >= BY_COLUMNS[4] + REGROUPING[4]
}
