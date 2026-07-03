// journey-sim gate evaluation (engine.md §7.4 P1–P11). P8 (placement
// quality) is DEFERRED per R10 — it must run against the real journey_en
// pack graph before publish, not only the fixture.

import type { LearnerRun } from "./runner.ts"

export interface GateResult {
  id: string
  name: string
  pass: boolean | null // null = deferred / not-applicable
  detail: string
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2
}

function p95(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)]
}

function pct(x: number): string {
  return `${(100 * x).toFixed(1)}%`
}

const STRAND_TARGETS: Record<number, [number, number, number, number]> = {
  0: [0.3, 0.1, 0.4, 0.2], // A1
  1: [0.3, 0.2, 0.3, 0.2], // A2
}

export function evaluateGates(runs: LearnerRun[], determinismOk: boolean | null): GateResult[] {
  const by = (id: string): LearnerRun[] => runs.filter((r) => r.persona === id)
  const gates: GateResult[] = []

  // ---- P1 review-load curve --------------------------------------------------
  {
    const dm = by("daily-median")
    let ok = 0
    const meds: number[] = []
    const p95s: number[] = []
    for (const r of dm) {
      const cap = Math.max(1, r.finalCourse?.dailyCapacityEwma ?? 1)
      const dues = r.days.filter((d) => d.active && d.day >= 14).map((d) => d.dueAtStart)
      const m = median(dues)
      const p = p95(dues)
      meds.push(m / cap)
      p95s.push(p / cap)
      if (m <= 1.2 * cap && p <= 2.0 * cap) ok += 1
    }
    const lap = by("lapser")
    let lapOk = 0
    for (const r of lap) {
      const cap = Math.max(1, r.finalCourse?.dailyCapacityEwma ?? 1)
      const post = r.days.filter((d) => d.day >= 81 && d.active).slice(0, 10)
      const drained = post.some((d) => d.dueAtStart <= 1.2 * cap)
      const floorStuck = (r.finalCourse?.newPerDay ?? 12) <= 4
      if (drained && !floorStuck) lapOk += 1
    }
    const dmPass = dm.length > 0 && ok / dm.length >= 0.9
    const lapPass = lap.length > 0 && lapOk / lap.length >= 0.8
    gates.push({
      id: "P1",
      name: "Review-load curve",
      pass: dmPass && lapPass,
      detail:
        `daily-median: ${ok}/${dm.length} learners with median due ≤1.2×cap ∧ p95 ≤2.0×cap ` +
        `(median ratio ${median(meds).toFixed(2)}, p95 ratio ${median(p95s).toFixed(2)}); ` +
        `lapser drain ≤10 active days w/o newPerDay floor: ${lapOk}/${lap.length}`,
    })
  }

  // ---- P2 debt brake ----------------------------------------------------------
  {
    const debutsOnBrake = runs.reduce((a, r) => a + r.debutsOnBrakeDays, 0)
    const wb = by("weekend-binger")
    const recoveries = wb.flatMap((r) => r.brakeRecoveryActiveDays)
    const recoveryOk = recoveries.length === 0 || median(recoveries) <= 3
    let cadenceViolations = 0
    for (const r of runs) {
      for (let i = 1; i < r.newPerDayChangeDays.length; i++) {
        if (r.newPerDayChangeDays[i] - r.newPerDayChangeDays[i - 1] < 7) cadenceViolations += 1
      }
    }
    gates.push({
      id: "P2",
      name: "Debt brake",
      pass: debutsOnBrake === 0 && recoveryOk && cadenceViolations === 0,
      detail:
        `debuts completed on braked days: ${debutsOnBrake}; weekend-binger median recovery ` +
        `${recoveries.length > 0 ? median(recoveries).toFixed(1) : "n/a"} active days ` +
        `(${recoveries.length} engagements); newPerDay adjustments <7d apart: ${cadenceViolations}`,
    })
  }

  // ---- P3 review:new ratio ------------------------------------------------------
  {
    const dm = by("daily-median")
    const ratios: number[] = []
    for (const r of dm) {
      const reviews = r.days.filter((d) => d.day >= 30).reduce((a, d) => a + d.reviews, 0)
      const debuts = r.days.filter((d) => d.day >= 30).reduce((a, d) => a + d.debuts, 0)
      if (debuts > 0) ratios.push(reviews / debuts)
    }
    const m = median(ratios)
    gates.push({
      id: "P3",
      name: "Review:new ratio (steady state)",
      pass: m >= 3 && m <= 6,
      detail: `daily-median days 30+: median ratio ${m.toFixed(2)}:1 (target 4:1, bounds [3,6])`,
    })
  }

  // ---- P4 time-to-arc ------------------------------------------------------------
  {
    const dm = by("daily-median").map((r) => r.arc1DoneActiveDay).filter((x): x is number => x !== null)
    const df = by("daily-fast").map((r) => r.arc1DoneActiveDay).filter((x): x is number => x !== null)
    const ss = by("slow-struggler")
    const dmMed = median(dm)
    const dfMed = median(df)
    const dmDone = dm.length / Math.max(1, by("daily-median").length)
    const fastEnough = df.length > 0 && dm.length > 0 && dfMed <= 0.75 * dmMed
    const struggleShares = ss.map((r) => {
      const scored = r.days.filter((d) => d.day >= 14).reduce((a, d) => a + d.scored, 0)
      const struggle = r.days.filter((d) => d.day >= 14).reduce((a, d) => a + d.modes.struggle, 0)
      return scored > 0 ? struggle / scored : 0
    })
    const ssOk = struggleShares.every((s) => s <= 0.4)
    gates.push({
      id: "P4",
      name: "Time-to-arc",
      pass: dmDone >= 0.8 && dmMed >= 45 && dmMed <= 100 && fastEnough && ssOk,
      detail:
        `daily-median Arc-1 completion: ${dm.length}/${by("daily-median").length} done, median ${dmMed} active days (target 45–100); ` +
        `daily-fast median ${df.length > 0 ? dfMed : "n/a"} (needs ≤ ${(0.75 * dmMed).toFixed(0)}); ` +
        `slow-struggler max struggle share after week 2: ${pct(Math.max(0, ...struggleShares))} (≤40%)`,
    })
  }

  // ---- P5 starvation ----------------------------------------------------------------
  {
    const daily = runs.filter((r) => ["daily-median", "daily-fast", "kid-guesser", "slow-struggler"].includes(r.persona))
    const dueServedAll = daily.every((r) => (r.poolCounts.due ?? 0) > 0 && (r.poolCounts.new ?? 0) > 0)
    const funShares = by("daily-median").map((r) => r.funCards / Math.max(1, r.totalCards))
    const funOk = median(funShares) >= 0.05
    const pi = by("placed-intermediate")
    const trickle = pi.map((r) => r.trickleUnvisitedAt60).filter((x): x is number => x !== null)
    const trickleOk = trickle.length > 0 && median(trickle) < 0.1
    const stale = daily.map((r) => r.dueStale14AtEnd)
    const staleOk = daily.every((r) => r.dueStale14AtEnd <= Math.max(2, 0.02 * r.totalCards))
    gates.push({
      id: "P5",
      name: "Starvation",
      pass: dueServedAll && funOk && trickleOk && staleOk,
      detail:
        `DUE+NEW served for every daily learner: ${dueServedAll}; FUN share (daily-median median) ${pct(median(funShares))} (≥5%); ` +
        `placed-intermediate unvisited placed-items at 60 active days: ${trickle.length > 0 ? pct(median(trickle)) : "n/a"} (<10%); ` +
        `due-items >14d stale at end (daily personas, max): ${Math.max(0, ...stale)}`,
    })
  }

  // ---- P6 livelock / determinism -------------------------------------------------------
  {
    const shortfalls = runs.reduce((a, r) => a + r.shortfallsWithoutReason, 0)
    const replayRepeats = runs.reduce((a, r) => a + r.p11.replayRepeatViolations, 0)
    gates.push({
      id: "P6",
      name: "Livelock / determinism",
      pass: shortfalls === 0 && replayRepeats === 0 && determinismOk === true,
      detail:
        `empty batches without a typed shortfall reason: ${shortfalls}; ` +
        `items replayed >1× per session: ${replayRepeats}; ` +
        `identical-seed transcript equality: ${determinismOk === null ? "not run" : determinismOk}`,
    })
  }

  // ---- P7 strand convergence --------------------------------------------------------------
  {
    const dm = by("daily-median")
    let ok = 0
    let worst = 0
    for (const r of dm) {
      const weekly = r.days.filter((d) => d.active && d.day >= 21)
      if (weekly.length === 0) continue
      let maxDev = 0
      for (const d of weekly) {
        const targets = STRAND_TARGETS[Math.min(d.arcOrdinal, 1)]
        for (let i = 0; i < 4; i++) maxDev = Math.max(maxDev, Math.abs(d.strandShares[i] - targets[i]))
      }
      worst = Math.max(worst, maxDev)
      if (maxDev <= 0.1) ok += 1
    }
    gates.push({
      id: "P7",
      name: "Strand convergence",
      pass: dm.length > 0 && ok / dm.length >= 0.8,
      detail:
        `daily-median learners within ±10 points of stage targets from week 3: ${ok}/${dm.length} ` +
        `(worst per-strand deviation ${pct(worst)}); last40 >65% fire-rate not separately instrumented (approximated by relaxation telemetry)`,
    })
  }

  // ---- P8 placement quality (DEFERRED — R10) --------------------------------------------------
  gates.push({
    id: "P8",
    name: "Placement quality",
    pass: null,
    detail:
      "DEFERRED: must run against the real journey_en pack graph with personas scoped to shipped arcs (R10); " +
      "the fixture-only run is not a valid P8 pass.",
  })

  // ---- P9 grade sanity -------------------------------------------------------------------------
  {
    const dm = by("daily-median")
    const easyShares: number[] = []
    const againShares: number[] = []
    for (const r of dm) {
      const total = r.grades.again + r.grades.hard + r.grades.good + r.grades.easy
      if (total === 0) continue
      easyShares.push(r.grades.easy / total)
      againShares.push(r.grades.again / total)
    }
    const easyOnGuessable = runs.reduce((a, r) => a + r.easyOnGuessable, 0)
    const e = median(easyShares)
    const a = median(againShares)
    gates.push({
      id: "P9",
      name: "Grade sanity",
      pass: e <= 0.1 && a >= 0.05 && a <= 0.25 && easyOnGuessable === 0,
      detail:
        `daily-median: Easy share ${pct(e)} (≤10%), Again share ${pct(a)} (∈[5%,25%]); ` +
        `Easy grades on MC-capped types across ALL runs: ${easyOnGuessable}`,
    })
  }

  // ---- P10 leech containment --------------------------------------------------------------------
  {
    const ss = by("slow-struggler")
    const shares = ss.map((r) => r.leechServings / Math.max(1, r.totalCards))
    const worst = Math.max(0, ...shares)
    const pooled =
      ss.reduce((a, r) => a + r.leechServings, 0) / Math.max(1, ss.reduce((a, r) => a + r.totalCards, 0))
    const suspendedServings = ss.reduce((a, r) => a + r.servingsAfterSuspicion, 0)
    const suspended = ss.reduce((a, r) => a + r.suspendedAtEnd, 0)
    const flagged = ss.reduce((a, r) => a + r.leechFlaggedAtEnd, 0)
    gates.push({
      id: "P10",
      name: "Leech containment",
      pass: pooled <= 0.03 && suspendedServings === 0,
      detail:
        `slow-struggler leech servings: ${pct(pooled)} of the persona's feed (≤3%; worst learner ${pct(worst)}); ` +
        `suspended-item servings: ${suspendedServings} (must be 0); ` +
        `flagged ${flagged} / suspended ${suspended} cards at end`,
    })
  }

  // ---- P11 constraint integrity --------------------------------------------------------------------
  {
    const gap = runs.reduce((a, r) => a + r.p11.itemGapViolations, 0)
    const debut = runs.reduce((a, r) => a + r.p11.debutOrderViolations, 0)
    const model = runs.reduce((a, r) => a + r.p11.modelBlockViolations, 0)
    const relax = runs.reduce((a, r) => a + r.relaxations, 0)
    const batches = runs.reduce((a, r) => a + r.batches, 0)
    const relaxRate = batches > 0 ? relax / batches : 0
    gates.push({
      id: "P11",
      name: "Constraint integrity",
      pass: gap === 0 && debut === 0 && model === 0 && relaxRate < 0.02 * 10, // relaxations counted per SLOT; 10 slots/batch
      detail:
        `violations — itemGap(<2): ${gap}, debut order: ${debut}, model-block contiguity: ${model}; ` +
        `relaxation rate ${relaxRate.toFixed(3)} per batch over ${batches} batches (slot-level log; <0.2/batch bound)`,
    })
  }

  return gates
}

export function formatReport(
  gates: GateResult[],
  config: { learners: number; days: number; seed: number; personas: string[] },
  elapsedMs: number,
): string {
  const lines: string[] = []
  lines.push("# journey-sim gate report")
  lines.push("")
  lines.push(
    `config: ${config.learners} learners/persona × ${config.days} days, seed ${config.seed}, personas [${config.personas.join(", ")}], ${(elapsedMs / 1000).toFixed(1)}s`,
  )
  lines.push("")
  for (const g of gates) {
    const badge = g.pass === null ? "DEFER" : g.pass ? "PASS " : "FAIL "
    lines.push(`[${badge}] ${g.id} ${g.name}`)
    lines.push(`        ${g.detail}`)
  }
  const failed = gates.filter((g) => g.pass === false).length
  const deferred = gates.filter((g) => g.pass === null).length
  lines.push("")
  lines.push(
    `${gates.length - failed - deferred} passed, ${failed} failed, ${deferred} deferred (P8 needs the real journey_en pack)`,
  )
  return lines.join("\n")
}
