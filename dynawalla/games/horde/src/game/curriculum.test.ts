/**
 * Bots, not assertions about arithmetic.
 *
 * Every test here drives the real ledger the game drives — `openQuestion`,
 * `answer`, `closeQuestion`, the sealed cache and the rift all go through
 * `Curriculum` and nothing else in DEEPSWARM calls `host.next` or
 * `host.report`. So a bot that plays badly here is a child playing badly there.
 */

import assert from "node:assert/strict"
import { test } from "node:test"

import type { Host, Question } from "../contract.ts"
import {
  BASE_THINKING_SECONDS,
  Curriculum,
  MAX_DIFFICULTY,
  LADDER_SPAN,
  MAX_DROP_RUNGS,
  MISS_RUNGS,
  RECENT_WINDOW,
  SPREAD_RUNGS,
} from "./curriculum.ts"

type Report = { questionId: string; correct: boolean; ms: number; answered: string }

/** mulberry32 — the same generator `stubHost.ts` uses. Seeded, so this is exact. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A host that remembers everything it was asked and everything it was told. */
function recordingHost(): {
  host: Host
  asks: number[]
  ceilings: number[]
  reports: Report[]
} {
  const asks: number[] = []
  const ceilings: number[] = []
  const reports: Report[] = []
  let n = 0
  const host: Host = {
    next(opts) {
      asks.push(opts?.difficulty ?? 0)
      ceilings.push(opts?.maxDifficulty ?? 0)
      n++
      return {
        id: `q${n}`,
        prompt: `${n} + 1`,
        answer: String(n + 1),
        distractors: [String(n), String(n + 2)],
        domain: "add",
        difficulty: 0.5,
      } satisfies Question
    },
    report(r) {
      reports.push(r)
    },
    haptic() {},
    prefersReducedMotion() {
      return false
    },
  }
  return { host, asks, ceilings, reports }
}

/**
 * Eleven minutes of DEEPSWARM, roughly. A core opens every ~40 s, a sealed
 * cache lands every third level-up, and a rift asks until it is charged — call
 * it fifty questions in a long run.
 */
const LONG_RUN = 50

/**
 * Why every bot below is handed a seed.
 *
 * `askUnit` draws a random step down the band for each question, and `Curriculum`
 * defaults its `rng` to `Math.random` — which is right for the game and wrong for
 * a test that reads one of those draws back. The all-right-answers bot asserted
 * on its LAST draw, so one time in forty-nine that draw was the bottom of the
 * six-rung spread and the whole suite went red: measured on pristine main,
 * **4 failures in 400 runs, every one of them `topped out at 0.8898305084745763`**
 * — which is the top of the ladder less exactly `SPREAD_RUNGS` rungs, i.e. the
 * band doing precisely what it is designed to do. It red-lit the merge queue for
 * unrelated PRs twice in one day.
 *
 * The production default stays `Math.random`, and that is not a dodge:
 *
 *   - It is not what makes a run reproducible. The QUESTIONS come from the host
 *     (`items.next`), which this game cannot seed; the seedable one is
 *     `stubHost.ts`, and `main.ts` already passes it a fixed seed. All this rng
 *     picks is how far under the earned edge one question is drawn from.
 *   - Everything else in DEEPSWARM that is random is unseeded too — `game.ts`
 *     derives its own generator from `Date.now()`, and `loadout.ts`,
 *     `ui/shuffle.ts` and `core/audio.ts` call `Math.random` directly. A run
 *     reproducible from a seed is a real feature and it is a run-seed threaded
 *     through all of them plus a host that replays, not one default in this file.
 *   - A fixed default would make every child's band descend in the same order in
 *     every run, forever, which is worse than the thing it fixes.
 *
 * So the seed belongs to the bot, and the assertion that read one random draw is
 * replaced below by the two claims that draw was standing in for.
 */
const seedFor = (name: string): (() => number) => {
  let h = 0x811c9dc5
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x01000193) >>> 0
  return seeded(h)
}

test("a bot that answers everything WRONG never climbs past the first rung", () => {
  const { host, asks } = recordingHost()
  const c = new Curriculum(seedFor("wrong"))

  for (let i = 0; i < LONG_RUN; i++) {
    const q = c.ask(host)
    c.answered(host, q, q.distractors[0]!, false, 1400)
  }

  // Three-digit addition lives high on the host ladder. This bot must not be
  // anywhere near it: it has demonstrated nothing.
  assert.equal(c.difficulty(), 1, "a run with no right answers must stay on rung 1")
  // The request is a LADDER POSITION now, not a step of a ten-point scale, so
  // the bottom is 0 rather than 1. The property is the same one: one value, and
  // it is the floor of the curriculum.
  assert.deepEqual(
    [...new Set(asks)],
    [0],
    "every question in a run with no right answers must come from the bottom rung",
  )
  assert.equal(c.solved, 0)
  assert.equal(c.asked, LONG_RUN)
})

