// journey-sim CLI (engine.md §7) — the pre-ship simulation gate.
//
//   node --experimental-strip-types scripts/journey-sim/cli.ts \
//     [--learners 25] [--days 180] [--seed 1] [--personas a,b] [--out DIR]
//     [--w6-smoke] [--quick] [--p8 [--p8-only]]
//
// --p8 runs the R10 placement gate against the REAL journey_en pack
// (dja/journey_pack/dist) with personas scoped to the shipped arcs; set
// P8_DEBUG=1 for per-learner rows.
//
// Impure edge: fs/process usage is allowed HERE (dev-only, never bundled).

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { makeSimGraph } from "./fixture.ts"
import { Learner, PERSONAS, type Persona } from "./learner.ts"
import { evaluateGates, formatReport } from "./report.ts"
import { runLearner, type LearnerRun } from "./runner.ts"
import { createManualClock, DAY_MS } from "../../src/journey/engine/clock.ts"
import { createJourneyEngine, createMemoryPersistence } from "../../src/journey/engine/index.ts"
import type { CourseGraph } from "../../src/journey/engine/index.ts"

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

/** Load a built course pack's graph via the in-tree loader (the w6Smoke
 *  precedent: esbuild-bundle journeyPack.ts, node:sqlite for the DB). */
async function loadPackGraph(dbPath: string): Promise<CourseGraph> {
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
  return (await mod.loadCourseGraph(queryFn)) as unknown as CourseGraph
}

/**
 * P8 — placement quality against the REAL journey_en pack (engine.md §7.4
 * row P8, R10). Personas are scoped to the shipped arcs: ability `a` is
 * drawn around the pack's content band midpoint, so the cohort naturally
 * splits into in-band learners (graded on |θ̂ − a| ≤ PLACEMENT_INBAND_TOLERANCE
 * within ≤25 items) and above-ceiling learners (a > max content b; must
 * terminate "above-content" within the Phase-2 budget, never grind).
 *
 * Wrong-placement self-heal (the P8 third leg): every 10th learner is
 * mis-calibrated — placement answered from an inflated prior-knowledge
 * profile (a + 1.5) — then the TRUE learner plays ≤14 simulated days and
 * must trigger the week-one rewind offer or a placement-seeded skill
 * demotion (engine.md §4.3.4 "rewind or demotion path corrects the
 * starting frontier within 14 days").
 */

/**
 * P8 in-band accuracy tolerance |θ̂ − a| for the "placed" leg (CTO-RESOLUTIONS
 * R17, 2026-07-03): amended from 0.6 → 0.8 @ ≥90%. The ±0.6 leg sat at the
 * information floor of ≤25 guessable probes (pooled placed-row error unbiased,
 * σ ≈ 0.40; ±0.6 @ ≥90% needs σ ≤ 0.36, i.e. ≥40 probes) — no estimator passes
 * it under the §7.1 learner within the spec's own ≤25-item budget. adaptivity
 * §4 calls precision beyond ±half a CEFR band (0.75) fake for author-assigned
 * b. Measured under this target: 94/94/100% per seed (CALIBRATION.md §5).
 *
 * NOTE: the separate 0.6 "ceiling-proximity grace" below (|maxB − a| ≤ 0.6) is
 * NOT this tolerance — it is band-edge identifiability tied to the engine's 0.5
 * above-content margin (PLACEMENT_ABOVE_CONTENT_MARGIN + jitter), so it stays
 * at 0.6 and is left literal.
 */
const PLACEMENT_INBAND_TOLERANCE = 0.8

const P8_CONSTRAINTS = {
  availableProviders: ["native", "lingo_hero"],
  modelsAvailable: ["stt", "llm", "tts"],
}

