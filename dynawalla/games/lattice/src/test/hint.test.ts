// THE HINT — the tree, the escalation, the quiet, and what a hint costs.
//
// The one thing that matters more than everything else in this file: **a tree
// that lies is worse than no tree at all.** A child who is shown `112 = 2·2·2·7`
// sweeps exactly that, flies into the resonator with 56 in the hold, and is
// refused by the game that told them to do it. So the generator is checked as a
// property rather than by example — every target the ladder can serve, many
// seeds, every node the exact product of its two children and every leaf a
// prime.
//
// After that, three claims:
//
//   * the escalation goes somewhere: each stage is a superset of the last, the
//     first stages give nothing arithmetical away, and the last one is the whole
//     tree;
//   * the quiet before an automatic hint is a **pure function of the item and
//     monotone non-decreasing in its difficulty**, with no clock, no speed and
//     no reading of the child anywhere in it; and
//   * a hint costs the child nothing — not a point, not the chain, not the
//     ceremony — and the only thing it changes is that the host is told nothing
//     at all about a question whose answer the game printed.
//
// Everything here is seeded from a literal and there is no real clock anywhere.

import assert from "node:assert/strict"
import { test } from "node:test"

import type { Host } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { Arena, MAX_TARGET } from "../game/arena.ts"
import { isPrime, primeFactors, productOf } from "../game/factor.ts"
import {
  firstHintMs,
  freeStages,
  heldLeaves,
  HINT_STAGES,
  HINT_DWELL_MS,
  itemOf,
  revealPaceMs,
  revealsAnswer,
  scheduledStage,
  shownAt,
  stageCount,
  WALL_STAGES,
} from "../game/hint.ts"
import { CALM_OPENINGS } from "../game/opening.ts"
import { isResonant, MIN_TARGET } from "../game/resonance.ts"
import {
  factorTree,
  leafProduct,
  leavesOf,
  placeTree,
  treeIsHonest,
  type PlacedNode,
} from "../game/tree.ts"
import { createStubHost } from "../stubHost.ts"
import { grindToPrimes, rig, sweepFactorisation } from "./harness.ts"

/**
 * Sit there. Advance the world by `ms`, sixteen milliseconds at a time, with
 * nobody touching anything — which is what the automatic hint is a response to.
 *
 * The hint's clock is PLAYED time, accumulated in `Arena.step`, so a test that
 * merely names a large number proves nothing about it. This is also why a
 * backgrounded webview cannot spend it: no frames, no `step`, no clock.
 */
function sitStill(arena: Arena, ms: number): void {
  for (let t = 0; t < ms; t += 16) arena.step(16)
}

/** Every whole number a resonator can be about. The ladder's whole range. */
const BAND: number[] = []
for (let n = MIN_TARGET; n <= MAX_TARGET; n++) BAND.push(n)

/** Every target the resonator would actually put up, wall or tree. */
const ASKABLE = BAND.filter(
  (n) => isResonant(n, MAX_TARGET, { wall: true }) || isResonant(n, MAX_TARGET, { wall: false }),
)

const SEEDS = [1, 2, 3, 7, 42, 97, 512, 1337, 24601, 90210, 0x1a771ce, 0xfeed]

// ── the generator cannot lie ───────────────────────────────────────────────

test("every tree the game can generate multiplies back to its own root", () => {
  // The whole band, every seed: 988 targets × 12 seeds, and each one checked
  // node by node. `treeIsHonest` is the conjunction of the three things that
  // make a factor tree a factor tree — the root is the number asked for, every
  // internal node is the exact product of its two children, and the leaves are
  // exactly `primeFactors(n)` as a multiset.
  let checked = 0
  for (const seed of SEEDS) {
    const rng = new Rng(seed)
    for (const n of BAND) {
      const tree = factorTree(n, rng)
      assert.ok(treeIsHonest(n, tree), `the tree for ${n} on seed ${seed} is not a tree of ${n}`)
      assert.equal(
        productOf(leavesOf(tree)),
        n,
        `the leaves of ${n}'s tree on seed ${seed} do not multiply to ${n}`,
      )
      checked += 1
    }
  }
  assert.ok(checked > 11_000, `only ${checked} trees were checked; the loop has gone stale`)
})

test("a leaf is a prime and a prime is a leaf — there is no third kind of node", () => {
  for (const seed of SEEDS) {
    const rng = new Rng(seed)
    for (const n of ASKABLE) {
      const placed = placeTree(factorTree(n, rng))
      for (let i = 0; i < placed.nodes.length; i++) {
        const node = placed.nodes[i] as PlacedNode
        const leaf = node.kids === null
        assert.equal(
          leaf,
          isPrime(node.value),
          `${node.value} in ${n}'s tree is ${leaf ? "a leaf" : "a fork"} and ${
            isPrime(node.value) ? "prime" : "composite"
          }`,
        )
      }
    }
  }
})