test("a bot that never answers at all never climbs either", () => {
  const { host, asks } = recordingHost()
  const c = new Curriculum(seedFor("silent"))

  for (let i = 0; i < LONG_RUN; i++) {
    c.ask(host)
    c.expired()
  }

  assert.equal(c.difficulty(), 1, "surviving is not an achievement")
  assert.equal(Math.max(...asks), 0)
  assert.equal(c.unanswered, LONG_RUN)
})

test("a bot that answers everything RIGHT climbs, and reaches the top", () => {
  const { host, asks } = recordingHost()
  const c = new Curriculum(seedFor("right"))

  for (let i = 0; i < LONG_RUN; i++) {
    const q = c.ask(host)
    c.answered(host, q, q.answer, true, 1400)
  }

  assert.equal(c.difficulty(), MAX_DIFFICULTY, "a run that is all right answers must top out")
  assert.equal(asks[0], 0, "it still starts at the bottom")
  assert.ok(
    asks[asks.length - 1]! > asks[0]!,
    "the ladder has to actually move for a child who is getting them right",
  )

  // What "reaches the top" means, in the two parts the old single-sample
  // assertion conflated. The band is `SPREAD_RUNGS` wide by design, so no ONE
  // draw can be the top — but every draw is inside the band, and the run does
  // reach the top of it.
  const edge = c.edgeUnit()
  // Said in absolute terms as well as against the game's own edge, so a ladder
  // that quietly stopped climbing at the middle cannot satisfy the two claims
  // below by moving the goalposts with itself.
  assert.ok(
    edge > 1 - 1 / LADDER_SPAN,
    `a run that has topped the ladder out should be drawing from its top rung; the edge is ${edge}`,
  )
  const bandFloor = edge - SPREAD_RUNGS / LADDER_SPAN
  for (const [i, ask] of asks.entries()) {
    // From the point the ladder is topped out — solved 18 earns rung 10 — every
    // question comes from the top band and none from below it. True of every
    // seed: this is the width the band states, not a tolerance.
    if (i < 2 * (MAX_DIFFICULTY - 1) + 2) continue
    assert.ok(
      ask >= bandFloor - 1e-12,
      `question ${i + 1} of a run that has answered everything right came from ${ask}, below the ` +
        `stated ${SPREAD_RUNGS}-rung band under the top of the ladder (${bandFloor})`,
    )
  }
  assert.equal(
    Math.max(...asks),
    edge,
    `a run that answered fifty questions right never once saw the top of the ladder (${edge}); ` +
      `the hardest question it was asked came from ${Math.max(...asks)}`,
  )
})

test("the ladder tracks right answers alone — the clock is not an input", () => {
  const c = new Curriculum()
  assert.equal(c.difficulty(), 1)
  // Six right answers, at whatever pace: three rungs.
  for (let i = 0; i < 6; i++) c.solved++
  assert.equal(c.difficulty(), 4)
  // Two hundred wrong answers and a hundred timeouts change nothing about it.
  c.asked += 300
  c.unanswered += 100
  assert.equal(c.difficulty(), 4, "wrong answers and timeouts must not move the rung")
})

test("a timeout reports NOTHING to the host", () => {
  const { host, reports } = recordingHost()
  const c = new Curriculum(seedFor("timeout"))

  const q = c.ask(host)
  c.expired()

  assert.deepEqual(
    reports,
    [],
    "a child who was still computing has told the host nothing; the host must be told nothing",
  )
  // And in particular, not the old payload.
  const filed: Report[] = reports
  assert.equal(
    filed.find((r) => r.questionId === q.id && r.answered === "" && !r.correct),
    undefined,
    "an empty answer marked incorrect is a wrong answer the child never gave",
  )
})

test("an answer — right or wrong — reports the exact payload the host expects", () => {
  const { host, reports } = recordingHost()
  const c = new Curriculum(seedFor("payload"))

  const a = c.ask(host)
  c.answered(host, a, a.answer, true, 1234.6)
  const b = c.ask(host)
  c.answered(host, b, b.distractors[0]!, false, 987.2)

  assert.deepEqual(reports, [
    { questionId: a.id, correct: true, ms: 1235, answered: a.answer },
    { questionId: b.id, correct: false, ms: 987, answered: b.distractors[0]! },
  ])
})

