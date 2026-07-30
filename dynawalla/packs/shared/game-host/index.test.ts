// The difficulty wire, held to the promises it makes.
//
// Every test here runs against `attachGameHost` and a fake `HostClient`, which
// is the whole reason that seam exists: the adapter's interesting behaviour —
// which question comes out next, and why — needs no window, no parent frame and
// no `MessagePort`.
//
// The fake host is a ladder of 16 rungs. Rung 0 is the easiest content it has
// and rung 15 the hardest, and — like the real one — it stands somewhere in the
// middle until a pack tells it otherwise. That is the situation the whole
// design is for: a child is being served questions at rung 12, is struggling,
// and the game knows it. What has to happen next is that the *next* question is
// easier, not the thirty-third.

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Capability, HostClient, Item, ItemRequest, Judgement, Settings } from "../../sdk/src/index.ts"
import { MAX_REQUESTS_PER_SECOND } from "../../sdk/src/index.ts"
import type { GameHostOptions, MountedHost } from "./index.ts"
import {
  attachDeclared,
  attachGameHost as attachOnClock,
  declaredSkills,
  domainOf,
  packRootUrl,
  toUnit,
  ACQUIRE_MAX_CALLS,
  FLUSH_KEEP,
  POOL_FLOOR,
  POOL_TARGET,
  PREFETCH_BUDGET,
  RATE_WINDOW_MS,
} from "./index.ts"

/**
 * How long a fake round trip takes.
 *
 * The adapter now measures what it spends of the host's per-second request
 * budget (`PREFETCH_BUDGET`), so a fake host that answers in *zero* elapsed time
 * is no longer a neutral fake: it models a wire with infinite bandwidth, and
 * every test below that serves two dozen questions would be claiming a child
 * answered them all inside the same millisecond. Fifteen milliseconds a call is
 * a plausible `postMessage` round trip through the host's generator, and every
 * method the adapter charges spends one — see `tick`, which is separate from
 * `record` for exactly that reason. That puts the fake at 66 calls a second:
 * measured peak 67 in any virtual second against a gate of 84, so the pacing
 * never binds and every assertion in this file means what it meant before it
 * existed. The two `[measured]` lines this file prints are byte-identical to the
 * ones it printed on main, which is the check that says so.
 *
 * A test that wants the *worst* case says so, by passing a frozen clock: see
 * "an attach and a first question stay inside the host's own rate limit".
 */
const ROUND_TRIP_MS = 15

/** Virtual milliseconds. Monotonic across the file; only ever moves forward. */
let clock = 0

/** `attachGameHost` on that clock, unless a test brings its own. */
const attachGameHost = (client: HostClient, options: GameHostOptions = {}): MountedHost =>
  attachOnClock(client, { now: () => clock, ...options })

/** Rungs on the fake host's ladder. Enough that 1/16 is a visible step. */
const RUNGS = 16

/** Where the fake host stands before anybody asks it for anything. */
const RESTING_RUNG = 12

const SETTINGS: Settings = {
  locale: "en",
  reducedMotion: false,
  quality: "high",
  textScale: 1,
  colorScheme: "light",
  sound: true,
  haptics: true,
}

/** Named by the SDK, so the fake cannot drift from the real wire. */
type Ask = ItemRequest

type Fake = {
  readonly client: HostClient
  /** Every `nextItem` call, in order. */
  readonly asks: Ask[]
  /** Every method called on the client, in order. The host counts these. */
  readonly calls: string[]
  /** Every `answer` call, in order. */
  readonly answers: { itemId: string; response: string }[]
  /** Every `items.skip` call, in order. */
  readonly skips: string[]
  /** The host's verdict on the next answer, whatever the pack claims. */
  verdict: boolean
  /** Make `answer` reject, to prove the pack's own belief still survives. */
  answerFails: boolean
  /** Make `skip` reject, as an older host with no such method would. */
  skipFails: boolean
  /**
   * The rung the fake's own ladder is standing on, which a test may move.
   *
   * The real host's position moves on every answer, and a fake that stands still
   * forever cannot show the defect this exists for: a pool stocked at rung 0
   * being served to a child the ladder has already carried to rung 25.
   */
  standing: number
}

/**
 * A host with a ladder, a resting position, and no opinions of its own.
 *
 * `difficulty` on the way in is 0..1 across the whole ladder, and the item that
 * comes back says which rung it came from on the same scale. That is exactly
 * the contract the real `items.ts` implements; this is the smallest thing that
 * implements it too.
 */
function fakeHost(
  options: {
    granted?: Capability[]
    rungs?: number
    /** The skill each rung belongs to. Default: four rungs per `arith.rung.N`. */
    skillAt?: (index: number) => string
  } = {},
): Fake {
  const rungs = options.rungs ?? RUNGS
  const skillAt = options.skillAt ?? ((index: number) => `arith.rung.${String(Math.floor(index / 4))}`)
  const asks: Ask[] = []
  const calls: string[] = []
  /**
   * A round trip's worth of virtual time.
   *
   * Separate from `record` because three of the methods the adapter CHARGES —
   * `haptic`, `progress` and `transition` — are deliberately not in `calls`,
   * which several tests count. They still cross the wire and still cost time, and
   * a fake that charged them without spending any clock ran at 89 charged calls a
   * virtual second: over the prefetch gate, which stalled the top-up half way
   * through `skillsServed(24)` and quietly made the budget, rather than the pool
   * logic, the thing that test was measuring.
   */
  const tick = (): void => {
    clock += ROUND_TRIP_MS
  }

  /** One call across the wire: recorded, and the clock moves by a round trip. */
  const record = (method: string): void => {
    calls.push(method)
    tick()
  }
  const answers: { itemId: string; response: string }[] = []
  const skips: string[] = []
  const canonicals = new Map<string, string>()
  let sequence = 0

  const fake: Fake = {
    verdict: true,
    answerFails: false,
    skipFails: false,
    standing: RESTING_RUNG,
    asks,
    calls,
    answers,
    skips,
    client: {
      packId: "dynawalla.test",
      hostVersion: "0.1.0",
      granted: options.granted ?? ["items", "items.reveal", "haptics"],
      // Every capability this stub is granted works, and none of them is
      // native-backed. `usable`, `available` and `tilt` are the native-capability
      // surface (SDK 1.1, `docs/NATIVE_CAPABILITIES.md`); nothing in this file
      // exercises one, so the stub reports "everything granted works" and a tilt
      // reader that is honestly unavailable.
      usable: options.granted ?? ["items", "items.reveal", "haptics"],
      available: () => true,
      tilt: { available: false, start: () => () => {} },
      settings: SETTINGS,
      can: () => true,

      nextItem: (ask: Ask = {}) => {
        asks.push(ask)
        record("items.next")
        const span = Math.max(1, rungs - 1)
        const cap = ask.maxDifficulty === undefined ? 1 : ask.maxDifficulty
        const wanted = ask.difficulty === undefined ? fake.standing / span : ask.difficulty
        let index = Math.max(
          0,
          Math.min(rungs - 1, Math.round(Math.min(wanted, cap) * span)),
        )
        // A named skill wins outright and is served at the FIRST rung that
        // carries it, whatever the difficulty and whatever the ceiling. That is
        // not a simplification: the shipped host is `rungs.find(r => r.node.id
        // === skillId) ?? rungAt(drawn)`, measured returning ordinate 0.28 for a
        // pin sent with `difficulty: 0.9`, and 0.28 again for the same pin sent
        // with `maxDifficulty: 0.1`. An unknown id is ignored, as it is there.
        if (ask.skillId !== undefined) {
          for (let rung = 0; rung < rungs; rung++) {
            if (skillAt(rung) === ask.skillId) {
              index = rung
              break
            }
          }
        }
        sequence += 1
        const item: Item = {
          id: `i${String(sequence)}`,
          skillId: skillAt(index),
          // Deliberately NOT the ladder ordinate: `level` is the level within a
          // skill, which is what the shipped host puts here and what the old
          // read-back mistook for a difficulty.
          level: index % 4,
          difficulty: index / span,
          form: "binary-op",
          operator: "+",
          operands: [String(index), "1"],
          prompt: `${String(index)} + 1`,
          choices: [
            { id: "c0", text: String(index + 1) },
            { id: "c1", text: "999" },
          ],
          answerKind: "integer",
        }
        canonicals.set(item.id, String(index + 1))
        return Promise.resolve(item)
      },

      answer: (input) => {
        record("items.answer")
        answers.push({ itemId: input.itemId, response: input.response })
        if (fake.answerFails) return Promise.reject(new Error("the host is gone"))
        return Promise.resolve({
          correct: fake.verdict,
          canonical: "1",
          advance: fake.verdict,
        } satisfies Judgement)
      },
      skip: (itemId) => {
        record("items.skip")
        skips.push(itemId)
        // What an older host — one shipped before `items.skip` existed — would
        // do with the call, so the adapter is held to surviving it.
        if (fake.skipFails) return Promise.reject(new Error("unknown method: items.skip"))
        return Promise.resolve()
      },
      reveal: (itemId) => {
        record("items.reveal")
        return Promise.resolve(canonicals.get(itemId) ?? "")
      },
      learnerSummary: () => Promise.resolve({ skills: [] }),
      haptic: () => {
        tick()
        return Promise.resolve()
      },
      sound: () => Promise.resolve(),
      milestone: () => Promise.resolve(),
      storage: {
        get: () => Promise.resolve(null),
        set: () => Promise.resolve(),
        remove: () => Promise.resolve(),
        keys: () => Promise.resolve([]),
      },
      progress: () => {
        tick()
        return Promise.resolve()
      },
      end: () => Promise.resolve(),
      transition: () => {
        tick()
        return Promise.resolve()
      },
      on: () => () => {},
      dispose: () => {},
    },
  }
  return fake
}

