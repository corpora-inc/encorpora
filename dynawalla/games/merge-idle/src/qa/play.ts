/**
 * A headless player, so the game can be MEASURED rather than described.
 *
 * It drives `core/engine.ts` — the same rules a child drives, not a second copy
 * of them — through a fake clock and a seeded rng, and reports what happened. The
 * three policies exist to answer one question that a game like this has to be
 * able to answer out loud:
 *
 *   **Is the arithmetic skippable?**
 *
 * THE SPLIT shipped in this fleet with a bot that never answered a question
 * outscoring one that did. So: `merger` never feeds the mouth at all, `random`
 * feeds whatever is nearest, and `compute` works the target out. If `compute` does
 * not win decisively, the maths is decoration and the game is broken. See
 * `bots.test.ts`.
 *
 * Nothing here is imported by `game.ts`, so none of it ships.
 */

import { canSplit } from '../core/ladder.ts'
import { Engine, type Event } from '../core/engine.ts'
import { at, emptyCells, hasLegalMerge, polyps } from '../core/board.ts'
import { makeRng } from '../core/rng.ts'
import { bagOf, routeIn } from '../core/target.ts'
import { makeStubHost } from '../stubHost.ts'

export type Policy = 'merger' | 'random' | 'compute'

export type Report = {
  policy: Policy
  seed: number
  blooms: number
  spills: number
  merges: number
  splits: number
  dissolves: number
  /** Every target the session was shown, in order. */
  targets: Array<{
    value: number
    form: string
    slots: number
    depth: number
    viaHost: boolean
    /** True when the shelf could already build it the moment it went up. */
    reachable: boolean
    /** How many polyps the reef still owed the shelf when it went up. */
    stock: number
  }>
  /** Attempts the host recorded, and what was reported for each. */
  reports: Array<{ correct: boolean; answered: string; ms: number }>
  /** Items refused because no board could ever build them. */
  skips: number
  /** Times a target was up and the shelf could not build it after the reef settled. */
  stuck: number
}

const STEP_MS = 220

export function play(o: { policy: Policy; seed: number; steps?: number }): Report {
  const steps = o.steps ?? 900
  const rng = makeRng(o.seed)
  const reports: Report['reports'] = []
  let skips = 0
  const host = makeStubHost({
    seed: o.seed ^ 0x9e37,
    onReport: (r) => reports.push({ correct: r.correct, answered: r.answered, ms: r.ms }),
    onSkip: () => {
      skips++
    },
  })

  let clock = 0
  const engine = new Engine({
    host: {
      next: (opts) => host.next(opts),
      skip: (id) => host.skip?.(id),
      focus: (spec) => host.focus?.(spec),
      report: (r) => host.report(r),
    },
    rng,
    now: () => clock,
    limit: () => ({ maxCols: 8, maxRows: 9 }),
    cols: 6,
    rows: 7,
  })
  engine.seed()

  const out: Report = {
    policy: o.policy,
    seed: o.seed,
    blooms: 0,
    spills: 0,
    merges: 0,
    splits: 0,
    dissolves: 0,
    targets: [],
    reports,
    skips,
    stuck: 0,
  }

  const noteTarget = (): void => {
    const t = engine.s.target
    if (!t) return
    out.targets.push({
      value: t.value,
      form: t.form,
      slots: t.slots,
      depth: engine.s.depth,
      viaHost: t.questionId !== null,
      reachable: engine.reachable(),
      stock: engine.s.stock.length,
    })
  }

  const tally = (events: readonly Event[]): void => {
    for (const ev of events) {
      if (ev.kind === 'bloom') out.blooms++
      else if (ev.kind === 'spill') out.spills++
      else if (ev.kind === 'merge') out.merges++
      else if (ev.kind === 'split') out.splits++
      else if (ev.kind === 'dissolve') out.dissolves++
      else if (ev.kind === 'target') noteTarget()
    }
  }

  tally(engine.ask())

  /** The plan the computing bot is following, as board VALUES in mouth order. */
  let plan: number[] = []

  for (let step = 0; step < steps; step++) {
    clock += STEP_MS
    tally(engine.tick(STEP_MS))
    const s = engine.s
    if (!s.target) break

    // Never let the shelf jam: every policy is allowed the free escape hatch,
    // because a bot that soft-locks is measuring the wrong thing.
    if (emptyCells(s.board).length === 0 && !hasLegalMerge(s.board)) {
      tally(engine.dissolve())
      plan = []
      continue
    }

    if (o.policy === 'merger') {
      if (!doMerge(engine, tally)) doSplit(engine, tally)
      continue
    }

    if (o.policy === 'random') {
      // Half the time it tidies the board like anybody would; the rest of the
      // time it puts a polyp in the mouth without working anything out.
      if (rng.chance(1, 2) && doMerge(engine, tally)) continue
      const here = polyps(s.board)
      if (here.length === 0) continue
      const pick = here[rng.int(0, here.length - 1)]
      if (pick) tally(engine.feed(pick.cell))
      continue
    }

    // compute
    if (s.mouth.fed.length === 0) plan = []
    if (plan.length === 0) {
      const bag = bagOf(polyps(s.board).map((p) => p.value))
      const route = routeIn(bag, s.target.value, s.target.form, s.target.slots)
      if (route) plan = [...route]
    }
    if (plan.length > 0) {
      const want = plan[0] as number
      const cell = polyps(s.board).find((p) => p.value === want)?.cell
      if (cell === undefined) {
        plan = []
      } else {
        plan.shift()
        const before = engine.s.mouth.fed.length
        tally(engine.feed(cell))
        if (engine.s.mouth.fed.length <= before) plan = []
        continue
      }
    }
    // Nothing to feed yet: build the reef up instead. Merging first, because that
    // is what makes the big terms, then splitting, which is what makes the odd ones.
    if (doMerge(engine, tally)) continue
    if (doSplit(engine, tally)) continue
    out.stuck++
  }

  out.skips = skips
  return out
}

function doMerge(engine: Engine, tally: (e: readonly Event[]) => void): boolean {
  const b = engine.s.board
  const byValue = new Map<number, number[]>()
  for (const p of polyps(b)) {
    const list = byValue.get(p.value) ?? []
    list.push(p.cell)
    byValue.set(p.value, list)
  }
  // Largest pair first: that is what a person does, and it is what makes the
  // board climb instead of churn.
  const values = [...byValue.keys()].sort((a, z) => z - a)
  for (const v of values) {
    const cells = byValue.get(v)
    if (!cells || cells.length < 2) continue
    const out = engine.merge(cells[0] as number, cells[1] as number)
    if (out) {
      tally(out.events)
      return true
    }
  }
  return false
}

function doSplit(engine: Engine, tally: (e: readonly Event[]) => void): boolean {
  const b = engine.s.board
  if (emptyCells(b).length === 0) return false
  const cand = polyps(b)
    .filter((p) => canSplit(p.value))
    .sort((a, z) => z.value - a.value)[0]
  if (!cand) return false
  const before = engine.s.splits
  tally(engine.split(cand.cell))
  return engine.s.splits > before
}

/** Sum of a numeric field over many reports, for the bot comparison. */
export function total(rs: readonly Report[], pick: (r: Report) => number): number {
  return rs.reduce((a, r) => a + pick(r), 0)
}

/** Exported for the reachability assertions. */
export { at }
