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
import { BENCH_CAP } from "../game/auction.ts"
import { POOL_EXTRA, assembleRoom, bestBid, isTrap, tightest, type Tablet } from "../game/lot.ts"
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
})

test("a ceiling only ever comes down: a higher undrawable rung cannot raise it", () => {
  // The guard this covers — `if (this.drawCeiling !== null && this.drawCeiling <= capped)
  // return` — was unguarded when it shipped. The test that claimed to cover it called
  // `begin()` a second time on a game that was already stalled, where `begin` early-
  // returns and does nothing at all, so deleting the guard left the whole suite green.
  //
  // A rung that could not be drawn once cannot be drawn later, so a ceiling that drifted
  // back up would re-enter the same starve every time the child climbed.
  let n = 0
  const wide = "1".repeat(PROMPT_MAX_CHARS + 4)
  const { host } = scriptedHost(() => {
    n++
    // The first draw is from a middling rung, everything after it from a high one. Both
    // are undrawable, and only the first may set the ceiling.
    return {
      id: `q${String(n)}`,
      prompt: `${wide} + 1`,
      answer: "12",
      distractors: [],
      domain: "add",
      difficulty: n === 1 ? 0.5 : 0.9,
    }
  })
  const game = new Auction(host, new Rng(31), 0)
  game.begin(0)
  assert.ok(n > 2, "the second, higher rung was never served")
  assert.equal(game.stalled, true)
  assert.ok(game.ceiling !== null)
  assert.ok(
    (game.ceiling ?? 1) < 0.5,
    `the ceiling is ${String(game.ceiling)}: a rung at 0.9 raised a ceiling set at 0.5`,
  )
})

test("the pool is flushed only after the new ceiling has gone out on the wire", () => {
  // POLARITY flushed the instant it set a ceiling. `game-host`'s flush ranks the pool with
  // a distance function that reads the host's OWN ceiling, and that is only updated inside
  // `next()` — so flushing first ranked every pooled question against the STALE ceiling and
  // kept precisely the rung it meant to discard. Measured there as ten consecutive silent
  // questions, about four and a half minutes.
  const calls: string[] = []
  let n = 0
  const wide = "1".repeat(PROMPT_MAX_CHARS + 4)
  const host: Host = {
    next(ask) {
      calls.push(ask?.maxDifficulty === undefined ? "ask" : "ask+ceiling")
      n++
      return {
        id: `q${String(n)}`,
        prompt: `${wide} + 1`,
        answer: "12",
        distractors: [],
        domain: "add",
        difficulty: 0.6,
      }
    },
    report() {},
    skip() {},
    flush() {
      calls.push("flush")
    },
    haptic() {},
    prefersReducedMotion: () => true,
  }
  const game = new Auction(host, new Rng(41), 0)
  game.begin(0)

  const firstFlush = calls.indexOf("flush")
  const firstCeiling = calls.indexOf("ask+ceiling")
  assert.ok(firstFlush > 0, `nothing was ever flushed: ${calls.join(" ")}`)
  assert.ok(firstCeiling > 0, `no ask ever carried the ceiling: ${calls.join(" ")}`)
  assert.ok(
    firstFlush > firstCeiling,
    `the pool was flushed at ${String(firstFlush)} before the ceiling reached the wire at ` +
      `${String(firstCeiling)}: ${calls.join(" ")}`,
  )
  // Exactly one flush per ceiling change, not one per refusal.
  assert.equal(calls.filter((c) => c === "flush").length, 1, calls.join(" "))
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
  // **The cap has to be able to bind, and it could not.** `assembleRoom` fills to
  // `want + POOL_EXTRA` and keeps `want`, so the bench it hands back holds at most
  // `POOL_EXTRA` — and `BENCH_CAP` shipped at 14 against a `POOL_EXTRA` of 10. Measured
  // over 120 lots: max bench 10, trims executed 0. So the hoard the cap exists to prevent
  // was real and unprevented, because `tightest` keeps the cluster and benches the
  // outliers: ten questions the room never wants, open in the host's ledger all session.
  assert.ok(BENCH_CAP < POOL_EXTRA, `BENCH_CAP ${String(BENCH_CAP)} can never bind`)

  // A stream that alternates a tight cluster with far outliers, so the bench fills with
  // values the room will keep passing over.
  let n = 0
  const { host, skips } = scriptedHost(() => {
    n++
    const value = n % 2 === 0 ? 100 + n : 8000 - n * 7
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
  const onABoard = new Set<string>()
  for (let i = 0; i < 24; i++) {
    const room = game.room
    if (!room) break
    for (const t of room.tablets) onABoard.add(t.id)
    game.tapTablet(0)
    const t = room.tablets[0]
    if (!t) break
    for (const ch of String(t.value + 1)) game.pressDigit(Number(ch))
    game.hammer(clock())
    game.nudge()
    game.advance(1, clock())
    assert.ok(game.benched <= BENCH_CAP, `the bench reached ${String(game.benched)}`)
  }
  assert.ok(game.trimmed > 0, "the bench never overflowed — the cap is dead code again")
  assert.equal(new Set(skips).size, skips.length, "a question was closed twice")

  // Oldest first. Every question here is usable, so a skip that never stood on a board is
  // a bench trim, and the ids this host issues ascend with the draw order.
  const trims = skips.filter((id) => !onABoard.has(id)).map((id) => Number(id.slice(1)))
  assert.equal(trims.length, game.trimmed)
  for (let i = 1; i < trims.length; i++) {
    assert.ok(
      (trims[i] ?? 0) > (trims[i - 1] ?? 0),
      `the bench was trimmed out of order: ${trims.join(", ")}`,
    )
  }
})

test("every question ever served is answered, closed, on the board or on the bench", () => {
  // The accounting invariant, which is the one the old bench test was reaching for and
  // did not state: it asserted that a count of CLOSED items was over a hundred, which
  // 24 lots of ordinary play satisfies whatever the bench does.
  let served = 0
  const answered: string[] = []
  const { host, skips } = scriptedHost(() => {
    served++
    return {
      id: `q${String(served)}`,
      prompt: `${String(served)} + 7`,
      answer: String(served + 7),
      distractors: [],
      domain: "add",
      difficulty: 0.1,
    }
  })
  const withReports: Host = {
    ...host,
    report: (r) => {
      answered.push(r.questionId)
    },
  }
  const game = new Auction(withReports, new Rng(37), 0)
  game.begin(0)
  const clock = stepClock()
  for (let i = 0; i < 30; i++) {
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
  const onBoard = game.room?.tablets.length ?? 0
  assert.equal(
    answered.length + skips.length + game.benched + onBoard,
    served,
    `${String(served)} questions served; ${String(answered.length)} answered, ` +
      `${String(skips.length)} closed, ${String(game.benched)} benched, ${String(onBoard)} on the board`,
  )

  // …and `unmount` closes the rest, which is the one path that used to leak about fifteen.
  const held = game.benched + onBoard
  game.closeAll()
  assert.equal(skips.length, served - answered.length, "unmount left questions open")
  assert.equal(game.benched, 0)
  assert.ok(held > 0, "there was nothing left to close, so this proved nothing")
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