/** Let every queued promise and timer callback run out. */
async function settle(rounds = 12): Promise<void> {
  for (let i = 0; i < rounds; i++) await new Promise((resolve) => setImmediate(resolve))
}

/** Run `body` with the console captured, and hand back what it said. */
async function withConsole(body: () => Promise<void>): Promise<string[]> {
  const said: string[] = []
  const warn = console.warn
  const error = console.error
  const take = (...args: unknown[]) => {
    said.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(" "))
  }
  console.warn = take
  console.error = take
  try {
    await body()
  } finally {
    console.warn = warn
    console.error = error
  }
  return said
}

// ─── The request reaches the item ────────────────────────────────────────────

test("toUnit reads both scales the games already speak, and clamps the rest", () => {
  // The 0..1 scale — polarity, trebuchet, siege.
  assert.equal(toUnit(0), 0)
  assert.equal(toUnit(0.2), 0.2)
  // The one ambiguous value, resolved towards the bottom and stated in `toUnit`.
  assert.equal(toUnit(1), 0)
  // The 1..10 ladder — arena, horde, merge-idle, rhythm, slice, stack, beam.
  assert.equal(toUnit(10), 1)
  assert.equal(toUnit(5.5), 0.5)
  // Out of range on either side, and not a number at all.
  assert.equal(toUnit(12), 1)
  assert.equal(toUnit(-4), 0)
  assert.equal(toUnit(Number.NaN), null)
  assert.equal(toUnit(Number.POSITIVE_INFINITY), null)
})

test("a difficulty a game asks for selects the question it gets back", async () => {
  const fake = fakeHost()
  const mounted = attachGameHost(fake.client)
  await mounted.warm()

  const resting = mounted.host.next()
  assert.ok(
    resting.difficulty > 0.6,
    `the host was resting at rung ${String(RESTING_RUNG)} and served ${String(resting.difficulty)}`,
  )

  // The child is struggling. The game says so, on the 1..10 scale six of the
  // eight already-passing games speak.
  mounted.host.next({ difficulty: 1 })
  await settle()
  const easy = mounted.host.next({ difficulty: 1 })
  assert.ok(
    easy.difficulty <= 0.1,
    `asked for the bottom of the ladder and got ${String(easy.difficulty)}`,
  )

  // And back up again — this is not a one-way ratchet.
  mounted.host.next({ difficulty: 10 })
  await settle()
  const hard = mounted.host.next({ difficulty: 10 })
  assert.ok(
    hard.difficulty >= 0.9,
    `asked for the top of the ladder and got ${String(hard.difficulty)}`,
  )
  mounted.dispose()
})

test("the requested difficulty travels down the wire, not just into the pool", async () => {
  const fake = fakeHost()
  const mounted = attachGameHost(fake.client)
  await mounted.warm()
  fake.asks.length = 0

  mounted.host.next({ difficulty: 2 })
  await settle()

  const carried = fake.asks.filter((ask) => ask.difficulty !== undefined)
  assert.ok(carried.length > 0, "no nextItem call carried a difficulty")
  for (const ask of carried) {
    assert.ok(
      ask.difficulty !== undefined && Math.abs(ask.difficulty - toUnit(2)!) < 1e-9,
      `the host was asked for ${String(ask.difficulty)}, not ${String(toUnit(2))}`,
    )
  }
  mounted.dispose()
})

test("Question.difficulty reads the ladder the host actually used, not the level within a skill", async () => {
  const fake = fakeHost()
  const mounted = attachGameHost(fake.client)
  await mounted.warm()
  mounted.host.next({ difficulty: 10 })
  await settle()
  const q = mounted.host.next({ difficulty: 10 })
  // The fake's top rung is index 15, whose `level` is 15 % 4 === 3. The old
  // read-back was `level / 8`, so the hardest question the host has would have
  // read 0.375 — and colossus and siege, which branch on 0..1, would call the
  // hardest content in the product "easy".
  assert.equal(q.difficulty, 1, `the top of the ladder read as ${String(q.difficulty)}`)
  mounted.dispose()
})

test("a ceiling is a ceiling: maxDifficulty is never exceeded", async () => {
  const fake = fakeHost()
  const mounted = attachGameHost(fake.client)
  await mounted.warm()
  for (let i = 0; i < 6; i++) {
    mounted.host.next({ difficulty: 10, maxDifficulty: 4 })
    await settle(4)
  }
  for (let i = 0; i < 10; i++) {
    const q = mounted.host.next({ difficulty: 10, maxDifficulty: 4 })
    assert.ok(
      q.difficulty <= toUnit(4)! + 1e-9,
      `the ceiling was ${String(toUnit(4))} and the question came back at ${String(q.difficulty)}`,
    )
  }
  mounted.dispose()
})

// ─── Flush: how many questions a change costs ────────────────────────────────

/**
 * How many questions a game has to serve before the stream follows a change.
 *
 * This is the measurement the whole prefetch pool argument turns on, so it is
 * counted rather than asserted about: ask for the bottom of the ladder, then
 * count questions until one actually arrives from there.
 */
async function questionsUntilEasy(mounted: ReturnType<typeof attachGameHost>): Promise<number> {
  for (let n = 1; n <= 200; n++) {
    const q = mounted.host.next({ difficulty: 1 })
    if (q.difficulty <= 0.1) return n
    await settle(3)
  }
  return Number.POSITIVE_INFINITY
}

test("a difficulty change lands next question, and the pool is re-stocked for it", async () => {
  // Both arms start from a *full* pool — `warm` awaits the floor and tops up in
  // the background, and it is the topped-up sixty-four that a real game meets.
  //
  // This test used to read "without a flush the change lands a whole pool later",
  // and the reason it no longer can is worth stating: the pool used to be
  // refilled in batches of thirty-two, when it drained past `POOL_FLOOR`, so
  // between batches there was nothing stocked at the new difficulty for the
  // *search* to find and the flush was the only thing that could help. It is
  // topped up one question at a time now — for a different reason, see `fresh` in
  // `index.ts` — so the search alone lands a change within a question or two even
  // with `autoFlush` off. What the flush still does, and what is asserted here,
  // is discard the sixty-four questions the child will now never see, so the pool
  // in front of them is stocked for where they are rather than where they were.
  const measure = async (autoFlush: boolean) => {
    const fake = fakeHost()
    const mounted = attachGameHost(fake.client, { autoFlush })
    await mounted.warm()
    await settle()
    const asked = fake.asks.length
    const questions = await questionsUntilEasy(mounted)
    await settle()
    const stocked = fake.asks.length - asked
    mounted.dispose()
    return { questions, stocked }
  }
  const stale = await measure(false)
  const fresh = await measure(true)

  console.log(
    `[measured] questions until a difficulty change lands: ` +
      `${String(stale.questions)} → ${String(fresh.questions)}; questions re-stocked for it: ` +
      `${String(stale.stocked)} → ${String(fresh.stocked)}`,
  )

  assert.ok(
    fresh.questions <= 2,
    `a flushed pool should follow within 2 questions, not ${String(fresh.questions)}`,
  )
  // A pool that was only searched grows back by the handful of questions that
  // were taken out of it. A pool that was flushed is trimmed to `FLUSH_KEEP` and
  // has to be refetched, which is most of `POOL_TARGET`.
  assert.ok(
    fresh.stocked > POOL_FLOOR,
    `a flush should re-stock more than ${String(POOL_FLOOR)} questions for the new difficulty, ` +
      `not ${String(fresh.stocked)}`,
  )
  assert.ok(
    stale.stocked < POOL_FLOOR,
    `with autoFlush off nothing should be discarded, so nothing much should be re-stocked; ` +
      `${String(stale.stocked)} questions were`,
  )
})

