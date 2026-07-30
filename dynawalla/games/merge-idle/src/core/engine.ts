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
  purgeLowest,
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
import { bagOf, faceOf, routeIn, type Form } from './target.ts'
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

  /** Stock a fresh shelf so the very first target has something to be made of. */
  seed(n = 8): void {
    const step = this.s.baseStep
    for (let i = 0; i < n; i++) {
      const strain = this.deps.rng.int(0, 7) as Strain
      const p = spawn(this.s.board, valueOf(strain, step), this.deps.rng)
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
    this.s.stock = [...a.stock]
    // A debt starts being paid on the NEXT frame, not on whatever was left of the
    // slow cadence: the child is already looking at a number they cannot make.
    if (this.s.stock.length > 0) this.s.emitMs = Math.min(this.s.emitMs, STOCK_PERIOD_MS)
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

  /* ----------------------------------------------------------------- merges */

  merge(from: number, to: number): { res: MergeResult; events: Event[] } | null {
    const res = tryMerge(this.s.board, from, to)
    if (!res) return null
    this.s.merges++
    if (res.value > this.s.bestValue) this.s.bestValue = res.value
    const events: Event[] = [{ kind: 'merge', cell: to, value: res.value, rank: res.rank, chain: 0 }]
    this.refreshCrowd(events)
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
    return [{ kind: 'move', cell: to }]
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
    this.refreshCrowd(events)
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
    if (verdict.kind === 'open') return events
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
    this.refreshCrowd(events)
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
    // The target is NOT replaced and NOT taken away. It stays up, and it is still
    // reachable — the reef re-stocks whatever the spill could not put back.
    const t = this.s.target
    if (t && !this.reachable()) {
      const bag = bagOf(polyps(this.s.board).map((p) => p.value))
      const missing = routeIn(bag, t.value, t.form, t.slots)
      if (!missing) this.s.stock.push(...t.route.filter((v) => (bag.get(v) ?? 0) === 0))
    }
    this.refreshCrowd(events)
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

  dissolve(): Event[] {
    const { gained, cells } = purgeLowest(this.s.board)
    if (cells.length === 0) return []
    const events: Event[] = [{ kind: 'dissolve', cells, gained }]
    this.refreshCrowd(events)
    return events
  }

  private refreshCrowd(events: Event[]): void {
    const c = isCrowded(this.s.board)
    if (c && !this.s.crowded) events.push({ kind: 'crowded' })
    this.s.crowded = c
  }

  /* -------------------------------------------------------------- emissions */

  /**
   * One polyp onto the shelf.
   *
   * `stock` first: those are the halves the reef owes so the current target stays
   * buildable, and they are the mechanism behind "the game can know what would be a
   * fun number to put on the vent and you build it with the polyps".
   *
   * Otherwise a value from the live band. The strain is drawn from what the shelf
   * ALREADY HOLDS three times out of four, because eight strains scattered at
   * random is a board with nothing to merge — and a merge board that never offers a
   * pair is the meanest thing this genre can do.
   */
  emitOne(): Polyp | null {
    const owed = this.s.stock.shift()
    if (owed !== undefined) return spawn(this.s.board, owed, this.deps.rng)
    const rng = this.deps.rng
    const here = polyps(this.s.board)
    const strains = new Set<number>()
    for (const p of here) {
      const id = decompose(p.value)
      if (id) strains.add(id.strain)
    }
    const pool = strains.size > 0 && rng.chance(3, 4) ? [...strains].sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6, 7]
    const strain = rng.pick(pool) as Strain
    const step = Math.max(0, this.s.baseStep + (rng.chance(1, 3) ? 1 : 0))
    return spawn(this.s.board, valueOf(strain, step), this.deps.rng)
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
        this.refreshCrowd(events)
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