test("the placed tree is a tree: one root, valid parents, leaves in their own columns", () => {
  for (const seed of SEEDS) {
    const rng = new Rng(seed)
    for (const n of ASKABLE) {
      const placed = placeTree(factorTree(n, rng))
      assert.equal(leafProduct(placed), n, `${n}'s placed leaves do not multiply to ${n}`)
      assert.equal(placed.leaves.length, primeFactors(n).length, `${n} lost a leaf in placement`)

      const roots = placed.nodes.filter((node) => node.parent < 0)
      assert.equal(roots.length, 1, `${n}'s tree has ${roots.length} roots`)
      assert.equal((placed.nodes[0] as PlacedNode).value, n, `${n} is not at index 0`)

      let deepest = 0
      const columns = new Set<number>()
      for (let i = 0; i < placed.nodes.length; i++) {
        const node = placed.nodes[i] as PlacedNode
        if (node.parent >= 0) {
          assert.ok(node.parent < i, `${n}: node ${i} has a parent that comes after it`)
          const parent = placed.nodes[node.parent] as PlacedNode
          assert.equal(parent.depth + 1, node.depth, `${n}: node ${i} is not under its parent`)
        }
        assert.ok(node.u >= 0 && node.u <= placed.columns - 1, `${n}: node ${i} is off the board`)
        if (node.depth > deepest) deepest = node.depth
        if (node.kids === null) columns.add(node.u)
      }
      assert.equal(placed.rows, deepest + 1, `${n}: the row count is not the depth`)
      assert.equal(columns.size, placed.leaves.length, `${n}: two leaves share a column`)
    }
  }
})

test("a prime target is one lonely node, which is the whole statement of the wall", () => {
  const rng = new Rng(0x1a771ce)
  for (const n of BAND.filter(isPrime)) {
    const placed = placeTree(factorTree(n, rng))
    assert.equal(placed.nodes.length, 1, `${n} came apart, and ${n} is prime`)
    assert.equal(placed.rows, 1)
    assert.equal(placed.columns, 1)
    assert.equal(stageCount(placed), WALL_STAGES)
  }
})

// ── the escalation ─────────────────────────────────────────────────────────

test("each stage shows everything the stage before it showed, and then more", () => {
  for (const seed of SEEDS) {
    const rng = new Rng(seed)
    for (const n of ASKABLE) {
      const placed = placeTree(factorTree(n, rng))
      const last = stageCount(placed)
      for (let stage = 0; stage < last; stage++) {
        const before = shownAt(placed, stage)
        const after = shownAt(placed, stage + 1)
        for (const index of before) {
          assert.ok(after.has(index), `${n}: node ${index} went dark again at stage ${stage + 1}`)
        }
      }
      assert.equal(shownAt(placed, 0).size, 0, `${n}: stage 0 showed something`)
      assert.equal(shownAt(placed, 1).size, 0, `${n}: the silhouette showed a numeral`)
      assert.equal(
        shownAt(placed, last).size,
        placed.nodes.length,
        `${n}: the last stage is not the whole tree`,
      )
    }
  }
})

test("the first numeral a child is given is the prime they were least likely to find", () => {
  const rng = new Rng(0x1a771ce)
  for (const n of ASKABLE) {
    const placed = placeTree(factorTree(n, rng))
    const shown = shownAt(placed, 2)
    assert.equal(shown.size, 1, `${n}: stage 2 lit ${shown.size} nodes rather than one`)
    const [index] = [...shown]
    const node = placed.nodes[index as number] as PlacedNode
    assert.equal(node.kids, null, `${n}: stage 2 lit a fork rather than a leaf`)
    const biggest = Math.max(...placed.leaves.map((i) => (placed.nodes[i] as PlacedNode).value))
    assert.equal(node.value, biggest, `${n}: stage 2 lit ${node.value} and not ${biggest}`)
  }
})

test("the silhouette and the first prime never give the answer away", () => {
  // The line the reporting hangs on. A blank tree says how many pieces the hold
  // needs and nothing else; one lit leaf cannot pin a composite down, because
  // pinning a root down needs BOTH of its branches determined and a single node
  // can only ever be one of them.
  for (const seed of SEEDS) {
    const rng = new Rng(seed)
    for (const n of ASKABLE.filter((v) => !isPrime(v))) {
      const placed = placeTree(factorTree(n, rng))
      assert.equal(revealsAnswer(placed, shownAt(placed, 1)), false, `${n}: the silhouette told`)
      assert.equal(revealsAnswer(placed, shownAt(placed, 2)), false, `${n}: one prime told`)
    }
  }
})

test("but it always gets there: the last stage states the answer, for every target", () => {
  for (const seed of SEEDS) {
    const rng = new Rng(seed)
    for (const n of ASKABLE) {
      const placed = placeTree(factorTree(n, rng))
      const last = stageCount(placed)
      assert.equal(
        revealsAnswer(placed, shownAt(placed, last)),
        true,
        `${n}: a child could reach the end of the hint and still be stuck`,
      )
      // And once it has been said it is never unsaid.
      let said = false
      for (let stage = 0; stage <= last; stage++) {
        const now = revealsAnswer(placed, shownAt(placed, stage))
        assert.ok(!said || now, `${n}: the answer was taken back at stage ${stage}`)
        said = said || now
      }
    }
  }
})