async function p8Gate(seed: number, learners: number): Promise<boolean> {
  const dbPath = path.resolve(
    here,
    "../../../dja/journey_pack/dist/journey_en/data/course.sqlite3",
  )
  if (!fs.existsSync(dbPath)) {
    console.error(`[P8] real journey_en pack not built at ${dbPath} — run dja/journey_pack/build_journey_pack.py en`)
    return false
  }
  const graph = await loadPackGraph(dbPath)
  const bs = Object.values(graph.items).map((i) => i.b)
  const minB = Math.min(...bs)
  const maxB = Math.max(...bs)
  console.log(
    `[P8] real pack ${graph.courseId}: ${Object.keys(graph.items).length} items, ` +
      `b ∈ [${minB.toFixed(2)}, ${maxB.toFixed(2)}]`,
  )

  const basePersona: Persona = {
    id: "p8-scoped",
    aMu: (minB + maxB) / 2,
    attends: () => true,
    sessionMinutes: 15,
    sessionsPerDay: 1,
    notes: "P8 placement cohort scoped to the shipped arcs (R10)",
  }

  type P8Row = {
    a: number
    theta: number
    asked: number
    outcome: string
  }
  const rows: P8Row[] = []
  const heals: { a: number; healedDay: number | null; how: string }[] = []
  for (let i = 0; i < learners; i++) {
    // Two-pass same-seed construction: read the drawn `a` first, then rebuild
    // the learner with a prior-knowledge prefix matching that ability (the
    // count of items at or below a — the "knows some" placed-intermediate
    // shape, scoped to this pack).
    const probeSeed = seed * 1_000_003 + i
    const aOnly = new Learner(basePersona, graph, probeSeed)
    const injected = i % 10 === 0 // the 10% mis-calibrated self-heal cohort
    const priorKnown = Object.values(graph.items).filter((it) => it.b <= aOnly.a).length
    // mis-calibrated cohort: placement is answered by a learner whose
    // ABILITY (and matching prior-knowledge profile) reads +1.5 above the
    // truth — the classic over-placement. Same seed ⇒ same gauss draw, so
    // the placement learner's a is exactly trueA + 1.5.
    const placementPrior = injected
      ? Object.values(graph.items).filter((it) => it.b <= aOnly.a + 1.5).length
      : priorKnown
    const placementLearner = new Learner(
      injected
        ? { ...basePersona, aMu: basePersona.aMu + 1.5, priorKnownItems: placementPrior }
        : { ...basePersona, priorKnownItems: priorKnown },
      graph,
      probeSeed,
    )

    const clock = createManualClock({ startMs: 20_000 * DAY_MS + 9 * 3_600_000 })
    const engine = createJourneyEngine({
      key: { stackId: `p8-${i}`, courseId: graph.courseId },
      graph,
      persistence: createMemoryPersistence({ now: () => clock.nowMs() }),
      clock,
    })
    await engine.load()
    engine.startSession()
    const controller = engine.startPlacement("probe")
    for (;;) {
      const card = controller.next()
      if (!card) break
      engine.applyResult(placementLearner.answer(card, 0))
    }
    const outcome = controller.finalize()
    if (!injected) {
      rows.push({
        a: placementLearner.a,
        theta: outcome.record.theta,
        asked: outcome.record.asked.length,
        outcome: outcome.record.outcome,
      })
    }
    if (process.env.P8_DEBUG) {
      const correct = outcome.record.asked.filter((x) => x.correct).length
      console.log(
        `[P8:dbg] a=${placementLearner.a.toFixed(2)} priorKnown=${placementPrior}${injected ? " (INJECTED)" : ""} ` +
          `theta=${outcome.record.theta.toFixed(2)} se=${outcome.record.se.toFixed(2)} ` +
          `asked=${outcome.record.asked.length} correct=${correct} outcome=${outcome.record.outcome}`,
      )
    }

    if (injected) {
      // self-heal: the TRUE learner (honest priorKnown) plays ≤14 days;
      // heal = week-one rewind offered (tickDay §4.3.4) OR a placement-
      // seeded skill demoting out of its provisional level-3.
      const trueLearner = new Learner({ ...basePersona, priorKnownItems: priorKnown }, graph, probeSeed)
      const placedSkills = new Set(outcome.unlockedSkills)
      let healedDay: number | null = null
      let how = ""
      for (let d = 1; d <= 14 && healedDay === null; d++) {
        clock.setDay(20_000 + d, 9 * 3_600_000)
        const roll = engine.tickDay()
        if (roll.placementCheck === "offer-rewind") {
          healedDay = d
          how = "rewind"
          break
        }
        const demoted = roll.announcements.find(
          (an) => an.from >= 3 && an.to < 3 && placedSkills.has(an.skillId),
        )
        if (demoted) {
          healedDay = d
          how = "demotion"
          break
        }
        engine.startSession()
        let secondsUsed = 0
        let emptyStreak = 0
        while (secondsUsed < basePersona.sessionMinutes * 60 && emptyStreak < 2) {
          const cards = engine.nextFeedItems(10, P8_CONSTRAINTS)
          if (cards.length === 0) {
            emptyStreak += 1
            continue
          }
          emptyStreak = 0
          for (const card of cards) {
            const res = trueLearner.answer(card, d)
            clock.advance(Math.min(res.durationMs, 120_000))
            secondsUsed += res.durationMs / 1000 + 2
            engine.applyResult(res)
          }
        }
      }
      heals.push({ a: trueLearner.a, healedDay, how })
      if (process.env.P8_DEBUG) {
        console.log(
          `[P8:dbg] self-heal a=${trueLearner.a.toFixed(2)} healed=${healedDay === null ? "NO" : `day ${healedDay} (${how})`}`,
        )
      }
    }
  }

  const inBand = rows.filter((r) => r.a <= maxB)
  const aboveBand = rows.filter((r) => r.a > maxB)
  // In-band: placed within ±PLACEMENT_INBAND_TOLERANCE of true ability in ≤25
  // items — OR an honest "above-content" when the true ability sits within 0.6
  // of the ceiling (indistinguishable from the ceiling by construction).
  const inBandOk = inBand.filter(
    (r) =>
      r.asked <= 25 &&
      ((r.outcome === "placed" && Math.abs(r.theta - r.a) <= PLACEMENT_INBAND_TOLERANCE) ||
        (r.outcome === "above-content" && maxB - r.a <= 0.6)),
  )
  // Above-band: terminate "above-content" within budget — OR, at the band
  // edge (a within 0.6 of the ceiling, closer than the engine's 0.5
  // above-content margin can distinguish), an accurate in-band placement.
  // Symmetric to the in-band edge grace above.
  const aboveOk = aboveBand.filter(
    (r) =>
      r.asked <= 25 &&
      (r.outcome === "above-content" ||
        (r.a - maxB <= 0.6 &&
          r.outcome === "placed" &&
          Math.abs(r.theta - r.a) <= PLACEMENT_INBAND_TOLERANCE)),
  )
  const accuracy = inBand.length > 0 ? inBandOk.length / inBand.length : 1
  const maxAsked = rows.reduce((m, r) => Math.max(m, r.asked), 0)
  const healed = heals.filter((h) => h.healedDay !== null)
  const healDays = healed.map((h) => h.healedDay as number)
  const pass =
    accuracy >= 0.9 && aboveOk.length === aboveBand.length && healed.length === heals.length

  const detail =
    `P8 Placement quality (REAL journey_en pack, personas scoped to shipped arcs — R10): ` +
    `${pass ? "PASS" : "FAIL"} — in-band |θ̂−a|≤${PLACEMENT_INBAND_TOLERANCE} in ≤25 items: ${inBandOk.length}/${inBand.length} ` +
    `(${(100 * accuracy).toFixed(0)}%, need ≥90%); above-ceiling terminate "above-content" ≤ budget: ` +
    `${aboveOk.length}/${aboveBand.length}; max items asked ${maxAsked}; ` +
    `wrong-placement self-heal (week-one rewind or demotion ≤14d, injected 10% cohort): ` +
    `${healed.length}/${heals.length} healed` +
    (healDays.length > 0 ? ` (days ${healDays.join(",")})` : "")
  console.log(`[P8] ${detail}`)
  return pass
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

  if (flag("p8")) {
    const ok = await p8Gate(seed, learners)
    if (process.argv.includes("--p8-only")) {
      process.exit(ok ? 0 : 1)
    }
    if (!ok) process.exitCode = 1
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
