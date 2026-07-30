// THE ROOM ITSELF: what may be on a board, and what may never be.
//
// Four properties, each of which has been a shipped defect in this fleet:
//
//   1. **No two rivals bid the same amount.** A tie has no highest, so there is no
//      right tablet to mark and no right bid to make.
//   2. **The highest bid is equally likely to be anywhere.** COUNTERPOISE put its
//      answer in the rightmost slot 97.2% of the time and a bot that always took the
//      rightmost slot scored 97.2%.
//   3. **A rung the game cannot draw caps the stream, once, and never un-caps.**
//      Declining is per-item and the host serves by RUNG, so a rung whose answers do
//      not fit on a tablet is a soft-lock rather than a degradation.
//   4. **A duplicate value must NOT cap anything.** That is a fact about a pair of
//      questions. POLARITY capped on the equivalent item-level refusal and pinned a
//      whole session to the easiest rung in the product.

import assert from "node:assert/strict"
import { test } from "node:test"

import type { Ask, Host, Question } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { Auction } from "../game/auction.ts"
import { MAX_MARGIN, MIN_MARGIN, PROMPT_MAX_CHARS } from "../game/ladder.ts"
import { assembleRoom, bestBid, isTrap, tightest, type Tablet } from "../game/lot.ts"
import { PERFECT, rig, settleOn, stepClock } from "./harness.ts"

const SEEDS = [0x1, 0xbeef, 0x2718, 0x5eed1ce, 0xfeed, 0xd00d]

/** Every room a perfect player is shown over a long sitting. */
function rooms(seed: number, lots = 60): Array<{ values: number[]; highest: number; offer: number }> {
  const r = rig(seed)
  const clock = stepClock()
  const out: Array<{ values: number[]; highest: number; offer: number }> = []
  for (let i = 0; i < lots; i++) {
    const room = r.game.room
    if (!room) break
    out.push({
      values: room.tablets.map((t) => t.value),
      highest: room.highest,
      offer: room.offer,
    })
    PERFECT.act(r.game, room, undefined as never, clock())
    settleOn(r.game, clock)
  }
  return out
}

test("no two rivals in a room ever bid the same amount", () => {
  for (const seed of SEEDS) {
    for (const room of rooms(seed)) {
      assert.equal(
        new Set(room.values).size,
        room.values.length,
        `seed ${seed.toString(16)}: a room with a tie for the highest bid: ${room.values.join(", ")}`,
      )
      assert.equal(room.highest, Math.max(...room.values))
      assert.ok(room.values.every((v) => Number.isInteger(v) && v >= 0))
    }
  }
})

test("the highest bid is as likely to be in one position as another", () => {
  const at = new Map<number, number>()
  let total = 0
  for (const seed of SEEDS) {
    for (const room of rooms(seed, 90)) {
      const index = room.values.indexOf(room.highest)
      at.set(index, (at.get(index) ?? 0) + 1)
      total++
    }
  }
  assert.ok(total > 300, `only ${String(total)} rooms sampled`)
  // Rooms hold three to five tablets, so the first three positions always exist and
  // each should hold the highest bid roughly a quarter to a third of the time.
  for (const index of [0, 1, 2]) {
    const share = (at.get(index) ?? 0) / total
    assert.ok(
      share > 0.12,
      `the highest bid landed in position ${String(index)} on only ${(share * 100).toFixed(1)}% of ` +
        `${String(total)} rooms — the position is giving the answer away`,
    )
  }
})

test("the broker's offer stays inside the band, and a trap is exactly an offer nobody can beat", () => {
  let traps = 0
  let lots = 0
  for (const seed of SEEDS) {
    for (const room of rooms(seed, 120)) {
      const margin = room.offer - room.highest
      lots++
      assert.ok(margin >= 0 && margin <= MAX_MARGIN, `an offer ${String(margin)} above the room`)
      if (margin <= 1) {
        traps++
        assert.equal(isTrap({ tablets: [], highest: room.highest, offer: room.offer }), true)
        assert.equal(bestBid({ tablets: [], highest: room.highest, offer: room.offer }), null)
      } else {
        assert.ok(margin >= MIN_MARGIN)
        assert.equal(
          bestBid({ tablets: [], highest: room.highest, offer: room.offer }),
          room.highest + 1,
        )
      }
    }
  }
  assert.ok(traps > 8, `only ${String(traps)} unprofitable lots in ${String(lots)}`)
  assert.ok(traps / lots < 0.4, "too many lots are not worth bidding on")
})

