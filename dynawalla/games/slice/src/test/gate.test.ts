// THE ORDER, THE MISS AND THE GATE, driven through the real game.
//
// `order.test.ts` proves the arithmetic and `director.test.ts` measures the
// density; neither of them mounts anything. This file mounts the real game
// against a fake surface, drives the real frame loop on a virtual clock, and
// cuts things with a real pointer stroke.
//
// Three beats are checked here because none of them is provable from a pure
// function:
//
//   1. a helpful cut advances the plate and a decoy does not;
//   2. an overshoot completes the sum, HOLDS the market while it is up, and
//      never says a word about it;
//   3. the bomb gate freezes the market, asks one question with no timer of any
//      kind, and hands the lamp back for a correct answer.
//
// Every assertion below was mutation-tested against the code it guards.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  B_BOMB,
  B_GOURD,
  B_MOTE,
  begin,
  dbg,
  frontier,
  helpfulUp,
  overshootUp,
  snapshot,
  swipe,
  until,
  type Report,
  type Surface,
} from "./harness.ts"
import { CANDIDATE_READ_LOCK_MS } from "../sim/economy.ts"

const st = (): Record<string, number | string> => dbg().stats()

/** Play until a gourd that advances the order is in reach, then cut it. */
function cutHelpful(s: Surface): boolean {
  for (let i = 0; i < 3000; i++) {
    const t = helpfulUp()
    if (t && t.y > 60 && t.y < Number(st().H) - 60) {
      swipe(s, t.x, t.y)
      s.step(16)
      return true
    }
    s.step(16)
  }
  return false
}

test("A HELPFUL CUT ADVANCES THE PLATE, and the plate is the founder's", () => {
  const { s, handle, restore } = begin({ seed: 0x0101 })
  try {
    dbg().setIntensity(0.5)
    s.step(16)
    const plate0 = String(st().plate)
    assert.ok(plate0.includes("□"), `the plate has no blank in it: "${plate0}"`)
    assert.ok(plate0.endsWith(`= ${st().target}`), `the plate does not state the target: "${plate0}"`)
    const residual0 = Number(st().residual)

    assert.ok(cutHelpful(s), "never managed to find a value that advances the order")
    assert.ok(
      Number(st().residual) < residual0,
      `the residual did not move: ${residual0} → ${st().residual}`,
    )
    assert.notEqual(String(st().plate), plate0, "the plate did not change on a helpful cut")
    assert.ok(String(st().plate).includes("□") || Number(st().residual) === 0)
    assert.ok(Number(st().score) > 0, "advancing the order paid nothing")
  } finally {
    handle.unmount()
    restore()
  }
})

