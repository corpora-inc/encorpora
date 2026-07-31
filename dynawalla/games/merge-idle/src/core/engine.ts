/**
 * THE ENGINE — every rule in ABYSSAL BLOOM, and nothing else.
 *
 * No canvas, no DOM, no `performance.now()`, no particles. The clock is injected,
 * the randomness is seeded, and every method returns a list of `Event`s that the
 * shell turns into sound, shake and light. `game.ts` is a shell.
 *
 * **This file exists so the tests are not vacuous.** The previous version put the
 * rules inside the class that also owned the canvas and the audio, so nothing
 * could exercise a real game without a browser, and the bots that were supposed to
 * prove the arithmetic was unskippable would have had to re-implement the rules
 * they were testing. `bots.test.ts` drives *this*, which is the same code the
 * child drives.
 *
 * The loop, in one paragraph. The reef coughs polyps onto a shelf. Two polyps with
 * the same number merge into their sum, which is exactly double; a polyp can be
 * split back into two halves. One target sits at the top, and it is answered by
 * putting one to three polyps into the mouth. The mouth resolves the instant it
 * can — a match blooms, an overshoot or a full-and-short mouth spills — and a
 * spill hands the polyps back HALVED, so a wrong answer costs work and nothing
 * else. Blooming deepens the reef, which brightens the water, raises the rung new
 * polyps arrive on and, every five blooms, grows the shelf.
 */

import {
  at,
  cull,
  emptyCells,
  grow,
  isCrowded,
  makeBoard,
  move,
  place,
  polyps,
  purgeUpTo,
  spawn,
  trySplit,
  tryMerge,
  type MergeResult,
  type Polyp,
} from './board.ts'
import {
  baseStepFor,
  bloomLevel,
  bloomYield,
  EMIT_STEP,
  emitPeriodMs,
  growthsAt,
  offlineGrowth,
  STOCK_PERIOD_MS,
  sumSlotsAt,
} from './economy.ts'
import { canSplit, decompose, rank, valueOf, type Strain } from './ladder.ts'
import {
  emptyMouth,
  feed as feedMouth,
  resolve,
  retract as retractMouth,
  running,
  spillInto,
} from './mouth.ts'
import type { Rng } from './rng.ts'
import { askTarget, type AskHost } from './ask.ts'
import { bagOf, faceOf, ladderRoute, routeIn, stockFor, type Form } from './target.ts'
import { BUDGET, emptyDrag, type State, type Target, type Tier } from './state.ts'

export type Event =
  | { kind: 'merge'; cell: number; value: number; rank: number; chain: number }
  | { kind: 'split'; cell: number; into: number; value: number }
  | { kind: 'move'; cell: number }
  | { kind: 'fed'; value: number; index: number }
  | { kind: 'retract'; value: number; cell: number }
  | { kind: 'bloom'; value: number; form: Form; depth: number }
  | { kind: 'spill'; produced: number | null; back: number[] }
  | { kind: 'grow'; cols: number; rows: number }
  | { kind: 'emit'; cell: number; value: number }
  | { kind: 'dissolve'; cells: number[]; gained: number }
  | { kind: 'crowded' }
  | { kind: 'target'; value: number; form: Form; face: string }
  | { kind: 'refuse'; why: 'mouth-full' | 'no-halves' | 'no-room' | 'shelf-full' }
  | { kind: 'grew-away'; polyps: number }

/** What a shell has to supply that is genuinely outside the rules. */
export type EngineDeps = {
  host: AskHost & {
    report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void
  }
  rng: Rng
  /** Milliseconds, monotonic. Injected so tests are deterministic. */
  now(): number
  /** How big the shelf may get on this glass. Re-read on every growth. */
  limit(): { maxCols: number; maxRows: number }
  reduceMotion?: boolean
  tier?: Tier
  cols?: number
  rows?: number
}

export const START_COLS = 6
export const START_ROWS = 7

/** How many recent targets to remember, so the same number twice running is rare. */
const RECENT = 4

/**
 * The room CLEAR guarantees, over and above what the reef currently owes.
 *
 * A debt is at most six polyps — three terms, two halves each — so six cells is
 * enough to *land* it. Two more are the slack to work in: a polyp may be dragged
 * onto any empty cell from anywhere, so one spare cell is already enough to bring
 * any two halves together, and two is enough that a child never has to think
 * about it.
 */