test("the thinking window grows with the ladder and never shrinks", () => {
  const c = new Curriculum()
  const easy = c.thinkingSeconds()
  assert.equal(easy, BASE_THINKING_SECONDS)

  let previous = easy
  for (let i = 0; i < 40; i++) {
    c.solved++
    const now = c.thinkingSeconds()
    assert.ok(now >= previous, `window shrank at ${c.solved} solved: ${previous} -> ${now}`)
    previous = now
  }

  // At the top of the ladder the child has at least the p90 cadence target for
  // two-digit-with-regrouping from EXPERIENCE_DESIGN.md.
  assert.ok(previous >= 14, `top-rung window is ${previous}s, under the 14s p90`)
})

test("the rift asks below what the run has earned, never above", () => {
  const c = new Curriculum()
  for (let i = 0; i < 8; i++) c.solved++
  assert.equal(c.difficulty(), 5)
  assert.equal(c.difficulty(-1), 4)
  // ...and it cannot fall off the bottom.
  const fresh = new Curriculum()
  assert.equal(fresh.difficulty(-1), 1)
})

test("the run panel counts questions the child ANSWERED, not questions it served", () => {
  const { host } = recordingHost()
  const c = new Curriculum(seedFor("panel"))

  for (let i = 0; i < 5; i++) {
    const q = c.ask(host)
    c.answered(host, q, q.answer, true, 1200)
  }
  for (let i = 0; i < 3; i++) {
    c.ask(host)
    c.expired()
  }

  assert.equal(c.asked, 8)
  assert.equal(c.answeredCount, 5, "three cores closed unanswered; they are not answers")
  assert.equal(c.solved, 5)
})


/* ------------------------------------------------------------ the question mix */

// TEN RUNGS OUT OF SIXTY.
//
// A founder playtest: "more variable questions for the rift, they are all like
// 2-digit plus 2-digit without carrying? I think we could have some single and
// triple digit (adapting to user level) and some carrying .. and why not
// subtraction, multiplication and division sometimes (dependent on user
// performance and adapting up and down)."
//
// The cause was not the operation — the host owns that and `domain` is a label.
// It was the SCALE. The game spoke the host's integer scale, where 1..10 maps
// onto a 59-rung ladder with a stride of 6.5, so fifty of the sixty shipped
// rungs could not be named at all. `ladderCoverage` below walks the same
// arithmetic the host does (`toUnit`, then `Math.round(unit * span)`) and
// counts what a run can actually reach.

/** The host's own reading of a request, from `packs/shared/game-host/index.ts`. */
function toUnit(value: number): number {
  return value < 1 ? Math.max(0, value) : Math.min(1, (value - 1) / 9)
}

/** The rung `items.ts` lands on for a request. `next`: rounds; the cap floors. */
function rungFor(difficulty: number, maxDifficulty: number): number {
  const span = LADDER_SPAN
  const cap = Math.floor(toUnit(maxDifficulty) * span)
  return Math.max(0, Math.min(span, cap, Math.round(toUnit(difficulty) * span)))
}

/** A recording host that also reports which ladder rung each request landed on. */
function rungRecorder(): { host: Host; rungs: number[] } {
  const rungs: number[] = []
  let n = 0
  const host: Host = {
    next(opts) {
      rungs.push(rungFor(opts?.difficulty ?? 0, opts?.maxDifficulty ?? 10))
      n++
      return {
        id: `q${n}`, prompt: `${n} + 1`, answer: String(n + 1),
        distractors: [String(n), String(n + 2)], domain: "add", difficulty: 0.5,
      } satisfies Question
    },
    report() {},
    haptic() {},
    prefersReducedMotion: () => false,
  }
  return { host, rungs }
}

/** Eighteen questions — a nine-minute run — at a given accuracy. */
function playRun(seed: number, accuracy: number): number[] {
  const { host, rungs } = rungRecorder()
  const rng = seeded(seed)
  const c = new Curriculum(seeded(seed ^ 0x9e37))
  for (let i = 0; i < 18; i++) {
    const q = c.ask(host)
    const right = rng() < accuracy
    c.answered(host, q, right ? q.answer : (q.distractors[0] as string), right, 1500)
  }
  return rungs
}