test("one stage before the end, the hold is already spelled out in full", () => {
  // The stage the founder asked for by name — "basically reveal the answer" —
  // and the one that actually unsticks a child, because the resonator opens on
  // the product of the HOLD and never on the numeral at the top of the tree.
  // Every leaf lit is a shopping list: go and sweep these.
  //
  // Asserted separately from "the last stage is the whole tree", because the
  // last stage adds every node including the forks and would cover for a stage
  // 5 that had quietly stopped lighting leaves at all.
  for (const seed of SEEDS) {
    const rng = new Rng(seed)
    for (const n of ASKABLE.filter((v) => !isPrime(v))) {
      const placed = placeTree(factorTree(n, rng))
      const shown = shownAt(placed, stageCount(placed) - 1)
      for (const leaf of placed.leaves) {
        assert.ok(
          shown.has(leaf),
          `${n}: a child one stage from the end still cannot see which primes to sweep`,
        )
      }
      const hold = placed.leaves.map((i) => (placed.nodes[i] as PlacedNode).value)
      assert.equal(productOf(hold), n, `${n}: the spelled-out hold does not open the ring`)
    }
  }
})

test("a wall says nothing at all and then says the number, which is the only hint it has", () => {
  const rng = new Rng(0x1a771ce)
  for (const n of ASKABLE.filter(isPrime)) {
    const placed = placeTree(factorTree(n, rng))
    assert.equal(revealsAnswer(placed, shownAt(placed, 1)), false, `${n}: the wall's shape told`)
    assert.equal(revealsAnswer(placed, shownAt(placed, 2)), true, `${n}: the wall never told`)
  }
})

test("the founder's own examples, as pictures", () => {
  // `112` is the number in the report: `642 − 530`, then four twos and a seven.
  // Whatever `splitPair` chooses, the partial is a two-number product of it and
  // the leaves are the hold.
  const placed = placeTree(factorTree(112, new Rng(9)))
  const leaves = placed.leaves.map((i) => (placed.nodes[i] as PlacedNode).value).sort((a, b) => a - b)
  assert.deepEqual(leaves, [2, 2, 2, 2, 7])

  const partial = [...shownAt(placed, 4)]
    .map((i) => (placed.nodes[i] as PlacedNode).value)
    .sort((a, b) => a - b)
  // Two numerals whose product is 112 — `16 × 7`, or `8 × 14`, depending on the
  // draw. Either is the stepping stone the founder asked for.
  const kids = (placed.nodes[0] as PlacedNode).kids
  assert.notEqual(kids, null)
  const [a, b] = kids as readonly [number, number]
  const pair = [(placed.nodes[a] as PlacedNode).value, (placed.nodes[b] as PlacedNode).value]
  assert.equal(pair[0]! * pair[1]!, 112, "the partial does not multiply to 112")
  for (const value of pair) assert.ok(partial.includes(value), `${value} is missing from the partial`)

  // `129 ⟶ 3 and ⟶ ?`: half a split, with the sibling left blank.
  //
  // **And 129 is the shape where that picture does not exist**, which is worth
  // pinning rather than papering over. Its tree is `3 · 43` and 43 is both the
  // largest leaf (stage 2) and the larger root child, so stage 3 lights both
  // halves at once and states the answer a stage early. Around 118 of the 410 composite
  // targets do that. It is why `freeStages` walks the tree instead of returning
  // a hardcoded 3, and why `given` is computed from the picture.
  //
  // The assertion that used to be here was `lit.length >= 1`, which `shownAt`
  // satisfies by construction for every composite — the message said a sibling
  // was blank and the check was happy with both siblings lit.
  const odd = placeTree(factorTree(129, new Rng(4)))
  const oddKids = (odd.nodes[0] as PlacedNode).kids as readonly [number, number]
  const oddValues = [odd.nodes[oddKids[0]]!.value, odd.nodes[oddKids[1]]!.value].sort((a, b) => a - b)
  assert.deepEqual(oddValues, [3, 43], "129 no longer comes apart as 3 · 43")
  assert.equal(freeStages(odd), 2, "129's free stages are not two")
  assert.equal(revealsAnswer(odd, shownAt(odd, 2)), false, "129 gave itself away at one prime")
  assert.equal(revealsAnswer(odd, shownAt(odd, 3)), true, "129's stage 3 is not both halves")

  // Where the picture DOES exist, one half is lit and the other is not — a
  // strictly stronger claim than "at least one is lit".
  const half = placeTree(factorTree(112, new Rng(9)))
  const halfKids = (half.nodes[0] as PlacedNode).kids as readonly [number, number]
  const litAt3 = shownAt(half, 3)
  const litKids = [halfKids[0], halfKids[1]].filter((i) => litAt3.has(i))
  assert.equal(litKids.length, 1, "112's stage 3 lit both halves of the split, or neither")
  assert.equal(freeStages(half), 3, "112 does not have three free stages")
})

