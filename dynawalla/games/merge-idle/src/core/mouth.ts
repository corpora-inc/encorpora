/**
 * THE MOUTH — where polyps go in and the target is answered.
 *
 * One mouth, one target. The old game had two vents, each with its own prompt
 * and its own row of multiple-choice pills, and the founder's verdict was exact:
 *
 *   "I think feeding the vents without the polyps and using the little pill
 *    numbers makes it 2 games on the same screen instead of a cohesive game"
 *   "two vents too just seems like sort of extra useless"
 *
 * So there is one, it is wide, it sits under the thumbs, and the only thing it
 * accepts is a polyp off the shelf.
 *
 * ## No clock, ever
 *
 * `docs/EXPERIENCE_DESIGN.md`: *COMPREHENSION — not budgeted. The child's time.
 * Measured, never limited.* Nothing in this file reads a clock. A polyp sits in
 * the mouth for as long as the child wants, can be **pulled back out for free**
 * as many times as they like, and no target is ever taken away.
 *
 * ## What a wrong answer costs
 *
 * Work, and only work — the `colossus` rule. When the mouth resolves wrong it
 * SPILLS: every polyp in it goes back on the shelf, and each one that can be
 * halved comes back as **two halves**. A 16 you fed by mistake is two 8s to merge
 * again. It is visible, it is countable, there is no buzzer, no life, no red X and
 * no clock — and it is a real price, because merging back up is the game.
 *
 * The spill is also what keeps the arithmetic unskippable. The mouth resolves the
 * instant it can — on equality, on an overshoot, or on a full mouth — so a child
 * (or a bot) cannot probe: a wrong drop lands the moment it is made. `bots.test.ts`
 * measures exactly that.
 *
 * Pure. No time, no DOM, no board. `game.ts` owns where the polyps physically go.
 */

import { canSplit } from './ladder.ts'
import { evaluate, type Form } from './target.ts'

/** One polyp sitting in the mouth. `cell` is where it came from, for the return. */
export type Fed = {
  readonly value: number
  /** Render only: 0..1 pop-in. */
  born: number
  /** Render only, so the row never pulses in lockstep. */
  readonly phase: number
}

export type Mouth = {
  fed: Fed[]
  /** How many polyps this target's form will hold. */
  slots: number
  /** Render only: a decaying kick when something lands. */
  thud: number
}

export function emptyMouth(slots: number): Mouth {
  return { fed: [], slots: Math.max(1, Math.min(3, slots)), thud: 0 }
}

export type Verdict =
  /** Still waiting. Nothing has been decided and nothing has been reported. */
  | { kind: 'open' }
  /** The child made the target. */
  | { kind: 'bloom'; produced: number; answered: string }
  /** The child made something else, and said so by filling or overshooting. */
  | { kind: 'spill'; produced: number | null; answered: string }

/** The running value of what is in the mouth, or null when the form cannot say. */
export function running(m: Mouth, form: Form): number | null {
  return evaluate(
    m.fed.map((f) => f.value),
    form,
  )
}

/**
 * What the mouth reads as, for the child: `16 + 2` or `30 ÷ ▢`.
 *
 * Built here rather than in the renderer so a test can assert what a child sees.
 */
export function expression(m: Mouth, form: Form, glyph: string): string {
  const parts: string[] = []
  for (const f of m.fed) parts.push(String(f.value))
  // A sum shows only what has actually been fed; the other forms have a fixed
  // arity, so the empty slot is drawn as a blank and the child can see one is
  // missing.
  const shown = form === 'sum' ? parts : [...parts, ...Array(Math.max(0, 2 - parts.length)).fill('▢')]
  return shown.join(` ${glyph} `)
}

/** Put a polyp in. The caller has already taken it off the shelf. */
export function feed(m: Mouth, value: number, phase = 0): void {
  if (m.fed.length >= m.slots) return
  m.fed.push({ value, born: 0, phase })
  m.thud = 1
}

/** Take one back out. Free, always available while the mouth is open. */
export function retract(m: Mouth, index: number): number | null {
  const f = m.fed[index]
  if (!f) return null
  m.fed.splice(index, 1)
  return f.value
}

/**
 * Has the mouth decided?
 *
 * Called after every feed, and never on a timer. `answered` is **what the child
 * produced**, verbatim — never a value derived from the target, and never the
 * target itself. Two games in this fleet shipped marking correct children wrong
 * by reporting something else; this string is the only thing `game.ts` hands to
 * `host.report`.
 */
export function resolve(m: Mouth, form: Form, target: number): Verdict {
  if (m.fed.length === 0) return { kind: 'open' }
  const produced = running(m, form)

  if (form === 'sum') {
    if (produced === null) return { kind: 'open' }
    if (produced === target) return { kind: 'bloom', produced, answered: String(produced) }
    if (produced > target) return { kind: 'spill', produced, answered: String(produced) }
    if (m.fed.length >= m.slots) return { kind: 'spill', produced, answered: String(produced) }
    return { kind: 'open' }
  }

  // The other three forms have exactly two slots and are not commutative, so
  // nothing is decided until both are filled.
  if (m.fed.length < 2) return { kind: 'open' }
  if (produced === null) {
    // `over` with a divisor that does not divide. The child committed to an
    // answer that is not a whole number, so what they produced is the expression
    // itself and the host judges it — the game does not quietly floor it.
    const answered = m.fed.map((f) => String(f.value)).join(' ÷ ')
    return { kind: 'spill', produced: null, answered }
  }
  if (produced === target) return { kind: 'bloom', produced, answered: String(produced) }
  return { kind: 'spill', produced, answered: String(produced) }
}

/**
 * What a spill puts back on the shelf, given how much room there is.
 *
 * Halves first — that is the cost — but never at the price of losing a polyp: a
 * term is only halved when there is a spare cell to put the second half in, and a
 * shelf with no room at all gets every polyp back whole. A child can be given
 * more work; a child can never be given less reef than they had.
 *
 * `free` is the number of empty cells AFTER the fed polyps have left, so on a
 * board that was exactly full it is `fed.length` and nothing splits.
 */
export function spillInto(m: Mouth, free: number): number[] {
  // Every polyp needs a cell of its own no matter what, so only the cells LEFT
  // OVER after each one is seated may be spent on splitting. Counting the split
  // as "two cells" instead was a bug the test caught: with three polyps and two
  // free cells the first one split, took both cells, and the two behind it were
  // handed back anyway — four polyps into two cells.
  let spare = Math.max(0, free - m.fed.length)
  const out: number[] = []
  // Largest first, so the polyp whose halving is most useful is the one that gets
  // it when there is only one spare cell.
  const order = m.fed.map((f) => f.value).sort((a, b) => b - a)
  for (const v of order) {
    if (canSplit(v) && spare >= 1) {
      out.push(v / 2, v / 2)
      spare--
      continue
    }
    out.push(v)
  }
  return out
}