test("a run reaches far more of the curriculum than ten rungs of sixty", () => {
  const perRun: number[] = []
  const everywhere = new Set<number>()
  for (let s = 0; s < 600; s++) {
    const r = playRun(1000 + s, 0.6)
    perRun.push(new Set(r).size)
    for (const x of r) everywhere.add(x)
  }
  const mean = perRun.reduce((a, b) => a + b, 0) / perRun.length
  // Measured before this change, same 600 runs: 5.84 distinct rungs per run and
  // 9 distinct rungs across all of them, because ten integers is all the old
  // scale could say.
  assert.ok(mean > 8, `a run still only reaches ${mean.toFixed(2)} distinct rungs`)
  assert.ok(
    everywhere.size > 30,
    `600 runs between them reached ${everywhere.size} of ${LADDER_SPAN + 1} rungs`,
  )
})

test("the rungs the old integer scale could not name are now reachable", () => {
  // The ten rungs `1..10` mapped to, and therefore the only ten a run could
  // ever be served. Rung 18 is `column.add-no-regroup L0` and rung 29 is
  // `regroup.add-multidigit L0` — the beginning of two-digit work and the whole
  // of carrying — and neither was addressable.
  const OLD = new Set([0, 7, 13, 20, 26, 33, 39, 46, 52, 59])
  const reached = new Set<number>()
  for (let s = 0; s < 600; s++) for (const r of playRun(2000 + s, 0.75)) reached.add(r)
  const novel = [...reached].filter((r) => !OLD.has(r))
  assert.ok(
    novel.length > 20,
    `only ${novel.length} rungs outside the old ten were ever reached: ${novel.join(", ")}`,
  )
  assert.ok(reached.has(18) || reached.has(19), "the first column-arithmetic rungs are still unreachable")
  assert.ok(reached.has(29) || reached.has(30), "the first regrouping rungs are still unreachable")
})

test("a rung the child has not earned is never served, however wide the band", () => {
  for (let s = 0; s < 200; s++) {
    const { host, rungs } = rungRecorder()
    const c = new Curriculum(seeded(s))
    const rng = seeded(s ^ 0x5a5a)
    for (let i = 0; i < 40; i++) {
      // The edge as it stood when the question was ASKED.
      const edgeRung = Math.round(c.edgeUnit() * LADDER_SPAN)
      const q = c.ask(host)
      assert.ok(
        (rungs[rungs.length - 1] as number) <= edgeRung,
        `a question came from rung ${rungs[rungs.length - 1]} with only rung ${edgeRung} earned`,
      )
      const right = rng() < 0.5
      c.answered(host, q, right ? q.answer : (q.distractors[0] as string), right, 1500)
    }
  }
})

test("the edge itself is served — the cap does not shave a rung off the top", () => {
  // `items.ts` FLOORS the cap and ROUNDS the request, so a ceiling sent naively
  // sits a rung under the question it is meant to permit. `ask` adds the half
  // rung that makes them agree, and the top of the ladder has to be reachable.
  const { host, rungs } = rungRecorder()
  const c = new Curriculum(seeded(1))
  for (let i = 0; i < 60; i++) c.solved++
  for (let i = 0; i < 400; i++) c.ask(host)
  assert.ok(
    rungs.includes(LADDER_SPAN),
    `a run at the top of the ladder never saw rung ${LADDER_SPAN}; highest was ${Math.max(...rungs)}`,
  )
})

test("the band does not bottom out on 0 + 1 in the opening minutes", () => {
  // Measured with an absolute descent instead of a proportional one: 36% of
  // every early run collapsed onto the single easiest rung in the product,
  // twice what the old code did, which is a worse game and worse teaching.
  let atFloor = 0
  let n = 0
  for (let s = 0; s < 600; s++) {
    for (const r of playRun(3000 + s, 0.6)) {
      n++
      if (r === 0) atFloor++
    }
  }
  assert.ok(
    atFloor / n < 0.25,
    `${((atFloor / n) * 100).toFixed(0)}% of every question was the easiest rung in the product`,
  )
})

test("most questions still sit at or just under the edge", () => {
  const c = new Curriculum(seeded(11))
  for (let i = 0; i < 20; i++) c.solved++
  const edge = c.edgeUnit() * LADDER_SPAN
  let near = 0
  const N = 5000
  for (let i = 0; i < N; i++) if (edge - c.askUnit() * LADDER_SPAN <= 2) near++
  assert.ok(
    near / N > 0.45,
    `only ${((near / N) * 100).toFixed(0)}% of questions were within two rungs of the edge — ` +
      "the band is meant to interleave easier retrieval, not replace the work",
  )
})