test("the free stages are exactly the pictures that do not state the answer", () => {
  // The property `freeStages` exists to have, over the whole band: everything at
  // or below it is safe to show a child who is merely sitting there, and the
  // stage above it is not.
  let earlyCrossers = 0
  for (const seed of SEEDS) {
    const rng = new Rng(seed)
    for (const n of ASKABLE) {
      const placed = placeTree(factorTree(n, rng))
      const free = freeStages(placed)
      assert.ok(free >= 1, `${n}: the clock is not allowed to show even the silhouette`)
      for (let stage = 1; stage <= free; stage++) {
        assert.equal(
          revealsAnswer(placed, shownAt(placed, stage)),
          false,
          `${n}: stage ${stage} is called free and states the answer`,
        )
      }
      assert.ok(free < stageCount(placed), `${n}: the clock alone can reach the whole tree`)
      assert.equal(
        revealsAnswer(placed, shownAt(placed, free + 1)),
        true,
        `${n}: the stage above the free ones still says nothing, so the ceiling is too low`,
      )
      if (!isPrime(n) && free < 3) earlyCrossers += 1
    }
  }
  assert.ok(
    earlyCrossers > 0,
    "no composite crosses early any more, so `freeStages` could just be a constant",
  )
})

// ── the maths moment ───────────────────────────────────────────────────────

test("a lit leaf clicks into place once per copy the child is actually holding", () => {
  // `112`'s tree has four twos in it. A hold with two twos must collar exactly
  // two of them. Collar all four and the picture says the hold is finished when
  // it is half finished — a hint that lies, and a child who trusts it flies into
  // the ring and is refused by the game that told them to.
  const placed = placeTree(factorTree(112, new Rng(9)))
  const all = shownAt(placed, stageCount(placed))
  const twos = placed.leaves.filter((i) => (placed.nodes[i] as PlacedNode).value === 2)
  assert.equal(twos.length, 4, "112 stopped having four twos in it")

  assert.equal(heldLeaves(placed, all, []).size, 0, "an empty hold collared something")
  assert.equal(heldLeaves(placed, all, [2]).size, 1, "one 2 collared more than one leaf")
  assert.equal(heldLeaves(placed, all, [2, 2]).size, 2, "two 2s did not collar two leaves")
  assert.equal(heldLeaves(placed, all, [2, 2, 2, 2, 7]).size, 5, "a finished hold is not finished")
  // A prime the tree never asked for collars nothing at all.
  assert.equal(heldLeaves(placed, all, [5, 5, 5]).size, 0, "a stray prime collared a leaf")

  // And a blank leaf is never collared, because collaring a `?` would say which
  // prime it is a stage before the game meant to.
  const silhouette = shownAt(placed, 1)
  assert.equal(
    heldLeaves(placed, silhouette, [2, 2, 2, 2, 7]).size,
    0,
    "the blank tree told the child which of its leaves they were already carrying",
  )
})

// ── the quiet is a pure function of the item ───────────────────────────────

test("the item is read off the target: a longer hold is a longer piece of work", () => {
  // `tiles` is how many motes the hold is, and it is the half of the item that
  // is about the WORK rather than the rung. Wired to a constant, a `720` — seven
  // primes to hunt down across the arena — would be given exactly as much quiet
  // as a `12`, and the game would start offering help in the middle of a sweep
  // the child was halfway through.
  assert.equal(itemOf(12, 0).tiles, 3, "12 = 2·2·3 is three motes")
  assert.equal(itemOf(112, 0.5).tiles, 5, "112 = 2·2·2·2·7 is five motes")
  assert.equal(itemOf(720, 0.5).tiles, 7, "720 is seven motes")
  assert.equal(itemOf(997, 0.5).tiles, 1, "a prime is one mote, found rather than built")
  assert.equal(itemOf(112, 0.5).difficulty, 0.5, "the rung was not carried through")
  assert.ok(
    firstHintMs(itemOf(720, 0.5)) > firstHintMs(itemOf(12, 0.5)),
    "a seven-mote hold gets no more quiet than a three-mote one",
  )
})

test("the quiet before a hint is a pure function of the item", () => {
  const items = [
    itemOf(12, 0),
    itemOf(112, 0.5),
    itemOf(720, 0.72),
    itemOf(997, 1),
  ]
  for (const item of items) {
    const first = firstHintMs(item)
    for (let i = 0; i < 500; i++) {
      assert.equal(firstHintMs(item), first, "the same item asked twice gave two different quiets")
    }
    assert.ok(Number.isFinite(first) && first > 0, `the quiet for ${JSON.stringify(item)} is ${first}`)
  }
})

test("the quiet is monotone non-decreasing in difficulty, at every tile count", () => {
  // The law, stated the way the fleet states it for an answer window: `window(d)`
  // may not shrink as `d` grows. A hint arriving SOONER on a harder item is the
  // game telling a child it does not believe they can do this one.
  for (let tiles = 0; tiles <= 10; tiles++) {
    let previous = -1
    for (let d = 0; d <= 1.0000001; d += 0.005) {
      const ms = firstHintMs({ difficulty: d, tiles })
      assert.ok(
        ms >= previous,
        `the quiet fell from ${previous}ms to ${ms}ms between difficulties at ${tiles} tiles`,
      )
      previous = ms
    }
  }
})

