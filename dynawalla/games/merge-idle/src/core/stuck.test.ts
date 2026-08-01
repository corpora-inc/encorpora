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
 *
 * ## What 0.3.9 adds, and why the file grew
 *
 * 0.3.8 fixed the emitter and the debt. The founder played it and was still stuck,
 * for three reasons that are all here too:
 *
 *   4. **CLEAR took the wrong polyps.** It climbed from the SMALLEST, so it ate the
 *      1, 3, 5 and 7 a small target is answered with and left the giants — *"'clear'
 *      tends to just take out the good (small) numbers"*. It now wipes the shelf.
 *   5. **A save from 0.3.7 was a permanent junk board.** The emitter fix reached
 *      nobody who already had one, which was every tester. `a 0.3.7 save full of
 *      old-emitter junk` is that save, byte for byte.
 *   6. **Nothing ever left the shelf.** A polyp was permanent unless the mouth
 *      happened to call for it, so the board could only accumulate. A bloom now
 *      shuffles, sweeps the top and re-seeds.
 */

import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { Engine, ESCAPE_CELLS, SAVE_VERSION, STALE_SHELF_VERSION } from './engine.ts'
import { at, emptyCells, place, polyps } from './board.ts'
import { CLEAR_SEEDS, UNDERTOW_FLOOR } from './economy.ts'
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
      v: SAVE_VERSION,
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

test('CLEAR wipes the wall of giants and leaves a shelf a small target can be built from', () => {
  const engine = makeEngine(fixedHost(5), 7)
  loadShelf(engine, 6, [...HIGH, 1, 4, 4])
  engine.ask()
  const fours = polyps(engine.s.board).filter((p) => p.value === 4)
  engine.merge((fours[0] as { cell: number }).cell, (fours[1] as { cell: number }).cell)
  while (emptyCells(engine.s.board).length > 0) engine.tick(STEP_MS)
  assert.equal(emptyCells(engine.s.board).length, 0, 'the shelf is full again')
  const giantsBefore = polyps(engine.s.board).filter((p) => p.value >= 18).length
  assert.ok(giantsBefore >= 30, `only ${giantsBefore} giants on the founder's shelf`)

  const events = engine.dissolve()
  const cleared = events.find((e) => e.kind === 'dissolve')
  assert.ok(cleared, 'CLEAR must do something on a full shelf')
  assert.equal(cleared.cells.length, 42, 'CLEAR takes the WHOLE shelf, not a value class')

  // The founder's complaint about the 0.3.8 CLEAR, which is the opposite of the
  // 0.3.7 one: it took the small useful polyps and left the giants standing.
  assert.equal(
    polyps(engine.s.board).filter((p) => p.value >= 18).length,
    0,
    'not one of the accumulated giants may survive CLEAR',
  )
  const left = polyps(engine.s.board)
  assert.equal(left.length, CLEAR_SEEDS, 'CLEAR hands back the eight a fresh reef opens with')
  for (const p of left) {
    assert.equal(decompose(p.value)?.step, 0, `CLEAR left a ${p.value}; only seeds may come back`)
  }
  const free = emptyCells(engine.s.board).length
  assert.ok(
    free >= ESCAPE_CELLS,
    `CLEAR left ${free} cells, which is under the ${ESCAPE_CELLS} a debt can need — not an escape`,
  )
  assert.ok(
    engine.s.stock.length <= free,
    `the reef owes ${engine.s.stock.length} polyps into ${free} cells`,
  )
  assert.equal(engine.solvable(), true, 'the position after CLEAR must be winnable')

  // "88 on a full board so you can't even split it" — a split needs a free cell,
  // so an escape that does not restore one has not restored the game either.
  // Nothing on a re-seeded shelf halves (they are all seeds), so put an 88 back on
  // it and check the gesture the jammed board refused.
  const spare = emptyCells(engine.s.board)[0]
  assert.ok(spare !== undefined, 'CLEAR left somewhere to put it')
  assert.ok(place(engine.s.board, spare, 88), 'the 88 goes back on the shelf')
  const before = engine.s.splits
  engine.split(spare)
  assert.equal(engine.s.splits, before + 1, 'SPLIT must be possible again after CLEAR')
  assert.equal(at(engine.s.board, spare)?.value, 44, 'and the 88 is now a pair of 44s')
})