test("a game that drives no difficulty at all still gets the host's current rung", async () => {
  // THE test for the founder's report. TRUE DRAW calls `host.next()` with no
  // arguments — it has no difficulty model of its own and does not want one — so
  // `target` is never set, and the flush used to return early on exactly that.
  // The pool it was handed at `warm()` was therefore stocked at whatever rung the
  // ladder stood on before the child answered anything, and stayed in front of
  // the child for the whole depth of the pool, permanently:
  //
  //   "I've gotten 10 correct in a row fast and I still get 2+0=1 ... 25 in a
  //    row max speed and I get 2+0=1"
  //
  // Here the host's ladder starts at the bottom and is carried to the top, which
  // is what twenty-five correct answers do to it. The question is how many
  // questions a child has to answer before they see it.
  // The measured depth on the code this replaces, on this same fake, was **65
  // questions** — `POOL_FLOOR` awaited by `warm()` plus the top-up to
  // `POOL_TARGET` on the first hand-out, and then never refreshed. It is not
  // reproducible from here by flipping `autoFlush`, because three separate things
  // had to change to fix it and that option only disables one: the pool is now
  // *aimed* at the host's own position (`fresh`), *searched* against that aim,
  // and topped up one question at a time so the aim is current. Delete any one of
  // them and this test fails — measured at 65, 65 and 34 respectively.
  const fake = fakeHost()
  fake.standing = 0
  const mounted = attachGameHost(fake.client)
  await mounted.warm()
  await settle()
  // The ladder moves, exactly as `items.ts` moves it on a correct answer. The
  // game is told nothing and asks for nothing.
  fake.standing = RUNGS - 1
  const asked = fake.asks.length
  let served = Number.POSITIVE_INFINITY
  for (let n = 1; n <= 400; n++) {
    const q = mounted.host.next()
    if (q.difficulty >= 0.9) {
      served = n
      break
    }
    await settle(3)
  }
  await settle()
  // Searched *and* discarded. Finding the one fresh question in a pool of
  // sixty-four stale ones is what makes the next question right; throwing the
  // sixty-four away is what makes the question after that right too, and it is a
  // separate mechanism (`maybeFlush` from `take`) with a separate failure mode. A
  // pool that was only searched grows back by the handful taken out of it.
  const stocked = fake.asks.length - asked
  mounted.dispose()
  console.log(
    `[measured] questions a game driving no difficulty serves before it sees the host's own ` +
      `rung: ${String(served)} (was 65); questions re-stocked for it: ${String(stocked)}`,
  )
  assert.ok(
    served <= 8,
    `a game that drives nothing waited ${String(served)} questions for the ladder it is standing ` +
      `on; the pool is aimed at the host's own position now, so it should be a handful`,
  )
  assert.ok(
    stocked > POOL_FLOOR,
    `the stale pool was searched but never discarded: only ${String(stocked)} questions were ` +
      `re-stocked for the rung the child is now on, so most of what is queued in front of them ` +
      `is still the rung they left`,
  )
})

test("flush never empties the pool, so a flushed question is still reportable", async () => {
  const fake = fakeHost()
  const mounted = attachGameHost(fake.client)
  await mounted.warm()
  for (let i = 0; i < 8; i++) {
    mounted.host.flush()
    const q = mounted.host.next({ difficulty: 1 + i })
    assert.notEqual(q.id, "", "the pool ran dry, so this question cannot be reported")
    assert.notEqual(q.prompt, "")
    // A frame's worth of time, which is more than the refill needs and less
    // than a child needs to read a question.
    await settle(2)
  }
  mounted.dispose()
})

// ─── The verdict is kept ─────────────────────────────────────────────────────

test("what the game believed and what the host decided are both kept", async () => {
  const fake = fakeHost()
  const seen: { claimed: boolean; correct: boolean; judged: boolean; difficulty: number }[] = []
  const mounted = attachGameHost(fake.client, {
    onOutcome: (o) => seen.push({ claimed: o.claimed, correct: o.correct, judged: o.judged, difficulty: o.difficulty }),
  })
  await mounted.warm()

  const q = mounted.host.next()
  fake.verdict = false
  mounted.host.report({ questionId: q.id, correct: true, ms: 900, answered: "7" })
  await settle()

  assert.equal(seen.length, 1)
  assert.equal(seen[0]?.claimed, true, "the game's own verdict was thrown away")
  assert.equal(seen[0]?.correct, false, "the host's verdict was thrown away")
  assert.equal(seen[0]?.judged, true)
  assert.equal(seen[0]?.difficulty, q.difficulty)

  const recent = mounted.host.recentOutcomes()
  assert.equal(recent.length, 1)
  assert.equal(recent[0]?.correct, false)
  mounted.dispose()
})

test("a host that cannot be reached does not cost the child their answer", async () => {
  const fake = fakeHost()
  fake.answerFails = true
  const mounted = attachGameHost(fake.client)
  await withConsole(async () => {
    await mounted.warm()
    const q = mounted.host.next()
    mounted.host.report({ questionId: q.id, correct: true, ms: 500, answered: "7" })
    await settle()
  })
  const recent = mounted.host.recentOutcomes()
  assert.equal(recent.length, 1, "the outcome vanished with the failed round trip")
  assert.equal(recent[0]?.claimed, true)
  assert.equal(recent[0]?.correct, true, "with no host verdict the game's belief is the record")
  assert.equal(recent[0]?.judged, false, "an unjudged outcome must say it is unjudged")
  mounted.dispose()
})

test("an outcome is recorded once, and only for a question this module served", async () => {
  const fake = fakeHost()
  const mounted = attachGameHost(fake.client)
  await mounted.warm()
  const q = mounted.host.next()
  mounted.host.report({ questionId: q.id, correct: true, ms: 100, answered: "1" })
  mounted.host.report({ questionId: q.id, correct: false, ms: 100, answered: "2" })
  mounted.host.report({ questionId: "never-served", correct: true, ms: 100, answered: "3" })
  mounted.host.report({ questionId: "", correct: true, ms: 100, answered: "4" })
  await settle()
  assert.equal(mounted.host.recentOutcomes().length, 1)
  mounted.dispose()
})

// ─── A question that was never answered ──────────────────────────────────────
//
// A timeout is not a wrong answer. Six games used to report one as
// `{ correct: false, answered: "" }`, which this adapter forwarded to
// `items.answer` as an empty response — and an empty response does not parse,
// so the host filed a miss and stepped the child's ladder down for not having
// finished in time. Those games now say nothing at all, which is honest and
// leaves the item open. `skip` is the ending that is honest *and* closed.

test("a question the child never answered is closed on the host, and closed as a skip", async () => {
  const fake = fakeHost()
  const mounted = attachGameHost(fake.client)
  await mounted.warm()

  const q = mounted.host.next()
  mounted.host.skip(q.id)
  await settle()

  assert.deepEqual(fake.skips, [q.id], `items.skip was not reached: ${JSON.stringify(fake.skips)}`)
  // And emphatically not through the method that records a wrong attempt. This
  // is the line the whole fix exists for: an empty response *is* a miss.
  assert.deepEqual(
    fake.answers,
    [],
    `a skip reached items.answer as ${JSON.stringify(fake.answers)}, which is a recorded miss`,
  )
  mounted.dispose()
})

test("a skip is an absence of evidence: no outcome, no verdict, no progress", async () => {
  const fake = fakeHost()
  const outcomes: unknown[] = []
  const progress: number[] = []
  const mounted = attachGameHost(fake.client, {
    onOutcome: (o) => outcomes.push(o),
    onProgress: (f) => progress.push(f),
  })
  await mounted.warm()

  const skipped = mounted.host.next()
  mounted.host.skip(skipped.id)
  await settle()

  assert.deepEqual(outcomes, [], "a skip produced an outcome a pacing controller would read")
  assert.deepEqual(
    mounted.host.recentOutcomes(),
    [],
    "a skip is in recentOutcomes, where a controller will count it against the child",
  )
  assert.deepEqual(progress, [], "a skip advanced the session progress, which counts answers")

  // An answered question, immediately after, still does all three — the skip
  // suppressed the record of itself and nothing else.
  const answered = mounted.host.next()
  mounted.host.report({ questionId: answered.id, correct: true, ms: 400, answered: "7" })
  await settle()
  assert.equal(mounted.host.recentOutcomes().length, 1, "a real answer stopped being recorded")
  assert.equal(progress.length, 1, "a real answer stopped advancing progress")
  mounted.dispose()
})

test("skipping is final: an answer reported afterwards is not recorded either", async () => {
  const fake = fakeHost()
  const mounted = attachGameHost(fake.client)
  await mounted.warm()

  const q = mounted.host.next()
  mounted.host.skip(q.id)
  // A late strike, a queued input, a second code path in the game. Whatever it
  // is, the item is closed, and reopening it is how a timeout becomes a miss by
  // another route.
  mounted.host.report({ questionId: q.id, correct: false, ms: 9000, answered: "" })
  await settle()

  assert.deepEqual(
    fake.answers,
    [],
    `an answer after a skip reached the host: ${JSON.stringify(fake.answers)}`,
  )
  assert.deepEqual(mounted.host.recentOutcomes(), [], "an answer after a skip was recorded")
  mounted.dispose()
})