test("the whole band is used, out to its stated width", () => {
  const c = new Curriculum(seeded(0xabc))
  for (let i = 0; i < 20; i++) c.solved++
  const edge = c.edgeUnit() * LADDER_SPAN
  const steps = new Set<number>()
  for (let i = 0; i < 6000; i++) steps.add(Math.round(edge - c.askUnit() * LADDER_SPAN))
  const sorted = [...steps].sort((a, b) => a - b)
  assert.deepEqual(sorted, [0, 1, 2, 3, 4, 5, 6], `the band used steps {${sorted.join(", ")}}`)
  assert.equal(SPREAD_RUNGS, 6)
})

/* --------------------------------------------------------- and back down again */

test("a child who starts missing is asked easier questions, within one question", () => {
  const c = new Curriculum(seeded(5))
  const { host } = recordingHost()
  for (let i = 0; i < 20; i++) c.solved++ // earned the top of the ladder
  assert.equal(c.difficulty(), MAX_DIFFICULTY)

  // The TOP of the band, not one sample of it: a single draw carries the
  // ordinary spread and would make this test a coin toss.
  const topRung = (): number =>
    Math.max(...Array.from({ length: 400 }, () => Math.round(c.askUnit() * LADDER_SPAN)))
  const before = topRung()
  assert.equal(before, LADDER_SPAN, "a clean run at the top must be able to draw the top rung")

  for (let i = 0; i < 3; i++) {
    const q = c.ask(host)
    c.answered(host, q, q.distractors[0] as string, false, 4000)
  }
  assert.equal(c.recentMisses, 3)
  assert.equal(c.difficulty(), MAX_DIFFICULTY, "the EARNED step must not fall — #656")
  const after = topRung()
  assert.equal(
    after,
    before - 3 * MISS_RUNGS,
    `three misses moved the hardest question the run will ask from rung ${before} to rung ` +
      `${after}; a child who is drowning must be handed something easier`,
  )
})

test("and it comes straight back up when they start getting them right", () => {
  const c = new Curriculum(seeded(13))
  const { host } = recordingHost()
  for (let i = 0; i < 20; i++) c.solved++

  for (let i = 0; i < RECENT_WINDOW; i++) {
    const q = c.ask(host)
    c.answered(host, q, q.distractors[0] as string, false, 4000)
  }
  assert.equal(c.recentMisses, RECENT_WINDOW, "the window should be all misses")

  for (let i = 0; i < RECENT_WINDOW; i++) {
    const q = c.ask(host)
    c.answered(host, q, q.answer, true, 1100)
  }
  assert.equal(c.recentMisses, 0, "the window must forget an old bad patch")
  const top = Math.max(...Array.from({ length: 400 }, () => Math.round(c.askUnit() * LADDER_SPAN)))
  assert.equal(
    top,
    LADDER_SPAN,
    "recovery has to be immediate — the earned step was never lost, so it must not be re-earned",
  )
})

test("the drop is bounded — a bad patch cannot strand a child at the bottom", () => {
  const c = new Curriculum(seeded(17))
  const { host } = recordingHost()
  for (let i = 0; i < 20; i++) c.solved++
  for (let i = 0; i < 40; i++) {
    const q = c.ask(host)
    c.answered(host, q, q.distractors[0] as string, false, 5000)
  }
  const lowest = Math.min(
    ...Array.from({ length: 500 }, () => Math.round(c.askUnit() * LADDER_SPAN)),
  )
  assert.ok(
    lowest >= LADDER_SPAN - MAX_DROP_RUNGS - SPREAD_RUNGS,
    `a run that reached the top was walked all the way down to rung ${lowest}`,
  )
  assert.ok(lowest > LADDER_SPAN / 3, `rung ${lowest} is a different subject, not an easier question`)
})

test("a timeout is not a miss, and does not pull the band down", () => {
  // Same principle as `expired()` reporting nothing: a child who ran out of
  // time has told us nothing about what they know, and acting on it is a guess.
  const c = new Curriculum(seeded(19))
  const { host } = recordingHost()
  for (let i = 0; i < 20; i++) c.solved++
  for (let i = 0; i < 10; i++) {
    c.ask(host)
    c.expired()
  }
  assert.equal(c.recentMisses, 0, "a timeout was counted as a wrong answer")
})

test("the rift asks below the band, and the band below that", () => {
  const c = new Curriculum(seeded(23))
  for (let i = 0; i < 12; i++) c.solved++
  assert.equal(c.difficulty(), 7)
  assert.equal(c.difficulty(-1), 6)
  const riftEdge = c.edgeUnit(-1)
  assert.ok(riftEdge < c.edgeUnit(), "a rift question must be easier than the run's own edge")
  for (let i = 0; i < 500; i++) {
    const u = c.askUnit(-1)
    assert.ok(u <= riftEdge, "a rift question came in above what the run had earned")
    assert.ok(u >= 0)
  }
})
