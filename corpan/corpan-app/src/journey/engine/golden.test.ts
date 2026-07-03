// engine.md §8.3 golden transcripts — three end-to-end fixtures snapshotting
// (feed specIds, grades, θ) per step. Catches unintended behavioral drift;
// regenerating (JOURNEY_REGEN_GOLDEN=1) requires a spec-cited justification
// in the PR.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { DAY_MS } from "./clock.ts"
import type { ProbeResult } from "./types.ts"
import { answer, makeEngine } from "./__fixtures__/harness.ts"

const CONS = { availableProviders: ["native"] }
const here = path.dirname(fileURLToPath(import.meta.url))
const goldenPath = path.join(here, "__golden__", "transcripts.json")

interface Step {
  cards: string[]
  grades: string[]
  theta: number
}

async function playScenario(
  name: "fresh-beginner" | "placed-intermediate" | "struggle-session",
): Promise<Step[]> {
  const h = await makeEngine({ unitsPerArc: 3, itemsPerSkill: 8 })
  const steps: Step[] = []
  const passFn: (i: number, batch: number) => boolean =
    name === "struggle-session" ? (i) => i % 3 === 0 : (i) => i % 4 !== 3
  if (name === "placed-intermediate") {
    const transcript: ProbeResult[] = h.graph.units
      .flatMap((u) => u.skillIds)
      .flatMap((s) => h.graph.skills[s].itemIds.slice(0, 1))
      .slice(0, 10)
      .map((itemId) => ({ itemId, correct: h.graph.items[itemId].b < -1.5, latencyMs: 2500 }))
    h.engine.startSession()
    h.engine.placeUser(transcript)
  }
  const days = name === "fresh-beginner" ? 3 : 2
  for (let day = 0; day < days; day++) {
    h.engine.startSession()
    for (let b = 0; b < 2; b++) {
      const cards = h.engine.nextFeedItems(8, CONS)
      if (cards.length === 0) break
      const grades: string[] = []
      cards.forEach((card, i) => {
        const out = h.engine.applyResult(answer(card, { pass: passFn(i, b) }))
        grades.push(out.grades.map((g) => `${g.itemId}=${g.grade}`).join(","))
      })
      steps.push({
        cards: cards.map((c) => `${c.spec.specId}|${c.spec.activityType}|${c.meta.pool}|f${c.meta.form}`),
        grades,
        theta: Math.round(h.engine.getCourseSnapshot().theta * 1e6) / 1e6,
      })
    }
    h.clock.advance(DAY_MS)
  }
  return steps
}

test("golden transcripts: fresh beginner / placed intermediate / struggle session", async () => {
  const actual = {
    "fresh-beginner": await playScenario("fresh-beginner"),
    "placed-intermediate": await playScenario("placed-intermediate"),
    "struggle-session": await playScenario("struggle-session"),
  }
  if (process.env.JOURNEY_REGEN_GOLDEN === "1" || !fs.existsSync(goldenPath)) {
    fs.mkdirSync(path.dirname(goldenPath), { recursive: true })
    fs.writeFileSync(goldenPath, JSON.stringify(actual, null, 2) + "\n")
    assert.ok(fs.existsSync(goldenPath), "golden regenerated")
    return
  }
  const expected = JSON.parse(fs.readFileSync(goldenPath, "utf8"))
  assert.deepEqual(actual, expected, "behavioral drift vs __golden__/transcripts.json — regenerate ONLY with a spec-cited justification")
})