test("the values in a room sit close together, so magnitude cannot sort them", () => {
  // This is the property `tightest` exists for. Without it — keeping whatever the host
  // happened to serve first — a room spans about three quarters of its own maximum, and
  // a board holding 9, 40 and 380 can be sorted by which numeral looks biggest without
  // working any of them out.
  const spreads: number[] = []
  for (const seed of SEEDS) {
    for (const room of rooms(seed, 90)) {
      const hi = Math.max(...room.values)
      const lo = Math.min(...room.values)
      spreads.push((hi - lo) / Math.max(1, hi))
    }
  }
  assert.ok(spreads.length > 300)
  const mean = spreads.reduce((a, b) => a + b, 0) / spreads.length
  assert.ok(
    mean < 0.6,
    `a room spans ${(mean * 100).toFixed(0)}% of its own highest bid on average — ` +
      "that is a board a child can sort by eye",
  )
})

test("a fresh run never opens with a lot nobody can profit from", () => {
  // A trap is a lesson about a rule the child has not been taught yet. The bottom of
  // the ladder is for exposure, so `trapChance` is zero there.
  for (const seed of [...SEEDS, 0x1414, 0xc0ffee, 0x2, 0x3]) {
    const first = rooms(seed, 1)[0]
    assert.ok(first)
    assert.ok(
      first.offer - first.highest >= MIN_MARGIN,
      `seed ${seed.toString(16)} opened on a lot with no profit in it`,
    )
  }
})

test("the assembler keeps the run of values that sit closest together", () => {
  const pool: Tablet[] = [2, 3, 40, 41, 42, 99].map((value, i) => ({
    id: `t${String(i)}`,
    prompt: `p${String(i)}`,
    value,
    difficulty: 0,
  }))
  const { kept, dropped } = tightest(pool, 3)
  assert.deepEqual(
    kept.map((t) => t.value),
    [40, 41, 42],
  )
  assert.deepEqual(
    dropped.map((t) => t.value).sort((a, b) => a - b),
    [2, 3, 99],
  )
  // Asking for more than there is takes everything rather than failing.
  assert.equal(tightest(pool, 99).kept.length, pool.length)
})

/** A host that serves whatever it is told to, and records what it was asked. */
function scriptedHost(script: () => Question): { host: Host; asks: Ask[]; skips: string[] } {
  const asks: Ask[] = []
  const skips: string[] = []
  const host: Host = {
    next(ask) {
      asks.push({ ...(ask ?? {}) })
      return script()
    },
    report() {},
    skip(id) {
      skips.push(id)
    },
    flush() {},
    haptic() {},
    prefersReducedMotion: () => true,
  }
  return { host, asks, skips }
}

test("a rung whose answers cannot go on a tablet caps the stream, and stays capped", () => {
  let n = 0
  // Every question is a fraction at the top of the ladder: nothing this game can put
  // a price on, and a fact about the RUNG rather than about one item.
  const { host, asks } = scriptedHost(() => {
    n++
    return {
      id: `q${String(n)}`,
      prompt: "3/4 + 1/4",
      answer: "1/2",
      distractors: [],
      domain: "frac",
      difficulty: 0.8,
    }
  })
  const game = new Auction(host, new Rng(7), 0)
  game.begin(0)
  assert.equal(game.stalled, true, "a whole rung of unusable questions did not stall the gallery")
  assert.ok(game.ceiling !== null, "the stream was never capped")
  assert.ok((game.ceiling ?? 1) < 0.8, `the ceiling ${String(game.ceiling)} does not exclude the rung`)
  const capped = asks.filter((a) => a.maxDifficulty !== undefined)
  assert.ok(capped.length > 0, "no ask ever carried a ceiling")
  assert.ok(
    (capped[0]?.maxDifficulty ?? 0) < 10,
    "the ceiling was sent as the top of the ladder rather than below the banned rung",
  )
  // Monotone: a second, higher undrawable rung must not raise it.
  const before = game.ceiling
  game.begin(0)
  assert.equal(game.ceiling, before)
})