export const ESCAPE_SLACK = 2

/**
 * The biggest debt the reef can ever owe: three terms, two halves apiece.
 *
 * A constant and not `stock.length` on purpose. CLEAR clears room and then works
 * out what it owes, and on the founder's own board the clearing is what CREATES
 * the debt — it takes away the last small polyp, so a target that was answerable
 * a moment ago now needs stocking. Sizing the escape against the debt as it stood
 * *before* the purge left the shelf one cell short of the debt the purge made.
 */
export const MAX_DEBT = 6

/** The room CLEAR restores, and the point below which it is offered. */
export const ESCAPE_CELLS = MAX_DEBT + ESCAPE_SLACK

export class Engine {
  readonly s: State
  private deps: EngineDeps
  private recent: number[] = []
  /** Set when a target's item has been reported, so it can never be reported twice. */
  private closed = new Set<string>()

  constructor(deps: EngineDeps) {
    this.deps = deps
    const tier = deps.tier ?? 'mid'
    this.s = {
      board: makeBoard(deps.cols ?? START_COLS, deps.rows ?? START_ROWS),
      target: null,
      mouth: emptyMouth(2),
      depth: 0,
      bloom: bloomLevel(0),
      baseStep: baseStepFor(0),
      grows: 0,
      stock: [],
      emitMs: 900,
      crowded: false,
      toasts: [],
      elapsed: 0,
      merges: 0,
      splits: 0,
      spills: 0,
      bestValue: 0,
      drag: emptyDrag(),
      pinged: -1,
      pingMs: 0,
      mouthFlash: 0,
      mouthShake: 0,
      mouthRect: { x: 0, y: 0, w: 0, h: 0 },
      tier,
      reduceMotion: deps.reduceMotion ?? false,
    }
    void BUDGET
  }

  /* ------------------------------------------------------------------ setup */

  /**
   * Stock a fresh shelf so the very first target has something to be made of.
   *
   * At step 0, always. A returning child whose shelf was emptied gets 1, 3, 5, 7
   * back, not the rung their depth would have justified — the reef's own emission
   * band starts at the seeds too, and a shelf that opens above it is a shelf
   * nothing can be built out of.
   */
  seed(n = 8): void {
    for (let i = 0; i < n; i++) {
      const strain = this.deps.rng.int(0, 7) as Strain
      const p = spawn(this.s.board, valueOf(strain, 0), this.deps.rng)
      if (p) p.born = 1
    }
  }

  /** Away time, paid in polyps. See `economy.ts`, `offlineGrowth`. */
  returnAfter(elapsedMs: number): Event[] {
    const n = offlineGrowth(elapsedMs, this.s.depth)
    if (n <= 0) return []
    let made = 0
    for (let i = 0; i < n; i++) {
      const p = this.emitOne()
      if (p) made++
    }
    for (const p of polyps(this.s.board)) p.born = 1
    return made > 0 ? [{ kind: 'grew-away', polyps: made }] : []
  }

  /* ----------------------------------------------------------------- target */

  /**
   * Put a target up.
   *
   * Everything hard about this is in `core/ask.ts`. What happens here is the
   * bookkeeping: the mouth is sized for the form, the reef is told what it owes
   * the shelf, and the clock starts on the child's thinking time.
   */
  ask(): Event[] {
    const bag = bagOf(polyps(this.s.board).map((p) => p.value))
    const a = askTarget({ bag, depth: this.s.depth, host: this.deps.host, rng: this.deps.rng, recent: this.recent })
    const target: Target = {
      value: a.value,
      form: a.form,
      slots: a.slots,
      route: a.route,
      questionId: a.questionId,
      hostPrompt: a.hostPrompt,
      askedAt: this.deps.now(),
      age: 0,
    }
    this.s.target = target
    this.s.mouth = emptyMouth(a.slots)
    // `askTarget` already worked the debt out; `restock` is the same computation
    // against the same shelf, and going through it means there is exactly ONE
    // place in this engine that decides what the reef owes.
    this.restock()
    this.recent.push(a.value)
    while (this.recent.length > RECENT) this.recent.shift()
    return [{ kind: 'target', value: a.value, form: a.form, face: this.face }]
  }

