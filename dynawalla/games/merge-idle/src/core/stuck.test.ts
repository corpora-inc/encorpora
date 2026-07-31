/**
 * NO REACHABLE BOARD MAY BE UNSOLVABLE.
 *
 * `game.ts` tells a child, in as many words: *"You can never get stuck. CLEAR
 * always works."* In 0.3.7 that sentence was false, and the founder played it and
 * said so:
 *
 *   "the board fills up with high numbers and it becomes impossible 10 = ___ -
 *    ___ .... then I hit clear and one goes away and the next polyp to come .. is
 *    18 .. the polyps should start as low numbers"
 *
 *   "____ + ____ = 5 and EVERY FREAKING NUMBER is like above 18"
 *
 * Three separate faults met to produce that board, and there is a test here for
 * each:
 *
 *   1. **Emission ignored the target.** A fresh polyp was `strain * 2 ** baseStep`
 *      and `baseStep` came from DEPTH, so past six blooms the reef could not cough
 *      out an odd number at all — and a sum of even polyps is even, so `5` was
 *      unmakeable no matter how long a child played.
 *   2. **The debt was computed once.** The reef worked out what it owed when the
 *      target went up and then never again, so a child who merged the last term of
 *      their own route into something bigger left the target unbuildable with the
 *      reef owing nothing.
 *   3. **CLEAR freed one value class**, which on a shelf of forty distinct numbers
 *      is one cell — filled again on the next breath.
 *
 * `the founder's board` below reproduces all three against the real `Engine`
 * through nothing but public methods, and it FAILS on the code that shipped.
 */

import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { Engine, ESCAPE_CELLS } from './engine.ts'
import { at, emptyCells, hasLegalMerge, place, polyps } from './board.ts'
import { canSplit, decompose } from './ladder.ts'
import { makeRng } from './rng.ts'
import { bagOf, ladderRoute, ladderValues, routeIn } from './target.ts'
import { makeStubHost } from '../stubHost.ts'
import type { AskHost } from './ask.ts'

const LIMIT = { maxCols: 8, maxRows: 9 }
const STEP_MS = 220

/** A host that asks for one number, forever. `5` is the founder's own example. */
function fixedHost(answer: number): AskHost & { report(r: unknown): void } {
  let n = 0
  return {
    next: () => ({ id: `fixed-${n++}`, prompt: `? = ${answer}`, answer: String(answer) }),
    skip: () => {},
    focus: () => {},
    report: () => {},
  }
}

function makeEngine(host: AskHost & { report(r: never): void }, seed: number): Engine {
  let clock = 0
  return new Engine({
    host: host as never,
    rng: makeRng(seed),
    now: () => (clock += 1),
    limit: () => LIMIT,
    cols: 6,
    rows: 7,
  })
}

/** Put the shelf in a named state through `restore`, which is a shipped entry point. */
function loadShelf(engine: Engine, depth: number, values: readonly number[]): void {
  engine.restore(
    JSON.stringify({
      v: 2,
      depth,
      grows: 0,
      cols: 6,
      rows: 7,
      cells: values.map((v, i) => [i, v]),
      mouth: [],
      lastSeen: Date.now(),
    }),
  )
}

/**
 * Thirty-nine ladder values, none under 18, no two the same, and not one of them
 * on the 5-ladder — the founder's shelf.
 *
 * Distinct because a repeated value is a merge and a merge is a way out. Off the
 * 5-ladder because splitting is the other way out: 20 halves to 10 halves to 5, so
 * a shelf with a 20 on it can still reach `5` with its bare hands. Excluding
 * strain 2 is what makes this board genuinely unmakeable without the reef's help,
 * which is the position the founder was actually handed.
 */
const HIGH = ladderValues()
  .filter((v) => v >= 18 && decompose(v)?.strain !== 2)
  .slice(0, 39)

/**
 * A patient child. Feeds the route when there is one, otherwise joins a pair,
 * otherwise splits, otherwise presses CLEAR. Returns true if the reef bloomed.
 *
 * Deliberately not clever: everything it does is something the glass affords with
 * one finger, and it never reads a private field.
 */
