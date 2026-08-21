// THE ORDER — the standing plate, and the reason a dead end cannot happen.
//
// A customer places an order. It sits at the top of the screen until it is
// filled. The market throws fruit. You cut what fills the order.
//
//     10  +  15  +  □  =  33
//
// The plate has an **elastic tail**: the addends already taken, then exactly one
// open blank. It grows — `□ = 33` → `10 + □ = 33` → `10 + 15 + □ = 33` →
// `10 + 15 + 8 = 33` FILLED. That is one departure from the founder's three-slot
// mock and it buys the whole rigour of this file: the frontier is a function of
// the residual alone, the reachability table is one-dimensional, and a printed
// value's classification depends only on the thing the child is computing.
//
// ── the three rules ─────────────────────────────────────────────────────────
//
// R1 CLASSIFICATION. A printed value `v` against residual `R` is
//    *overshoot* iff v > R, *helpful* iff R − v is reachable as a sum of pool
//    members, and *decoy* otherwise. Recomputed on every slice, against the live
//    residual — never baked into the object when it was thrown.
//
// R2 ONLY A HELPFUL SLICE CONSUMES A BLANK. A decoy changes no state at all: no
//    score, no blank, no combo, nothing lost. It is information, not punishment.
//
// R3 THE OFFER INVARIANT lives in `director.ts`, because it is about what is in
//    the air. This file supplies the frontier it offers from.
//
// ── ORDER DOES NOT MATTER ───────────────────────────────────────────────────
//
// Founder ruling: in `13 = □ + □ + □`, `3 + 3 + 3 + 4` and `4 + 3 + 3 + 3` are
// the same answer. A child who takes the 4 first has not made a mistake, and the
// game may never treat them as though they had.
//
// That is not a special case here, it is a consequence of the shape. The only
// state a classification reads is the RESIDUAL, and the residual is
// `T − Σ addends` — a sum, which is commutative. So `classify` is a function of
// the *multiset* of values taken and cannot see the sequence they arrived in,
// and `Reach` is the unbounded coin problem, which is a statement about
// multisets and has no notion of order in it at all. The frontier after taking
// {3, 4} is identical to the frontier after taking {4, 3}, element for element.
// `order.test.ts` asserts exactly that over every permutation of many
// decompositions, because "it follows from the shape" is the kind of claim that
// stops being true the first time somebody adds a k-blank structure.
//
// The plate prints the addends in the order the child cut them, which is the
// honest record of what they did, and both readings are correct arithmetic.
//
// **Together R1 and R2 make a dead end impossible by construction.** The proof
// is two lines. Every target is generated as a sum of pool members, so `R = T`
// is reachable. A helpful cut moves R to R − v, which R1 checked is reachable.
// So every reachable state has R reachable; and if R > 0 and reachable then
// R = v₁ + … + vₖ for some pool members, so v₁ is in the frontier and the
// frontier is non-empty. There is no losable resource and nothing to back out
// of. `order.test.ts` walks it over a hundred thousand random states.
//
// No floating point anywhere below. Every value a child sees is an integer,
// reachability is a `Uint8Array`, and the only division is in the scoring, which
// lives in `economy.ts`.

/** Three digits is the legibility ceiling for a numeral on a moving object. */
export const PRINTED_MAX = 999

/**
 * The blank, `□` (U+25A1).
 *
 * Not `?` and not `___`. The curriculum pins it — `dynawalla-app/src/packs/items.ts`
 * declares `export const BLANK = "□"` — and `games/stack/src/blank.ts` is the
 * fleet's note on what happened the last time a pack invented its own.
 */
export const BLANK = "□"

export type Band = {
  readonly name: string
  readonly targetLo: number
  readonly targetHi: number
  /**
   * THE ADDEND POOL. Reachability, target generation and the frontier are all
   * defined over this set and nothing else.
   */
  readonly pool: readonly number[]
  /**
   * Values that may be PRINTED on a gourd but are not addends.
   *
   * They exist so that the judgement is real at the top of an order as well as
   * at the bottom. With `pool = {1…9}` and `R = 15` every printed value would be
   * helpful and there would be nothing to decide; a foil of 19 overshoots and
   * has to be rejected on sight.
   *
   * A foil is not a trap: R1 classifies it exactly like anything else, so a foil
   * that happens to leave a reachable remainder simply *is* helpful, and taking
   * it can never strand the child. The invariant does not care where a printed
   * value came from.
   */
  readonly foils: readonly number[]
  /** How many addends a generated target is built from. */
  readonly partsLo: number
  readonly partsHi: number
}