  get face(): string {
    const t = this.s.target
    return t ? faceOf(t.value, t.form) : ''
  }

  /** What is in the mouth right now, as a number, or null. */
  get running(): number | null {
    const t = this.s.target
    return t ? running(this.s.mouth, t.form) : null
  }

  /**
   * Is the target buildable from the shelf as it stands?
   *
   * The one invariant this whole redesign exists to keep. Exposed so a test can
   * assert it after every move rather than only when a target goes up — and so the
   * QA overlay can show it.
   */
  reachable(): boolean {
    const t = this.s.target
    if (!t) return false
    const bag = bagOf(polyps(this.s.board).map((p) => p.value))
    return routeIn(bag, t.value, t.form, t.slots) !== null
  }

  /**
   * Every polyp the child controls: the shelf, plus whatever is in the mouth.
   *
   * The mouth counts. A polyp in it can be pulled back out for free and a spill
   * hands all of them back, so a route that is half-fed is a route the child still
   * holds — and a debt computed off the shelf alone would ask the reef to grow a
   * second copy of the 16 they are standing there holding.
   */
  private get held() {
    return bagOf([...polyps(this.s.board).map((p) => p.value), ...this.s.mouth.fed.map((f) => f.value)])
  }

  /**
   * Can the child GET to this route with the polyps they hold, given merges and
   * splits? The honest form of "is this winnable", and it is a counting argument.
   *
   * A polyp's strain is its odd part, and the only two moves that change a value
   * are merge (double) and split (halve). So a strain never converts into another
   * strain, and within a strain everything is fungible: a 44 is four 11s, a 22 is
   * two, and the child can go either way. Count each strain's holding in SEEDS —
   * `2 ** step` apiece — and a route is affordable exactly when every strain it
   * calls for is covered.
   *
   * This is what `solvable()` needed and did not have. The first version asked
   * `routeIn`, which reads the shelf literally, and a shelf holding a 40 and two
   * 2s failed it while `40 − (2+2) = 36` was one drag away.
   */
  private canAfford(route: readonly number[]): boolean {
    const have = new Map<number, number>()
    for (const [value, n] of this.held) {
      const id = decompose(value)
      if (!id) continue
      have.set(id.strain, (have.get(id.strain) ?? 0) + 2 ** id.step * n)
    }
    const need = new Map<number, number>()
    for (const v of route) {
      const id = decompose(v)
      if (!id) return false
      need.set(id.strain, (need.get(id.strain) ?? 0) + 2 ** id.step)
    }
    for (const [strain, want] of need) if ((have.get(strain) ?? 0) < want) return false
    return true
  }

  /** The terms the current target is made of, whatever the child holds. */
  private routeFor(t: Target): readonly number[] {
    return routeIn(this.held, t.value, t.form, t.slots) ?? ladderRoute(t.value, t.form, t.slots) ?? t.route
  }

  /**
   * CAN THE CHILD STILL WIN FROM HERE? The invariant the manual promises.
   *
   * `game.ts` tells a child, in as many words: *"You can never get stuck. CLEAR
   * always works."* This is that sentence, decidable, on live state — and it was
   * false in 0.3.7, which is why the founder was handed a board he could not win.
   *
   * Two ways to be true, and only two:
   *
   *   1. The shelf builds the target NOW — `reachable()`.
   *   2. The reef OWES the polyps that build it, and there is somewhere for them
   *      to land: room already, or room `dissolve()` will make.
   *
   * Note what is not here: hope. "The reef will emit something eventually" was the
   * old answer and it is how a board fills with numbers no answer can use. If
   * neither clause holds, the child is stuck, and this returns false rather than
   * shrugging.
   */
  solvable(): boolean {
    const t = this.s.target
    if (!t) return true
    if (this.canAfford(this.routeFor(t))) return true
    const owed = this.s.stock.length
    if (owed === 0) return false
    // Room already, or room CLEAR will make — `purgeUpTo` keeps going up the
    // values until there is `escapeRoom()`, so any shelf with a polyp on it can
    // be opened up. An empty shelf needs no opening.
    return emptyCells(this.s.board).length >= owed || polyps(this.s.board).length > 0
  }

  /** How much room the shelf needs before the reef can pay what it owes. */
  private escapeRoom(): number {
    return ESCAPE_CELLS
  }

