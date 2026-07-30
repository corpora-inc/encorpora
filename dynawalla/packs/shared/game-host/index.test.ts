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
import { attachGameHost, toUnit, POOL_FLOOR } from "./index.ts"

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
function fakeHost(options: { granted?: Capability[]; rungs?: number } = {}): Fake {
  const rungs = options.rungs ?? RUNGS
  const asks: Ask[] = []
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
    answers,
    skips,
    client: {
      packId: "dynawalla.test",
      hostVersion: "0.1.0",
      granted: options.granted ?? ["items", "items.reveal", "haptics"],
      settings: SETTINGS,
      can: () => true,

      nextItem: (ask: Ask = {}) => {
        asks.push(ask)
        const span = Math.max(1, rungs - 1)
        const cap = ask.maxDifficulty === undefined ? 1 : ask.maxDifficulty
        const wanted = ask.difficulty === undefined ? fake.standing / span : ask.difficulty
        const index = Math.max(
          0,
          Math.min(rungs - 1, Math.round(Math.min(wanted, cap) * span)),
        )
        sequence += 1
        const item: Item = {
          id: `i${String(sequence)}`,
          skillId: `arith.rung.${String(Math.floor(index / 4))}`,
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
        answers.push({ itemId: input.itemId, response: input.response })
        if (fake.answerFails) return Promise.reject(new Error("the host is gone"))
        return Promise.resolve({
          correct: fake.verdict,
          canonical: "1",
          advance: fake.verdict,
        } satisfies Judgement)
      },
      skip: (itemId) => {
        skips.push(itemId)
        // What an older host — one shipped before `items.skip` existed — would
        // do with the call, so the adapter is held to surviving it.
        if (fake.skipFails) return Promise.reject(new Error("unknown method: items.skip"))
        return Promise.resolve()
      },
      reveal: (itemId) => Promise.resolve(canonicals.get(itemId) ?? ""),
      learnerSummary: () => Promise.resolve({ skills: [] }),
      haptic: () => Promise.resolve(),
      sound: () => Promise.resolve(),
      milestone: () => Promise.resolve(),
      storage: {
        get: () => Promise.resolve(null),
        set: () => Promise.resolve(),
        remove: () => Promise.resolve(),
        keys: () => Promise.resolve([]),
      },
      progress: () => Promise.resolve(),
      end: () => Promise.resolve(),
      transition: () => Promise.resolve(),
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