test("A DECOY CHANGES NOTHING THE CHILD CAN SEE — not the plate, not the score", () => {
  // Whether a printed value is a decoy depends on the RESIDUAL, so a bot that
  // only ever cuts decoys sits at one residual forever and meets almost none.
  // This one plays properly — advancing the order between hunts — which is both
  // the honest way to find them and the way a child does.
  const { s, handle, restore } = begin({ seed: 0x0202 })
  try {
    dbg().setIntensity(0.55)
    s.step(16)
    let sawDecoy = 0
    for (let round = 0; round < 120 && sawDecoy < 5; round++) {
      for (let i = 0; i < 90 && sawDecoy < 5; i++) {
        s.step(16)
        const f = frontier()
        const residual = Number(st().residual)
        const decoy = dbg()
          .targets()
          .find(
            (t) =>
              t.kind === B_GOURD &&
              t.value > 0 &&
              t.value <= residual &&
              !f.includes(t.value) &&
              t.y > 80 &&
              t.y < Number(st().H) - 80,
          )
        if (!decoy) continue
        const before = {
          plate: String(st().plate),
          score: Number(st().score),
          residual,
          free: Number(st().freeCuts),
          priced: Number(st().pricedCuts),
          total: Number(st().totalCuts),
          combo: Number(st().combo),
          lamps: Number(st().lamps),
        }
        swipe(s, decoy.x, decoy.y)
        s.step(16)
        // Only a stroke that landed on EXACTLY ONE object, and that object a
        // non-advancing one, is evidence about a decoy. A 240px stroke can take
        // a helpful gourd on its way through, and `freeCuts` / `totalCuts` are
        // the game's own instrumentation for telling those apart.
        if (Number(st().freeCuts) !== before.free + 1) continue
        if (Number(st().totalCuts) !== before.total + 1) continue
        sawDecoy++
        assert.equal(String(st().plate), before.plate, "a decoy moved the plate")
        assert.equal(Number(st().residual), before.residual, "a decoy moved the residual")
        assert.equal(Number(st().score), before.score, "a decoy paid points")
        assert.equal(Number(st().pricedCuts), before.priced, "a decoy was billed as a decision")
        assert.equal(Number(st().combo), before.combo, "a decoy broke the stream")
        assert.equal(Number(st().lamps), before.lamps, "a decoy cost a lamp")
        assert.equal(String(st().reveal), "", "a decoy put a completed sum on the screen")
      }
      cutHelpful(s)
    }
    assert.ok(sawDecoy >= 5, `only ${sawDecoy} decoys were ever cut, so this proved little`)
  } finally {
    handle.unmount()
    restore()
  }
})

test("AN OVERSHOOT COMPLETES THE SUM AND HOLDS THE MARKET WHILE IT IS UP", () => {
  // `games/stack`'s rule, which this batch is held to: never aim at one thing
  // while reading another. Nothing is red, nothing says WRONG, no lamp is lost.
  const haptics: string[] = []
  const reports: Report[] = []
  const { s, handle, restore } = begin({
    seed: 0x0303,
    onReport: (r) => reports.push(r),
    onHaptic: (k) => haptics.push(k),
  })
  try {
    // The calm end, so the reveal is the patient one and the hold is real.
    dbg().setIntensity(0.2)
    s.step(16)
    assert.ok(cutHelpful(s), "could not get the order off the ground")
    const plateBefore = String(st().plate)
    const lampsBefore = Number(st().lamps)

    let cut = false
    for (let i = 0; i < 6000 && !cut; i++) {
      const t = overshootUp()
      if (t && t.y > 60 && t.y < Number(st().H) - 60) {
        haptics.length = 0
        swipe(s, t.x, t.y)
        s.step(16)
        cut = String(st().reveal) !== ""
      }
      if (!cut) s.step(16)
    }
    assert.ok(cut, "never managed to overshoot, so this test proved nothing")

    // The sum finished itself, in place, with the missing addend filled in.
    const reveal = String(st().reveal)
    assert.ok(reveal.includes("□"), `the completed sum has no blank to fill: "${reveal}"`)
    assert.ok(reveal.startsWith(plateBefore.slice(0, 4)), `the reveal is not the plate: "${reveal}"`)
    assert.ok(Number(st().revealLeft) > 1, `the sum was given ${st().revealLeft}s to be read`)

    // …and the market is HELD for the whole time it is up.
    //
    // Measured as "the field only ever gets smaller": objects already in the air
    // finish their arcs and retire, and NOTHING new arrives. At this intensity a
    // wave lands every 1.6 s, so a hold of several seconds that let even one
    // through would show up here immediately.
    const hold = Number(st().hold)
    assert.ok(hold > 1, `the market was held for only ${hold}s while the sum was up`)
    let ceiling = Number(st().cuttable)
    for (let i = 0; i < Math.floor((hold * 1000) / 16) - 4; i++) {
      s.step(16)
      const now = Number(st().cuttable)
      assert.ok(
        now <= ceiling,
        `fruit was thrown at a child reading a completed sum: ${ceiling} → ${now} objects`,
      )
      ceiling = now
    }

    // Nothing was said about it.
    assert.ok(!haptics.includes("failure"), `an overshoot fired ${haptics.join(",")}`)
    assert.equal(Number(st().lamps), lampsBefore, "an overshoot put a lamp out")
    assert.ok(reports.length > 0, "the overshoot was never reported to the ladder")
    assert.equal(reports[reports.length - 1]?.correct, false)

    // A stroke ends the hold: a fast player is never held.
    swipe(s, 200, 700)
    s.step(16)
    assert.equal(Number(st().hold), 0, "a stroke did not end the hold")
    assert.equal(Number(st().revealLeft), 0, "a stroke did not start the sum leaving")
  } finally {
    handle.unmount()
    restore()
  }
})