test("a duplicate value is a fact about two questions and must never cap a rung", () => {
  // The POLARITY defect, in this game's shape. Every question here is perfectly
  // drawable; they simply collide, which the assembler resolves by drawing again.
  let n = 0
  const { host, asks } = scriptedHost(() => {
    n++
    // Two distinct values, so a board of three can never be filled — every draw after
    // the second is a collision.
    return {
      id: `q${String(n)}`,
      prompt: n % 2 === 0 ? "4 + 3" : "5 + 5",
      answer: n % 2 === 0 ? "7" : "10",
      distractors: [],
      domain: "add",
      difficulty: 0.5,
    }
  })
  const game = new Auction(host, new Rng(11), 0)
  game.begin(0)
  assert.equal(game.ceiling, null, "a value collision capped the stream")
  assert.equal(asks.every((a) => a.maxDifficulty === undefined), true)
  // Two usable values is a room: smaller than asked for, and still a comparison.
  assert.equal(game.stalled, false)
  assert.equal(game.room?.tablets.length, 2)
})

test("the shared host's dry-pool sentinel describes no rung and caps nothing", () => {
  // `game-host` answers an empty pool with `{ id: "", answer: "0", … }`. It parses and
  // it prints, so nothing here should refuse it — but if a future sentinel does not,
  // capping on it would pin the run at the easiest rung in the product for the rest of
  // the session, silently, and it would look like adaptation.
  const { host } = scriptedHost(() => ({
    id: "",
    prompt: "",
    answer: "0",
    distractors: [],
    domain: "arith",
    difficulty: 0,
  }))
  const game = new Auction(host, new Rng(13), 0)
  game.begin(0)
  assert.equal(game.ceiling, null, "the dry-pool sentinel capped the stream")

  // …and the same for a sentinel whose answer does NOT parse, which is what makes the
  // `id === ""` guard load-bearing rather than decorative. Today's sentinel answers
  // "0", which prints, so the printability check alone refuses to cap on it; the
  // sentinel belongs to the host and the next one may not print, and capping on it
  // would pin the run to the easiest rung in the product for the rest of the session,
  // silently, and it would look like adaptation.
  const future = scriptedHost(() => ({
    id: "",
    prompt: "",
    answer: "",
    distractors: [],
    domain: "arith",
    difficulty: 0.7,
  }))
  const later = new Auction(future.host, new Rng(13), 0)
  later.begin(0)
  assert.equal(later.ceiling, null, "a sentinel that does not parse capped a rung it does not describe")
})

test("a prompt too wide for a tablet is refused rather than printed off the edge", () => {
  const wide = "1".repeat(PROMPT_MAX_CHARS + 1)
  const { host } = scriptedHost(() => ({
    id: "wide",
    prompt: `${wide} + 1`,
    answer: "12",
    distractors: [],
    domain: "add",
    difficulty: 0.6,
  }))
  const game = new Auction(host, new Rng(17), 0)
  game.begin(0)
  assert.equal(game.stalled, true)
  assert.ok(game.ceiling !== null, "an unprintable prompt did not cap its rung")
})

test("a question the assembler cannot use at all is closed at once", () => {
  // Two usable values and a stream of unusable ones. The unusable ones must be closed
  // on the spot: they can never join a board or a bench, so holding them would leak.
  let n = 0
  const { host, skips } = scriptedHost(() => {
    n++
    if (n % 3 === 0) {
      return { id: `bad${String(n)}`, prompt: "1/2 + 1/2", answer: "1", distractors: [], domain: "frac", difficulty: 0.1 }
    }
    return {
      id: `q${String(n)}`,
      prompt: `${String(n)} + 1`,
      answer: String(n + 1),
      distractors: [],
      domain: "add",
      difficulty: 0.1,
    }
  })
  const game = new Auction(host, new Rng(19), 0)
  game.begin(0)
  const used = new Set(game.room?.tablets.map((t) => t.id) ?? [])
  assert.ok(used.size >= 3)
  assert.equal(
    skips.filter((id) => used.has(id)).length,
    0,
    "a question standing on the board was closed",
  )
})