function playUntilBloom(engine: Engine, steps: number): boolean {
  for (let i = 0; i < steps; i++) {
    engine.tick(STEP_MS)
    const s = engine.s
    if (!s.target) return true

    const bag = bagOf(polyps(s.board).map((p) => p.value))
    const route = routeIn(bag, s.target.value, s.target.form, s.target.slots)
    if (route) {
      let bloomed = false
      for (const want of route) {
        const cell = polyps(s.board).find((p) => p.value === want)?.cell
        if (cell === undefined) break
        for (const ev of engine.feed(cell)) if (ev.kind === 'bloom') bloomed = true
      }
      if (bloomed) return true
      continue
    }

    const byValue = new Map<number, number[]>()
    for (const p of polyps(s.board)) {
      const list = byValue.get(p.value) ?? []
      list.push(p.cell)
      byValue.set(p.value, list)
    }
    let acted = false
    for (const v of [...byValue.keys()].sort((a, z) => z - a)) {
      const cells = byValue.get(v)
      if (!cells || cells.length < 2) continue
      if (engine.merge(cells[0] as number, cells[1] as number)) {
        acted = true
        break
      }
    }
    if (acted) continue
    if (emptyCells(s.board).length < 2) engine.dissolve()
  }
  return false
}

/* ------------------------------------------------------------ the founder's board */

test('the founder’s board: 5 = ▢ + ▢ + ▢ on a shelf of nothing under 18', () => {
  // Depth 6, because that is where `baseStepFor` used to cross 1 — and past that
  // rung the shipped emitter could only ever produce EVEN numbers, so an odd
  // target became arithmetically unmakeable and stayed that way for good.
  const engine = makeEngine(fixedHost(5), 20260728)
  // Forty numbers no smaller than 18, and the route to five: 4 + 1. A second 4 so
  // there is a legal join on the shelf, which is what the child spends.
  loadShelf(engine, 6, [...HIGH, 1, 4, 4])
  assert.equal(emptyCells(engine.s.board).length, 0, 'the shelf must start full')

  engine.ask()
  const t = engine.s.target
  assert.ok(t, 'a target must be up')
  assert.equal(t.value, 5)
  assert.equal(t.form, 'sum')
  assert.ok(engine.reachable(), '5 = 4 + 1 is on the shelf when the target goes up')
  assert.equal(engine.s.stock.length, 0, 'a shelf that can already answer is owed nothing')

  // The child joins their two 4s — a legal, ordinary, sensible move, and the last
  // odd-capable route to 5 goes with it.
  const fours = polyps(engine.s.board).filter((p) => p.value === 4)
  assert.equal(fours.length, 2)
  assert.ok(engine.merge((fours[0] as { cell: number }).cell, (fours[1] as { cell: number }).cell))
  assert.equal(engine.reachable(), false, 'the shelf can no longer build 5 — this is the moment')
  // Nothing on this shelf is on the 5-ladder, so no amount of joining or halving
  // produces a five: the reef has to owe one, and it has to know that it does.
  assert.deepEqual(engine.s.stock, [5], 'the reef must owe the five')
  assert.equal(engine.solvable(), true, 'and the position must still be winnable')

  // From here the child is patient and does everything the glass affords, CLEAR
  // included. The reef must give them a five.
  assert.ok(
    playUntilBloom(engine, 400),
    `5 never became makeable. shelf: [${polyps(engine.s.board)
      .map((p) => p.value)
      .sort((a, b) => a - b)
      .join(', ')}]`,
  )
})

test('the reef owes the polyps the target needs the moment the shelf stops holding them', () => {
  const engine = makeEngine(fixedHost(5), 20260728)
  loadShelf(engine, 6, [...HIGH, 1, 4, 4])
  engine.ask()
  const fours = polyps(engine.s.board).filter((p) => p.value === 4)
  engine.merge((fours[0] as { cell: number }).cell, (fours[1] as { cell: number }).cell)

  // The repair, stated directly: a merge that spends the route leaves a DEBT.
  assert.equal(engine.reachable(), false)
  assert.deepEqual(engine.s.stock, [5], 'the reef must owe the five it can no longer be built out of')
  assert.equal(engine.solvable(), true)
})

/* ------------------------------------------------------------------------ CLEAR */

test('CLEAR always works: a full shelf is always opened up, and SPLIT works again', () => {
  const engine = makeEngine(fixedHost(5), 7)
  loadShelf(engine, 6, [...HIGH, 1, 4, 4])
  engine.ask()
  const fours = polyps(engine.s.board).filter((p) => p.value === 4)
  engine.merge((fours[0] as { cell: number }).cell, (fours[1] as { cell: number }).cell)
  while (emptyCells(engine.s.board).length > 0) engine.tick(STEP_MS)
  assert.equal(emptyCells(engine.s.board).length, 0, 'the shelf is full again')

  // The founder's exact complaint about the old CLEAR: "only one goes away".
  const events = engine.dissolve()
  const cleared = events.find((e) => e.kind === 'dissolve')
  assert.ok(cleared, 'CLEAR must do something on a full shelf')
  const free = emptyCells(engine.s.board).length
  assert.ok(
    free >= ESCAPE_CELLS,
    `CLEAR left ${free} cells, which is under the ${ESCAPE_CELLS} a debt can need — not an escape`,
  )
  assert.ok(
    engine.s.stock.length <= free,
    `the reef owes ${engine.s.stock.length} polyps into ${free} cells`,
  )

  // "88 on a full board so you can't even split it" — a split needs a free cell,
  // so an escape that does not restore one has not restored the game either.
  const big = polyps(engine.s.board).find((p) => canSplit(p.value))
  assert.ok(big, 'the shelf still holds something halvable')
  const before = engine.s.splits
  engine.split(big.cell)
  assert.equal(engine.s.splits, before + 1, 'SPLIT must be possible again after CLEAR')
})

