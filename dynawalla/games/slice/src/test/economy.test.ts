// The dominant strategy, measured.
//
// The audit's finding about THE SPLIT was not "the window is a bit tight". It
// was that **not doing the maths was the winning move**, and that is a claim
// about an ordering of strategies, so it is testable and it was never tested.
//
// Three numbers made it true:
//
//   1. the answer window was 4.2 s gross, 3.78 s usable after the read-lock,
//      against this repo's own 6 s p50 for the two-digit regrouping skills
//      `pack.json` declares — so a child reading honestly could not finish;
//   2. a wrong lantern cost a lamp and a timeout cost nothing, so a child who
//      could not finish was better off letting the sigil expire than guessing;
//   3. `quiet` throttled the wave timer and the wave size and never touched
//      `floorCount()`, so the market kept its guaranteed six-to-eight objects
//      and its bomb spawner running the whole time — which meant refusing to
//      engage was not even a pause. It was uninterrupted slicing.
//
// The bots below play both rulebooks over the same seeds. The old one is not a
// straw man: it is the three functions this game shipped with, inlined.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import {
  answerGain,
  CADENCE,
  CANDIDATE_READ_LOCK_MS,
  comprehensionP50Ms,
  comprehensionP90Ms,
  favourAfter,
  lampCost,
  LAMPS,
  marketHushSeconds,
  moteSecondsFor,
  reportsToCurriculum,
  usableAnswerSeconds,
  type Verdict,
} from "../sim/economy.ts"

// ── the window ──────────────────────────────────────────────────────────────

test("the usable window is monotone non-decreasing in difficulty", () => {
  // The fleet invariant. A harder item may never get less time than an easier
  // one — not by a millisecond, at any difficulty, ever.
  let previous = 0
  for (let d = 1; d <= 10; d++) {
    const s = usableAnswerSeconds(d)
    assert.ok(s >= previous, `difficulty ${String(d)} got ${s.toFixed(2)}s after ${previous.toFixed(2)}s`)
    previous = s
  }
})

test("no item gets less usable window than the child's measured p90", () => {
  // Usable, not gross: 420 ms of every window is spent under the read-lock that
  // stops the stroke which opened the tablet from also answering it. That is
  // real time the child does not have, so the invariant is quoted net of it.
  for (let d = 1; d <= 10; d++) {
    const usable = usableAnswerSeconds(d) * 1000
    assert.ok(
      usable >= comprehensionP90Ms(d),
      `difficulty ${String(d)}: ${(usable / 1000).toFixed(2)}s usable against a ${(comprehensionP90Ms(d) / 1000).toFixed(1)}s p90`,
    )
  }
})

test("the declared skills get the cadence the declared skills were measured at", () => {
  // `pack.json` covers `dw.add.regroup.*` including `subtract-across-zero`. The
  // table's own rows for those are 6 s / 14 s and 16 s / 40 s.
  assert.ok(usableAnswerSeconds(1) * 1000 >= CADENCE.fact.p90)
  assert.ok(usableAnswerSeconds(10) * 1000 >= CADENCE.wide.p90)
  assert.ok(comprehensionP50Ms(1) === CADENCE.fact.p50)
  assert.ok(comprehensionP50Ms(10) === CADENCE.wide.p50)
})

test("the shipped window, and this one, per difficulty", () => {
  const shipped = (d: number): number => 4.2 + Math.max(0, Math.min(9, d - 1)) * 0.2
  const rows = []
  for (let d = 1; d <= 10; d++) {
    const beforeUsable = shipped(d) - CANDIDATE_READ_LOCK_MS / 1000
    const afterUsable = usableAnswerSeconds(d)
    rows.push({
      difficulty: d,
      p50s: (comprehensionP50Ms(d) / 1000).toFixed(1),
      p90s: (comprehensionP90Ms(d) / 1000).toFixed(1),
      beforeUsableS: beforeUsable.toFixed(2),
      beforePctOfP50: `${((beforeUsable * 1000) / comprehensionP50Ms(d) * 100).toFixed(0)}%`,
      afterUsableS: afterUsable.toFixed(2),
      afterPctOfP50: `${((afterUsable * 1000) / comprehensionP50Ms(d) * 100).toFixed(0)}%`,
    })
  }
  console.table(rows)
  // The property the table exists to show: the shipped window gave a smaller
  // share of the child's need the harder the item got. The ramp was inverted.
  const first = (shipped(1) * 1000 - CANDIDATE_READ_LOCK_MS) / comprehensionP50Ms(1)
  const last = (shipped(10) * 1000 - CANDIDATE_READ_LOCK_MS) / comprehensionP50Ms(10)
  assert.ok(last < first, "the old ramp was not inverted after all — re-derive this whole file")
})