test("the quiet is monotone non-decreasing in tiles, at every difficulty", () => {
  for (let d = 0; d <= 1.0000001; d += 0.01) {
    let previous = -1
    for (let tiles = 0; tiles <= 12; tiles++) {
      const ms = firstHintMs({ difficulty: d, tiles })
      assert.ok(ms >= previous, `the quiet fell from ${previous}ms to ${ms}ms at difficulty ${d}`)
      previous = ms
    }
  }
})

test("nothing but the item reaches the quiet — not the clock, not a nonsense number", () => {
  // Non-finite inputs are clamped rather than propagated. A `NaN` here would
  // make every comparison against it false, so the first hint would arrive on
  // the first frame of every question in the session — a tree permanently on
  // screen and every item silently unreported.
  assert.equal(firstHintMs({ difficulty: Number.NaN, tiles: 3 }), firstHintMs({ difficulty: 0, tiles: 3 }))
  assert.equal(firstHintMs({ difficulty: 0.5, tiles: Number.NaN }), firstHintMs({ difficulty: 0.5, tiles: 0 }))
  assert.equal(firstHintMs({ difficulty: 9, tiles: 3 }), firstHintMs({ difficulty: 1, tiles: 3 }))
  assert.equal(firstHintMs({ difficulty: -9, tiles: 3 }), firstHintMs({ difficulty: 0, tiles: 3 }))
  assert.ok(firstHintMs({ difficulty: 0, tiles: 0 }) >= HINT_DWELL_MS)
})

test("the schedule only ever moves forward, and starts in silence", () => {
  const item = itemOf(112, 0.55)
  const first = firstHintMs(item)
  assert.equal(scheduledStage(0, item), 0)
  assert.equal(scheduledStage(first - 1, item), 0, "a hint arrived before the quiet was up")
  assert.equal(scheduledStage(first, item), 1, "the quiet ran out and nothing arrived")
  assert.equal(scheduledStage(Number.NaN, item), 0)

  let previous = 0
  for (let t = 0; t < first * 12; t += 250) {
    const stage = scheduledStage(t, item)
    assert.ok(stage >= previous, `the schedule went backwards at ${t}ms`)
    previous = stage
  }
  assert.ok(previous >= HINT_STAGES, "the schedule never reaches the whole tree on its own")
})

test("the reveal is calm when it is hard and brief when it is not", () => {
  // The one thing in the hint system that reads the child at all, and it changes
  // only how the reveal LANDS — never what is revealed and never when.
  let previous = Number.POSITIVE_INFINITY
  for (let chain = 0; chain <= 20; chain++) {
    const pace = revealPaceMs(chain)
    assert.ok(pace <= previous, `the ceremony got longer at chain ${chain}`)
    assert.ok(pace > 0, "the ceremony has no duration at all")
    previous = pace
  }
  assert.ok(
    revealPaceMs(0) > revealPaceMs(8) * 4,
    "a child on a chain waits nearly as long as a child who is stuck",
  )
})

// ── what a hint costs ──────────────────────────────────────────────────────

test("a hint costs the child nothing: the same run, hinted and unhinted", () => {
  // Two arenas off the same seed. One is played with the tree fully revealed
  // from the first frame; the other is played blind. Everything the child can
  // SEE must come out identical — the counter, the chain, the ceremony, the
  // haptic that says well done.
  const play = (hints: boolean): { opened: number; chain: number; haptics: string[] } => {
    const r = rig(0x5eed)
    for (let round = 0; round < 4; round++) {
      const res = r.arena.resonator
      if (!res) break
      if (hints) {
        for (let i = 0; i < HINT_STAGES; i++) r.arena.askHint()
      }
      grindToPrimes(r.arena)
      assert.ok(sweepFactorisation(r.arena, res.target), "the field could not supply the answer")
      r.arena.enter(1000)
    }
    return { opened: r.arena.opened, chain: r.arena.chain, haptics: r.haptics }
  }

  const blind = play(false)
  const helped = play(true)
  assert.ok(blind.opened >= 3, "the unhinted run opened nothing, so this compares two failures")
  assert.equal(helped.opened, blind.opened, "a hinted run opened fewer resonators")
  assert.equal(helped.chain, blind.chain, "a hint broke the chain")
  assert.deepEqual(helped.haptics, blind.haptics, "a hinted run felt different in the hand")
})

