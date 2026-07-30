/**
 * MONUMENT's abandonment guard — the thing that replaced the dither.
 *
 * ## What the dither was
 *
 * `T.DITHER_CYCLES / DITHER_STEP / DITHER_MAX` was the only mechanism in this
 * game that responded to a child not committing, and the way it responded was to
 * make the stone **faster**: three full sweeps without a drop and the sweep sped
 * up 16%, compounding to a 1.90× ceiling. Measured on the real sim at floor 0,
 * from a standing start, doing nothing but reading:
 *
 * ```
 *   hesitated   3 s → 1.00×    (1.78 world units/s)
 *              10 s → 1.16×
 *              20 s → 1.80×
 *              30 s → 1.90×    (3.38 world units/s — the ceiling)
 * ```
 *
 * The last line of MONUMENT's own manual is "Waiting never costs you anything",
 * and thirty seconds of a child working out `47 + 25` nearly doubled the speed of
 * the target they then had to hit. Reading the rules was billed the same way,
 * until #692 stopped the clock behind the sheet.
 *
 * ## What it was *for*
 *
 * One real problem, stated in its own source comment as "the sweep leans on you":
 * MONUMENT has no clock of any kind, so a child who never taps is a run that
 * never moves. And the item under them stays open — `place()` reports
 * `ms = clock − questionAt`, so a stone set after a ten-minute interruption
 * reaches the curriculum as ten minutes of a child failing to answer `7 + ? = 10`.
 *
 * A speed-up is the wrong answer to that, because it fires on the child it should
 * be protecting. So the pressure is deleted and this takes over: a guard that
 * measures **silence**, is put back in full by any input at all, is derived from
 * the item rather than chosen, and is never drawn. Ends the run? No — it takes
 * the item back, reports nothing, and costs nothing. Nobody was there.
 *
 * The shape and both tables are `games/claim`'s `gate.ts` (PR #673) and
 * `games/counterweight`'s `guard.ts` (PR #707), unchanged, because the rule they
 * were written for is the same rule: **a clock may never take anything away from
 * a child.**
 */

/** The house p90 for reading and working a column sum, by digit count. */
const BY_COLUMNS = [6, 6, 11, 18, 32] as const
/** What needing to carry or borrow is worth on top, per digit count. */
const REGROUPING = [0, 0, 3, 5, 8] as const

/** What one more face on the stone costs a child, in seconds of scanning. */
const PER_FACE_SECONDS = 1.5

/**
 * How many multiples of the arithmetic's own p90 count as "nobody is there".
 *
 * Not a comfort margin — a definition. A guard sized at one p90 fires on the
 * child the p90 describes, which is the child this game keeps getting wrong.
 */
export const ABANDON_FACTOR = 2

/**
 * The shortest silence that can take an item back, whatever the item is.
 *
 * `3 + ? = 10` has a p90 of six seconds, and twelve seconds of stillness on it is
 * still a child thinking, or a child looking up at somebody in the room. Being
 * generous here costs nothing: nothing in MONUMENT depends on an item turning
 * over promptly, and the only thing a longer floor loses is how quickly an
 * abandoned pack stops holding a stale question.
 */
export const MIN_GUARD_SECONDS = 30

import { fillBlank } from "../blank.ts"

/** What the guard is handed: the item, exactly as the child reads it. */
export type Item = {
  /** `47 + □ = 72`, or `3/4 + 1/4 = □`. */
  readonly prompt: string
  /** The canonical answer the host gave. Never computed here. */
  readonly answer: string
}

const OPERATOR = /^\s*(\d+)\s*([+\-−–])\s*(\d+)\s*$/

/** The widest run of digits anywhere the child has to read, prompt or answer. */
export function widestColumn(item: Item): number {
  let widest = 1
  for (const run of item.prompt.match(/\d+/g) ?? []) widest = Math.max(widest, run.length)
  for (const run of item.answer.match(/\d+/g) ?? []) widest = Math.max(widest, run.length)
  return widest
}

/**
 * Whether the sum carries or borrows.
 *
 * Takes the whole item, because MONUMENT's prompts carry the blank — `47 + □ = 72`
 * has no second operand until the answer is put back into it, and a version of
 * this that read the prompt alone could never parse anything at all and would
 * quietly hand every item in the game the same allowance.
 *
 * That is not hypothetical: this looked for a literal `"?"` until the host began
 * writing `□`, at which point the substitution stopped matching and every blank
 * statement fell through to the fail-open branch below. Harmless in direction —
 * the child got the *longer* silence — but the measurement was not being made.
 * The blank glyph lives in `src/blank.ts` now, once, for this file and the HUD.
 *
 * **Fails open.** Anything this cannot parse — a fraction, a comparison, a family
 * this file has never heard of — is treated as needing to regroup, so an
 * unreadable item is always given the *longer* silence and never the shorter one.
 */
export function needsRegrouping(item: Item): boolean {
  const filled = fillBlank(item.prompt, item.answer)
  const bare = filled.replace(/\s*=.*$/, "")
  const m = OPERATOR.exec(bare)
  if (!m) return true
  const a = Number(m[1])
  const b = Number(m[3])
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return true
  const op = m[2]
  const add = op === "+"
  if (!add && op !== "-" && op !== "−" && op !== "–") return true
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
 * Columns, clamped to the table.
 *
 * This clamp is also the ceiling on the whole guard, which is why there is no
 * `MAX_GUARD_SECONDS`: a nine-digit prompt is treated as the widest item the
 * table knows about, so the longest silence anything can ask for is
 * `ABANDON_FACTOR × (32 + 8 + faces)`.
 */
function columnsOf(item: Item): number {
  return Math.max(1, Math.min(BY_COLUMNS.length - 1, widestColumn(item)))
}

/**
 * The arithmetic's own p90, plus the scan across the stone's faces.
 *
 * **Measured, never enforced.** It is not a budget the child is held to — nothing
 * is — it is only the scale the guard is sized against. The face term is
 * MONUMENT's own: the stone shows one value at a time and changes it at every
 * turnaround, so four faces is four passes before a child has even seen all the
 * candidates.
 */
export function comprehensionSeconds(item: Item, faces: number): number {
  const columns = columnsOf(item)
  const base = BY_COLUMNS[columns] ?? MIN_GUARD_SECONDS
  const regroup = needsRegrouping(item) ? (REGROUPING[columns] ?? 0) : 0
  const scan = Math.max(0, faces - 1) * PER_FACE_SECONDS
  return base + regroup + scan
}

/**
 * How long the sweep waits for a hand, in seconds.
 *
 * Monotone non-decreasing in both inputs — more columns is never less patience,
 * more faces is never less patience — and a pure function of the item and the
 * stone. Nothing about the floor, the run, the width or how long anybody has
 * been playing can reach it.
 */
export function guardSecondsFor(item: Item, faces: number): number {
  return Math.max(MIN_GUARD_SECONDS, ABANDON_FACTOR * comprehensionSeconds(item, faces))
}