test("AN OVERSHOOT ROTATES THE ORDER — the anti-mash lock, and it costs nothing", () => {
  const { s, handle, restore } = begin({ seed: 0x0404 })
  try {
    dbg().setIntensity(0.9) // no hold at the top: the order rotates at once
    s.step(16)
    assert.ok(cutHelpful(s), "could not get the order off the ground")
    const before = { target: Number(st().target), score: Number(st().score), lamps: Number(st().lamps) }
    assert.ok(Number(st().residual) < before.target, "the order never advanced")

    let rotated = false
    for (let i = 0; i < 8000 && !rotated; i++) {
      const t = overshootUp()
      if (t && t.y > 60 && t.y < Number(st().H) - 60) {
        swipe(s, t.x, t.y)
        s.step(16)
        rotated = Number(st().residual) === Number(st().target)
      }
      if (!rotated) s.step(16)
    }
    assert.ok(rotated, "an overshoot did not rotate the order")
    // Nothing was taken away. The loss is the unfinished remainder and nothing else.
    assert.ok(Number(st().score) >= before.score, "an overshoot deducted points")
    assert.equal(Number(st().lamps), before.lamps, "an overshoot cost a lamp")
    assert.equal(String(st().plate), `□ = ${st().target}`, "the fresh order is not fresh")
  } finally {
    handle.unmount()
    restore()
  }
})

// ── the bomb gate ───────────────────────────────────────────────────────────

/** Play until a bomb is in reach and cut it. Returns whether the gate opened. */
function cutABomb(s: Surface): boolean {
  for (let i = 0; i < 20000; i++) {
    const b = dbg()
      .targets()
      .find((t) => t.kind === B_BOMB && t.y > 80 && t.y < Number(st().H) - 80)
    if (b) {
      swipe(s, b.x, b.y)
      s.step(16)
      if (String(st().gate) !== "") return true
    }
    s.step(16)
  }
  return false
}

test("THE BOMB GATE: the market freezes, one question, and NO TIMER OF ANY KIND", () => {
  const reports: Report[] = []
  const { s, handle, restore } = begin({ seed: 0x0505, onReport: (r) => reports.push(r) })
  try {
    dbg().setIntensity(0.85)
    s.step(16)
    assert.ok(cutABomb(s), "never met a bomb, so this test proved nothing")
    assert.equal(Number(st().lamps), 2, "cutting a bomb did not put a lamp out")

    // A real freeze. Everything airborne holds, exactly where it was.
    const world = snapshot(s)
    const frozen = dbg()
      .targets()
      .filter((t) => t.kind !== B_MOTE)
      .map((t) => `${t.text}@${t.x.toFixed(3)},${t.y.toFixed(3)}`)
      .sort()
    for (let i = 0; i < 600; i++) s.step(16)
    const still = dbg()
      .targets()
      .filter((t) => t.kind !== B_MOTE)
      .map((t) => `${t.text}@${t.x.toFixed(3)},${t.y.toFixed(3)}`)
      .sort()
    assert.deepEqual(still, frozen, "the market kept moving behind the gate")
    void world

    // TEN SECONDS with nobody touching the screen, and the question is still
    // there. This is the assertion that would catch a "generous" timer.
    assert.notEqual(String(st().gate), "", "the gate expired on a child who was thinking")
    for (let i = 0; i < 60 * 60; i++) s.step(16)
    assert.notEqual(String(st().gate), "", "a full minute of thinking expired the gate")
    assert.equal(Number(st().lamps), 2, "waiting cost a second lamp")
    assert.equal(reports.length, 0, "a question nobody answered was reported to the ladder")

    // Four lanterns, and none of them cuttable for the read-lock.
    const motes = dbg().targets().filter((t) => t.kind === B_MOTE)
    assert.equal(motes.length, 4, `the gate hung ${motes.length} lanterns`)
    assert.equal(motes.filter((m) => m.correct).length, 1, "the gate has more than one right answer")
  } finally {
    handle.unmount()
    restore()
  }
})