// ── the costs ───────────────────────────────────────────────────────────────

test("a timeout never costs less than an honest wrong answer", () => {
  // The rule the whole failure comes down to. Lamps equal, favour equal — and
  // the tiebreak, market time, goes *against* the timeout. See below.
  assert.equal(lampCost("timeout"), lampCost("wrong"))
  assert.equal(favourAfter("timeout", 4), favourAfter("wrong", 4))
  assert.equal(favourAfter("timeout", 4), 1)
})

test("no verdict costs a lamp — a slow child is never a punished child", () => {
  // The other half of the same rule. There are two ways to stop a timeout being
  // cheaper than a wrong answer and only one of them is allowed: charging the
  // timeout a lamp would bill a child for still thinking.
  for (const v of ["correct", "wrong", "timeout"] as const) assert.equal(lampCost(v), 0)
})

test("a timeout is not reported to the ladder as a wrong answer", () => {
  assert.equal(reportsToCurriculum("correct"), true)
  assert.equal(reportsToCurriculum("wrong"), true)
  assert.equal(reportsToCurriculum("timeout"), false)
})

test("a timeout costs the whole market; an answer hands it straight back", () => {
  const d = 5
  const window = moteSecondsFor(d)
  assert.equal(marketHushSeconds("timeout", d, window), window)
  assert.ok(marketHushSeconds("correct", d, 3) < window)
  assert.ok(marketHushSeconds("wrong", d, 3) < window)
  // Strictly more, for every answering time the window allows.
  for (let at = 0; at < window; at += 0.5) {
    assert.ok(
      marketHushSeconds("timeout", d, at) >= marketHushSeconds("wrong", d, at),
      `answering at ${at.toFixed(1)}s cost more market than refusing to`,
    )
  }
})

// ── the bots ────────────────────────────────────────────────────────────────

/** The three functions that decide whether the maths is optional. */
type Rules = {
  readonly name: string
  usableSeconds(difficulty: number): number
  lampCost(verdict: Verdict): number
  favourAfter(verdict: Verdict, favour: number): number
  /** Seconds of market the child loses to a question settled this way. */
  hushSeconds(verdict: Verdict, difficulty: number, atSeconds: number): number
  /** Does the market keep throwing while an equation is on screen? */
  readonly marketAliveDuringQuestion: boolean
}

const AFTER: Rules = {
  name: "after",
  usableSeconds: usableAnswerSeconds,
  lampCost,
  favourAfter,
  hushSeconds: marketHushSeconds,
  marketAliveDuringQuestion: false,
}

/** The three functions THE SPLIT shipped with, inlined verbatim. */
const BEFORE: Rules = {
  name: "before",
  usableSeconds: (d) => 4.2 + Math.max(0, Math.min(9, d - 1)) * 0.2 - CANDIDATE_READ_LOCK_MS / 1000,
  lampCost: (v) => (v === "wrong" ? 1 : 0),
  favourAfter: (v, f) => (v === "correct" ? Math.min(4, f + 1) : v === "wrong" ? 1 : Math.max(1, f - 1)),
  // `quiet` throttled two knobs and left the density floor and the bomb spawner
  // alone, so a live question cost the child nothing they were not choosing to
  // spend. Refusing to engage was uninterrupted slicing.
  hushSeconds: () => 0,
  marketAliveDuringQuestion: true,
}