test("a hinted round is still reported, because the progress hairline is a thing the child sees", () => {
  // **This is the assertion that caught the first version of this feature.**
  //
  // It closed a hinted question with `host.skip` instead of reporting it, on the
  // reasoning that a `correct` after the game printed the answer is a claim
  // about the child that is not true. Honest, and invisible from inside the
  // canvas — and `game-host` says of `skip`, verbatim, that it "does not advance
  // the session progress fraction, because that counts answered questions",
  // which the host paints as a hairline across the top of every pack.
  //
  // So: five hinted rounds, five ceremonies, `OPENED 5` — and a progress bar
  // still on nought for the whole sitting. The child who leans on the hint is
  // the one this feature exists for and theirs was the bar that never moved.
  const r = rig(0x5eed)
  const ids: string[] = []
  for (let round = 0; round < 5; round++) {
    const res = r.arena.resonator
    if (!res) break
    ids.push(res.questionId)
    for (let i = 0; i < HINT_STAGES; i++) r.arena.askHint()
    assert.equal(r.arena.hint()?.given, true, "the whole tree did not state the answer")
    grindToPrimes(r.arena)
    assert.ok(sweepFactorisation(r.arena, res.target), "the field could not supply the answer")
    r.arena.enter(1000 * (round + 1))
  }

  assert.equal(r.arena.opened, 5, "the run did not open five resonators")
  assert.equal(
    r.reports.length,
    5,
    `five hinted rounds produced ${r.reports.length} reports, so the progress hairline moved ${r.reports.length}/40 of a session instead of 5/40`,
  )
  for (const id of ids) {
    const report = r.reports.find((entry) => entry.questionId === id)
    assert.ok(report, `${id} was opened and the host was never told`)
    assert.equal(report.correct, true, `${id} was opened and reported as wrong`)
  }
  assert.deepEqual(r.skips.filter((id) => ids.includes(id)), [], "an answered question was skipped")
})

test("nothing the clock does on its own can ever reach the stage that states the answer", () => {
  // The other half of the same fix, and the one that matters for a child who
  // never presses anything.
  //
  // The old schedule ran all the way to stage 6 on time alone. On a WALL that
  // was 51 seconds — `tiles` is 1 for a prime, so the quiet is short, and stage
  // 2 for a wall IS the numeral. Fifty-one seconds is an ordinary length of time
  // to spend hunting one mote across a drifting field, which is the entire task
  // on a wall round; a child doing it exactly right, unaided, had the answer
  // printed for them at the finish line. Walls are one resonator in five.
  //
  // Now the clock stops at `freeStages` and the rest is the child's to ask for.
  for (const seed of [1, 7, 42, 1337, 90210, 0x5eed]) {
    for (let round = 0; round < 6; round++) {
      const r = rig(seed)
      for (let skipRound = 0; skipRound < round; skipRound++) {
        const skipRes = r.arena.resonator
        if (!skipRes) break
        grindToPrimes(r.arena)
        if (!sweepFactorisation(r.arena, skipRes.target)) break
        r.arena.enter(1000 * (skipRound + 1))
      }
      const res = r.arena.resonator
      if (!res) continue
      // Ten minutes of a child sitting in front of one question, doing nothing.
      sitStill(r.arena, 600_000)
      const hint = r.arena.hint()
      assert.ok(hint, `seed ${seed} round ${round}: ten minutes and no hint at all`)
      assert.equal(
        hint.given,
        false,
        `seed ${seed} round ${round}: the clock alone stated the answer to ${res.prompt} (= ${res.target}, prime=${isPrime(res.target)})`,
      )
      // Not `stage >= 1`, which `hint()` guarantees by returning null below it.
      // Ten minutes is far past every step in the schedule, so the clock should
      // be standing on its ceiling — which is also what makes the `given` check
      // above a check on the CEILING rather than on the clock being slow.
      assert.equal(
        hint.stage,
        freeStages(hint.placed),
        `seed ${seed} round ${round}: ten minutes did not exhaust the clock's own stages`,
      )
    }
  }
})

test("but the child can always ask past it, and asking is what makes it their choice", () => {
  const r = rig(0x5eed)
  sitStill(r.arena, 600_000)
  const byClock = r.arena.hint()
  assert.ok(byClock)
  assert.equal(byClock.given, false)

  r.arena.askHint()
  const asked = r.arena.hint()
  assert.ok(asked)
  assert.equal(asked.stage, byClock.stage + 1, "a tap at the clock's ceiling did nothing")
  assert.equal(asked.given, true, "one tap past the free stages did not state the answer")
})

test("a hint that gave nothing away leaves the report exactly as it was", () => {
  const r = rig(0x5eed)
  const res = r.arena.resonator
  assert.ok(res)
  const id = res.questionId

  // The silhouette and one prime. Neither says what the sum is.
  r.arena.askHint()
  r.arena.askHint()
  assert.equal(r.arena.hint()?.stage, 2)
  assert.equal(r.arena.hint()?.given, false, "two taps already stated the answer")

  grindToPrimes(r.arena)
  assert.ok(sweepFactorisation(r.arena, res.target))
  r.arena.enter(1000)

  const report = r.reports.find((entry) => entry.questionId === id)
  assert.ok(report, "a question the child answered themselves was not reported")
  assert.equal(report.correct, true)
  assert.equal(report.answered, String(res.target))
  assert.equal(r.skips.includes(id), false, "the child's own answer was thrown away")
})

test("asking is always allowed and never runs out in a way that reads as a refusal", () => {
  const r = rig(0x5eed)
  assert.equal(r.arena.hint(), null, "a fresh question opens with a tree already up")

  let previous = 0
  for (let i = 0; i < 40; i++) {
    r.arena.askHint()
    const stage = r.arena.hint()?.stage ?? 0
    assert.ok(stage >= previous, "asking for a hint took one away")
    previous = stage
  }
  const hint = r.arena.hint()
  assert.ok(hint)
  assert.equal(hint.stage, hint.stages, "forty taps did not reach the whole tree")
  // And the fortieth tap is a quiet no-op rather than an error or an event.
  assert.deepEqual(r.arena.askHint(), [], "asking past the end of the tree did something")
})