const span = (lo: number, hi: number, step = 1): number[] => {
  const out: number[] = []
  for (let v = lo; v <= hi; v += step) out.push(v)
  return out
}

/**
 * The ladder. One rung per band, walked by the flow controller's intensity.
 *
 * `dynawalla-full-spectrum-adaptation`: the floor is genuinely trivial and that
 * is not demeaning — `□ = 4` with two slow fruit in the air and unlimited time
 * is a real, satisfying game — and the top is world-championship arithmetic at
 * arcade density. One axis, five rungs, no difficulty menu.
 */
export const BANDS: readonly Band[] = [
  {
    name: "ones",
    targetLo: 2,
    targetHi: 6,
    pool: [1, 2, 3],
    foils: [7, 8, 9, 11],
    partsLo: 2,
    partsHi: 3,
  },
  {
    // The pool starts at THREE, not at one, and that is the whole rung.
    //
    // With `1` in the pool every residual is reachable, so no printed value can
    // ever be a decoy and the only judgement left is "is it too big". Starting
    // at three makes 1 and 2 unreachable remainders, so `R − 1` and `R − 2` are
    // decoys: at `□ = 15` a child who takes the 8 is left needing 2 and there is
    // no 2. That is a real, small, first piece of arithmetic reasoning, and it is
    // the first rung on the ladder where one exists.
    name: "single digits",
    targetLo: 12,
    targetHi: 24,
    pool: span(3, 9),
    foils: [11, 13, 14, 16, 17, 19, 21, 22, 25, 27],
    partsLo: 3,
    partsHi: 4,
  },
  {
    // The pool starts at FIVE for the same reason the rung below starts at
    // three: the smallest addend is what decides how many residuals are
    // unreachable, and unreachable residuals are the only thing that makes a
    // value a DECOY rather than merely too big. From five up, `R − 1` through
    // `R − 4` are all decoys, so four of every twenty-odd printed values are a
    // "that leaves you somewhere you cannot get out of" judgement.
    name: "friendly two-digit",
    targetLo: 25,
    targetHi: 60,
    pool: [5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 18, 20, 25],
    foils: [22, 27, 33, 38, 44, 49, 55, 63, 70],
    partsLo: 3,
    partsHi: 4,
  },
  {
    name: "regrouping",
    targetLo: 100,
    targetHi: 400,
    pool: [
      10, 15, 17, 20, 23, 25, 29, 30, 35, 38, 40, 45, 46, 50, 55, 57, 60, 63, 65, 70, 74, 75, 80,
      85, 88, 90,
    ],
    foils: [105, 110, 125, 150, 175, 200, 225, 250, 275, 300, 350],
    partsLo: 3,
    partsHi: 4,
  },
  {
    name: "thousands",
    targetLo: 1000,
    targetHi: 3000,
    pool: [
      100, 125, 150, 175, 200, 225, 250, 275, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750,
      800, 850, 900,
    ],
    foils: [110, 199, 240, 333, 475, 675, 725, 875, 925, 975, 999],
    partsLo: 3,
    partsHi: 4,
  },
]

/**
 * Is `r` expressible as a sum of pool members?
 *
 * A bounded coin problem: one `Uint8Array(max + 1)`, filled once per band, then
 * O(1) forever. Exact, integer-only, and small enough that the whole ladder's
 * tables together are under four kilobytes.
 */
export class Reach {
  private readonly table: Uint8Array
  readonly max: number

  constructor(pool: readonly number[], max: number) {
    this.max = Math.max(0, Math.floor(max))
    const t = new Uint8Array(this.max + 1)
    t[0] = 1
    for (let r = 1; r <= this.max; r++) {
      for (const v of pool) {
        if (v <= r && t[r - v] === 1) {
          t[r] = 1
          break
        }
      }
    }
    this.table = t
  }

  canMake(r: number): boolean {
    if (!Number.isInteger(r) || r < 0 || r > this.max) return false
    return this.table[r] === 1
  }
}

const REACH: Array<Reach | undefined> = []
const PRINTED: Array<readonly number[] | undefined> = []

/** The reachability table for a rung. Built once, shared by every order on it. */
export function reachFor(rung: number): Reach {
  const i = rungIndex(rung)
  const b = BANDS[i] as Band
  return (REACH[i] ??= new Reach(b.pool, b.targetHi))
}

/** Everything the market may print on a gourd at this rung, ascending. */
export function printedFor(rung: number): readonly number[] {
  const i = rungIndex(rung)
  const b = BANDS[i] as Band
  return (PRINTED[i] ??= [...new Set([...b.pool, ...b.foils])].sort((x, y) => x - y))
}