type Bot = {
  readonly name: string
  /** Seconds this child needs to work the item out. `Infinity` = never engages. */
  readSeconds(difficulty: number, rng: Rng): number
  /** Given that they finished in time, are they right? */
  isRight(rng: Rng): boolean
}

/** Never touches a lantern. The strategy the format has to defeat. */
const REFUSER: Bot = {
  name: "never answers",
  readSeconds: () => Number.POSITIVE_INFINITY,
  isRight: () => false,
}

/**
 * Reads the equation and works it out, at the pace this repo says a child works
 * at: a spread whose median is the table's p50 and whose ninth decile is its
 * p90. Right nine times in ten once they have finished.
 */
const READER: Bot = {
  name: "reads it, honestly and slowly",
  readSeconds: (d, rng) => {
    const p50 = comprehensionP50Ms(d) / 1000
    const p90 = comprehensionP90Ms(d) / 1000
    // Log-normal through the two quantiles: exp(mu) = p50, and the 1.2816 is the
    // standard normal's 90th percentile.
    const mu = Math.log(p50)
    const sigma = Math.log(p90 / p50) / 1.2816
    // Box–Muller off the seeded stream; no Math.random anywhere in this file.
    const u1 = Math.max(1e-9, rng.next())
    const u2 = rng.next()
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    return Math.exp(mu + sigma * z)
  },
  isRight: (rng) => rng.chance(0.9),
}

/**
 * Works it out and gets it right — and takes the number of seconds this repo
 * says that costs. Right every single time, once finished.
 *
 * This is the bot the audit named: "answers correctly but slowly". It carries no
 * distribution and no luck, so what it measures is unambiguous — whether a child
 * working at the documented pace can land an answer at all.
 */
const SLOW_READER: Bot = {
  name: "answers correctly, at the documented p50",
  readSeconds: (d) => comprehensionP50Ms(d) / 1000,
  isRight: () => true,
}

/** Swipes a lantern the moment it can. One in four. */
const GUESSER: Bot = {
  name: "guesses immediately",
  readSeconds: () => 0.05,
  isRight: (rng) => rng.chance(0.25),
}

type RunOptions = {
  readonly seconds: number
  readonly difficulty: number
  /** Points a second of live market is worth at multiplier one. */
  readonly slicePerSecond: number
  /** Seconds of live market between sigils. */
  readonly sigilGap: number
  /** Chance per live-market second that the child clips a bomb. */
  readonly bombPerSecond: number
}

type RunResult = { score: number; answered: number; correct: number; lampsLost: number; survived: number }

/**
 * One run, in market-seconds.
 *
 * Deliberately coarse: slicing is an income rate rather than a physics sim, and
 * a question is a hole in that income. What it models exactly is the only thing
 * under test — what each of the three ways a question can end actually costs.
 */