test("and the other way round: a skip after an answer does not close it twice", async () => {
  const fake = fakeHost()
  const mounted = attachGameHost(fake.client)
  await mounted.warm()

  const q = mounted.host.next()
  mounted.host.report({ questionId: q.id, correct: true, ms: 400, answered: "7" })
  mounted.host.skip(q.id)
  // Ids this module never served, and the id the dry pool hands out.
  mounted.host.skip("never-served")
  mounted.host.skip("")
  await settle()

  assert.equal(mounted.host.recentOutcomes().length, 1, "the answer was lost")
  assert.deepEqual(fake.skips, [], `unserved ids reached the wire: ${JSON.stringify(fake.skips)}`)
  mounted.dispose()
})

test("a skipped question does not come straight back, with or without a flush", async () => {
  const fake = fakeHost()
  const mounted = attachGameHost(fake.client)
  await mounted.warm()

  const skipped = mounted.host.next()
  mounted.host.skip(skipped.id)
  await settle()

  const later: string[] = []
  for (let i = 0; i < 30; i++) {
    later.push(mounted.host.next().id)
    if (i === 4) mounted.host.flush()
    if (i % 6 === 0) await settle(2)
  }
  assert.ok(
    !later.includes(skipped.id),
    `the question that just timed out was served again at position ${String(later.indexOf(skipped.id) + 1)}`,
  )
  mounted.dispose()
})

test("a skip asks for nothing: it does not move the difficulty or flush the pool", async () => {
  const fake = fakeHost()
  const mounted = attachGameHost(fake.client)
  await mounted.warm()
  await settle()
  fake.asks.length = 0

  for (let i = 0; i < 6; i++) {
    const q = mounted.host.next()
    mounted.host.skip(q.id)
    await settle(2)
  }

  // A child who ran out of time has told us nothing about what they know, so
  // this module says nothing about it either. Anything else would be this
  // module deciding a difficulty, which is a controller's job and not its own.
  assert.equal(
    fake.asks.every((ask) => ask.difficulty === undefined && ask.maxDifficulty === undefined),
    true,
    `skipping put a difficulty on the wire: ${JSON.stringify(fake.asks.slice(0, 4))}`,
  )
  mounted.dispose()
})

test("a host that cannot take a skip says so once, and the item is still not recorded", async () => {
  const fake = fakeHost()
  fake.skipFails = true
  const mounted = attachGameHost(fake.client)
  const said = await withConsole(async () => {
    await mounted.warm()
    const first = mounted.host.next()
    mounted.host.skip(first.id)
    // The same failure again, and again: a game with a per-gate timer produces
    // one of these a second, and a message printed a thousand times is not read.
    for (let i = 0; i < 5; i++) {
      const q = mounted.host.next()
      mounted.host.skip(q.id)
    }
    await settle()
    mounted.host.report({ questionId: first.id, correct: false, ms: 9000, answered: "" })
    await settle()
  })

  const complaints = said.filter((line) => line.includes("could not be closed"))
  assert.equal(complaints.length, 1, `said ${String(complaints.length)} times: ${said.join(" | ")}`)
  // The half of the fix that does not need the host: the item is gone from this
  // module's ledger, so nothing can turn it into a wrong attempt afterwards.
  assert.deepEqual(fake.answers, [], "a failed skip left the item answerable, so it became a miss")
  assert.deepEqual(mounted.host.recentOutcomes(), [], "a failed skip still produced an outcome")
  mounted.dispose()
})

test("a pack that never skips never touches the skip wire", async () => {
  const fake = fakeHost()
  const mounted = attachGameHost(fake.client)
  await mounted.warm()
  for (let i = 0; i < 10; i++) {
    const q = mounted.host.next({ difficulty: 4 })
    mounted.host.report({ questionId: q.id, correct: true, ms: 300, answered: q.answer })
    await settle(2)
  }
  assert.deepEqual(fake.skips, [], "the twenty-seven packs that never skip started skipping")
  assert.equal(fake.answers.length, 10)
  mounted.dispose()
})

// ─── Nothing silent ──────────────────────────────────────────────────────────

test("a difficulty outside every scale is clamped and said out loud", async () => {
  const said = await withConsole(async () => {
    const mounted = attachGameHost(fakeHost().client)
    await mounted.warm()
    mounted.host.next({ difficulty: 40 })
    mounted.host.next({ difficulty: Number.NaN })
    await settle()
    mounted.dispose()
  })
  assert.ok(
    said.some((line) => line.includes("40")),
    `nothing was said about a difficulty of 40: ${said.join(" | ")}`,
  )
  assert.ok(
    said.some((line) => line.toLowerCase().includes("nan")),
    `nothing was said about a difficulty of NaN: ${said.join(" | ")}`,
  )
})

test("a request under the curriculum's floor clamps to the easiest rung and names it", async () => {
  const said = await withConsole(async () => {
    const mounted = attachGameHost(fakeHost().client)
    await mounted.warm()
    for (let i = 0; i < 4; i++) {
      mounted.host.next({ difficulty: 0 })
      await settle(4)
    }
    mounted.dispose()
  })
  const floor = said.filter((line) => line.includes("easiest"))
  assert.ok(floor.length > 0, `the floor was hit silently: ${said.join(" | ")}`)
  assert.ok(
    floor[0]?.includes("arith.rung.0"),
    `the floor notice does not name the rung it stopped at: ${String(floor[0])}`,
  )
  // Loud once, not once a frame: a warning a game prints sixty times a second
  // is a warning nobody reads.
  assert.equal(floor.length, 1, `the floor notice repeated ${String(floor.length)} times`)
})

// ─── Backwards compatibility ─────────────────────────────────────────────────

test("a game that passes nothing gets exactly what it got before", async () => {
  const fake = fakeHost()
  const mounted = attachGameHost(fake.client)
  await mounted.warm()

  const drawn: string[] = []
  for (let i = 0; i < 20; i++) drawn.push(mounted.host.next().id)

  // FIFO, in the order the host served them, with no difficulty on the wire.
  assert.deepEqual(drawn, Array.from({ length: 20 }, (_, i) => `i${String(i + 1)}`))
  assert.equal(
    fake.asks.every((ask) => ask.difficulty === undefined && ask.maxDifficulty === undefined),
    true,
    "a game that asked for nothing put a difficulty on the wire",
  )
  mounted.dispose()
})

test("focus still wins over difficulty, because a chip has to say a number", async () => {
  const fake = fakeHost()
  const mounted = attachGameHost(fake.client)
  await mounted.warm()
  // Rung 15 is "15 + 1", whose answer is 16.
  mounted.host.next({ difficulty: 10 })
  await settle()
  mounted.host.focus({ key: 1, wanted: [16] })
  const q = mounted.host.next({ difficulty: 1 })
  assert.equal(q.answer, "16", "a focused value was dropped in favour of a difficulty")
  mounted.dispose()
})

test("setDifficulty and raiseFloor are real, so trebuchet and siege stop talking to nobody", async () => {
  const fake = fakeHost()
  const mounted = attachGameHost(fake.client)
  await mounted.warm()

  mounted.host.setDifficulty(0.05)
  await settle()
  assert.ok(mounted.host.next().difficulty <= 0.1, "setDifficulty did nothing")

  // siege's floor: never lets the maths fall below what the wave justifies.
  mounted.host.raiseFloor(0.7)
  await settle()
  const held = mounted.host.next({ difficulty: 0 })
  assert.ok(
    held.difficulty >= 0.65,
    `a raised floor of 0.7 was undercut at ${String(held.difficulty)}`,
  )
  // And it never lowers.
  mounted.host.raiseFloor(0.1)
  await settle()
  assert.ok(mounted.host.next({ difficulty: 0 }).difficulty >= 0.65, "raiseFloor lowered the floor")
  mounted.dispose()
})

test("a per-call domain is the label the question carries", async () => {
  const mounted = attachGameHost(fakeHost().client, { domain: "arith" })
  await mounted.warm()
  assert.equal(mounted.host.next().domain, "arith")
  assert.equal(mounted.host.next({ domain: "add" }).domain, "add")
  mounted.dispose()
})

test("the one value the two scales disagree about is not read in silence", async () => {
  const said = await withConsole(async () => {
    const mounted = attachGameHost(fakeHost().client)
    await mounted.warm()
    mounted.host.next({ difficulty: 1 })
    mounted.host.next({ difficulty: 1 })
    await settle()
    mounted.dispose()
  })
  const notes = said.filter((line) => line.includes("exactly 1"))
  assert.equal(notes.length, 1, `said ${String(notes.length)} times: ${said.join(" | ")}`)
  assert.ok(notes[0]?.includes("BOTTOM"), `the notice does not say which reading won: ${String(notes[0])}`)
})