test("the quiet the arena actually keeps is the quiet the item asks for", () => {
  // The wiring between `arm` and `firstHintMs`, pinned to the millisecond. Built
  // from the wrong item — a constant, the previous target, the rung that was
  // *requested* rather than the one that answered — the schedule still fires and
  // every other assertion in this file still passes; a child on a seven-mote
  // hold just gets interrupted as if they were on a three-mote one.
  for (const seed of [1, 7, 42, 1337, 90210, 0x5eed]) {
    const r = rig(seed)
    const res = r.arena.resonator
    assert.ok(res, `seed ${seed}: no resonator`)
    const first = firstHintMs(itemOf(res.target, res.difficulty))
    sitStill(r.arena, first - 1000)
    assert.equal(
      r.arena.hint()?.stage ?? 0,
      0,
      `seed ${seed}: a hint arrived before the item's own quiet was up`,
    )
    sitStill(r.arena, 1100)
    assert.equal(
      r.arena.hint()?.stage,
      1,
      `seed ${seed}: the item's quiet ran out at ${first}ms and nothing arrived`,
    )
  }
})

test("a hint arrives once, not every frame", () => {
  const r = rig(0x5eed)
  const res = r.arena.resonator
  assert.ok(res)
  const item = itemOf(res.target, 0)
  // Whatever rung it landed on, the quiet cannot be shorter than the floor.
  const events: number[] = []
  for (let t = 0; t <= firstHintMs({ difficulty: 1, tiles: 12 }) * 4; t += 100) {
    sitStill(r.arena, 100)
    for (const event of r.arena.unfold()) {
      if (event.kind === "hint") events.push(event.stage)
    }
  }
  assert.ok(events.length > 0, `no hint ever arrived, with a quiet of ${firstHintMs(item)}ms`)
  assert.deepEqual(
    events,
    events.slice().sort((a, b) => a - b),
    "the stages did not arrive in order",
  )
  assert.equal(new Set(events).size, events.length, "the same stage was announced twice")
})

test("a tap runs ahead of the quiet, and the quiet never lands on top of it", () => {
  const r = rig(0x5eed)
  r.arena.askHint()
  r.arena.askHint()
  assert.equal(r.arena.hint()?.stage, 2)

  // Wind the clock right through the moments the first several automatic hints
  // would have arrived. The stage is a `max`, so the schedule catches up
  // silently behind the taps rather than re-announcing a stage the child already
  // has — which on screen would be the tree flickering back to a picture they
  // had left behind, twice, for no reason they could name.
  const stages: number[] = []
  for (let t = 0; t <= firstHintMs({ difficulty: 1, tiles: 12 }) * 6; t += 100) {
    sitStill(r.arena, 100)
    for (const event of r.arena.unfold()) {
      if (event.kind === "hint") stages.push(event.stage)
    }
  }
  for (const stage of stages) {
    assert.ok(stage > 2, `stage ${stage} was announced again after the child had already asked for it`)
  }
  assert.equal(new Set(stages).size, stages.length, "the same stage was announced twice")
})

test("the ladder holds rather than climbing on an answer the game handed over", () => {
  // Not a penalty — the absence of one. `Ladder.opened` is three rungs of harder
  // arithmetic next time, and pushing a child into harder arithmetic *because*
  // they had just been shown the answer is the one way a hint in this game could
  // quietly cost them something. Everything the child can SEE is unchanged; the
  // test above holds that line.
  //
  // Measured at the wire rather than on `ladder.at`, because `arm` calls
  // `landed()` immediately after and snaps the position onto whatever rung the
  // host actually served. What the climb changes is the difficulty the *next*
  // arming asks for, and that is a number the host is handed.
  const nextRequestAfterOpening = (hints: boolean): number => {
    const asked: number[] = []
    const base = createStubHost({ seed: 0x5eed, reducedMotion: true })
    const host: Host = {
      next: (opts) => {
        asked.push(opts?.difficulty ?? -1)
        return base.next(opts)
      },
      report: (r) => base.report(r),
      skip: (id) => base.skip?.(id),
      haptic: () => undefined,
      prefersReducedMotion: () => true,
    }
    const arena = new Arena(host, new Rng(0x5eed ^ 0x51de), { width: 900, height: 700, experience: CALM_OPENINGS })
    arena.begin(0)
    const firstArming = asked.length
    const res = arena.resonator
    assert.ok(res, "no resonator was armed")
    if (hints) {
      for (let i = 0; i < HINT_STAGES; i++) arena.askHint()
      assert.equal(arena.hint()?.given, true, "the whole tree did not state the answer")
    }
    grindToPrimes(arena)
    assert.ok(sweepFactorisation(arena, res.target))
    arena.enter(1000)
    assert.equal(arena.opened, 1, "the resonator did not open")
    assert.ok(asked.length > firstArming, "the next question was never asked for")
    return asked[firstArming] as number
  }

  const blind = nextRequestAfterOpening(false)
  const helped = nextRequestAfterOpening(true)
  assert.ok(helped < blind, `a handed-over open climbed the ladder anyway: ${helped} vs ${blind}`)
})