function simulate(rules: Rules, bot: Bot, seed: number, o: RunOptions): RunResult {
  const rng = new Rng(seed)
  let t = 0
  let lamps = LAMPS
  let favour = 1
  let score = 0
  let answered = 0
  let correct = 0
  let lampsLost = 0
  let untilSigil = o.sigilGap
  const step = 0.1

  while (t < o.seconds && lamps > 0) {
    // A live market second: income, and a chance of clipping a bomb.
    score += o.slicePerSecond * favour * step
    if (rng.chance(o.bombPerSecond * step)) {
      lamps -= 1
      lampsLost += 1
      favour = 1
      if (lamps <= 0) break
    }
    t += step
    untilSigil -= step
    if (untilSigil > 0) continue

    // ── a sigil ───────────────────────────────────────────────────────────
    untilSigil = o.sigilGap
    const usable = rules.usableSeconds(o.difficulty)
    const need = bot.readSeconds(o.difficulty, rng)
    const finished = need <= usable
    const verdict: Verdict = !finished ? "timeout" : bot.isRight(rng) ? "correct" : "wrong"
    const at = finished ? need : usable

    if (verdict === "correct") {
      answered++
      correct++
      favour = rules.favourAfter(verdict, favour)
      // The answer, and the favour wave it fires: the wave doubles, and it opens
      // roughly a second's worth of market all at once.
      score += answerGain(o.difficulty, favour) + o.slicePerSecond * favour * 2
    } else {
      if (verdict === "wrong") answered++
      favour = rules.favourAfter(verdict, favour)
    }
    lamps -= rules.lampCost(verdict)
    lampsLost += rules.lampCost(verdict)
    if (lamps <= 0) break

    // The hole the question left. Under the old rules the market never stopped,
    // so a refusing child kept earning right through it; a reading child did
    // not, because they were reading.
    const hush = rules.hushSeconds(verdict, o.difficulty, at)
    const blind = rules.marketAliveDuringQuestion ? (Number.isFinite(need) ? Math.min(need, usable) : 0) : hush
    // Bomb exposure continues wherever the market is alive.
    if (rules.marketAliveDuringQuestion) {
      const exposed = Number.isFinite(need) ? Math.min(need, usable) : usable
      if (rng.chance(o.bombPerSecond * exposed * 0.5)) {
        lamps -= 1
        lampsLost += 1
        favour = 1
      }
      // A refusing child was slicing right through the window.
      if (!Number.isFinite(need)) score += o.slicePerSecond * favour * usable
    }
    t += Math.max(blind, Number.isFinite(need) ? Math.min(need, usable) : usable)
  }

  return { score, answered, correct, lampsLost, survived: Math.min(t, o.seconds) }
}

function meanScore(rules: Rules, bot: Bot, o: RunOptions, runs = 60): number {
  let total = 0
  for (let i = 0; i < runs; i++) total += simulate(rules, bot, 1000 + i * 7919, o).score
  return total / runs
}

const BASE: RunOptions = {
  seconds: 300,
  difficulty: 5,
  slicePerSecond: 120,
  sigilGap: 6,
  bombPerSecond: 0.01,
}

test("BEFORE: never answering outscored answering correctly but slowly", () => {
  // The defect, played out. Not an assertion about the fix — an assertion about
  // what the game shipped as, kept green so the "before" column cannot rot.
  //
  // The slow reader is right every time. It loses no lamps, guesses at nothing
  // and makes no mistakes. It simply takes the number of seconds this repo says
  // the item takes, and the window it shipped with was shorter than that — so it
  // never landed a single answer, and paid for the attempt in market time it did
  // not spend slicing.
  const refuser = meanScore(BEFORE, REFUSER, BASE)
  const reader = meanScore(BEFORE, SLOW_READER, BASE)
  const landed = simulate(BEFORE, SLOW_READER, 4242, BASE).answered
  console.log(
    `  before: refuser ${refuser.toFixed(0)} vs correct-but-slow ${reader.toFixed(0)} ` +
      `(${String(landed)} answers landed in ${String(BASE.seconds)}s)`,
  )
  assert.equal(landed, 0, "the shipped window was answerable at the documented p50 after all")
  assert.ok(
    refuser > reader,
    `the old rules did not actually favour refusing: ${refuser.toFixed(0)} vs ${reader.toFixed(0)}`,
  )
})

test("BEFORE: refusing also beat guessing, which is the same bug from the other side", () => {
  // A child at second 3.7 with the sum half-done had two moves: swipe, or let it
  // go. Swiping cost a lamp three times in four. Letting it go cost one point of
  // favour. The rational play was to look away.
  const refuser = meanScore(BEFORE, REFUSER, BASE)
  const guesser = meanScore(BEFORE, GUESSER, BASE)
  assert.ok(
    refuser > guesser,
    `guessing was already worse than refusing: ${guesser.toFixed(0)} vs ${refuser.toFixed(0)}`,
  )
})

