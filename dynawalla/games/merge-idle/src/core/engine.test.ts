import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { at, emptyCells, polyps, reefMass } from './board.ts'
import { GROW_EVERY } from './economy.ts'
import { Engine, type Event } from './engine.ts'
import { makeRng } from './rng.ts'
import { bagOf, routeIn } from './target.ts'
import { makeStubHost } from '../stubHost.ts'
import type { Host } from '../contract.ts'
import type { Target } from './state.ts'

/** Replace the live target with an unreachable one, to force a spill on purpose. */
function impossible(t: Target, slots = 3): Target {
  return { ...t, value: 10 ** 6, form: 'sum', slots, route: [] }
}

type Reported = { questionId: string; correct: boolean; ms: number; answered: string }

function rig(o: { seed?: number; cols?: number; rows?: number } = {}): {
  engine: Engine
  reports: Reported[]
  skips: string[]
  tick(ms: number): Event[]
  advance(ms: number): void
} {
  const reports: Reported[] = []
  const skips: string[] = []
  const host: Host = makeStubHost({
    seed: o.seed ?? 4,
    onReport: (r) => reports.push(r),
    onSkip: (id) => skips.push(id),
  })
  let clock = 1000
  const engine = new Engine({
    host: {
      next: (opts) => host.next(opts),
      skip: (id) => host.skip?.(id),
      focus: (spec) => host.focus?.(spec),
      report: (r) => host.report(r),
    },
    rng: makeRng(o.seed ?? 4),
    now: () => clock,
    limit: () => ({ maxCols: 8, maxRows: 9 }),
    cols: o.cols ?? 6,
    rows: o.rows ?? 7,
  })
  return {
    engine,
    reports,
    skips,
    tick: (ms) => {
      clock += ms
      return engine.tick(ms)
    },
    advance: (ms) => {
      clock += ms
    },
  }
}

/** Put the shelf in a known state, ignoring whatever the reef seeded. */
function stage(engine: Engine, values: number[]): number[] {
  for (let i = 0; i < engine.s.board.cells.length; i++) engine.s.board.cells[i] = null
  const cells: number[] = []
  const rng = makeRng(1)
  for (const v of values) {
    const cell = engine.s.board.cells.findIndex((c) => c === null)
    if (cell < 0) continue
    engine.s.board.cells[cell] = {
      id: engine.s.board.nextId++,
      value: v,
      cell,
      age: 0,
      born: 1,
      squash: 0,
      phase: rng.f(),
    }
    cells.push(cell)
  }
  return cells
}

/* --------------------------------------------------------- reporting honesty */

test('the reported answer is the value the child BUILT, never the target', () => {
  const r = rig({ seed: 12 })
  r.engine.seed()
  r.engine.ask()
  const t = r.engine.s.target
  assert.ok(t)
  // Feed a route that deliberately misses, and check the string that goes out.
  const cells = stage(r.engine, [1, 1])
  r.engine.s.mouth.slots = 2
  r.engine.feed(cells[0] as number)
  r.engine.feed(cells[1] as number)
  assert.equal(r.reports.length, 1)
  assert.equal(r.reports[0]?.answered, '2', 'the child made 2, so 2 is what is reported')
  assert.equal(r.reports[0]?.correct, t.value === 2)
  assert.equal(r.reports[0]?.questionId, t.questionId)
})

test('a bloom reports the target because that is what the child made, and only once', () => {
  const r = rig({ seed: 21 })
  r.engine.seed()
  r.engine.ask()
  const t = r.engine.s.target
  assert.ok(t)
  const route = [...t.route]
  const cells = stage(r.engine, route)
  r.engine.s.mouth.slots = t.slots
  for (const c of cells) r.engine.feed(c)
  const forThis = r.reports.filter((x) => x.questionId === t.questionId)
  assert.equal(forThis.length, 1, 'one report per item, ever')
  assert.equal(forThis[0]?.answered, String(t.value))
  assert.equal(forThis[0]?.correct, true)
})

test('a target with no host item behind it reports nothing at all', () => {
  const r = rig({ seed: 33 })
  r.engine.seed()
  r.engine.ask()
  const t = r.engine.s.target
  assert.ok(t)
  // Forge the state the fallback path produces: a real target, no item.
  Object.assign(t as unknown as { questionId: string | null }, { questionId: null })
  const before = r.reports.length
  const cells = stage(r.engine, [1, 1])
  r.engine.s.mouth.slots = 2
  r.engine.feed(cells[0] as number)
  r.engine.feed(cells[1] as number)
  assert.equal(r.reports.length, before, 'an absence is honest; a fabricated attempt is not')
})

