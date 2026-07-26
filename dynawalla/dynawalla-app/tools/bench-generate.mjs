// Headless generation and answer-path bench.
//
// EXPERIENCE_DESIGN puts a hard rule on generation: "if any single `generate()`
// exceeds 4 ms measured, move generation to a Worker — do not optimise in place."
// And it budgets `commit → judgement` under 1 ms. Both are measured on demand,
// and the numbers are printed rather than described.
//
//   node --experimental-strip-types tools/bench-generate.mjs [iterations]
//
// The answer-path half is here, not only in the browser bench, because the
// branches are not equally reachable from a driver: the app serves one contrast
// pair per misconception per session, so a browser run yields one diagnosed
// sample however hard it tries. In Node the same judging path runs over thousands
// of real items on every branch, which is what makes the budget claim cover the
// branch it says it covers.
//
// This is a *developer machine* number. `Q-01` is the same measurement on a
// Galaxy Tab A9 and is a `[device]` item that no script can close.

import { countingBoard } from "../src/work/contrast.ts"
import { exact } from "../src/work/curriculum.ts"
import { judge } from "../src/work/judge.ts"
import { LADDER, rungAt } from "../src/work/ladder.ts"
import { generateProblem } from "../src/work/session.ts"

const iterations = Number(process.argv[2] ?? 2000)

function percentile(sorted, p) {
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[rank]
}

const rows = []

for (let rung = 0; rung < LADDER.length; rung++) {
  const spec = rungAt(rung)
  const samples = []
  // Warm the JIT so the first few calls do not dominate a short run.
  for (let i = 0; i < 200; i++) generateProblem(spec, i)
  for (let i = 0; i < iterations; i++) {
    const started = performance.now()
    generateProblem(spec, i + 1_000_000)
    samples.push(performance.now() - started)
  }
  samples.sort((a, b) => a - b)
  rows.push({
    rung,
    skill: spec.skillId,
    level: spec.level,
    p50: percentile(samples, 50),
    p95: percentile(samples, 95),
    p99: percentile(samples, 99),
    max: samples[samples.length - 1],
  })
}

const ms = (n) => `${n.toFixed(3)} ms`
console.log(`generate() over ${String(iterations)} seeds per rung\n`)
for (const row of rows) {
  console.log(
    `rung ${String(row.rung)}  ${row.skill} L${String(row.level)}  ` +
      `p50 ${ms(row.p50)}  p95 ${ms(row.p95)}  p99 ${ms(row.p99)}  max ${ms(row.max)}`,
  )
}

const worstP95 = Math.max(...rows.map((r) => r.p95))
console.log(`\nworst p95 across rungs: ${ms(worstP95)}  (Worker threshold: 4 ms)`)

// ── commit → judgement, per branch ──────────────────────────────────────────
//
// The work `commit` does that depends on the answer: judge (classifying through
// every mal-rule of the family) and, where this build can draw one, the counting
// board. The rest of that path is object spreads over state that already exists.

const answerOf = (value) => ({ kind: "integer", value: exact.rational(value) })

const branches = { seated: [], diagnosed: [], unexplained: [] }

for (let rung = 0; rung < LADDER.length; rung++) {
  const spec = rungAt(rung)
  for (let i = 0; i < iterations; i++) {
    const exercise = generateProblem(spec, i + 2_000_000)
    const canonical = exercise.answer.canonical
    if (canonical.kind !== "integer") continue
    const right = exact.toScaled(canonical.value, 0)
    if (right === null) continue

    // The buggy answer, if this item admits one this build can draw a board for.
    let buggy = null
    for (let place = 1; place <= 4 && buggy === null; place++) {
      const candidate = answerOf(right + 10n ** BigInt(place))
      const verdict = judge(exercise, candidate)
      if (verdict.kind === "struck" && verdict.diagnosis?.contrast != null) buggy = candidate
    }

    const cases = [
      ["seated", answerOf(right)],
      ["unexplained", answerOf(right + 7n)],
      ...(buggy === null ? [] : [["diagnosed", buggy]]),
    ]
    for (const [branch, value] of cases) {
      const started = performance.now()
      const verdict = judge(exercise, value)
      if (verdict.kind === "struck" && verdict.diagnosis?.contrast != null) {
        countingBoard(exercise, value)
      }
      branches[branch].push(performance.now() - started)
    }
  }
}

console.log(`\ncommit → judgement, by branch (budget: < 1 ms)\n`)
for (const [name, samples] of Object.entries(branches)) {
  if (samples.length === 0) {
    console.log(`${name.padEnd(12)}  no samples`)
    continue
  }
  samples.sort((a, b) => a - b)
  console.log(
    `${name.padEnd(12)}  n ${String(samples.length).padStart(6)}  ` +
      `p50 ${ms(percentile(samples, 50))}  p95 ${ms(percentile(samples, 95))}  ` +
      `max ${ms(samples[samples.length - 1])}`,
  )
}

const worstJudge = Math.max(
  ...Object.values(branches)
    .filter((s) => s.length > 0)
    .map((s) => percentile(s, 95)),
)
console.log(`\nworst p95 across branches: ${ms(worstJudge)}  (budget: 1 ms)`)
process.exitCode = worstP95 < 4 && worstJudge < 1 ? 0 : 1