test("a sheet over the frame is not thinking time, and does not unfold the tree", () => {
  const r = rig(0x5eed)
  sitStill(r.arena, 1000)
  assert.equal(r.arena.hint()?.stage ?? 0, 0, "a hint arrived one second into the question")

  r.arena.pause(1000)
  // Two minutes behind a paywall card, a parent gate or the how-to-play panel —
  // and the shell keeps calling `step`, because it keeps drawing.
  sitStill(r.arena, 120_000)
  assert.equal(r.arena.hint()?.stage ?? 0, 0, "the tree unfolded behind the host's sheet")
  assert.deepEqual(r.arena.unfold(), [], "a hint announced itself behind the sheet")
  // And the control is inert behind it, like every other input in this game. A
  // press that lands on a translucent host card is not the child asking for
  // anything, and a tap that leaked through would unfold a tree they are not
  // looking at — the same class of damage as a resting thumb flying the ship
  // through the resonator behind a sheet.
  assert.deepEqual(r.arena.askHint(), [], "a tap behind the host's sheet asked for a hint")
  assert.equal(r.arena.hint(), null, "a tap behind the host's sheet unfolded the tree")

  r.arena.resume(121_000)
  sitStill(r.arena, 1000)
  assert.equal(r.arena.hint()?.stage ?? 0, 0, "the sheet spent the child's quiet for them")

  // Back from the sheet, asking works again.
  r.arena.askHint()
  assert.equal(r.arena.hint()?.stage, 1, "the control never came back after the sheet")
})

test("a webview in the app switcher does not spend the child's quiet either", () => {
  // The case a pack is NEVER told about, and the one a wall-clock schedule with
  // a pause guard bolted on gets wrong: the child hits the home button mid
  // question and comes back three minutes later. `Arena.pause` is never called,
  // because the host does not know, so the only thing that can protect the quiet
  // is that it is PLAYED time — and `step` clamps a delta of minutes to 120ms
  // like every other physical quantity in the arena.
  const r = rig(0x5eed)
  const res = r.arena.resonator
  assert.ok(res)
  const first = firstHintMs(itemOf(res.target, res.difficulty))
  for (let i = 0; i < 10; i++) r.arena.step(20_000)
  assert.equal(
    r.arena.hint()?.stage ?? 0,
    0,
    `two hundred seconds in the app switcher spent a ${first}ms quiet`,
  )
})

test("a new question starts in silence, however much of the last tree was up", () => {
  const r = rig(0x5eed)
  const first = r.arena.resonator
  assert.ok(first)
  for (let i = 0; i < HINT_STAGES; i++) r.arena.askHint()
  assert.equal(r.arena.hint()?.stage, r.arena.hint()?.stages)

  grindToPrimes(r.arena)
  assert.ok(sweepFactorisation(r.arena, first.target))
  r.arena.enter(1000)

  const next = r.arena.resonator
  assert.ok(next)
  assert.notEqual(next.questionId, first.questionId, "the same resonator came back")
  assert.equal(r.arena.hint(), null, "the new question opened with the last one's tree up")
})

test("the tree the resonator is hinting is the tree of the field it is standing over", () => {
  // The hint and the arena must be about the same number. If the tree were built
  // off anything but the live target — a stale copy, the previous question, the
  // request rather than the item served — a child would sweep exactly what they
  // were shown and be refused.
  for (const seed of [1, 7, 42, 1337, 90210, 0x5eed]) {
    const r = rig(seed)
    for (let round = 0; round < 6; round++) {
      const res = r.arena.resonator
      if (!res) break
      for (let i = 0; i < HINT_STAGES; i++) r.arena.askHint()
      const hint = r.arena.hint()
      assert.ok(hint, `seed ${seed}: no hint for a live resonator`)
      assert.equal(
        (hint.placed.nodes[0] as PlacedNode).value,
        res.target,
        `seed ${seed}: the tree is about a different number than the ring`,
      )
      assert.equal(leafProduct(hint.placed), res.target)

      // And the leaves are a hold the field can actually supply.
      grindToPrimes(r.arena)
      assert.ok(
        sweepFactorisation(r.arena, res.target),
        `seed ${seed}: the tree named primes the field does not have`,
      )
      r.arena.enter(1000 * (round + 1))
    }
  }
})

test("with no resonator there is nothing to hint about and nothing throws", () => {
  const arena = new Arena(
    {
      next: () => ({ id: "x", prompt: "2 + 0", answer: "2", distractors: [], domain: "add", difficulty: 0 }),
      report: () => undefined,
      haptic: () => undefined,
      prefersReducedMotion: () => true,
    },
    new Rng(3),
    { width: 900, height: 700, experience: CALM_OPENINGS },
  )
  // Every draw is `2`, which is not a target this game asks for, so the arena
  // arms nothing at all.
  arena.begin(0)
  assert.equal(arena.resonator, null, "the arena armed a resonator on a target it refuses")
  assert.equal(arena.hint(), null)
  assert.deepEqual(arena.askHint(), [])
  assert.deepEqual(arena.unfold(), [])
})