  /**
   * Is CLEAR worth offering? True when pressing it would actually free something.
   *
   * Not "the board is full": a shelf with three cells left and a five-polyp debt
   * is already a shelf the reef cannot pay, and waiting for it to jam completely
   * before offering the way out is how a child spends a minute watching nothing
   * happen.
   */
  get needsRoom(): boolean {
    return emptyCells(this.s.board).length < this.escapeRoom() && polyps(this.s.board).length > 0
  }

  /**
   * Make the reef owe whatever the target still needs.
   *
   * Called after EVERY change to the shelf, which is the whole repair. The
   * previous version computed the debt once, when the target went up, and then
   * again only on a spill — so a child who merged the last term of their own route
   * into something bigger (a legal, sensible move) left the target unbuildable
   * with the reef owing nothing, and ambient emission cheerfully filled the shelf
   * with numbers that could not be part of any answer.
   *
   * Idempotent: `stockFor` is recomputed against the shelf as it stands, so a
   * half that has already landed is not asked for twice and a term the child has
   * merged up is dropped from the debt.
   */
  private restock(): void {
    const t = this.s.target
    if (!t) return
    const route = this.routeFor(t)
    // Nothing is owed while the child can still get there themselves. `canAfford`
    // and not `holdable` on purpose: a shelf one merge away from the answer is a
    // shelf with a merge to do, not a shelf to pour more polyps onto.
    if (this.canAfford(route)) {
      this.s.stock = []
      return
    }
    const owed = stockFor(this.held, route)
    this.s.stock = owed
    // A debt starts being paid on the NEXT frame: the child is already looking at
    // a number they cannot make.
    if (owed.length > 0) this.s.emitMs = Math.min(this.s.emitMs, STOCK_PERIOD_MS)
  }

  /** Everything that has to be true again after the shelf changes. */
  private settle(events: Event[]): void {
    this.restock()
    const c = isCrowded(this.s.board)
    if (c && !this.s.crowded) events.push({ kind: 'crowded' })
    this.s.crowded = c
  }

  /* ----------------------------------------------------------------- merges */

  merge(from: number, to: number): { res: MergeResult; events: Event[] } | null {
    const res = tryMerge(this.s.board, from, to)
    if (!res) return null
    this.s.merges++
    if (res.value > this.s.bestValue) this.s.bestValue = res.value
    const events: Event[] = [{ kind: 'merge', cell: to, value: res.value, rank: res.rank, chain: 0 }]
    this.settle(events)
    return { res, events }
  }

