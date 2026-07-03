// journey-sim CLI (engine.md §7) — the pre-ship simulation gate.
//
//   node --experimental-strip-types scripts/journey-sim/cli.ts \
//     [--learners 25] [--days 180] [--seed 1] [--personas a,b] [--out DIR]
//     [--w6-smoke] [--quick]
//
// Impure edge: fs/process usage is allowed HERE (dev-only, never bundled).

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { makeSimGraph } from "./fixture.ts"
import { PERSONAS } from "./learner.ts"
import { evaluateGates, formatReport } from "./report.ts"
import { runLearner, type LearnerRun } from "./runner.ts"

const here = path.dirname(fileURLToPath(import.meta.url))

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const flag = (name: string): boolean => process.argv.includes(`--${name}`)

async function determinismCheck(seed: number): Promise<boolean> {
  const graph = makeSimGraph({ seed: 42 })
  for (const persona of PERSONAS) {
    const a = await runLearner(graph, persona, 0, seed, 30)
    const b = await runLearner(graph, persona, 0, seed, 30)
    if (a.transcriptHash !== b.transcriptHash || a.totalCards !== b.totalCards) {
      console.error(`[determinism] ${persona.id}: transcripts diverged`)
      return false
    }
  }
  return true
}

/** Load the W6 fixture pack via the in-tree PackReader → CourseGraph loader
 *  (esbuild-bundled — util/journeyPack.ts's module graph pulls @tauri-apps)
 *  and run the engine on it for 3 days. Proves the loader seam end-to-end. */
async function w6Smoke(seed: number): Promise<boolean> {
  const dbPath = path.resolve(
    here,
    "../../../dja/journey_pack/fixtures/dist/journey_en/data/course.sqlite3",
  )
  if (!fs.existsSync(dbPath)) {
    console.log(`[w6-smoke] fixture DB not found at ${dbPath} — skipped`)
    return true
  }
  const { build } = await import("esbuild")
  const res = await build({
    entryPoints: [path.resolve(here, "../../src/util/journeyPack.ts")],
    bundle: true,
    format: "esm",
    write: false,
    platform: "neutral",
    define: { "import.meta.env.DEV": "false" },
    tsconfig: path.resolve(here, "../../tsconfig.json"),
  })
  const mod = (await import(
    "data:text/javascript;base64," + Buffer.from(res.outputFiles[0].text).toString("base64")
  )) as typeof import("../../src/util/journeyPack.ts")
  const { DatabaseSync } = await import("node:sqlite")
  const db = new DatabaseSync(dbPath, { readOnly: true })
  const queryFn = async (sql: string, params: unknown[], maxRows: number) =>
    db.prepare(sql).all(...(params as never[])).slice(0, maxRows) as Record<string, unknown>[]
  const graph = await mod.loadCourseGraph(queryFn, { pageSize: 16 })
  console.log(
    `[w6-smoke] loaded ${graph.courseId}: ${graph.units.length} units, ` +
      `${Object.keys(graph.skills).length} skills, ${Object.keys(graph.items).length} items, ` +
      `${graph.checkpoints.length} checkpoints, ${graph.rareCards.length} rare cards`,
  )
  const run = await runLearner(graph as never, PERSONAS[0], 0, seed, 3)
  console.log(
    `[w6-smoke] engine served ${run.totalCards} cards over 3 days ` +
      `(${run.scoredCards} scored, grades ${JSON.stringify(run.grades)})`,
  )
  return run.totalCards > 0
}

async function main(): Promise<void> {
  const learners = Number(arg("learners", flag("quick") ? "4" : "25"))
  const days = Number(arg("days", flag("quick") ? "45" : "180"))
  const seed = Number(arg("seed", "1"))
  const personaIds = arg("personas", PERSONAS.map((p) => p.id).join(",")).split(",")
  const outDir = arg("out", path.join(here, "out", `run-${seed}-${learners}x${days}`))
  const started = Date.now()

  console.log(`journey-sim: ${learners} learners/persona × ${days} days, seed ${seed}`)

  if (flag("w6-smoke")) {
    const ok = await w6Smoke(seed)
    if (!ok) process.exit(1)
    if (process.argv.includes("--w6-smoke-only")) return
  }

  console.log("[determinism] paired identical-seed runs (30 days × all personas)…")
  const determinismOk = await determinismCheck(seed)
  console.log(`[determinism] ${determinismOk ? "byte-identical" : "DIVERGED"}`)

  const graph = makeSimGraph({ seed: 42 })
  console.log(
    `fixture: ${graph.units.length} units, ${Object.keys(graph.skills).length} skills, ` +
      `${Object.keys(graph.items).length} items, ${graph.activityTemplates.length} templates`,
  )

  const runs: LearnerRun[] = []
  for (const persona of PERSONAS) {
    if (!personaIds.includes(persona.id)) continue
    const t0 = Date.now()
    for (let i = 0; i < learners; i++) {
      runs.push(await runLearner(graph, persona, i, seed, days))
    }
    console.log(`  ${persona.id}: ${learners} learners in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  }

  const gates = evaluateGates(runs, determinismOk)
  const report = formatReport(gates, { learners, days, seed, personas: personaIds }, Date.now() - started)
  console.log("\n" + report)

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, "report.md"), report + "\n")
  fs.writeFileSync(
    path.join(outDir, "metrics.json"),
    JSON.stringify(
      {
        config: { learners, days, seed, personas: personaIds },
        gates,
        perLearner: runs.map((r) => ({
          persona: r.persona,
          index: r.index,
          a: r.a,
          activeDays: r.activeDays,
          totalCards: r.totalCards,
          scoredCards: r.scoredCards,
          grades: r.grades,
          poolCounts: r.poolCounts,
          arc1DoneActiveDay: r.arc1DoneActiveDay,
          debutsCompleted: r.debutsCompleted,
          reviewTouches: r.reviewTouches,
          p11: r.p11,
          relaxations: r.relaxations,
          batches: r.batches,
          finalTheta: r.finalCourse?.theta,
          finalNewPerDay: r.finalCourse?.newPerDay,
          finalCapacity: r.finalCourse?.dailyCapacityEwma,
          // due-at-session-start samples (calibration diagnostics, W11)
          dueCurve: [30, 60, 90, 120, 150, 179].map(
            (d) => r.days.find((x) => x.day === d)?.dueAtStart ?? null,
          ),
          modeTotals: r.days.reduce(
            (a, d) => ({
              cruise: a.cruise + d.modes.cruise,
              normal: a.normal + d.modes.normal,
              struggle: a.struggle + d.modes.struggle,
            }),
            { cruise: 0, normal: 0, struggle: 0 },
          ),
        })),
      },
      null,
      2,
    ) + "\n",
  )
  console.log(`\nwrote ${outDir}/report.md + metrics.json`)
  const failed = gates.some((g) => g.pass === false)
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
