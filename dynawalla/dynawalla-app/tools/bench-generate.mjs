// Headless generation bench.
//
// EXPERIENCE_DESIGN puts a hard rule on this number: "if any single `generate()`
// exceeds 4 ms measured, move generation to a Worker — do not optimise in place."
// So it is measured, on demand, and the number is printed rather than described.
//
//   node --experimental-strip-types tools/bench-generate.mjs [iterations]
//
// This is a *developer machine* number. `Q-01` is the same measurement on a
// Galaxy Tab A9 and is a `[device]` item that no script can close.

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
process.exitCode = worstP95 < 4 ? 0 : 1