// ─── The other axis: what kind of maths, not how hard ────────────────────────
//
// The ladder these tests use is the shipped one in miniature: 16 rungs, four
// skills, two domains, and the domains interleaved the way the real curriculum
// interleaves them — `dw.mul` sits in the MIDDLE of the ladder, between two
// bands of `dw.add`, because that is the fact that makes difficulty an
// insufficient axis. On the shipped 66-rung ladder
// `dw.mul.scale.times-power-of-ten` (answers in the millions) sits at ordinate
// 0.45 and `dw.div.whole.divide-exact` (single-digit answers) sits at 0.55, one
// above the other, so no ceiling and no floor can separate a pack from a domain
// it cannot draw.
//
//   rungs  0–3   dw.add.facts.add-within-ten          ordinate 0.00–0.20
//   rungs  4–7   dw.mul.scale.times-power-of-ten      ordinate 0.27–0.47
//   rungs  8–11  dw.add.column.add-no-regroup         ordinate 0.53–0.73
//   rungs 12–15  dw.add.regroup.subtract-across-zero  ordinate 0.80–1.00

/** The skills of the interleaved ladder above, by rung. */
const LADDER = [
  "dw.add.facts.add-within-ten",
  "dw.mul.scale.times-power-of-ten",
  "dw.add.column.add-no-regroup",
  "dw.add.regroup.subtract-across-zero",
]

const skillAt = (index: number): string => LADDER[Math.floor(index / 4)] ?? "dw.add.facts.add-within-ten"

/** What TREBUCHET declares, in its own order, cut to the skills above. */
const TREBUCHET = ["dw.add.column.add-no-regroup", "dw.add.regroup.subtract-across-zero"]

/**
 * Answer `count` questions and hand back the skill each one came from.
 *
 * Read through `recentOutcomes`, which is the only place a pack can see what it
 * was served: `Question` carries no skill id, so this is also the seam a game's
 * own pacing controller would use, and a test that read a private field would
 * be testing something no game can observe.
 */
async function skillsServed(mounted: ReturnType<typeof attachGameHost>, count: number): Promise<string[]> {
  for (let i = 0; i < count; i++) {
    const question = mounted.host.next()
    mounted.host.report({ questionId: question.id, correct: true, ms: 1000, answered: question.answer })
    await settle(4)
  }
  await settle()
  return mounted.host.recentOutcomes().map((outcome) => outcome.skillId)
}

test("THE GAP: a pack is served a domain it does not cover, and its declaration cannot stop it", async () => {
  // The host is standing on rung 5 — inside the multiplication band, which is
  // exactly where trebuchet was standing when it was asked to wind its arm to
  // 4,510,000 metres. The pack declares add and subtract only.
  const fake = fakeHost({ skillAt })
  fake.standing = 5
  const mounted = attachGameHost(fake.client, { skills: TREBUCHET })
  await mounted.warm()

  const served = await skillsServed(mounted, 12)
  assert.ok(served.length >= 12, `only ${String(served.length)} questions were served`)
  const foreign = served.filter((skill) => !skill.startsWith("dw.add"))
  assert.equal(
    foreign.length,
    0,
    `${String(foreign.length)} of ${String(served.length)} questions came from a domain this ` +
      `pack does not declare: ${[...new Set(foreign)].join(", ")}`,
  )
  mounted.dispose()
})

test("the declaration reaches the wire as a skillId, and only when it has to", async () => {
  const fake = fakeHost({ skillAt })

  // Standing in the multiplication band: the pack cannot use what arrives, so
  // it trades, and the trade is a `skillId` on the wire.
  fake.standing = 5
  const trading = attachGameHost(fake.client, { skills: TREBUCHET })
  await trading.warm()
  const pins = fake.asks.filter((ask) => ask.skillId !== undefined).map((ask) => ask.skillId)
  assert.ok(pins.length > 0, "not one request named a skill, so the declaration went nowhere")
  for (const pin of pins) {
    assert.ok(
      pin !== undefined && TREBUCHET.includes(pin),
      `the host was asked for "${String(pin)}", which this pack never declared`,
    )
  }
  trading.dispose()

  // Standing in the addition band: everything that arrives is already something
  // the pack declares, so nothing is pinned and the host keeps its own spread,
  // its own levels and its own idea of where the child is.
  const quiet = fakeHost({ skillAt })
  quiet.standing = 9
  const content = attachGameHost(quiet.client, { skills: TREBUCHET })
  await content.warm()
  await skillsServed(content, 8)
  const uninvited = quiet.asks.filter((ask) => ask.skillId !== undefined)
  assert.equal(
    uninvited.length,
    0,
    `${String(uninvited.length)} requests pinned a skill while the host was already serving one ` +
      `the pack declares — a pin ignores difficulty and maxDifficulty, so this would cost every ` +
      `pack its difficulty wire`,
  )
  content.dispose()
})

test("a pack that declares nothing is served exactly what it was served before", async () => {
  const bare = fakeHost({ skillAt })
  bare.standing = 5
  const before = attachGameHost(bare.client)
  await before.warm()
  const servedBefore = await skillsServed(before, 8)
  before.dispose()

  const empty = fakeHost({ skillAt })
  empty.standing = 5
  const after = attachGameHost(empty.client, { skills: [] })
  await after.warm()
  const servedAfter = await skillsServed(after, 8)
  after.dispose()

  assert.ok(servedBefore.includes("dw.mul.scale.times-power-of-ten"), "the ladder was not where this test needs it")
  assert.deepEqual(servedAfter, servedBefore, "an empty declaration changed what a pack is served")
  assert.equal(
    bare.asks.filter((ask) => ask.skillId !== undefined).length +
      empty.asks.filter((ask) => ask.skillId !== undefined).length,
    0,
    "a pack that declared nothing had a skill named on its behalf",
  )
})

test("the question the pack could not use is closed on the host, not left open", async () => {
  const fake = fakeHost({ skillAt })
  fake.standing = 5
  const mounted = attachGameHost(fake.client, { skills: TREBUCHET })
  await mounted.warm()
  await settle()

  assert.ok(fake.skips.length > 0, "a rescued question was abandoned open in the host's ledger")
  // Every skip is an item the pack never served, and no served item was skipped:
  // a skip is the honest ending for a question that was drawn and not asked.
  const answered = new Set(fake.answers.map((answer) => answer.itemId))
  for (const skipped of fake.skips) {
    assert.ok(!answered.has(skipped), `item ${skipped} was both answered and closed unanswered`)
  }
  mounted.dispose()
})

// A ladder whose UNUSABLE band is at the bottom, which is what puts a pack's
// ceiling and its declaration in conflict: everything the pack covers is above
// the highest rung it is allowed to draw.
//
//   rungs 0–3    dw.mul.facts.tables-within-five   0.00–0.20
//   rungs 4–15   dw.add.column.add-no-regroup      0.27–1.00   a pin lands 0.27
const lowBandForeign = (index: number): string =>
  index < 4 ? "dw.mul.facts.tables-within-five" : "dw.add.column.add-no-regroup"

test("a rescue never breaks a ceiling the game set", async () => {
  const fake = fakeHost({ skillAt: lowBandForeign })
  const said = await withConsole(async () => {
    const mounted = attachGameHost(fake.client, { skills: ["dw.add.column.add-no-regroup"] })
    // The ceiling is stated before the pool is stocked, because a pool stocked
    // without one already holds questions above it — that is what a flush is for
    // and it is not what this test is about.
    mounted.host.next({ maxDifficulty: 0.2 })
    await mounted.warm()
    // The game can only draw the bottom fifth of the ladder. The only skill this
    // pack declares starts at 0.27, and a pinned request is served that rung
    // whatever the ceiling says — measured against the shipped host, which
    // returns 0.28 for a pin sent with `maxDifficulty: 0.1`. So the ceiling wins
    // and the pack keeps the question it can at least draw.
    for (let i = 0; i < 12; i++) {
      const question = mounted.host.next({ maxDifficulty: 0.2 })
      assert.ok(
        question.difficulty <= 0.2 + 1e-9,
        `a question at ${question.difficulty.toFixed(2)} was served under a ceiling of 0.20`,
      )
      mounted.host.report({ questionId: question.id, correct: true, ms: 900, answered: question.answer })
      await settle(4)
    }
    mounted.dispose()
  })
  const notes = said.filter((line) => line.includes("the ceiling wins"))
  assert.equal(notes.length, 1, `the ceiling/declaration conflict was said ${String(notes.length)} times`)
  assert.ok(
    notes[0]?.includes("maxDifficulty of 0.20"),
    `the notice does not say which ceiling it stopped at: ${String(notes[0])}`,
  )
})

test("a trade that keeps failing stops paying for itself, loudly", async () => {
  // The conflict above, left running: the pack declares a skill the host has and
  // the game has set a ceiling below it, so no trade can ever succeed. The
  // request budget is the point — every failed trade costs a second
  // `items.next`, and the host allows 120 calls in a sliding second.
  const fake = fakeHost({ skillAt: lowBandForeign })
  const said = await withConsole(async () => {
    const mounted = attachGameHost(fake.client, { skills: ["dw.add.column.add-no-regroup"] })
    mounted.host.next({ maxDifficulty: 0.2 })
    await mounted.warm()
    for (let i = 0; i < 24; i++) {
      const question = mounted.host.next({ maxDifficulty: 0.2 })
      assert.notEqual(question.id, "", `the pool ran dry on question ${String(i)}`)
      mounted.host.report({ questionId: question.id, correct: true, ms: 900, answered: question.answer })
      await settle(4)
    }
    mounted.dispose()
  })
  const notes = said.filter((line) => line.includes("IGNORED for the rest of this session"))
  assert.equal(notes.length, 1, `surrender was announced ${String(notes.length)} times: ${said.join(" | ")}`)
  const pins = fake.asks.filter((ask) => ask.skillId !== undefined)
  assert.ok(
    pins.length <= 6,
    `${String(pins.length)} trades were attempted for a skill that can never be served under ` +
      `this game's ceiling; it should give up after ${String(3)} consecutive failures`,
  )
})