test('CLEAR is always pressable, and glows once the shelf is short of room', () => {
  const engine = makeEngine(fixedHost(5), 11)
  // ONE free cell — not jammed, but nowhere near enough to pay a debt into and
  // one drag away from being jammed. Waiting for the last cell to go before
  // offering the way out is a minute of a child watching nothing happen.
  loadShelf(engine, 6, [...HIGH.slice(0, 38), 1, 4, 4])
  engine.ask()
  assert.equal(emptyCells(engine.s.board).length, 1, 'the shelf must have exactly one cell left')
  assert.equal(engine.needsRoom, true, 'one free cell is not room')
  assert.equal(engine.canClear, true, 'a shelf with polyps on it can always be cleared')

  engine.dissolve()
  assert.ok(
    emptyCells(engine.s.board).length >= ESCAPE_CELLS,
    'CLEAR must leave at least the slack it promises',
  )
  assert.equal(engine.needsRoom, false, 'a shelf CLEAR has just opened up does not need more')
  // And it is STILL pressable — the founder wants to be able to shake the reef up
  // whenever he likes, not only once it has jammed.
  assert.equal(engine.canClear, true, 'CLEAR is never greyed out while there is a polyp')
})

test('CLEAR is pressable on a roomy shelf a child simply does not like', () => {
  const engine = makeEngine(fixedHost(5), 13)
  loadShelf(engine, 6, [96, 96, 96])
  assert.ok(emptyCells(engine.s.board).length > ESCAPE_CELLS, 'this shelf has plenty of room')
  assert.equal(engine.needsRoom, false, 'and so it does not glow')
  assert.equal(engine.canClear, true, 'but it is still pressable')
  const events = engine.dissolve()
  assert.ok(
    events.some((e) => e.kind === 'dissolve'),
    'pressing CLEAR on a roomy shelf must still clear it',
  )
  assert.equal(
    polyps(engine.s.board).some((p) => p.value === 96),
    false,
    'the numbers the child wanted rid of are gone',
  )
})

test('CLEAR does nothing at all on an empty shelf, and is not offered there', () => {
  const engine = makeEngine(fixedHost(5), 17)
  loadShelf(engine, 6, [])
  assert.equal(polyps(engine.s.board).length, 0)
  assert.equal(engine.canClear, false, 'there is nothing to clear')
  assert.equal(engine.dissolve().length, 0, 'and pressing it must not re-seed out of nowhere')
})

/* --------------------------------------------------- the save he is actually in */

/**
 * The exact 0.3.7 shelf, written by the old emitter: `strain * 2 ** baseStepFor
 * (depth)` at depth 30, so `baseStep` is 5 and every polyp is a seed times 32.
 * Not one of these values is something the current reef could ever hand out, and
 * a shelf of nothing but them is the founder's *"bunch of irrelevant crap
 * numbers"*.
 */
const OLD_EMITTER_SHELF: readonly number[] = Array.from(
  { length: 42 },
  (_, i) => ([1, 3, 5, 7, 9, 11, 13, 15][i % 8] as number) * 32,
)

/** The literal bytes 0.3.7 wrote into `dynawalla.abyssal-bloom.v1`. */
function stale037Save(depth: number, values: readonly number[]): string {
  return JSON.stringify({
    v: STALE_SHELF_VERSION,
    depth,
    grows: 4,
    cols: 8,
    rows: 9,
    cells: values.map((v, i) => [i, v]),
    mouth: [],
    lastSeen: Date.now(),
  })
}