export function rungIndex(rung: number): number {
  if (!Number.isFinite(rung)) return 0
  return Math.max(0, Math.min(BANDS.length - 1, Math.floor(rung)))
}

export type Klass = "helpful" | "decoy" | "overshoot"

/** R1, and the only place a value is ever judged. */
export function classify(v: number, residual: number, reach: Reach): Klass {
  if (!Number.isInteger(v) || v < 1) return "decoy"
  if (v > residual) return "overshoot"
  return reach.canMake(residual - v) ? "helpful" : "decoy"
}

/**
 * A target the child can actually reach, built as a sum of pool members so that
 * reachability is true by construction rather than by search.
 */
export function makeTarget(rung: number, rnd: () => number): number {
  const i = rungIndex(rung)
  const b = BANDS[i] as Band
  const reach = reachFor(i)
  for (let attempt = 0; attempt < 80; attempt++) {
    const k = b.partsLo + Math.floor(rnd() * (b.partsHi - b.partsLo + 1))
    let t = 0
    for (let n = 0; n < k; n++) t += b.pool[Math.floor(rnd() * b.pool.length)] as number
    if (t >= b.targetLo && t <= b.targetHi) return t
  }
  // Deterministic fallback. Every band has a reachable target in range — the
  // test asserts it — so this terminates without ever returning something the
  // child cannot fill.
  for (let t = b.targetLo; t <= b.targetHi; t++) if (reach.canMake(t)) return t
  return b.targetLo
}

/** May a host-supplied answer stand in as this rung's target? */
export function targetIsUsable(rung: number, n: number): boolean {
  const i = rungIndex(rung)
  const b = BANDS[i] as Band
  if (!Number.isInteger(n) || n < b.targetLo || n > b.targetHi) return false
  return reachFor(i).canMake(n)
}

/**
 * One standing order.
 *
 * Mutable, allocation-free on the cut path apart from the frontier array, which
 * is written into a caller-owned buffer.
 */
export class Order {
  readonly rung: number
  readonly band: Band
  readonly target: number
  /**
   * The host question this target came from, or `""` when the game generated it
   * itself. **Nothing is reported against an empty id** — inventing a question
   * id the host never issued would put fiction into the ladder.
   */
  readonly questionId: string
  readonly addends: number[] = []
  private readonly reach: Reach
  private taken = 0

  constructor(rung: number, target: number, questionId = "") {
    this.rung = rungIndex(rung)
    this.band = BANDS[this.rung] as Band
    this.reach = reachFor(this.rung)
    this.target = target
    this.questionId = questionId
  }

  get residual(): number {
    return this.target - this.taken
  }

  get filled(): boolean {
    return this.taken === this.target
  }

  /** How many cuts it took. Three is the tidy one; see `economy.tidyBonus`. */
  get cuts(): number {
    return this.addends.length
  }

  classify(v: number): Klass {
    return classify(v, this.residual, this.reach)
  }

  /**
   * R2. Applies the value if and only if it is helpful, and returns what it
   * was either way. A decoy leaves this object bit-for-bit unchanged.
   */
  take(v: number): Klass {
    const k = this.classify(v)
    if (k !== "helpful") return k
    this.addends.push(v)
    this.taken += v
    return k
  }

  /**
   * Every printed value at this rung that would advance the order.
   *
   * Non-empty whenever the order is unfilled — that is the theorem this file
   * exists for. Written into `out` so the frame path allocates nothing.
   */
  frontier(out: number[] = []): number[] {
    out.length = 0
    const r = this.residual
    if (r <= 0) return out
    for (const v of printedFor(this.rung)) {
      if (v <= r && this.reach.canMake(r - v)) out.push(v)
    }
    return out
  }

  /** `10 + 15 + □ = 33`, or `10 + 15 + 8 = 33` once it is filled. */
  plate(): string {
    const head = this.addends.length === 0 ? BLANK : this.addends.join(" + ")
    if (this.filled) return `${head} = ${this.target}`
    return this.addends.length === 0
      ? `${BLANK} = ${this.target}`
      : `${head} + ${BLANK} = ${this.target}`
  }

  /** `33 − 10 − 15 = 8`. The written-out subtraction, for the calm end only. */
  sentence(): string {
    if (this.addends.length === 0) return `${this.target} = ${this.residual}`
    return `${this.target} − ${this.addends.join(" − ")} = ${this.residual}`
  }
}
