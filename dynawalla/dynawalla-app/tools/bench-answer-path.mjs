// The answer path, in Node, with no browser in the way.
//
//   node --experimental-strip-types tools/bench-answer-path.mjs [cards]
//
// `bench-loop.mjs` measures the same thing through Chrome and reports what a
// child would feel; this measures the *work*, at a sample size a browser driver
// cannot reach in a reasonable time. It exists because M5 put the learner model
// on the answer path — `commit` now judges, diagnoses, updates θ, φ, β, the
// latency EWMA, the fact cards and the difficulty controller, and decides whether
// to throw the rest of the batch away — and "the loop must not get slower" is a
// claim that needs a number on both sides of the change.
//
// Two spans are reported and they are not the same question:
//
//   commit               the whole answer path, which is what the child waits for
//   plan                 `nextExercises(8)`, which runs in idle and must not be
//                        on the critical path — gate EG-4 budgets it at p99 < 5 ms
//
// Answers alternate correct and wrong on a fixed pattern so both branches of the
// answer path are sampled: a seated answer does no diagnosis at all, and a struck
// one runs every mal-rule's column procedure.

import { glyphFromKey } from "../src/work/entry.ts"
import { advance, commit, prepare, pressKey, startSession } from "../src/work/session.ts"
import { adaptivePlanner } from "../src/work/plan.ts"
import { engineCatalog, DEFAULT_GRADE } from "../src/work/catalog.ts"
import { coldStart, newSession, planBatch } from "../../engine/src/index.ts"
import { writtenAnswer } from "../src/work/problem.ts"

const CARDS = Number(process.argv[2] ?? 2000)

const percentile = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))] ?? 0
}
const report = (name, xs) =>
  console.log(
    `${name.padEnd(8)} n=${String(xs.length).padStart(5)}  p50=${percentile(xs, 50).toFixed(4)}ms  ` +
      `p95=${percentile(xs, 95).toFixed(4)}ms  p99=${percentile(xs, 99).toFixed(4)}ms  max=${Math.max(...xs).toFixed(4)}ms`,
  )

function typeIn(state, digits) {
  return digits.split("").reduce((next, digit) => {
    const glyph = glyphFromKey(digit)
    return glyph === null ? next : pressKey(next, { kind: "glyph", glyph })
  }, state)
}

// ── the answer path ─────────────────────────────────────────────────────────
let state = startSession({
  profileId: "bench",
  learner: coldStart(engineCatalog(), DEFAULT_GRADE, 0),
  seedCursor: 0,
  day: 0,
})
const commits = []
/** A session is a day. Renewed on the same cadence the app does, so the session
 *  context — recent items, benched skills, fatigue — is exercised rather than
 *  accumulating for two thousand cards, which no child ever does. */
const CARDS_PER_SESSION = 24
for (let card = 0; card < CARDS; card++) {
  if (card > 0 && card % CARDS_PER_SESSION === 0) {
    state = startSession({
      profileId: "bench",
      learner: state.learner,
      seedCursor: state.seedCursor,
      day: Math.floor(card / CARDS_PER_SESSION),
    })
  }
  if (state.card.kind !== "problem") {
    state = advance(state)
    card -= 1
    continue
  }
  const right = writtenAnswer(state.card.exercise) ?? "0"
  // Every fourth answer is wrong, and wrong by one, so the diagnosis path runs.
  const answer = card % 4 === 3 ? String(Math.max(0, Number(right) - 1)) : right
  const typed = typeIn(state, answer)
  const started = performance.now()
  const committed = commit(typed, 6000)
  commits.push(performance.now() - started)
  state = advance(prepare(committed))
}

// ── the planner, which runs in idle ─────────────────────────────────────────
const catalog = engineCatalog()
let learner = coldStart(catalog, DEFAULT_GRADE, 0)
const context = newSession(1, 0, learner)
const plans = []
for (let batch = 0; batch < 500; batch++) {
  const started = performance.now()
  planBatch(catalog, learner, context, 8)
  plans.push(performance.now() - started)
}

console.log(`answer path, ${String(CARDS)} cards, planner ${adaptivePlanner.name}`)
report("commit", commits)
report("plan", plans)