test('a 0.3.7 save full of old-emitter junk loads into a shelf that is not stuck', () => {
  const engine = makeEngine(fixedHost(5), 20260728)
  engine.restore(stale037Save(30, OLD_EMITTER_SHELF))

  // Every one of them is gone. This is the whole defect: 0.3.8 fixed the emitter
  // and did nothing for a player who already had a save, which was every tester.
  const left = polyps(engine.s.board)
  assert.equal(left.length, CLEAR_SEEDS, `the stale shelf left ${left.length} polyps behind`)
  for (const p of left) {
    assert.equal(decompose(p.value)?.step, 0, `a ${p.value} survived the migration; only seeds may`)
  }
  assert.equal(
    left.some((p) => OLD_EMITTER_SHELF.includes(p.value)),
    false,
    'not one of the old numbers may come back',
  )

  // And nothing else was taken. Depth is the only progress this game has: it is
  // what brightens the water, unlocks the operator forms, sizes the ask and pays
  // the bloom yield.
  assert.equal(engine.s.depth, 30, 'depth must survive the migration')
  assert.equal(engine.s.grows, 4, 'and the growths that earned the bigger shelf')
  assert.equal(engine.s.board.cols, 8, 'and the shelf he grew')
  assert.equal(engine.s.board.rows, 9)

  // The founder's actual situation, stated as the thing he could not do: play.
  engine.ask()
  assert.equal(engine.solvable(), true, 'a migrated shelf must be a winnable position')
  assert.ok(
    playUntilBloom(engine, 400),
    `never bloomed after migrating. shelf: [${polyps(engine.s.board)
      .map((p) => p.value)
      .sort((a, b) => a - b)
      .join(', ')}]`,
  )

  // And it is written back as v3, so the migration happens once and never again.
  assert.equal(JSON.parse(engine.snapshot()).v, SAVE_VERSION)
})

test('a v3 save keeps the shelf it was written with', () => {
  const engine = makeEngine(fixedHost(5), 3)
  loadShelf(engine, 6, [1, 3, 5, 7, 96])
  assert.deepEqual(
    polyps(engine.s.board)
      .map((p) => p.value)
      .sort((a, z) => a - z),
    [1, 3, 5, 7, 96],
    'the migration must not fire on a save this build wrote',
  )
})

test('a save from a schema this reef has never seen is refused rather than misread', () => {
  const engine = makeEngine(fixedHost(5), 3)
  assert.throws(() => engine.restore(JSON.stringify({ v: 1, depth: 9, cells: [[0, 3]] })), /older reef/)
})

/* --------------------------------------------------------------- the turnover */

test('a bloom carries the biggest polyps off the shelf and shakes the rest', () => {
  const engine = makeEngine(fixedHost(5), 20260728)
  // Twelve giants and the route to five, so the bloom is one feed away and the
  // shelf it blooms on is exactly the accumulation the founder is complaining of.
  loadShelf(engine, 6, [512, 256, 128, 96, 88, 80, 72, 64, 56, 48, 40, 32, 5])
  engine.ask()
  const before = polyps(engine.s.board).map((p) => p.value)
  const five = polyps(engine.s.board).find((p) => p.value === 5)
  assert.ok(five, 'the shelf holds the five')

  const events = engine.feed(five.cell)
  assert.ok(
    events.some((e) => e.kind === 'bloom'),
    'feeding the five must bloom',
  )
  const swept = events.find((e) => e.kind === 'undertow')
  assert.ok(swept, 'a bloom must carry something off a shelf of thirteen')
  // Thirteen polyps, one eaten by the mouth: twelve left, a quarter of which is 3.
  assert.equal(swept.cells.length, 3, `the undertow took ${swept.cells.length}`)
  assert.equal(swept.gained, 512 + 256 + 128, 'and it took them off the TOP')
  assert.equal(
    polyps(engine.s.board).some((p) => p.value === 512),
    false,
    'the biggest number on the shelf is exactly what a bloom is supposed to clear',
  )
  assert.ok(
    events.some((e) => e.kind === 'shuffle'),
    'and the survivors are shaken up',
  )
  assert.ok(
    events.some((e) => e.kind === 'emit'),
    'and fresh polyps land in the churn',
  )
  assert.ok(before.length > 0)
})