test("a declaration this host cannot satisfy is surrendered, loudly, and once", async () => {
  // arena, balance, claim and pulse are all in this state today: every skill
  // they declare is missing from the shipped ladder. The game must keep getting
  // questions, and the repository must be told.
  const fake = fakeHost({ skillAt })
  fake.standing = 5
  const said = await withConsole(async () => {
    const mounted = attachGameHost(fake.client, { skills: ["dw.ns.compare.whole-numbers"] })
    await mounted.warm()
    const served = await skillsServed(mounted, 20)
    assert.ok(served.length >= 20, `the pack starved: only ${String(served.length)} questions`)
    mounted.dispose()
  })
  const notes = said.filter((line) => line.includes("IGNORED for the rest of this session"))
  assert.equal(notes.length, 1, `surrender was announced ${String(notes.length)} times: ${said.join(" | ")}`)
  assert.ok(notes[0]?.includes("dw.ns"), `the notice does not name the domain: ${String(notes[0])}`)
  // And it stopped paying for the trade. Two pinned requests at most: one to
  // discover the skill is not there, and none after that.
  const pins = fake.asks.filter((ask) => ask.skillId !== undefined)
  assert.ok(
    pins.length <= 2,
    `${String(pins.length)} pinned requests were sent for a skill the host does not have`,
  )
})

test("the trade measures each declared skill once and then asks for the nearest", async () => {
  // Declared hardest-first, on purpose: `dw.add.regroup.subtract-across-zero` is
  // rung 12 (ordinate 0.80) and `dw.add.column.add-no-regroup` is rung 8 (0.53).
  // A pack cannot see where a skill sits until it has asked for it, so the first
  // two trades are the measurement — in declaration order — and every trade
  // after that has to be the one nearest what the game is asking for, which is
  // the SECOND of the two. A rescue that just took the first declared skill
  // would pass the previous test and fail this one.
  //
  //   rungs  0–3   dw.mul.facts.tables-within-five       0.00–0.20
  //   rungs  4–7   dw.add.column.add-no-regroup          0.27–0.47   a pin lands 0.27
  //   rungs  8–11  dw.mul.scale.times-power-of-ten       0.53–0.73
  //   rungs 12–15  dw.add.regroup.subtract-across-zero   0.80–1.00   a pin lands 0.80
  //
  // Two bands the pack cannot use, one below its cheapest declared skill and one
  // above it, so the nearest declared skill is a different one depending on where
  // the game is aiming — which a rescue that always picks the same skill, or the
  // first declared one, cannot get right twice.
  const split = (index: number): string =>
    [
      "dw.mul.facts.tables-within-five",
      "dw.add.column.add-no-regroup",
      "dw.mul.scale.times-power-of-ten",
      "dw.add.regroup.subtract-across-zero",
    ][Math.floor(index / 4)] ?? ""
  const declaredHardestFirst = [
    "dw.add.regroup.subtract-across-zero",
    "dw.add.column.add-no-regroup",
  ]
  const fake = fakeHost({ skillAt: split })
  fake.standing = 1
  const mounted = attachGameHost(fake.client, { skills: declaredHardestFirst })
  await mounted.warm()
  await settle()

  const pins = (): string[] =>
    fake.asks.filter((ask) => ask.skillId !== undefined).map((ask) => ask.skillId ?? "")

  // The measurement, in declaration order, once each.
  const measured = pins()
  assert.equal(
    measured[0],
    "dw.add.regroup.subtract-across-zero",
    `the first trade did not measure the first declared skill, it asked for "${String(measured[0])}"`,
  )
  assert.equal(
    measured[1],
    "dw.add.column.add-no-regroup",
    `the second declared skill was not measured next; the trade asked for "${String(measured[1])}"`,
  )

  const drive = async (difficulty: number) => {
    fake.asks.length = 0
    for (let i = 0; i < 6; i++) {
      const question = mounted.host.next({ difficulty })
      mounted.host.report({ questionId: question.id, correct: true, ms: 900, answered: question.answer })
      await settle(4)
    }
    await settle()
    const asked = pins()
    assert.ok(asked.length > 0, `nothing was traded while aiming at ${String(difficulty)}`)
    return asked[asked.length - 1]
  }

  // Aiming at the bottom: the cheaper declared skill is the nearer one, and it is
  // the one declared SECOND.
  assert.equal(
    await drive(0),
    "dw.add.column.add-no-regroup",
    "aiming at the bottom of the ladder still traded for the hardest skill the pack declares",
  )
  // Aiming above the pack's cheap skill: the answer flips to the other one.
  assert.equal(
    await drive(0.6),
    "dw.add.regroup.subtract-across-zero",
    "aiming at 0.60 traded for the skill at 0.27 rather than the one at 0.80",
  )
  mounted.dispose()
})

test("honouring the declaration does not spend the host's request budget", async () => {
  // The host allows `MAX_REQUESTS_PER_SECOND` calls in a sliding second and
  // `warm()` stocks POOL_FLOOR questions back to back, so what a restricted pack
  // costs at mount is not a detail: the refuse-and-retry shape this started as
  // spent four calls a question — two `items.next`, a `reveal` and a `skip` —
  // and doubled the burst. A pack that has to name a skill asks for it directly.
  const spend = async (skills?: readonly string[]) => {
    const fake = fakeHost({ skillAt })
    fake.standing = 5
    const mounted = attachGameHost(fake.client, skills === undefined ? {} : { skills })
    await mounted.warm()
    const burst = fake.calls.length
    await skillsServed(mounted, 24)
    mounted.dispose()
    return { burst, session: fake.calls.length }
  }
  const baseline = await spend()
  const restricted = await spend(TREBUCHET)

  assert.ok(baseline.burst >= 2 * POOL_FLOOR, `the baseline burst was only ${String(baseline.burst)} calls`)
  assert.ok(
    restricted.burst <= baseline.burst * 1.25,
    `stocking the pool cost ${String(restricted.burst)} calls with a declaration against ` +
      `${String(baseline.burst)} without — ${(restricted.burst / baseline.burst).toFixed(2)}× the ` +
      `burst, which is how a restricted pack gets rate-limited at mount and shows a child an ` +
      `empty pool`,
  )
  // And over a session, where a pool flushed at a difficulty none of its contents
  // can be is the other way to spend the budget.
  assert.ok(
    restricted.session <= baseline.session * 1.25,
    `24 questions cost ${String(restricted.session)} calls with a declaration against ` +
      `${String(baseline.session)} without — ${(restricted.session / baseline.session).toFixed(2)}×`,
  )
})

/* ────────────────────── the budget in absolute terms ────────────────────────
 *
 * The test above compares a restricted mount to an unrestricted one and never
 * asks what either of them costs, which is how the unrestricted one went on
 * breaching the limit in every pack for as long as it did. `warm()` awaits
 * POOL_FLOOR questions and the fill behind it goes on to POOL_TARGET, at two
 * calls each: 128 calls before the first question, against a hundred and twenty
 * in a sliding second. Measured on the code before this, with a frozen clock:
 * 130 calls, 10 of them refused with `rate_limited`; 150 and 30 for a pack whose
 * declaration has it pinned. What a child got for that was a pool that came up
 * short and a `fill` that died on the rejection, and it happened at every mount
 * of all 27 packs.
 */

/**
 * Every call a mount makes, counted — including the ones `fakeHost` ignores.
 *
 * `{...client}` is safe for the fake, which is a plain object; it would drop
 * getters and prototype methods from a real `connect()` client, and there is no
 * reason to point one at this.
 */
function countingClient(client: HostClient): { client: HostClient; count: () => number } {
  let n = 0
  const tick = <T,>(run: () => T): T => {
    n += 1
    return run()
  }
  const counted: HostClient = {
    ...client,
    nextItem: (ask) => tick(() => client.nextItem(ask)),
    reveal: (itemId) => tick(() => client.reveal(itemId)),
    skip: (itemId) => tick(() => client.skip(itemId)),
    answer: (input) => tick(() => client.answer(input)),
    progress: (fraction) => tick(() => client.progress(fraction)),
    haptic: (cue) => tick(() => client.haptic(cue)),
    sound: (cue) => tick(() => client.sound(cue)),
    milestone: (name) => tick(() => client.milestone(name)),
    transition: (kind, label) => tick(() => client.transition(kind, label)),
    learnerSummary: () => tick(() => client.learnerSummary()),
  }
  return { client: counted, count: () => n }
}

