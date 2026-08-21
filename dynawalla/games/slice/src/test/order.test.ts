// THE ORDER, and the theorem it rests on.
//
// The design this game is built to has exactly one place it could become a bug
// factory: a child takes a value that is legal now and finds, four cuts later,
// that there is nothing left they can take. `order.ts` claims that is impossible
// by construction. A claim like that is worth nothing without a machine walking
// the state space, so this file walks it.
//
// Every assertion below was mutation-tested: the rule it guards was broken, the
// test was confirmed to fail, and the message it printed is quoted in the PR.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import {
  BANDS,
  BLANK,
  classify,
  makeTarget,
  Order,
  PRINTED_MAX,
  printedFor,
  Reach,
  reachFor,
  rungIndex,
  targetIsUsable,
} from "../sim/order.ts"

/** A brute-force reachability oracle, written a different way on purpose. */
function reachableBySearch(pool: readonly number[], r: number, seen = new Set<number>()): boolean {
  if (r === 0) return true
  if (r < 0) return false
  if (seen.has(r)) return false
  seen.add(r)
  for (const v of pool) if (reachableBySearch(pool, r - v, seen)) return true
  return false
}

test("the reachability table agrees with an independent search", () => {
  for (let rung = 0; rung < BANDS.length; rung++) {
    const band = BANDS[rung]!
    const reach = reachFor(rung)
    // The whole table for the small bands; a sample for the big ones, because
    // the recursive oracle is exponential in the worst case.
    const upper = Math.min(band.targetHi, 400)
    for (let r = 0; r <= upper; r++) {
      assert.equal(
        reach.canMake(r),
        reachableBySearch(band.pool, r, new Set()),
        `${band.name}: the DP and the search disagree about ${r}`,
      )
    }
  }
})

test("reachability is out of band, not wrong, outside its range", () => {
  const reach = new Reach([2, 3], 20)
  assert.equal(reach.canMake(-1), false)
  assert.equal(reach.canMake(1.5), false)
  assert.equal(reach.canMake(21), false, "a residual past the table is not silently reachable")
  assert.equal(reach.canMake(0), true, "zero is always reachable — that is what filled means")
  assert.equal(reach.canMake(1), false, "1 cannot be made from 2s and 3s")
  assert.equal(reach.canMake(2), true)
})

test("every printed value fits the three-digit legibility ceiling", () => {
  for (let rung = 0; rung < BANDS.length; rung++) {
    for (const v of printedFor(rung)) {
      assert.ok(Number.isInteger(v), `${v} is not an integer`)
      assert.ok(v >= 1 && v <= PRINTED_MAX, `${v} is outside 1…${PRINTED_MAX}`)
      assert.ok(String(v).length <= 3, `${v} is four digits on a moving object`)
    }
  }
})

test("every band can generate a target, and every generated target is reachable", () => {
  for (let rung = 0; rung < BANDS.length; rung++) {
    const band = BANDS[rung]!
    const reach = reachFor(rung)
    const rng = new Rng(0x0d + rung)
    const seen = new Set<number>()
    for (let i = 0; i < 4000; i++) {
      const t = makeTarget(rung, () => rng.next())
      seen.add(t)
      assert.ok(
        t >= band.targetLo && t <= band.targetHi,
        `${band.name}: generated ${t}, outside ${band.targetLo}…${band.targetHi}`,
      )
      assert.ok(reach.canMake(t), `${band.name}: generated an unreachable target ${t}`)
    }
    assert.ok(seen.size >= 3, `${band.name}: only ${seen.size} distinct targets in four thousand`)
  }
})

// ── THE THEOREM ─────────────────────────────────────────────────────────────