test('thinking time is measured from when the target went up and is never negative', () => {
  const r = rig({ seed: 44 })
  r.engine.seed()
  r.engine.ask()
  r.advance(9000)
  const cells = stage(r.engine, [1, 1])
  r.engine.s.mouth.slots = 2
  r.engine.feed(cells[0] as number)
  r.engine.feed(cells[1] as number)
  assert.ok((r.reports[0]?.ms ?? -1) >= 9000, `ms was ${r.reports[0]?.ms}`)
})

/* -------------------------------------------------------------- no clock */

test('no amount of waiting takes the target away', () => {
  const r = rig({ seed: 55 })
  r.engine.seed()
  r.engine.ask()
  const before = r.engine.s.target
  assert.ok(before)
  // Five minutes of the reef breathing. The COMPREHENSION budget is the child's.
  for (let i = 0; i < 1200; i++) r.tick(250)
  assert.equal(r.engine.s.target, before, 'the target must be the same object it was')
  assert.equal(r.reports.length, 0, 'nothing may be reported without the child acting')
})

test('a polyp sits in the mouth indefinitely and comes back for nothing', () => {
  const r = rig({ seed: 66 })
  r.engine.seed()
  r.engine.ask()
  const cell = polyps(r.engine.s.board)[0]?.cell
  assert.ok(cell !== undefined)
  const value = at(r.engine.s.board, cell)?.value ?? 0
  const massBefore = reefMass(r.engine.s.board)
  r.engine.s.mouth.slots = 3
  r.engine.s.target = impossible(r.engine.s.target as Target)
  r.engine.feed(cell)
  for (let i = 0; i < 400; i++) r.tick(250)
  assert.equal(r.engine.s.mouth.fed.length, 1, 'the mouth must not empty itself on a timer')
  r.engine.retract(0)
  assert.equal(r.engine.s.mouth.fed.length, 0)
  assert.ok(
    polyps(r.engine.s.board).some((p) => p.value === value),
    'the polyp has to come back exactly as it was',
  )
  assert.ok(reefMass(r.engine.s.board) >= massBefore, 'retraction may never cost the reef anything')
})

/* ------------------------------------------------------------------ spills */

test('a spill never loses reef mass, and always hands back at least as many polyps', () => {
  const r = rig({ seed: 77 })
  r.engine.ask()
  const t = r.engine.s.target
  assert.ok(t)
  const cells = stage(r.engine, [16, 8, 4, 1])
  r.engine.s.mouth.slots = 2
  r.engine.s.target = impossible(t, 2)
  const massBefore = reefMass(r.engine.s.board)
  const countBefore = polyps(r.engine.s.board).length
  r.engine.feed(cells[0] as number)
  r.engine.feed(cells[1] as number)
  assert.equal(r.engine.s.mouth.fed.length, 0, 'a full-and-short mouth resolves')
  assert.equal(r.engine.s.spills, 1)
  assert.equal(reefMass(r.engine.s.board), massBefore, 'the reef lost value in a spill')
  assert.ok(
    polyps(r.engine.s.board).length > countBefore,
    'the cost of a wrong answer is MORE polyps to merge, and it must be visible',
  )
})

test('after a spill the target is still up and still buildable', () => {
  const r = rig({ seed: 88 })
  r.engine.seed()
  r.engine.ask()
  const t = r.engine.s.target
  assert.ok(t)
  const before = t.value
  const here = polyps(r.engine.s.board)
  // Feed the two largest, which almost never make the target.
  const two = [...here].sort((a, b) => b.value - a.value).slice(0, 2)
  r.engine.s.mouth.slots = 2
  r.engine.s.target = { ...t, slots: 2 }
  for (const p of two) r.engine.feed(p.cell)
  assert.equal(r.engine.s.target?.value, before, 'a wrong answer never takes the question away')
  // The reef re-stocks whatever the spill could not put back, then it is buildable.
  for (let i = 0; i < 40; i++) r.tick(330)
  const bag = bagOf(polyps(r.engine.s.board).map((p) => p.value))
  const tt = r.engine.s.target
  assert.ok(tt)
  assert.ok(
    routeIn(bag, tt.value, tt.form, tt.slots) !== null || r.engine.s.stock.length > 0,
    'a target must never become permanently unbuildable',
  )
})

/* ------------------------------------------------------------------ growth */

test('the shelf grows on the bloom that earns it, and never beyond the glass', () => {
  const r = rig({ seed: 99, cols: 6, rows: 7 })
  r.engine.seed()
  r.engine.ask()
  const startCells = r.engine.s.board.cells.length
  let grew = 0
  for (let i = 0; i < GROW_EVERY * 3; i++) {
    const t = r.engine.s.target
    assert.ok(t)
    const cells = stage(r.engine, [...t.route])
    r.engine.s.mouth.slots = t.slots
    const events: Event[] = []
    for (const c of cells) events.push(...r.engine.feed(c))
    grew += events.filter((e) => e.kind === 'grow').length
  }
  assert.equal(grew, 3, `expected three growths in ${GROW_EVERY * 3} blooms, saw ${grew}`)
  assert.ok(r.engine.s.board.cells.length > startCells)
  // ...and it stops at the cap it was given, rather than growing off the screen.
  for (let i = 0; i < 60; i++) {
    const t = r.engine.s.target
    if (!t) break
    const cells = stage(r.engine, [...t.route])
    r.engine.s.mouth.slots = t.slots
    for (const c of cells) r.engine.feed(c)
  }
  assert.ok(r.engine.s.board.cols <= 8)
  assert.ok(r.engine.s.board.rows <= 9)
})