test("THE GATE HANDS THE LAMP BACK: maths instead of an advertisement", () => {
  const reports: Report[] = []
  const { s, handle, restore } = begin({ seed: 0x0606, onReport: (r) => reports.push(r) })
  try {
    dbg().setIntensity(0.85)
    s.step(16)
    assert.ok(cutABomb(s), "never met a bomb")
    assert.equal(Number(st().lamps), 2)
    for (let i = 0; i < Math.ceil(CANDIDATE_READ_LOCK_MS / 16) + 4; i++) s.step(16)

    const right = dbg()
      .targets()
      .find((t) => t.kind === B_MOTE && t.correct)
    assert.ok(right, "the lanterns never arrived")
    const n = reports.length
    swipe(s, right.x, right.y)
    s.step(16)
    assert.equal(reports.length, n + 1, "the gate answer was never reported")
    assert.equal(reports[reports.length - 1]?.correct, true)
    assert.equal(Number(st().lamps), 3, "a correct answer did not relight the lamp")
    assert.equal(String(st().gate), "", "the gate stayed up after it was answered")
    // Lamp-NEUTRAL at best: it returns the one you spent and never grants a new
    // one, so seeking bombs can never be profitable.
    assert.ok(Number(st().lamps) <= 3, "the gate granted a lamp the child never had")
  } finally {
    handle.unmount()
    restore()
  }
})

test("a wrong gate answer keeps the lamp out, completes the sum, and never scolds", () => {
  const haptics: string[] = []
  const { s, handle, restore } = begin({ seed: 0x0707, onHaptic: (k) => haptics.push(k) })
  try {
    dbg().setIntensity(0.85)
    s.step(16)
    assert.ok(cutABomb(s), "never met a bomb")
    for (let i = 0; i < Math.ceil(CANDIDATE_READ_LOCK_MS / 16) + 4; i++) s.step(16)

    const wrong = dbg()
      .targets()
      .find((t) => t.kind === B_MOTE && !t.correct)
    assert.ok(wrong, "the lanterns never arrived")
    haptics.length = 0
    swipe(s, wrong.x, wrong.y)
    s.step(16)
    assert.equal(Number(st().lamps), 2, "a wrong gate answer relit the lamp anyway")
    assert.notEqual(String(st().reveal), "", "the gate's sum was not completed")
    assert.ok(Number(st().revealLeft) > 0.8, `the sum was given ${st().revealLeft}s`)
    assert.ok(!haptics.includes("failure"), `a wrong gate answer fired ${haptics.join(",")}`)
    assert.equal(String(st().gate), "", "the gate stayed up")
  } finally {
    handle.unmount()
    restore()
  }
})