test("an attach and a first question stay inside the host's own rate limit", async () => {
  // The clock is FROZEN, which is the worst case and also the one the app is:
  // `bridge.ts` counts every method in one sliding second and dispatches on the
  // same thread that generates the question, so nothing here has to be slow for
  // all of it to land inside one window.
  const spend = async (skills?: readonly string[]) => {
    const fake = fakeHost({ skillAt })
    // Rung 5 for the pinned arm, because that is the ONE band in this ladder
    // TREBUCHET cannot use (`dw.mul.scale.times-power-of-ten`) and standing
    // anywhere else means measuring an unpinned pack while calling it pinned.
    fake.standing = skills === undefined ? 12 : 5
    const counted = countingClient(fake.client)
    const mounted = attachOnClock(counted.client, {
      now: () => 0,
      ...(skills === undefined ? {} : { skills }),
    })
    await withConsole(async () => {
      await mounted.warm()
      // Everything a child's first question costs: the question, the answer they
      // give, the haptic under it, and the top-up behind all three.
      const first = mounted.host.next()
      mounted.host.haptic("light")
      mounted.host.report({ questionId: first.id, correct: true, ms: 1200, answered: first.answer })
      await settle()
    })
    mounted.dispose()
    return { calls: counted.count(), pinnedAsks: fake.asks.filter((ask) => ask.skillId !== undefined).length }
  }

  const plain = await spend()
  const pinned = await spend(TREBUCHET)

  // The arms have to be the two things they claim to be, or this test is one
  // measurement written down twice.
  assert.equal(plain.pinnedAsks, 0, "the unrestricted arm named a skill")
  assert.ok(
    pinned.pinnedAsks > 0,
    "the pinned arm never named a skill, so it measured an unrestricted mount",
  )

  assert.ok(
    plain.calls <= MAX_REQUESTS_PER_SECOND,
    `an attach and a first question spent ${String(plain.calls)} calls in one sliding second; the host ` +
      `refuses everything past ${String(MAX_REQUESTS_PER_SECOND)}, so the pool comes up short and ` +
      `the child waits for a question that was rate-limited`,
  )
  assert.ok(
    pinned.calls <= MAX_REQUESTS_PER_SECOND,
    `the same mount for a pack whose declaration has it pinned spent ${String(pinned.calls)} calls`,
  )
})

test("and the pool is still stocked when the child arrives", async () => {
  // The other half, and the reason this is not fixed by prefetching less: a
  // budget kept by never stocking anything is a blank chip in a child's hand.
  // POOL_FLOOR questions back to back, on the same frozen clock, out of a pool
  // that was never allowed a second call.
  //
  // Both arms, because `warm` is now allowed to stop early and a PINNED pack pays
  // three calls a question rather than two — so what its mount comes back with is
  // a thing this file has to state rather than leave to the arithmetic. The
  // promise is the same for both and it is the one `warm` always made: POOL_FLOOR
  // questions a child can play out of, before the first frame, inside one window.
  // Measured, frozen clock: 43 drainable questions unrestricted and 37 pinned.
  const stocked = async (skills?: readonly string[]) => {
    const fake = fakeHost({ skillAt })
    // Rung 5 is the band TREBUCHET cannot use; see the test above.
    fake.standing = skills === undefined ? 12 : 5
    const mounted = attachOnClock(fake.client, {
      now: () => 0,
      ...(skills === undefined ? {} : { skills }),
    })
    const want = POOL_FLOOR
    const said = await withConsole(async () => {
      await mounted.warm()
      await settle()
      for (let i = 0; i < want; i++) {
        const question = mounted.host.next()
        assert.notEqual(
          question.id,
          "",
          `question ${String(i + 1)} of ${String(want)} came out of a dry pool` +
            `${skills === undefined ? "" : " (pinned pack)"}`,
        )
      }
    })
    mounted.dispose()
    assert.deepEqual(
      said.filter((line) => line.includes("ran dry")),
      [],
      `the pool ran dry inside the first ${String(want)} questions`,
    )
    assert.equal(
      fake.asks.some((ask) => ask.skillId !== undefined),
      skills !== undefined,
      "the pinned arm has to be pinned and the plain arm has to not be",
    )
  }
  await stocked()
  await stocked(TREBUCHET)
})

test("the prefetch resumes once the window has drained", async () => {
  // Stopping is only safe if it starts again. `fill` is called on every hand-out,
  // so the top-up resumes at the next question the game asks for — with the
  // window a second emptier, and without a timer anywhere.
  const fake = fakeHost()
  let at = 0
  const mounted = attachOnClock(fake.client, { now: () => at })
  await mounted.warm()
  await settle()
  const atMount = fake.asks.length
  // The premise: a full pool costs more than the share, so a mount inside one
  // window cannot have reached POOL_TARGET. Said out loud, because lowering
  // POOL_TARGET below the share would make the assertion below meaningless
  // rather than false.
  assert.ok(
    2 * POOL_TARGET > PREFETCH_BUDGET,
    `a full pool costs ${String(2 * POOL_TARGET)} calls and the prefetch share is ` +
      `${String(PREFETCH_BUDGET)}; this test cannot say anything while it fits`,
  )
  assert.ok(
    atMount < POOL_TARGET,
    `the mount stocked ${String(atMount)} questions inside one window, which is more than the ` +
      `budget allows it to`,
  )

  at += RATE_WINDOW_MS + 1
  mounted.host.next()
  await settle()
  assert.ok(
    fake.asks.length > POOL_TARGET,
    `the pool stopped at ${String(fake.asks.length)} questions and never came back for the rest ` +
      `of POOL_TARGET (${String(POOL_TARGET)}) — a prefetch that stops has to start again`,
  )
  mounted.dispose()
})

test("the share leaves the host room, and warm fits inside the share", () => {
  // Two facts about the constants, so that raising one of them fails here rather
  // than at a child's mount.
  assert.ok(
    PREFETCH_BUDGET < MAX_REQUESTS_PER_SECOND,
    `the prefetch may spend ${String(PREFETCH_BUDGET)} of the host's ` +
      `${String(MAX_REQUESTS_PER_SECOND)}, which leaves nothing for the answer a child just gave`,
  )
  assert.ok(
    2 * POOL_FLOOR + ACQUIRE_MAX_CALLS <= PREFETCH_BUDGET,
    `warm() stocks POOL_FLOOR (${String(POOL_FLOOR)}) questions at two calls each before the first ` +
      `frame, which is ${String(2 * POOL_FLOOR)} of the ${String(PREFETCH_BUDGET)} the prefetch ` +
      `has — so the pool a child starts with would be capped by the budget rather than by the floor`,
  )
})

test("a ceiling that arrives after the pack is already pinned is still honoured", async () => {
  // The pack is pinned first — the host is parked at the bottom of the ladder,
  // in a band it cannot use — and only then does the game state a ceiling below
  // the rung it has been pinning. Nothing re-reads a pinned request on the host's
  // side, so the check has to happen here, on the way in, every time.
  const fake = fakeHost({ skillAt: lowBandForeign })
  fake.standing = 1
  const mounted = attachGameHost(fake.client, { skills: ["dw.add.column.add-no-regroup"] })
  await mounted.warm()
  await settle()

  const served: number[] = []
  const pinsBefore = fake.asks.filter((ask) => ask.skillId !== undefined).length
  for (let i = 0; i < 24; i++) {
    const question = mounted.host.next({ maxDifficulty: 0.2 })
    served.push(question.difficulty)
    mounted.host.report({ questionId: question.id, correct: true, ms: 900, answered: question.answer })
    await settle(4)
  }
  // The pool it had already stocked at 0.27 is above the new ceiling and is
  // allowed to drain — that is what a flush is for, and a flush keeps
  // FLUSH_KEEP of them. What must not happen is the pack going on ASKING for
  // 0.27 by name once it knows the ceiling, which is a supply of them with no end.
  const pinsAfter = fake.asks.filter((ask) => ask.skillId !== undefined).length - pinsBefore
  const over = served.filter((difficulty) => difficulty > 0.2 + 1e-9)
  assert.ok(
    over.length <= FLUSH_KEEP,
    `${String(over.length)} of ${String(served.length)} questions were above the ceiling of ` +
      `0.20 — at most ${String(FLUSH_KEEP)} of them can be the pool draining`,
  )
  // And it stopped ASKING for that rung by name. This is the assertion that
  // bites: a pooled question above a ceiling is never handed out while anything
  // else exists, so a pack that goes on pinning an over-ceiling skill does not
  // look broken from the outside — it just spends its whole pool, and its whole
  // request budget, on questions no child will ever see. Measured: 4 pinned
  // requests with the check, 27 without.
  assert.ok(
    pinsAfter <= 6,
    `${String(pinsAfter)} requests named a skill the pack already knew sits above the ceiling ` +
      `this game set; the pool fills with questions that can never be handed out`,
  )
  mounted.dispose()
})