  /** The cell adjacent to `cell` holding the same value, or -1. Drives the cascade. */
  adjacentTwin(cell: number): number {
    const b = this.s.board
    const me = at(b, cell)
    if (!me) return -1
    const cx = cell % b.cols
    const cy = Math.floor(cell / b.cols)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= b.cols || ny >= b.rows) continue
      const j = ny * b.cols + nx
      const n = at(b, j)
      if (n && n.value === me.value) return j
    }
    return -1
  }

  moveTo(from: number, to: number): Event[] {
    if (!move(this.s.board, from, to)) return []
    const p = at(this.s.board, to)
    if (p) p.squash = 0.5
    const events: Event[] = [{ kind: 'move', cell: to }]
    this.settle(events)
    return events
  }

  /**
   * SPLIT — halve a polyp. The merge run backwards, and the way an exact target
   * gets its odd term: `23 = 16 + 7` out of a shelf holding a 14.
   */
  split(cell: number): Event[] {
    const p = at(this.s.board, cell)
    if (!p) return []
    if (!canSplit(p.value)) return [{ kind: 'refuse', why: 'no-halves' }]
    const before = p.value
    const res = trySplit(this.s.board, cell, this.deps.rng)
    if (!res) return [{ kind: 'refuse', why: 'no-room' }]
    this.s.splits++
    const events: Event[] = [{ kind: 'split', cell, into: res.made.cell, value: before / 2 }]
    this.settle(events)
    return events
  }

  /* ------------------------------------------------------------------ mouth */

  /**
   * Put the polyp in `cell` into the mouth, and let the mouth decide.
   *
   * Nothing here reads a clock beyond stamping the latency that is reported. The
   * mouth resolves the instant it *can* — see `core/mouth.ts` — which is what
   * makes trial and error cost something and what keeps the target from ever
   * being taken away.
   */
  feed(cell: number): Event[] {
    const t = this.s.target
    const p = at(this.s.board, cell)
    if (!t || !p) return []
    if (this.s.mouth.fed.length >= this.s.mouth.slots) return [{ kind: 'refuse', why: 'mouth-full' }]
    cull(this.s.board, cell)
    feedMouth(this.s.mouth, p.value, this.deps.rng.int(0, 999) / 1000)
    const events: Event[] = [{ kind: 'fed', value: p.value, index: this.s.mouth.fed.length - 1 }]
    const verdict = resolve(this.s.mouth, t.form, t.value)
    // A polyp in the mouth is a polyp off the shelf, so the route the child had
    // may have just been spent. The reef owes whatever is left of it from HERE,
    // not from whatever the shelf looked like when the target went up.
    if (verdict.kind === 'open') {
      this.settle(events)
      return events
    }
    this.report(t, verdict.kind === 'bloom', verdict.answered)
    if (verdict.kind === 'bloom') events.push(...this.bloom(t))
    else events.push(...this.spill(verdict.produced))
    return events
  }

  /** Take a polyp back out of the mouth. Free, always, with no clock on it. */
  retract(index: number): Event[] {
    const value = this.s.mouth.fed[index]?.value
    if (value === undefined) return []
    const free = emptyCells(this.s.board)
    if (free.length === 0) return [{ kind: 'refuse', why: 'shelf-full' }]
    retractMouth(this.s.mouth, index)
    const p = spawn(this.s.board, value, this.deps.rng)
    return p ? [{ kind: 'retract', value, cell: p.cell }] : []
  }

  private bloom(t: Target): Event[] {
    const events: Event[] = []
    this.s.mouth.fed = []
    this.s.depth++
    this.s.bloom = bloomLevel(this.s.depth)
    this.s.baseStep = baseStepFor(this.s.depth)
    events.push({ kind: 'bloom', value: t.value, form: t.form, depth: this.s.depth })

    // The reward that is material: more life to merge.
    for (let i = 0; i < bloomYield(this.s.depth); i++) {
      const p = this.emitOne()
      if (p) events.push({ kind: 'emit', cell: p.cell, value: p.value })
    }
    events.push(...this.growIfEarned())
    events.push(...this.ask())
    this.settle(events)
    return events
  }

  /**
   * A wrong answer, priced in work.
   *
   * `colossus` is the reference: more to do, visible and countable, no buzzer and
   * no life. Every polyp in the mouth comes back, and every one that can be halved
   * comes back as two halves — so the 16 you fed by mistake is two 8s to merge
   * again. Nothing is ever lost: `spillInto` is given the real number of free cells
   * and hands polyps back whole when there is no room to split them.
   */
  private spill(produced: number | null): Event[] {
    const free = emptyCells(this.s.board).length
    const back = spillInto(this.s.mouth, free)
    this.s.mouth.fed = []
    this.s.spills++
    for (const v of back) {
      const p = spawn(this.s.board, v, this.deps.rng)
      if (p) p.born = 0
    }
    const events: Event[] = [{ kind: 'spill', produced, back }]
    // The target is NOT replaced and NOT taken away. It stays up, and `settle`
    // makes the reef owe whatever the spill could not put back — the same guard
    // every other move goes through, rather than a special case that only a spill
    // benefited from.
    this.settle(events)
    return events
  }

  /**
   * Report the attempt.
   *
   * `answered` is the string `core/mouth.ts` built out of what the child actually
   * produced. Never the target, never a value derived from it, and never an empty
   * string — the host files an empty answer as a MISS. Once per item, guarded, so a
   * double-resolve can never inflate a child's record.
   */
  private report(t: Target, correct: boolean, answered: string): void {
    if (!t.questionId) return
    if (this.closed.has(t.questionId)) return
    this.closed.add(t.questionId)
    try {
      this.deps.host.report({
        questionId: t.questionId,
        correct,
        ms: Math.max(0, Math.round(this.deps.now() - t.askedAt)),
        answered,
      })
    } catch (e) {
      console.warn('[abyssal-bloom] host.report threw', e)
    }
  }

  /* ------------------------------------------------------------------ shelf */

  private growIfEarned(): Event[] {
    const want = growthsAt(this.s.depth)
    if (want <= this.s.grows) return []
    const { maxCols, maxRows } = this.deps.limit()
    const b = this.s.board
    const nextCols = b.cols < maxCols ? b.cols + 1 : b.cols
    const nextRows = nextCols === b.cols ? Math.min(maxRows, b.rows + 1) : b.rows
    if (nextCols <= b.cols && nextRows <= b.rows) return []
    this.s.grows = want
    grow(b, nextCols, nextRows)
    return [{ kind: 'grow', cols: b.cols, rows: b.rows }]
  }

  /**
   * CLEAR — the escape hatch, and the one promise this game makes out loud.
   *
   * The manual tells the child *"You can never get stuck. CLEAR always works."*
   * That sentence was false: `purgeLowest` cleared one value class, which on a
   * shelf of forty distinct numbers is one polyp, the reef put something back into
   * the hole, and the founder was exactly where he started. So CLEAR now goes up
   * the values until there is room for everything the reef owes plus slack to work
   * in, and `settle` reloads that debt on the way out — pressing it leaves a
   * position the child can win from, which is the only thing the word means.
   */
  dissolve(): Event[] {
    const { gained, cells } = purgeUpTo(this.s.board, this.escapeRoom())
    if (cells.length === 0) return []
    const events: Event[] = [{ kind: 'dissolve', cells, gained }]
    this.settle(events)
    return events
  }

  /* -------------------------------------------------------------- emissions */

  /**
   * One polyp onto the shelf, and the second half of the repair.
   *
   * `stock` first: those are the halves the reef owes so the current target stays
   * buildable, and they are the mechanism behind "the game can know what would be a
   * fun number to put on the vent and you build it with the polyps".
   *
   * ## What the ambient emission does now, and what it used to do
   *
   * It used to be `strain * 2 ** baseStep`, and `baseStep` came from DEPTH. So the
   * smallest polyp the reef could produce climbed with the session and never came
   * back down, and nothing in the expression mentioned the number the child was
   * being asked for. That is the whole of the founder's report: `5 = ▢ + ▢` with a
   * shelf where every polyp is above 18, and a CLEAR that frees one cell only for
   * a 44 to drop into it.
   *
   * Both halves of the draw are now answerable to the target:
   *
   *   * **the strain** comes from the terms the target is made of, three times in
   *     four. A polyp's strain is its odd part and merging only ever doubles, so a
   *     strain-5 polyp can only ever become 11, 22, 44, 88 — which means the
   *     strains the target needs are *exactly* the polyps that can take part in
   *     answering it. The fourth draw is from what the shelf already holds, or the
   *     whole ladder, because a board with only one strain on it is a board with
   *     nothing to join.
   *   * **the rung** is always 0 — a bare seed, at every depth, forever. Big
   *     numbers are earned by merging and are never handed out. See `EMIT_STEP`.
   */
  emitOne(): Polyp | null {
    const owed = this.s.stock.shift()
    if (owed !== undefined) return spawn(this.s.board, owed, this.deps.rng)
    const rng = this.deps.rng
    const pool = this.strainPool(rng)
    // Among the strains that would help, the one the shelf is shortest of. A pool
    // picked flat put thirty 1s on a forty-cell shelf, because strain 0 is in
    // almost every route; "I want to see 1,3,5,7" is a SPREAD, not a monoculture.
    let best = pool[0] as number
    let fewest = Infinity
    for (const strain of rng.shuffle([...pool])) {
      const n = this.countStrain(strain)
      if (n < fewest) {
        fewest = n
        best = strain
      }
    }
    return spawn(this.s.board, valueOf(best as Strain, EMIT_STEP), this.deps.rng)
  }

  private countStrain(strain: number): number {
    let n = 0
    for (const p of polyps(this.s.board)) if (decompose(p.value)?.strain === strain) n++
    return n
  }

  /**
   * Which strains a fresh polyp may be drawn from.
   *
   * A polyp's strain is its odd part, and merging only ever doubles — so a
   * strain-5 polyp can only ever become 11, 22, 44, 88. The strains the target's
   * route needs are therefore *exactly* the polyps that can take part in answering
   * it, which is why the pool is drawn from the route three times in four. The
   * fourth draw is wider, because a shelf carrying one strain is a shelf whose
   * every polyp is a duplicate of every other.
   */
  private strainPool(rng: Rng): number[] {
    const t = this.s.target
    if (t && rng.chance(3, 4)) {
      const wanted = new Set<number>()
      for (const v of this.routeFor(t)) {
        const id = decompose(v)
        if (id) wanted.add(id.strain)
      }
      if (wanted.size > 0) return [...wanted].sort((a, b) => a - b)
    }
    return [0, 1, 2, 3, 4, 5, 6, 7]
  }

  /**
   * Advance the reef by `dtMs`.
   *
   * The only timer in the game, and it is on the reef's own breathing — never on
   * the child's answer. Emission stops while the shelf is full, so nothing is lost.
   */
  tick(dtMs: number): Event[] {
    const s = this.s
    s.elapsed += dtMs / 1000
    for (const p of polyps(s.board)) {
      p.age += dtMs / 1000
      p.born = Math.min(1, p.born + (dtMs / 1000) * 4.4)
    }
    for (const f of s.mouth.fed) f.born = Math.min(1, f.born + (dtMs / 1000) * 5)
    const events: Event[] = []
    if (emptyCells(s.board).length === 0) return events
    s.emitMs -= dtMs
    if (s.emitMs <= 0) {
      // A debt is settled fast; the ordinary breathing is slow. See STOCK_PERIOD_MS.
      s.emitMs = s.stock.length > 0 ? STOCK_PERIOD_MS : emitPeriodMs(s.depth)
      const p = this.emitOne()
      if (p) {
        events.push({ kind: 'emit', cell: p.cell, value: p.value })
        this.settle(events)
      }
    }
    return events
  }

  /* ------------------------------------------------------------------- save */

  snapshot(): string {
    const cells: Array<[number, number]> = []
    for (let i = 0; i < this.s.board.cells.length; i++) {
      const p = this.s.board.cells[i]
      if (p) cells.push([i, p.value])
    }
    return JSON.stringify({
      v: 2,
      depth: this.s.depth,
      grows: this.s.grows,
      cols: this.s.board.cols,
      rows: this.s.board.rows,
      cells,
      // Polyps sitting in the mouth go back on the shelf on the way out, so a
      // child who closes mid-answer is never charged for it.
      mouth: this.s.mouth.fed.map((f) => f.value),
      lastSeen: Date.now(),
    })
  }

  /** Returns the away time in ms, so the caller can pay it. */
  restore(raw: string): number {
    const d = JSON.parse(raw) as {
      v?: number
      depth?: number
      grows?: number
      cols?: number
      rows?: number
      cells?: Array<[number, number]>
      mouth?: number[]
      lastSeen?: number
    }
    if (Number(d.v) !== 2) throw new Error('merge-idle: save is from an older reef')
    this.s.depth = Math.max(0, Number(d.depth) || 0)
    this.s.grows = Math.max(0, Number(d.grows) || 0)
    this.s.bloom = bloomLevel(this.s.depth)
    this.s.baseStep = baseStepFor(this.s.depth)
    this.s.mouth = emptyMouth(sumSlotsAt(this.s.depth))
    const { maxCols, maxRows } = this.deps.limit()
    const cols = Math.max(START_COLS, Math.min(maxCols, Number(d.cols) || START_COLS))
    const rows = Math.max(START_ROWS, Math.min(maxRows, Number(d.rows) || START_ROWS))
    this.s.board = makeBoard(cols, rows)
    for (const [cell, value] of d.cells ?? []) {
      place(this.s.board, cell, value, this.deps.rng.int(0, 999) / 1000)
    }
    // Anything that was in the mouth comes back to the shelf, not to the mouth:
    // a target chosen for the old board may not be the one that comes up now.
    for (const value of d.mouth ?? []) spawn(this.s.board, value, this.deps.rng)
    for (const p of polyps(this.s.board)) p.born = 1
    this.s.crowded = isCrowded(this.s.board)
    return Math.max(0, Date.now() - (Number(d.lastSeen) || Date.now()))
  }

  /** For the QA overlay. */
  get stats(): { depth: number; merges: number; splits: number; spills: number; best: number } {
    return {
      depth: this.s.depth,
      merges: this.s.merges,
      splits: this.s.splits,
      spills: this.s.spills,
      best: this.s.bestValue,
    }
  }
}

/** Exported so the shell can colour a merge without importing the ladder twice. */
export { rank }