test("the gate's lanterns cannot be cut by the stroke that opened them", () => {
  // Without the read-lock the swipe that hit the bomb travels on through the
  // same `resolveCuts` pass and answers the question it just opened, in 0 ms.
  const reports: Report[] = []
  const { s, handle, restore } = begin({ seed: 0x0808, onReport: (r) => reports.push(r) })
  try {
    dbg().setIntensity(0.85)
    s.step(16)
    assert.ok(cutABomb(s), "never met a bomb")
    const n = reports.length
    const mote = dbg()
      .targets()
      .find((t) => t.kind === B_MOTE)
    assert.ok(mote, "the lanterns never arrived")
    swipe(s, mote.x, mote.y)
    s.step(16)
    assert.equal(reports.length, n, "the first stroke back answered a question nobody had read")

    assert.ok(
      until(s, 60, () => {
        const m = dbg()
          .targets()
          .find((t) => t.kind === B_MOTE)
        if (!m) return false
        swipe(s, m.x, m.y)
        s.step(16)
        return reports.length === n + 1
      }),
      "the read-lock never lapsed — the lanterns are permanently uncuttable",
    )
  } finally {
    handle.unmount()
    restore()
  }
})

test("A FRUIT THAT FALLS UNCUT IS NEVER REPORTED, and never costs anything", () => {
  // Fruit Ninja Zen's contract, and the thing that makes the arithmetic layer
  // genuinely unrushed: missing is free, so nothing is ever chasing the child.
  //
  // Checked across several orders with real cuts in between, because "no reports
  // at all" would also pass on a build that reports nothing ever.
  const reports: Report[] = []
  const { s, handle, restore } = begin({ seed: 0x0909, onReport: (r) => reports.push(r) })
  try {
    dbg().setIntensity(0.35)
    s.step(16)
    let atLastCut = 0
    let quietSpells = 0
    for (let round = 0; round < 8; round++) {
      // Let any favour wave from the previous round finish sweeping: its cuts
      // belong to the cut that earned it, not to the quiet spell that follows.
      for (let i = 0; i < 90; i++) s.step(16)
      atLastCut = reports.length
      const target = Number(st().target)
      const lamps = Number(st().lamps)
      const score = Number(st().score)
      // Twenty seconds of fruit arriving, arcing and falling, untouched.
      for (let i = 0; i < 60 * 20; i++) {
        s.step(16)
        assert.equal(
          reports.length,
          atLastCut,
          "a fruit that fell uncut was reported to the ladder as a wrong answer",
        )
      }
      quietSpells++
      assert.equal(Number(st().lamps), lamps, "a lamp went out on an untouched screen")
      assert.equal(Number(st().score), score, "an untouched screen scored")
      assert.equal(Number(st().target), target, "the order rotated on its own — something expired")
      assert.equal(Number(st().overshoots), 0, "an untouched screen overshot")
      cutHelpful(s)
      atLastCut = reports.length
    }
    assert.ok(quietSpells === 8, "the quiet spells did not happen")
    // The anti-vacuity half: the host's answers really are reaching the plate, so
    // "nothing was reported" is a claim about falling fruit and not about a game
    // that never reports anything.
    assert.ok(
      Number(st().hostOrders) > 0,
      `every order fell back to the pack's own generator (${st().ownOrders} of them) — ` +
        `nothing this game does would ever reach the curriculum`,
    )
    assert.ok(reports.length > 0, "eight rounds of real cuts reported nothing at all")
  } finally {
    handle.unmount()
    restore()
  }
})

test("the order is never one the child cannot fill, even after minutes of play", () => {
  const { s, handle, restore } = begin({ seed: 0x0a0a })
  try {
    dbg().setIntensity(0.6)
    s.step(16)
    for (let round = 0; round < 40; round++) {
      // Every frame of every round: if the order is unfilled, something can fill it.
      for (let i = 0; i < 30; i++) {
        s.step(16)
        if (Number(st().residual) > 0) {
          assert.ok(
            frontier().length > 0,
            `DEAD END on screen: ${st().plate} with nothing that can fill it`,
          )
        }
      }
      cutHelpful(s)
    }
    assert.ok(Number(st().ordersFilled) > 0, "forty rounds filled no orders at all")
  } finally {
    handle.unmount()
    restore()
  }
})
