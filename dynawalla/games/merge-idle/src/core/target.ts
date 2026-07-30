/**
 * THE TARGET — the one number at the top of the screen, and the crux of the game.
 *
 * ## What was wrong
 *
 * The reef used to hold up a curriculum prompt verbatim: `58042 + 968`. The
 * founder played for hours and reported the exact failure:
 *
 *   "the problems don't line up with the polyp numbers ... 2, 4, 8, 16 ...
 *    3, 6, 12, 24 ... the weird 58134+483 doesn't really jive with the polyps"
 *
 * and then named the fix himself:
 *
 *   "maybe the game can know what would be a fun number to put on the vent and
 *    you build it with the polyps ... 'some answers are not numbers a polyp can
 *    have' ... maybe that is a design mistake"
 *
 * It was. A target the board cannot make is a question with no answer on screen,
 * and the old game papered over it with a row of multiple-choice pills — a second
 * game on the same glass.
 *
 * ## The rule this file enforces
 *
 * **A target is never put up unless it can be built.** Two ways to be sure of
 * that, and the game uses both, in this order:
 *
 *   1. `routeIn` — the board already holds polyps that make it. Best case: the
 *      child looks at the shelf and sees the answer.
 *   2. `stockFor` — it can be made from ladder values, so the vent EMITS toward
 *      the missing ones (as halves, so there is a merge to do on the way). This
 *      is the sentence "you build it with the polyps" turned into a mechanism.
 *
 * If neither holds, the number is refused and another is drawn. Nothing else in
 * the game is allowed to invent a target.
 *
 * ## Forms
 *
 * A target carries an OPERATOR FORM, which is the escalation the founder asked
 * for last:
 *
 *   "Maybe even subtraction and division and multiplication with blank spaces:
 *    15 = __ ÷ __ → 30, 2. BOOM."
 *
 *     sum     18            feed 1..3 polyps, they add
 *     minus   15 = ▢ − ▢    feed two, larger first
 *     times   48 = ▢ × ▢    feed two
 *     over    15 = ▢ ÷ ▢    feed 30 then 2
 *
 * Which forms are legal for a given number is arithmetic, not taste — `48` has a
 * `times` route and `17` does not — so `formsFor` answers it and the caller picks
 * the most advanced form the child has unlocked *that the number can express*.
 *
 * Pure. No time, no DOM, no rendering. Integer throughout.
 */

import { canSplit, decompose, MAX_STEP, onLadder, SEEDS } from './ladder.ts'
import type { Rng } from './rng.ts'

export type Form = 'sum' | 'minus' | 'times' | 'over'

/** Every form, easiest first. Index into this is the unlock order. */
export const FORMS: readonly Form[] = ['sum', 'minus', 'times', 'over']

export const FORM_GLYPH: Readonly<Record<Form, string>> = {
  sum: '+',
  minus: '−',
  times: '×',
  over: '÷',
}

/**
 * How the target reads on the band.
 *
 * `sum` shows a bare number, because "make 18" needs no notation and the
 * founder's sketch is a bare number: "there is a number at the top, it might be
 * kinda simple usually - 18". The other three show the blanks, because `15` on
 * its own would be a different question.
 */
export function faceOf(value: number, form: Form): string {
  if (form === 'sum') return String(value)
  return `${value} = ▢ ${FORM_GLYPH[form]} ▢`
}

/** How many polyps the mouth holds for a form. */
export function slotsFor(form: Form, sumSlots: number): number {
  return form === 'sum' ? sumSlots : 2
}

/* --------------------------------------------------------------- the ladder */

/**
 * Every ladder value, ascending, computed once.
 *
 * 8 strains x 18 steps is 144 numbers, which is small enough that the
 * decomposition searches below are exhaustive rather than heuristic — and an
 * exhaustive search is what lets `expressible` be a *guarantee* instead of an
 * attempt.
 */