test('CLEAR is offered before the shelf jams solid, and never when there is already room', () => {
  const engine = makeEngine(fixedHost(5), 11)
  // ONE free cell — not jammed, but nowhere near enough to pay a debt into and
  // one drag away from being jammed. Waiting for the last cell to go before
  // offering the way out is a minute of a child watching nothing happen.
  loadShelf(engine, 6, [...HIGH.slice(0, 38), 1, 4, 4])
  engine.ask()
  assert.equal(emptyCells(engine.s.board).length, 1, 'the shelf must have exactly one cell left')
  assert.equal(engine.needsRoom, true, 'one free cell is not room')

  engine.dissolve()
  assert.ok(
    emptyCells(engine.s.board).length >= ESCAPE_CELLS,
    'CLEAR must leave at least the slack it promises',
  )
  assert.equal(engine.needsRoom, false, 'a shelf CLEAR has just opened up does not need more')
})

/* ------------------------------------------------------------- the emission band */

test('the reef never coughs out anything but a seed', () => {
  const seen = new Set<number>()
  for (let seed = 1; seed <= 8; seed++) {
    const engine = drive(seed, 500, (value, owed) => {
      if (owed) return
      seen.add(value)
      const id = decompose(value)
      assert.ok(id, `${value} is off the ladder`)
      assert.equal(id.step, 0, `the reef coughed out a ${value}; only seeds may be emitted`)
    })
    void engine
  }
  // And all eight seeds do actually appear, so "only seeds" is not "only 1".
  assert.equal(seen.size, 8, `only saw ${[...seen].sort((a, b) => a - b).join(', ')}`)
})

test('the strains the reef emits are strains the target can actually use', () => {
  let onRoute = 0
  let total = 0
  for (let seed = 1; seed <= 6; seed++) {
    drive(seed, 500, (value, owed, engine) => {
      if (owed) return
      const t = engine.s.target
      if (!t) return
      // The route the target is made of RIGHT NOW — recomputed here out of the
      // two exported pure functions rather than read off the engine, so this
      // measures the emitter against the arithmetic and not against itself.
      const bag = bagOf(polyps(engine.s.board).map((p) => p.value))
      const route = routeIn(bag, t.value, t.form, t.slots) ?? ladderRoute(t.value, t.form, t.slots)
      if (!route) return
      const mine = decompose(value)?.strain
      const wanted = new Set(route.map((v) => decompose(v)?.strain))
      total++
      if (wanted.has(mine)) onRoute++
    })
  }
  assert.ok(total > 200, `only ${total} ambient emissions measured`)
  const share = onRoute / total
  console.log(
    `   ${onRoute} of ${total} ambient arrivals (${(share * 100).toFixed(1)}%) were on a strain ` +
      `the target can use`,
  )
  // A polyp's strain is its odd part and merging only doubles, so a strain the
  // target does not use can never take part in answering it. Most of what arrives
  // must be able to; one draw in four is deliberately wider, because a shelf
  // carrying two strains is a shelf where every polyp is a duplicate.
  assert.ok(share > 0.6, `only ${(share * 100).toFixed(1)}% of arrivals could take part in the answer`)
})

/* ------------------------------------------------ the invariant, over real play */

test('no state a child can reach is unsolvable, over many seeds and every form', () => {
  let worstIdle = 0
  let worstSeed = 0
  let early = 0
  for (let seed = 1; seed <= 16; seed++) {
    const engine = playSession(seed, 2500, (e, where) => {
      assert.ok(
        e.solvable(),
        `seed ${seed}: unsolvable after ${where} — target ${e.s.target?.value} ` +
          `(${e.s.target?.form}), owes [${e.s.stock.join(', ')}], shelf [${polyps(e.s.board)
            .map((p) => p.value)
            .sort((a, b) => a - b)
            .join(', ')}]`,
      )
    })
    if (engine.idle > worstIdle) {
      worstIdle = engine.idle
      worstSeed = seed
    }
    early = Math.max(early, engine.earlyIdle)
    assert.ok(engine.depth > 60, `seed ${seed} only bloomed ${engine.depth} times in 2500 steps`)
  }
  console.log(
    `   longest a single target ever stayed up: ${worstIdle} steps (seed ${worstSeed}); ` +
      `${early} inside the first forty blooms`,
  )
  // The shipped build sat on ONE target for the whole run — 3,891 steps of a child
  // looking at a number they could not make, which is 97% of the session. Two
  // ceilings, because the interesting one is the early game: the founder was six
  // blooms in, and a child who has not yet built a big reef has nothing to grind
  // with. Later on a four-figure target legitimately IS a lot of joining, which is
  // the game the founder asked for — big numbers are earned, never handed out.
  assert.ok(early < 150, `a target stayed up ${early} steps inside the first forty blooms`)
  assert.ok(
    worstIdle < 833,
    `a target stayed up for ${worstIdle} steps on seed ${worstSeed} — a third of the session`,
  )
})