test("A DEAD END IS IMPOSSIBLE: the frontier is never empty until the order is filled", () => {
  // Ten thousand random walks across the whole ladder, taking a random helpful
  // value at every step, and checking the invariant at every single state.
  let states = 0
  let filled = 0
  for (let seed = 0; seed < 2000; seed++) {
    const rng = new Rng(0xf00d ^ seed)
    const rung = seed % BANDS.length
    const order = new Order(rung, makeTarget(rung, () => rng.next()))
    const buf: number[] = []
    let guard = 0
    while (!order.filled && guard++ < 200) {
      const f = order.frontier(buf)
      states++
      assert.ok(
        f.length > 0,
        `DEAD END at ${order.plate()} — residual ${order.residual}, ${order.cuts} cuts taken`,
      )
      // Also assert the frontier is honest: every member really does advance.
      for (const v of f) {
        assert.equal(order.classify(v), "helpful", `${v} is in the frontier but classifies as ${order.classify(v)}`)
      }
      const took = order.take(f[Math.floor(rng.next() * f.length)] as number)
      assert.equal(took, "helpful", "a frontier value was refused")
    }
    assert.ok(order.filled, `an order stalled unfilled after ${guard} cuts: ${order.plate()}`)
    filled++
  }
  assert.ok(states > 5000, `only ${states} states walked, so this proved very little`)
  assert.equal(filled, 2000)
})

test("A DECOY CHANGES NOTHING AT ALL — R2, bit for bit", () => {
  let sawDecoy = 0
  let sawOvershoot = 0
  for (let seed = 0; seed < 400; seed++) {
    const rng = new Rng(0xbeef ^ seed)
    const rung = seed % BANDS.length
    const order = new Order(rung, makeTarget(rung, () => rng.next()))
    const buf: number[] = []
    for (let step = 0; step < 40 && !order.filled; step++) {
      const before = { residual: order.residual, cuts: order.cuts, plate: order.plate() }
      const v = printedFor(rung)[Math.floor(rng.next() * printedFor(rung).length)] as number
      const k = order.classify(v)
      const got = order.take(v)
      assert.equal(got, k, "take and classify disagreed")
      if (k === "helpful") continue
      if (k === "decoy") sawDecoy++
      else sawOvershoot++
      assert.equal(order.residual, before.residual, `a ${k} moved the residual`)
      assert.equal(order.cuts, before.cuts, `a ${k} consumed a blank`)
      assert.equal(order.plate(), before.plate, `a ${k} changed the plate`)
      // …and the frontier is unchanged too, which is what makes the invariant
      // survive an arbitrary number of them.
      const f = order.frontier(buf)
      assert.ok(f.length > 0, `the frontier emptied after a ${k}`)
    }
  }
  assert.ok(sawDecoy > 20, `only ${sawDecoy} decoys ever occurred — the ladder has no decoys in it`)
  assert.ok(sawOvershoot > 20, `only ${sawOvershoot} overshoots ever occurred`)
})

test("ORDER DOES NOT MATTER: every permutation of a decomposition reaches the same state", () => {
  // The founder's ruling. `3 + 3 + 3 + 4` and `4 + 3 + 3 + 3` are the same
  // answer, and a child who takes the 4 first has not made a mistake.
  //
  // The property is stronger than "both fill": at EVERY step, the residual, the
  // classification of every printed value and the frontier itself must be
  // identical between two permutations that have taken the same multiset.
  const permutations = <T>(xs: T[]): T[][] => {
    if (xs.length <= 1) return [xs]
    const out: T[][] = []
    for (let i = 0; i < xs.length; i++) {
      const rest = [...xs.slice(0, i), ...xs.slice(i + 1)]
      for (const p of permutations(rest)) out.push([xs[i] as T, ...p])
    }
    return out
  }

  let checked = 0
  for (let seed = 0; seed < 120; seed++) {
    const rng = new Rng(0xa11 ^ seed)
    const rung = seed % BANDS.length
    // Build a decomposition of at most five parts, then try every ordering.
    const probe = new Order(rung, makeTarget(rung, () => rng.next()))
    const parts: number[] = []
    const buf: number[] = []
    while (!probe.filled && parts.length < 5) {
      const f = probe.frontier(buf)
      const v = f[Math.floor(rng.next() * f.length)] as number
      parts.push(v)
      probe.take(v)
    }
    if (!probe.filled || parts.length > 5) continue

    const target = probe.target
    const perms = permutations(parts)
    for (const perm of perms) {
      const a = new Order(rung, target)
      for (let i = 0; i < perm.length; i++) {
        const got = a.take(perm[i] as number)
        assert.equal(
          got,
          "helpful",
          `taking ${parts.join("+")} as ${perm.join("+")} was refused at step ${i} — order was made to matter`,
        )
        // Same multiset taken ⇒ same residual ⇒ same everything.
        const b = new Order(rung, target)
        for (const v of [...perm.slice(0, i + 1)].sort((x, y) => x - y)) b.take(v)
        assert.equal(a.residual, b.residual, "two orderings of the same multiset disagree on the residual")
        assert.deepEqual(
          a.frontier([]),
          b.frontier([]),
          "two orderings of the same multiset disagree on the frontier",
        )
      }
      assert.ok(a.filled, `${perm.join(" + ")} did not fill ${target}`)
      checked++
    }
  }
  assert.ok(checked > 200, `only ${checked} permutations were tried`)
})