const LADDER: readonly number[] = (() => {
  const out: number[] = []
  for (const s of SEEDS) for (let k = 0; k <= MAX_STEP; k++) out.push(s * 2 ** k)
  return out.sort((a, b) => a - b)
})()

/** Exported for tests and for the emitter, which draws from it. */
export function ladderValues(): readonly number[] {
  return LADDER
}

/* ---------------------------------------------------------------- the board */

/** What the shelf holds: value -> how many polyps carry it. */
export type Bag = ReadonlyMap<number, number>

export function bagOf(values: Iterable<number>): Bag {
  const bag = new Map<number, number>()
  for (const v of values) bag.set(v, (bag.get(v) ?? 0) + 1)
  return bag
}

/** Take one out of a bag, returning a new bag. Used by the route searches. */
function without(bag: Bag, value: number): Map<number, number> {
  const next = new Map(bag)
  const n = (next.get(value) ?? 0) - 1
  if (n <= 0) next.delete(value)
  else next.set(value, n)
  return next
}

/* ------------------------------------------------------------ can the board */

/**
 * A route to `value` using polyps THAT ARE ON THE BOARD RIGHT NOW, or null.
 *
 * The array is in the order the mouth wants them: `minus` and `over` are not
 * commutative, so `[30, 2]` means thirty first.
 *
 * Deterministic: candidate values are walked largest-first, so the route a child
 * is promised is the one with the biggest opening polyp — `23 = 16 + 7`, not
 * `23 = 8 + 8 + 7`.
 */
export function routeIn(bag: Bag, value: number, form: Form, slots: number): number[] | null {
  if (!Number.isSafeInteger(value) || value <= 0) return null
  const have = [...bag.keys()].sort((a, b) => b - a)
  if (form === 'sum') return sumRoute(bag, have, value, Math.max(1, Math.min(3, slots)))
  for (const a of have) {
    const rest = without(bag, a)
    for (const b of [...rest.keys()].sort((x, y) => y - x)) {
      if (form === 'minus' && a - b === value) return [a, b]
      if (form === 'times' && a * b === value) return [a, b]
      if (form === 'over' && b > 0 && a % b === 0 && a / b === value) return [a, b]
    }
  }
  return null
}

function sumRoute(bag: Bag, have: readonly number[], value: number, slots: number): number[] | null {
  for (const a of have) {
    if (a > value) continue
    if (a === value) return [a]
  }
  if (slots < 2) return null
  for (const a of have) {
    if (a >= value) continue
    const rest = without(bag, a)
    const need = value - a
    if (rest.has(need)) return [a, need]
  }
  if (slots < 3) return null
  for (const a of have) {
    if (a >= value) continue
    const restA = without(bag, a)
    for (const b of [...restA.keys()].sort((x, y) => y - x)) {
      if (b > value - a) continue
      const need = value - a - b
      if (need <= 0) continue
      const restB = without(restA, b)
      if (restB.has(need)) return [a, b, need]
    }
  }
  return null
}

/** Does this exact ordered list of polyp values resolve to `value` under `form`? */
export function evaluate(fed: readonly number[], form: Form): number | null {
  if (fed.length === 0) return null
  if (form === 'sum') {
    let total = 0
    for (const v of fed) total += v
    return total
  }
  if (fed.length !== 2) return null
  const a = fed[0] as number
  const b = fed[1] as number
  if (form === 'minus') return a - b
  if (form === 'times') return a * b
  if (b <= 0 || a % b !== 0) return null
  return a / b
}

/* --------------------------------------------------------- can the LADDER */

/**
 * A route to `value` out of ladder values alone, ignoring the board, or null.
 *
 * This is what makes the target buildable even on a fresh shelf: the vent emits
 * toward whatever this returns. Terms are chosen largest-first and with the
 * fewest possible, so a two-polyp answer is never dressed up as a three-polyp
 * one.
 */
