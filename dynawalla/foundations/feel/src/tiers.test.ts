// The product rules, asserted.
//
// Every test here corresponds to a sentence in the brief or in MISSION.md.
// If one of these fails the tuning is not "off", the product is wrong.

import { test } from "node:test"
import assert from "node:assert/strict"
import { TIERS, TIER_ORDER, chooseTier, energy, type TierName } from "./tiers.ts"
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const LADDER: TierName[] = ["tick", "snap", "pop", "slam", "bloom", "ascend"]

test("ordinary success never blocks: blockingMs is 0 for every tier but ascend", () => {
  for (const name of TIER_ORDER) {
    const t = TIERS[name]
    if (name === "ascend") {
      assert.ok(t.blockingMs > 0, "ascend is allowed to block")
      assert.ok(t.blockingMs <= 400, `ascend blocks too long: ${String(t.blockingMs)}ms`)
    } else {
      assert.equal(t.blockingMs, 0, `${name} blocks input for ${String(t.blockingMs)}ms`)
    }
  }
})

test("the verdict is always one frame — no tier delays it", () => {
  for (const name of TIER_ORDER) assert.equal(TIERS[name].verdictMs, 0)
})

test("hitstop is only ever spent on success", () => {
  assert.equal(TIERS.nudge.hitstopMs, 0, "a wrong answer must not freeze the retry")
  assert.equal(TIERS.tick.hitstopMs, 0, "a keypress must not freeze anything")
  assert.equal(TIERS.snap.hitstopMs, 0, "the 85% case must not freeze")
  assert.ok(TIERS.pop.hitstopMs > 0)
})

test("no hitstop exceeds 160 ms — past that it reads as a hang, not an impact", () => {
  for (const name of TIER_ORDER) {
    assert.ok(TIERS[name].hitstopMs <= 160, `${name}: ${String(TIERS[name].hitstopMs)}ms`)
  }
})

test("the common path fits its budget: snap's whole tail is under 250 ms", () => {
  // A child answering every 2.8 s (the cadence target) must never see two
  // flourishes overlap in a way that reads as backlog.
  assert.ok(TIERS.snap.tailMs <= 250, `snap tail ${String(TIERS.snap.tailMs)}ms`)
  assert.ok(TIERS.tick.tailMs <= 120)
})

test("energy ladder is strictly increasing — escalation is legible", () => {
  for (let i = 1; i < LADDER.length; i++) {
    const lo = energy(TIERS[LADDER[i - 1]!])
    const hi = energy(TIERS[LADDER[i]!])
    assert.ok(hi > lo, `${LADDER[i - 1]!} (${lo.toFixed(0)}) >= ${LADDER[i]!} (${hi.toFixed(0)})`)
  }
})

test("being wrong is never more interesting than being right", () => {
  const wrong = energy(TIERS.nudge)
  const right = energy(TIERS.snap)
  assert.ok(wrong < right, `nudge ${wrong.toFixed(0)} >= snap ${right.toFixed(0)}`)
})

test("a milestone is a different kind of thing, not a slightly longer thing", () => {
  // 8× is the threshold at which a child reports "something big happened"
  // rather than "that one was worth more".
  assert.ok(energy(TIERS.bloom) > energy(TIERS.snap) * 8)
  assert.ok(energy(TIERS.ascend) > energy(TIERS.bloom) * 1.8)
})

test("escalation cannot see a streak — behaviourally", () => {
  // Hand the chooser the same outcome after a notional 1 and 100 correct
  // answers. There is no field to put that in, which is the point; this test
  // fails the moment someone adds one and wires it up.
  const o = { correct: true, difficulty: 0.2, repaired: false, milestone: null } as const
  const a = chooseTier(o)
  const b = chooseTier({ ...o })
  assert.equal(a, b)
  assert.equal(a, "snap")
})

test("escalation cannot see a streak — lexically", () => {
  const dir = path.dirname(fileURLToPath(import.meta.url))
  const banned = /\b(streak|combo|runLength|consecutive|multiplier)\b/i
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".ts") || f.endsWith(".test.ts")) continue
    const src = readFileSync(path.join(dir, f), "utf8")
    // Strip comments: the prohibition is on the mechanism, and the comments
    // have to be able to name the thing they are prohibiting.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
    const m = banned.exec(code)
    assert.equal(m, null, `${f} references "${m?.[0] ?? ""}" in code`)
  }
})

test("chooseTier covers every branch", () => {
  assert.equal(chooseTier({ correct: false, difficulty: 1, repaired: true, milestone: "major" }), "nudge")
  assert.equal(chooseTier({ correct: true, difficulty: 0, repaired: false, milestone: "major" }), "ascend")
  assert.equal(chooseTier({ correct: true, difficulty: 0, repaired: false, milestone: "minor" }), "bloom")
  assert.equal(chooseTier({ correct: true, difficulty: 0, repaired: true, milestone: null }), "slam")
  assert.equal(chooseTier({ correct: true, difficulty: 0.9, repaired: false, milestone: null }), "pop")
  assert.equal(chooseTier({ correct: true, difficulty: 0.1, repaired: false, milestone: null }), "snap")
})

test("only one tier is once-per-session", () => {
  const once = TIER_ORDER.filter((n) => TIERS[n].oncePerSession)
  assert.deepEqual(once, ["ascend"])
})

test("every ladder column is monotonic", () => {
  const cols = ["tailMs", "trauma", "kick", "flash", "particles", "punchScale"] as const
  for (const col of cols) {
    for (let i = 1; i < LADDER.length; i++) {
      const lo = TIERS[LADDER[i - 1]!][col]
      const hi = TIERS[LADDER[i]!][col]
      assert.ok(hi >= lo, `${col} not monotonic at ${LADDER[i]!}: ${String(lo)} -> ${String(hi)}`)
    }
  }
})