test('a bloom takes nothing off a sparse shelf — a reward may not feel like a tax', () => {
  const engine = makeEngine(fixedHost(5), 5)
  loadShelf(engine, 6, [5, 96, 48])
  assert.ok(polyps(engine.s.board).length <= UNDERTOW_FLOOR, 'this shelf is under the floor')
  engine.ask()
  const five = polyps(engine.s.board).find((p) => p.value === 5)
  assert.ok(five)
  const events = engine.feed(five.cell)
  assert.ok(events.some((e) => e.kind === 'bloom'))
  assert.equal(
    events.some((e) => e.kind === 'undertow'),
    false,
    'nothing may be carried off a shelf a child has barely started',
  )
  assert.equal(
    polyps(engine.s.board).some((p) => p.value === 96),
    true,
    'the 96 they built is still theirs',
  )
})

test('over a real session no polyp is permanent — the shelf is a different shelf twenty blooms later', () => {
  // The founder's state is a shelf that only ever accumulates: *"I have all of the
  // old numbers from previous versions ... and leaving and coming back doesn't
  // clear."* So the claim to check is about IDENTITY, not about values — every
  // polyp is stamped with one at birth and nothing ever copies it — and it is the
  // claim the old build fails outright: without an undertow a polyp only leaves
  // the shelf if the mouth happens to call for it.
  const host = makeStubHost({ seed: 0x51ed })
  const engine = makeEngine(host as never, 20260728)
  engine.seed()
  engine.ask()
  // Get past the opening so the shelf is a real one, not eight seeds.
  for (let i = 0; i < 4000 && engine.s.depth < 20; i++) {
    engine.tick(STEP_MS)
    step(engine)
  }
  assert.ok(engine.s.depth >= 20, `only reached depth ${engine.s.depth}`)
  const before = new Set(polyps(engine.s.board).map((p) => p.id))
  assert.ok(before.size >= 10, `only ${before.size} polyps on the shelf to measure`)
  const mark = engine.s.depth
  for (let i = 0; i < 4000 && engine.s.depth < mark + 20; i++) {
    engine.tick(STEP_MS)
    step(engine)
  }
  assert.ok(engine.s.depth >= mark + 20, `only reached depth ${engine.s.depth}`)
  const survivors = polyps(engine.s.board).filter((p) => before.has(p.id)).length
  const share = survivors / before.size
  console.log(
    `   twenty blooms on, ${survivors} of ${before.size} polyps are the same ones ` +
      `(${(share * 100).toFixed(1)}%)`,
  )
  assert.ok(
    share < 0.25,
    `${survivors} of ${before.size} polyps sat through twenty blooms — that is the silt`,
  )
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
    // 900 steps and not 500: the reef turns over faster now, so a larger share of
    // what it emits is DEBT — the halves it owes — and those are excluded from
    // this measurement by design. The sample is of ambient draws, so it has to be
    // taken over enough play to still be one.
    drive(seed, 900, (value, owed, engine) => {
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
  // SPLIT before CLEAR, and CLEAR only as the last thing left. This changed when
  // CLEAR became a full wipe: the old bot pressed it whenever the shelf was merely
  // *cramped*, which under the new button throws away a reef the child spent the
  // session building. No player does that — CLEAR is the way out of a position you
  // cannot play, and a bot that spends it casually is modelling nobody. Measured
  // over the same 16 seeds × 2,500 steps: the casual bot bloomed 51 times at worst
  // and sat on one target for 2,200 steps; this one blooms 412 times at worst and
  // never sits longer than 131.
  const half = polyps(s.board)
    .filter((p) => canSplit(p.value))
    .sort((a, z) => z.value - a.value)[0]
  if (half && emptyCells(s.board).length > 0) {
    engine.split(half.cell)
    after('a split')
    return
  }
  engine.dissolve()
  after('CLEAR')
}