export function ladderRoute(value: number, form: Form, slots: number): number[] | null {
  if (!Number.isSafeInteger(value) || value <= 0) return null
  if (form === 'sum') {
    if (onLadder(value)) return [value]
    if (slots < 2) return null
    for (let i = LADDER.length - 1; i >= 0; i--) {
      const a = LADDER[i] as number
      if (a >= value) continue
      if (onLadder(value - a)) return [a, value - a]
    }
    if (slots < 3) return null
    for (let i = LADDER.length - 1; i >= 0; i--) {
      const a = LADDER[i] as number
      if (a >= value) continue
      for (let j = i; j >= 0; j--) {
        const b = LADDER[j] as number
        if (a + b >= value) continue
        if (onLadder(value - a - b)) return [a, b, value - a - b]
      }
    }
    return null
  }
  if (slots < 2) return null
  if (form === 'minus') {
    // a - b = value. Walk `b` upward from the smallest so the pair stays small:
    // `15 = 16 − 1` is a far better question than `15 = 983040 − 983025`.
    for (const b of LADDER) {
      if (b >= value * 8 + 8) break
      if (onLadder(value + b)) return [value + b, b]
    }
    return null
  }
  if (form === 'times') {
    for (const b of LADDER) {
      if (b > value) break
      if (value % b !== 0) continue
      if (onLadder(value / b)) return [value / b, b]
    }
    return null
  }
  // over: a / b = value, so a = value * b.
  for (const b of LADDER) {
    if (b > 64) break
    if (b === 1) continue
    if (onLadder(value * b) && onLadder(b)) return [value * b, b]
  }
  if (onLadder(value)) return null // `value ÷ 1` is not a question
  return null
}

/** Is `value` askable at all under `form` with `slots` polyps? */
export function expressible(value: number, form: Form, slots: number): boolean {
  return ladderRoute(value, form, slots) !== null
}

/** Every form (of those offered) that can express `value`. Easiest first. */
export function formsFor(
  value: number,
  offered: readonly Form[],
  sumSlots: number,
): Form[] {
  const out: Form[] = []
  for (const f of FORMS) {
    if (!offered.includes(f)) continue
    if (expressible(value, f, slotsFor(f, sumSlots))) out.push(f)
  }
  return out
}

/* ------------------------------------------------------------- the stocking */

/**
 * What the vent must cough out so that `route` becomes buildable.
 *
 * Emitting the term itself would hand the answer over. Emitting its two HALVES
 * leaves a doubling to do, which is the game's own arithmetic — so a target the
 * board cannot yet reach arrives as a merge, not as a gift. A seed value (3, 15)
 * cannot be halved and is emitted whole.
 */
export function stockFor(bag: Bag, route: readonly number[]): number[] {
  const spare = new Map(bag)
  const out: number[] = []
  for (const term of route) {
    const held = spare.get(term) ?? 0
    if (held > 0) {
      spare.set(term, held - 1)
      continue
    }
    if (canSplit(term)) out.push(term / 2, term / 2)
    else out.push(term)
  }
  return out
}

/* ---------------------------------------------------------------- the score */

/**
 * How good a number is to be asked for, given the shelf that has to answer it.
 *
 * This does NOT choose the target — the host's curriculum does, and `game.ts`
 * only ever puts up a number the host handed over. What this ranks is the list of
 * up to 32 candidates offered to `host.focus`, which biases the host's stream
 * toward answers this board can already make. So the score is allowed to be
 * about taste, because the worst it can do is make the host's job harder.
 *
 * Higher is better.
 */
export function funScore(
  value: number,
  routes: number,
  oneWay: boolean,
  wantDigits: number,
): number {
  let s = 0
  // A target one polyp already satisfies is a hand-over, not a question.
  if (oneWay) s -= 12
  // Two to five ways is a puzzle. One way is brittle — a merge elsewhere can
  // take the only route away. Twenty ways is mush.
  s += routes >= 2 && routes <= 5 ? 6 : routes === 1 ? 3 : 1
  // Round numbers read as deliberate. `35` and `15` are two of the founder's
  // three examples.
  if (value % 10 === 0) s += 3
  else if (value % 5 === 0) s += 2
  // Sized to what the curriculum is asking for, in digits.
  const digits = String(value).length
  s -= Math.abs(digits - wantDigits) * 4
  return s
}