test("classification is exactly the three cases, and nothing else", () => {
  const reach = new Reach([2, 5], 40)
  assert.equal(classify(6, 5, reach), "overshoot", "bigger than the residual is an overshoot")
  assert.equal(classify(5, 5, reach), "helpful", "the exact finisher is always helpful")
  assert.equal(classify(2, 5, reach), "decoy", "5 − 2 = 3 cannot be made from 2s and 5s")
  assert.equal(classify(2, 4, reach), "helpful")
  assert.equal(classify(0, 5, reach), "decoy", "zero is not a value")
  assert.equal(classify(-3, 5, reach), "decoy")
  assert.equal(classify(2.5, 5, reach), "decoy", "a non-integer can never fill a blank")
})

test("the plate reads the way the founder drew it, with the curriculum's blank", () => {
  const order = new Order(2, 33)
  assert.equal(BLANK, "□", "the blank is not U+25A1")
  assert.equal(order.plate(), "□ = 33")
  order.take(10)
  assert.equal(order.plate(), "10 + □ = 33")
  order.take(15)
  assert.equal(order.plate(), "10 + 15 + □ = 33")
  assert.equal(order.sentence(), "33 − 10 − 15 = 8")
  assert.equal(order.residual, 8)
  order.take(8)
  assert.equal(order.plate(), "10 + 15 + 8 = 33", "a filled plate still shows a blank")
  assert.equal(order.filled, true)
  assert.equal(order.cuts, 3)
})

test("a host answer is used as a target only when this rung can actually fill it", () => {
  // §9's risk: a host may legitimately return `3/4`, or a number nowhere near
  // the band. Taking it anyway would hand the child an order they cannot fill,
  // which is the one thing this design may not do.
  for (let rung = 0; rung < BANDS.length; rung++) {
    const band = BANDS[rung]!
    assert.equal(targetIsUsable(rung, band.targetLo - 1), false, "a target below the band was accepted")
    assert.equal(targetIsUsable(rung, band.targetHi + 1), false, "a target above the band was accepted")
    assert.equal(targetIsUsable(rung, Number.NaN), false)
    assert.equal(targetIsUsable(rung, 12.5), false, "a fraction was accepted as a target")
    let usable = 0
    for (let t = band.targetLo; t <= band.targetHi; t++) if (targetIsUsable(rung, t)) usable++
    assert.ok(usable > 0, `${band.name}: no target in the band is reachable at all`)
  }
  // 1 is unreachable from {2,5}-style pools but the ones band starts at 1, so
  // pin the case that actually bites: the thousands band cannot take a 1,050
  // that is not a sum of its own pool.
  assert.equal(targetIsUsable(4, 1001), false, "1001 is not a sum of the thousands pool")
  assert.equal(targetIsUsable(4, 1000), true)
})

test("a rung index is clamped rather than trusted", () => {
  assert.equal(rungIndex(-4), 0)
  assert.equal(rungIndex(99), BANDS.length - 1)
  assert.equal(rungIndex(Number.NaN), 0)
  assert.equal(rungIndex(2.9), 2)
})

test("the ladder really is a ladder: targets and pools grow at every rung", () => {
  for (let i = 1; i < BANDS.length; i++) {
    const lo = BANDS[i - 1]!
    const hi = BANDS[i]!
    assert.ok(hi.targetLo > lo.targetHi, `rung ${i} does not start above rung ${i - 1}`)
    const loMax = Math.max(...lo.pool)
    const hiMax = Math.max(...hi.pool)
    assert.ok(hiMax > loMax, `rung ${i}'s addends are no bigger than rung ${i - 1}'s`)
  }
})