/* -------------------------------------------------------------------- save */

test('a save round-trips, and a polyp left in the mouth comes back to the shelf', () => {
  const a = rig({ seed: 123 })
  a.engine.seed()
  a.engine.ask()
  a.engine.s.depth = 11
  const cell = polyps(a.engine.s.board)[0]?.cell
  assert.ok(cell !== undefined)
  const heldValue = at(a.engine.s.board, cell)?.value ?? 0
  a.engine.s.mouth.slots = 3
  a.engine.s.target = impossible(a.engine.s.target as Target)
  a.engine.feed(cell)
  const mass = reefMass(a.engine.s.board) + heldValue
  const snap = a.engine.snapshot()

  const b = rig({ seed: 123 })
  const away = b.engine.restore(snap)
  assert.ok(away >= 0)
  assert.equal(b.engine.s.depth, 11)
  assert.equal(b.engine.s.mouth.fed.length, 0, 'nothing may resume mid-answer against a new target')
  assert.equal(reefMass(b.engine.s.board), mass, 'the polyp in the mouth has to come home')
})

test('a save from an older reef is refused rather than half-read', () => {
  const r = rig({ seed: 5 })
  assert.throws(() => r.engine.restore(JSON.stringify({ essence: 4000, cells: [] })))
  assert.throws(() => r.engine.restore('not json'))
})

test('away time arrives as polyps and nothing else — no gate, no question', () => {
  const r = rig({ seed: 200 })
  r.engine.seed(4)
  r.engine.ask()
  const before = polyps(r.engine.s.board).length
  const events = r.engine.returnAfter(3 * 60 * 60 * 1000)
  assert.ok(polyps(r.engine.s.board).length > before || emptyCells(r.engine.s.board).length === 0)
  assert.deepEqual(
    events.map((e) => e.kind),
    ['grew-away'],
  )
  assert.equal(r.reports.length, 0, 'coming back must never ask a child anything')
})

/* ------------------------------------------------------------------ splits */

test('splitting is refused, harmlessly, on a seed polyp', () => {
  const r = rig({ seed: 300 })
  const cells = stage(r.engine, [15])
  const events = r.engine.split(cells[0] as number)
  assert.deepEqual(events, [{ kind: 'refuse', why: 'no-halves' }])
  assert.equal(at(r.engine.s.board, cells[0] as number)?.value, 15)
  assert.equal(r.engine.s.splits, 0)
})

test('splitting a 14 is how a shelf makes the 7 that 23 needs', () => {
  const r = rig({ seed: 301 })
  const cells = stage(r.engine, [16, 14])
  r.engine.split(cells[1] as number)
  const bag = bagOf(polyps(r.engine.s.board).map((p) => p.value))
  assert.deepEqual(routeIn(bag, 23, 'sum', 2), [16, 7])
})

test('the engine itself refuses to report an item twice, even against a host that would let it', () => {
  // The stub host guards too, and so does `packs/shared/game-host` — which is
  // exactly why this test uses NEITHER. A guard whose only proof is somebody
  // else's guard is not a guard.
  const seen: string[] = []
  let clock = 0
  const bare = {
    next: (o?: { difficulty?: number }) => {
      void o
      return { id: 'only-one', prompt: '9 + 9', answer: '18' }
    },
    report: (r: { questionId: string }) => seen.push(r.questionId),
  }
  const engine = new Engine({
    host: bare,
    rng: makeRng(1),
    now: () => clock,
    limit: () => ({ maxCols: 8, maxRows: 9 }),
  })
  engine.ask()
  const t = engine.s.target as Target
  assert.equal(t.questionId, 'only-one')

  // Resolve the same target twice over, which is what a double-tap on the last
  // slot or a re-entrant event would do.
  for (let round = 0; round < 3; round++) {
    const cells = stage(engine, [1, 1])
    engine.s.target = { ...t, value: 999_999, form: 'sum', slots: 2, route: [] }
    engine.s.mouth.slots = 2
    clock += 100
    engine.feed(cells[0] as number)
    engine.feed(cells[1] as number)
  }
  assert.deepEqual(seen, ['only-one'], `the same item was reported ${seen.length} times`)
})