export type Candidate = { value: number; form: Form; route: number[]; score: number }

/**
 * The numbers this board could answer right now, best first, capped at `limit`.
 *
 * `host.focus` takes at most 32 values, so there is no point building more.
 */
export function candidates(
  bag: Bag,
  offered: readonly Form[],
  sumSlots: number,
  wantDigits: number,
  limit = 32,
): Candidate[] {
  const ways = new Map<number, { form: Form; route: number[]; n: number; one: boolean }>()
  const note = (value: number, form: Form, route: number[]): void => {
    if (!Number.isSafeInteger(value) || value <= 0) return
    const hit = ways.get(value)
    if (!hit) {
      ways.set(value, { form, route, n: 1, one: route.length === 1 })
      return
    }
    hit.n++
    if (route.length === 1) hit.one = true
    // Prefer the most advanced form the number admits, and the shortest route.
    if (FORMS.indexOf(form) > FORMS.indexOf(hit.form) || route.length < hit.route.length) {
      hit.form = form
      hit.route = route
    }
  }

  const have = [...bag.keys()].sort((a, b) => b - a)
  const count = (v: number): number => bag.get(v) ?? 0

  if (offered.includes('sum')) {
    for (const a of have) note(a, 'sum', [a])
    if (sumSlots >= 2) {
      for (let i = 0; i < have.length; i++) {
        for (let j = i; j < have.length; j++) {
          const a = have[i] as number
          const b = have[j] as number
          if (i === j && count(a) < 2) continue
          note(a + b, 'sum', [a, b])
        }
      }
    }
    if (sumSlots >= 3) {
      for (let i = 0; i < have.length; i++) {
        for (let j = i; j < have.length; j++) {
          for (let k = j; k < have.length; k++) {
            const a = have[i] as number
            const b = have[j] as number
            const c = have[k] as number
            const need = new Map<number, number>()
            for (const v of [a, b, c]) need.set(v, (need.get(v) ?? 0) + 1)
            let ok = true
            for (const [v, n] of need) if (count(v) < n) ok = false
            if (!ok) continue
            note(a + b + c, 'sum', [a, b, c])
          }
        }
      }
    }
  }

  for (let i = 0; i < have.length; i++) {
    for (let j = 0; j < have.length; j++) {
      const a = have[i] as number
      const b = have[j] as number
      if (i === j && count(a) < 2) continue
      if (offered.includes('minus') && a - b > 0) note(a - b, 'minus', [a, b])
      if (offered.includes('times')) note(a * b, 'times', [a, b])
      if (offered.includes('over') && b > 1 && a % b === 0 && a / b > 1) note(a / b, 'over', [a, b])
    }
  }

  const out: Candidate[] = []
  for (const [value, w] of ways) {
    out.push({ value, form: w.form, route: w.route, score: funScore(value, w.n, w.one, wantDigits) })
  }
  // Sort by score, then by value, so the list is a pure function of the board.
  out.sort((a, b) => b.score - a.score || a.value - b.value)
  return out.slice(0, limit)
}

/**
 * Pick one of the top candidates, so two runs on the same board differ.
 *
 * Only reached when the host could not be made to hand over a number this board
 * can answer — see `game.ts`. Deterministic given the rng.
 */
export function pickCandidate(list: readonly Candidate[], rng: Rng): Candidate | null {
  if (list.length === 0) return null
  const head = list.slice(0, Math.min(8, list.length))
  return head[rng.int(0, head.length - 1)] ?? null
}

/** Debug helper: the strain of every term in a route, for the QA overlay. */
export function routeStrains(route: readonly number[]): number[] {
  return route.map((v) => decompose(v)?.strain ?? -1)
}