test("the host is read again, so a child who walks back into the pack's own domain gets it", async () => {
  //   rungs  0–3   dw.mul.facts.tables-within-five        0.00–0.20
  //   rungs  4–7   dw.add.column.add-no-regroup           0.27–0.47   a pin lands 0.27
  //   rungs  8–11  dw.mul.scale.times-power-of-ten        0.53–0.73
  //   rungs 12–15  dw.add.regroup.subtract-across-zero    0.80–1.00
  const banded = (index: number): string =>
    [
      "dw.mul.facts.tables-within-five",
      "dw.add.column.add-no-regroup",
      "dw.mul.scale.times-power-of-ten",
      "dw.add.regroup.subtract-across-zero",
    ][Math.floor(index / 4)] ?? ""
  const fake = fakeHost({ skillAt: banded })
  // Parked at the bottom, in a band the pack cannot use.
  fake.standing = 1
  // ONE declared skill, whose pin lands at 0.27: nothing this pack can ask for by
  // name reaches the band the child has climbed into, so the only way to be
  // served it is to let the host answer for itself again.
  const mounted = attachGameHost(fake.client, { skills: ["dw.add.column.add-no-regroup"] })
  await mounted.warm()
  await settle()

  // The child climbs. The host's own stream is now something this pack covers,
  // and the pack has to notice: a pinned rung is one rung, and a session spent on
  // it is a session that stopped following the child.
  fake.standing = 14
  const seen: number[] = []
  for (let i = 0; i < 24; i++) {
    const question = mounted.host.next()
    seen.push(question.difficulty)
    mounted.host.report({ questionId: question.id, correct: true, ms: 900, answered: question.answer })
    await settle(4)
  }
  assert.ok(
    seen.some((difficulty) => difficulty > 0.75),
    `the child's ladder walked to 0.93 and the pack was still being served ` +
      `${Math.max(...seen).toFixed(2)} at best — it never looked at the host again`,
  )
  mounted.dispose()
})

// ─── Reading the pack's own declaration ──────────────────────────────────────

test("domainOf cuts a skill id where the curriculum cuts it", () => {
  assert.equal(domainOf("dw.add.regroup.subtract-across-zero"), "dw.add")
  assert.equal(domainOf("dw.mul.scale.times-power-of-ten"), "dw.mul")
  assert.equal(domainOf("dw.frac.arith.add-like-denominators"), "dw.frac")
  // Three segments is the shortest thing that has a domain.
  assert.equal(domainOf("arith.rung.0"), "arith.rung")
  // And anything shorter is its own domain rather than an error or a lie.
  assert.equal(domainOf("counting"), "counting")
  assert.equal(domainOf("dw.add"), "dw.add")
})

test("packRootUrl cuts at the pack, not at the document's directory", () => {
  assert.equal(
    packRootUrl("dynawalla-pack://localhost/dynawalla.trebuchet/pack.html", "dynawalla.trebuchet"),
    "dynawalla-pack://localhost/dynawalla.trebuchet/",
  )
  // Android and Windows serve the same directory over the localhost form.
  assert.equal(
    packRootUrl("http://dynawalla-pack.localhost/dynawalla.siege/pack.html", "dynawalla.siege"),
    "http://dynawalla-pack.localhost/dynawalla.siege/",
  )
  // An entry moved into a subdirectory still finds the manifest at the root.
  assert.equal(
    packRootUrl("dynawalla-pack://localhost/dynawalla.fuse/html/pack.html", "dynawalla.fuse"),
    "dynawalla-pack://localhost/dynawalla.fuse/",
  )
  // No id in the URL is not a path to guess at.
  assert.equal(packRootUrl("https://example.test/somewhere/index.html", "dynawalla.fuse"), null)
  assert.equal(packRootUrl("dynawalla-pack://localhost/dynawalla.fuse/pack.html", ""), null)
})

/** A `fetch` that answers one URL and refuses everything else. */
function fakeFetch(url: string, body: unknown, status = 200): typeof globalThis.fetch {
  return ((asked: string | URL) => {
    if (String(asked) !== url) return Promise.reject(new Error(`unexpected fetch of ${String(asked)}`))
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as Response)
  }) as typeof globalThis.fetch
}

const MANIFEST_URL = "dynawalla-pack://localhost/dynawalla.trebuchet/manifest.json"
const DOCUMENT_URL = "dynawalla-pack://localhost/dynawalla.trebuchet/pack.html"

test("declaredSkills reads covers.skills off the pack's own manifest", async () => {
  const skills = await declaredSkills({
    packId: "dynawalla.trebuchet",
    documentUrl: DOCUMENT_URL,
    fetch: fakeFetch(MANIFEST_URL, { covers: { skills: TREBUCHET, grades: [1, 3] } }),
  })
  assert.deepEqual([...skills], TREBUCHET)
})

test("a manifest that cannot be read costs a warning and nothing else", async () => {
  const cases: { name: string; fetch: typeof globalThis.fetch }[] = [
    { name: "404", fetch: fakeFetch(MANIFEST_URL, {}, 404) },
    { name: "no covers", fetch: fakeFetch(MANIFEST_URL, { id: "x" }) },
    { name: "covers.skills is not a list", fetch: fakeFetch(MANIFEST_URL, { covers: { skills: "add" } }) },
    { name: "a skill is not an id", fetch: fakeFetch(MANIFEST_URL, { covers: { skills: ["ok", 7] } }) },
    { name: "the scheme refused", fetch: (() => Promise.reject(new Error("blocked by CSP"))) as typeof globalThis.fetch },
  ]
  for (const probe of cases) {
    const said = await withConsole(async () => {
      const skills = await declaredSkills({
        packId: "dynawalla.trebuchet",
        documentUrl: DOCUMENT_URL,
        fetch: probe.fetch,
      })
      assert.equal(skills.length, 0, `${probe.name}: a broken manifest produced a restriction`)
    })
    const notes = said.filter((line) => line.includes("no skill restriction will be applied"))
    assert.equal(notes.length, 1, `${probe.name}: said ${String(notes.length)} times: ${said.join(" | ")}`)
    assert.ok(
      notes[0]?.includes("manifest.json"),
      `${probe.name}: the warning does not name what it tried to read: ${String(notes[0])}`,
    )
  }
})

test("a manifest that never answers does not hold the game up", async () => {
  // Raced against a timer rather than simply awaited: the failure this guards
  // against is a read that never returns, and a test that waits for one forever
  // is a CI job that hangs instead of a test that fails.
  const said = await withConsole(async () => {
    const read = declaredSkills({
      packId: "dynawalla.trebuchet",
      documentUrl: DOCUMENT_URL,
      timeoutMs: 5,
      fetch: ((_url: string | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("This operation was aborted"))
          })
        })) as typeof globalThis.fetch,
    }).then((skills) => `gave up with ${String(skills.length)} skills`)
    const stall = new Promise<string>((resolve) => setTimeout(() => resolve("still waiting"), 500))
    assert.equal(
      await Promise.race([read, stall]),
      "gave up with 0 skills",
      "a manifest read that never answers held the game's mount open",
    )
  })
  assert.equal(said.length, 1, `a hung manifest read said: ${said.join(" | ")}`)
})

test("the declaration travels from the pack's own manifest all the way to the wire", async () => {
  // The step `createGameHost` takes, with the two things a test cannot have —
  // a document and a MessagePort — handed in instead.
  const fake = fakeHost({ skillAt })
  fake.standing = 5
  const mounted = await attachDeclared(fake.client, {}, {
    documentUrl: "dynawalla-pack://localhost/dynawalla.test/pack.html",
    fetch: fakeFetch("dynawalla-pack://localhost/dynawalla.test/manifest.json", {
      covers: { skills: TREBUCHET, grades: [1, 3] },
    }),
  })
  await mounted.warm()
  const served = await skillsServed(mounted, 8)
  assert.ok(served.length >= 8, `only ${String(served.length)} questions were served`)
  const foreign = served.filter((skill) => !skill.startsWith("dw.add"))
  assert.equal(
    foreign.length,
    0,
    `the manifest declared ${TREBUCHET.join(", ")} and ${String(foreign.length)} questions came ` +
      `from ${[...new Set(foreign)].join(", ")} anyway — the declaration never reached the wire`,
  )
  mounted.dispose()
})

test("a skills option a game passes wins over the manifest", async () => {
  const fake = fakeHost({ skillAt })
  fake.standing = 5
  const mounted = await attachDeclared(fake.client, { skills: [] }, {
    documentUrl: "dynawalla-pack://localhost/dynawalla.test/pack.html",
    fetch: (() => Promise.reject(new Error("the manifest must not be read"))) as typeof globalThis.fetch,
  })
  await mounted.warm()
  assert.equal(
    fake.asks.filter((ask) => ask.skillId !== undefined).length,
    0,
    "a pack that opted out of the restriction had a skill named on its behalf",
  )
  mounted.dispose()
})