/* ----------------------------------------------------------------------- drivers */

/** Run a session, reporting every emission. `owed` is true for a debt payment. */
function drive(
  seed: number,
  steps: number,
  onEmit: (value: number, owed: boolean, engine: Engine) => void,
): Engine {
  const host = makeStubHost({ seed: seed ^ 0x51ed })
  const engine = makeEngine(host as never, seed)
  engine.seed()
  engine.ask()
  for (let i = 0; i < steps; i++) {
    const owed = engine.s.stock.length > 0
    for (const ev of engine.tick(STEP_MS)) if (ev.kind === 'emit') onEmit(ev.value, owed, engine)
    step(engine)
  }
  return engine
}

/** A whole session with the invariant checked after every single action. */
function playSession(
  seed: number,
  steps: number,
  check: (e: Engine, where: string) => void,
): { depth: number; idle: number; earlyIdle: number } {
  const host = makeStubHost({ seed: seed ^ 0x51ed })
  const engine = makeEngine(host as never, seed)
  engine.seed()
  engine.ask()
  check(engine, 'ask')
  let idle = 0
  let worst = 0
  let early = 0
  let lastDepth = 0
  for (let i = 0; i < steps; i++) {
    engine.tick(STEP_MS)
    check(engine, 'tick')
    step(engine, (where) => check(engine, where))
    if (engine.s.depth !== lastDepth) {
      lastDepth = engine.s.depth
      idle = 0
    } else {
      idle++
      if (idle > worst) worst = idle
      if (engine.s.depth < 40 && idle > early) early = idle
    }
  }
  return { depth: engine.s.depth, idle: worst, earlyIdle: early }
}

/**
 * One turn a child could take: feed the route, else join a pair, else split,
 * else press CLEAR. `after` runs between every single engine call.
 */
function step(engine: Engine, after: (where: string) => void = () => {}): void {
  const s = engine.s
  if (!s.target) return
  const bag = bagOf(polyps(s.board).map((p) => p.value))
  const route = s.mouth.fed.length === 0 ? routeIn(bag, s.target.value, s.target.form, s.target.slots) : null
  if (route) {
    for (const want of route) {
      const cell = polyps(s.board).find((p) => p.value === want)?.cell
      if (cell === undefined) break
      engine.feed(cell)
      after('a feed')
      if (s.mouth.fed.length === 0) break // the mouth resolved
    }
    return
  }
  // Joins are made TOWARD the number at the top, which is what a child does and
  // what the shipped bots did not: joining the largest pair on the shelf every
  // time climbs away from the answer and turns an ordinary target into a grind.
  const want = ladderRoute(s.target.value, s.target.form, s.target.slots) ?? []
  const ceiling = want.reduce((a, b) => Math.max(a, b), 0)
  const byValue = new Map<number, number[]>()
  for (const p of polyps(s.board)) {
    const list = byValue.get(p.value) ?? []
    list.push(p.cell)
    byValue.set(p.value, list)
  }
  const pairs = [...byValue.keys()].filter((v) => (byValue.get(v) ?? []).length >= 2)
  const useful = pairs.filter((v) => v * 2 <= ceiling).sort((a, z) => z - a)
  for (const v of [...useful, ...pairs.sort((a, z) => a - z)]) {
    const cells = byValue.get(v)
    if (!cells || cells.length < 2) continue
    if (engine.merge(cells[0] as number, cells[1] as number)) {
      after('a join')
      return
    }
  }
  if (emptyCells(s.board).length < 2 || !hasLegalMerge(s.board)) {
    engine.dissolve()
    after('CLEAR')
    return
  }
  const half = polyps(s.board)
    .filter((p) => canSplit(p.value))
    .sort((a, z) => z.value - a.value)[0]
  if (half) {
    engine.split(half.cell)
    after('a split')
  }
}

/** Kept honest: `place` and `at` are the shelf's only writers. */
void place
void at