test("a question the room passed over waits on the bench and can come up later", () => {
  // The bench is what buys a wide choice without drawing ten fresh questions a lot. A
  // benched question has never been shown, so a later board may use it — and because a
  // tablet that reaches a board is always answered or skipped when that board settles,
  // nothing benched can ever be reported twice.
  const r = rig(0x2718)
  const clock = stepClock()
  const seenIds = new Set<string>()
  let reused = 0
  for (let i = 0; i < 30; i++) {
    const room = r.game.room
    if (!room) break
    for (const t of room.tablets) {
      if (seenIds.has(t.id)) reused++
      seenIds.add(t.id)
    }
    PERFECT.act(r.game, room, undefined as never, clock())
    settleOn(r.game, clock)
  }
  assert.equal(reused, 0, "a question that had already been on a board came back")
  // Nothing is answered twice and nothing is both answered and closed.
  assert.equal(new Set(r.reports.map((x) => x.questionId)).size, r.reports.length)
  assert.equal(new Set(r.skips).size, r.skips.length)
  assert.equal(r.skips.filter((id) => r.reports.some((x) => x.questionId === id)).length, 0)
})

test("the bench is a buffer and not a hoard: the overflow is closed, oldest first", () => {
  // A stream of values the tightest window keeps passing over, so the bench fills.
  let n = 0
  const { host, skips } = scriptedHost(() => {
    n++
    // Alternating tight cluster and far outliers: the outliers are usable, are never
    // wanted, and would sit on the bench for the whole session without the cap.
    const value = n % 2 === 0 ? 100 + n : 5000 - n * 7
    return {
      id: `q${String(n)}`,
      prompt: `${String(value)} + 0`,
      answer: String(value),
      distractors: [],
      domain: "add",
      difficulty: 0.1,
    }
  })
  const game = new Auction(host, new Rng(29), 0)
  game.begin(0)
  const clock = stepClock()
  for (let i = 0; i < 20; i++) {
    const room = game.room
    if (!room) break
    game.tapTablet(0)
    const t = room.tablets[0]
    if (!t) break
    for (const ch of String(t.value + 1)) game.pressDigit(Number(ch))
    game.hammer(clock())
    game.nudge()
    game.advance(1, clock())
  }
  assert.ok(skips.length > 0, "the bench grew without bound — nothing was ever closed")
  assert.equal(new Set(skips).size, skips.length, "a question was closed twice")
})

test("a room is assembled from the host and never from a constant", () => {
  // "In all games, we want random generation and surprise ... we basically don't ever
  // want that." Two different seeds must not produce the same opening room, and the
  // same seed must reproduce it exactly.
  const a = rooms(0x1, 3)
  const b = rooms(0xbeef, 3)
  const again = rooms(0x1, 3)
  assert.deepEqual(again, a, "the same seed did not reproduce the same rooms")
  assert.notDeepEqual(b, a, "two different seeds produced the same auction")
})

test("assembleRoom asks through the caller's closure on every single draw", () => {
  // The ceiling has to reach the wire mid-board, not one board later: a rung that
  // cannot be drawn is discovered on the second tablet and the third must not be
  // asked for at the same difficulty.
  const seen: number[] = []
  let want = 0.9
  const assembly = assembleRoom(
    () => {
      seen.push(want)
      want -= 0.1
      return {
        id: `q${String(seen.length)}`,
        prompt: `${String(seen.length)} + 2`,
        answer: String(seen.length + 2),
        distractors: [],
        domain: "add",
        difficulty: 0.2,
      }
    },
    3,
    0.2,
    new Rng(23),
    () => {
      throw new Error("nothing here is undrawable")
    },
  )
  assert.ok(assembly.room)
  assert.ok(seen.length >= 3)
  assert.notEqual(seen[0], seen[1], "the closure was read once and cached")
})