test("AFTER: answering correctly but slowly beats never answering, at every difficulty", () => {
  // The inversion, directly. Same bot, same seeds, same market.
  for (let difficulty = 1; difficulty <= 10; difficulty++) {
    const o = { ...BASE, difficulty }
    const refuser = meanScore(AFTER, REFUSER, o)
    const reader = meanScore(AFTER, SLOW_READER, o)
    assert.ok(
      reader > refuser,
      `difficulty ${String(difficulty)}: refusing scored ${refuser.toFixed(0)}, correct-but-slow scored ${reader.toFixed(0)}`,
    )
  }
})

test("AFTER: reading the equation beats refusing to, at every difficulty", () => {
  for (let difficulty = 1; difficulty <= 10; difficulty++) {
    const o = { ...BASE, difficulty }
    const refuser = meanScore(AFTER, REFUSER, o)
    const reader = meanScore(AFTER, READER, o)
    assert.ok(
      reader > refuser,
      `difficulty ${String(difficulty)}: refusing scored ${refuser.toFixed(0)}, reading scored ${reader.toFixed(0)}`,
    )
  }
})

test("AFTER: reading beats refusing however much the slicing is worth", () => {
  // The one parameter a reader could reasonably argue about is how much a second
  // of market is worth. So it is swept rather than chosen: the ordering has to
  // survive a market worth ten times as much per second as this one.
  for (const slicePerSecond of [20, 60, 120, 240, 600, 1200]) {
    const o = { ...BASE, slicePerSecond }
    const refuser = meanScore(AFTER, REFUSER, o)
    const reader = meanScore(AFTER, READER, o)
    assert.ok(
      reader > refuser,
      `at ${String(slicePerSecond)} points/s: refusing ${refuser.toFixed(0)}, reading ${reader.toFixed(0)}`,
    )
  }
})

test("AFTER: reading beats guessing, which beats refusing", () => {
  // The whole ordering, in one line. Guessing above refusing is correct and
  // deliberate: engaging badly must still beat not engaging, or the game is
  // teaching a child that the safe move is to look away. Reading above guessing
  // is what keeps it real maths — a guesser burns the favour economy three
  // times in four.
  const refuser = meanScore(AFTER, REFUSER, BASE)
  const guesser = meanScore(AFTER, GUESSER, BASE)
  const reader = meanScore(AFTER, READER, BASE)
  console.log(
    `  after:  refuser ${refuser.toFixed(0)} < guesser ${guesser.toFixed(0)} < reader ${reader.toFixed(0)}`,
  )
  assert.ok(guesser > refuser, `guessing ${guesser.toFixed(0)} did not beat refusing ${refuser.toFixed(0)}`)
  assert.ok(reader > guesser, `reading ${reader.toFixed(0)} did not beat guessing ${guesser.toFixed(0)}`)
})

test("AFTER: the honest reader actually lands their answers", () => {
  // The reason the old ordering existed at all: at 3.78 s usable against a 6 s
  // p50, a child reading honestly finished about a fifth of the time. The fix is
  // only a fix if that number moves.
  const before = simulate(BEFORE, READER, 4242, BASE)
  const after = simulate(AFTER, READER, 4242, BASE)
  const beforeRate = before.answered / Math.max(1, Math.round(before.survived / BASE.sigilGap))
  assert.ok(beforeRate < 0.5, `the shipped window already worked: ${(beforeRate * 100).toFixed(0)}%`)
  assert.ok(after.answered > before.answered * 2, `${String(before.answered)} → ${String(after.answered)}`)
})

test("AFTER: an honest reader never loses a lamp to the arithmetic", () => {
  // Lamps come off bombs, which are a thing a child chooses to touch. Nothing a
  // child does with a lantern — right, wrong, or too slow — can put one out.
  for (let difficulty = 1; difficulty <= 10; difficulty++) {
    const o = { ...BASE, difficulty, bombPerSecond: 0 }
    for (const bot of [REFUSER, READER, GUESSER]) {
      const r = simulate(AFTER, bot, 555 + difficulty, o)
      assert.equal(
        r.lampsLost,
        0,
        `difficulty ${String(difficulty)}, ${bot.name}: lost ${String(r.lampsLost)} lamps with no bombs in play`,
      )
    }
  }
})
