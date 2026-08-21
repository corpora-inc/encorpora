import { test } from "node:test"
import assert from "node:assert/strict"
import { absorbGain, devourGain, radiusForValue, viewSpanFor, arenaRadiusFor, World, APPARENT_FLOOR, baseSpeedFor, speedScaleFor, traversalSpeedFor, DIFFICULTY_RUNGS, FLOOR_MASS, MK_FOOD, MK_VOID, MK_SHED } from "./world.ts"
import { MAX_GUARD_SECONDS, comprehensionSeconds, guardSeconds } from "./window.ts"
import { Rng } from "../core/rng.ts"
import { DEPTHS, depthFor, overdrive } from "./depths.ts"
import { specFor } from "../core/tier.ts"
import { createStubHost } from "../host/stubHost.ts"
import type { Host, Question } from "../contract.ts"

/**
 * Absorption is the identity. Eat a `4`, gain 4 — at every mass, forever.
 *
 * This test used to assert the opposite ("absorption saturates, and saturates
 * harder as you grow"), and the reversal is the founder's:
 *
 *   "it would seem more intuitive to me to absorb the exact number? ... is that
 *    not how most games like this work?"
 *
 * The old curve made a `4` at mass 10 worth `+1`, so the running equation
 * printed `10 + 1 = 11` under a numeral a child had just read as 4. In a maths
 * product that is not a balance choice, it is a false sentence on screen.
 *
 * There is no free parameter left in here to get wrong, which is the point:
 * anything that ever wants to scale a swallow has to be argued about somewhere
 * else, because this function has nowhere to put it.
 */
test("absorption is exact, at every mass, with nothing left to tune", () => {
  for (const v of [1, 2, 3, 4, 7, 40, 999, 3418, 1_000_000, 2_147_483_646]) {
    assert.equal(absorbGain(v), v, `a mote wearing ${v} was not worth ${v}`)
  }
  // Nothing at or below nothing is worth anything, and nothing is ever handed
  // back for a negative — a void is a LOSS and it is applied in `collide`.
  assert.equal(absorbGain(0), 0)
  assert.equal(absorbGain(-9), 0)
  // Still an integer, because it lands between the ribbon's integer terms.
  for (const v of [1, 5, 12345]) assert.ok(Number.isInteger(absorbGain(v)))
})

/**
 * And so is the kill. See `devourGain` in world.ts for why this one could
 * honestly have gone either way and did not: a rival carries a drawn numeral
 * (`gfx.ts` labels every core big enough to hold one), so `400 + 84 = 484`
 * under a core reading 300 is the same false sentence by another route.
 *
 * What keeps it safe is that a rival is a RATIONED supply where a mote is not:
 * MAX_RIVALS of them, a respawn timer, and the `mass > m * 1.06` rule, which
 * together mean a kill can never more than 1.94x you.
 */
test("devouring a rival is exact, and a kill can never more than double you", () => {
  for (const m of [1, 4, 500, 90_000, 3_000_000]) {
    assert.equal(devourGain(m), m, `a rival of ${m} was not worth ${m}`)
  }
  assert.equal(devourGain(0), 0)
  assert.equal(devourGain(-3), 0)
  // The bound is the collision rule's, not the curve's: you may only swallow a
  // rival strictly below `mass / 1.06`, so the most a kill can pay is 1/1.06.
  for (const mass of [10, 500, 90_000]) {
    const biggestLegal = Math.ceil(mass / 1.06) - 1
    assert.ok(
      mass + devourGain(biggestLegal) < mass * 1.95,
      `a legal kill at mass ${mass} paid ${devourGain(biggestLegal)} — more than a doubling`,
    )
  }
})

test("one radius law for everything, and the membrane always sits outside the frame", () => {
  for (const v of [1, 4, 25, 900, 40000]) {
    assert.ok(radiusForValue(v) > 0)
  }
  assert.ok(radiusForValue(900) > radiusForValue(100))
  for (const m of [10, 120, 2200, 20000, 5_000_000]) {
    assert.ok(
      arenaRadiusFor(m) > viewSpanFor(m) * 1.5,
      `the arena fell inside the view at mass ${m} — the player can see the void`,
    )
  }
})

test("depth bands are ordered, cover every mass, and escalate past the last one", () => {
  for (let i = 1; i < DEPTHS.length; i++) {
    assert.ok((DEPTHS[i] as { at: number }).at > (DEPTHS[i - 1] as { at: number }).at)
    assert.ok((DEPTHS[i] as { temper: number }).temper >= (DEPTHS[i - 1] as { temper: number }).temper)
  }
  assert.equal(depthFor(0).depth.index, 0)
  assert.equal(depthFor(1e9).depth.index, DEPTHS.length - 1)
  for (const m of [1, 50, 500, 5000, 50000]) {
    const { t } = depthFor(m)
    assert.ok(t >= 0 && t <= 1)
  }
  // The clock caps how far ahead of itself a snowballing player can run, so
  // the bands cannot all be spent in the first three minutes.
  assert.equal(depthFor(1e9, 0).depth.index, 2)
  assert.equal(depthFor(1e9, 60 * 3).depth.index, 3)
  assert.ok(depthFor(1e9, 60 * 13).depth.index === DEPTHS.length - 1)
  // The clock is also a FLOOR, and this assertion is the reversal of the one
  // that used to live here. Judged: a five-minute soak saw exactly two depths,
  // because the band tracked mass and a player who was not winning simply never
  // moved. The world now sinks whether you are winning or not.
  assert.ok(depthFor(10, 60 * 5).depth.index >= 3, "the world must escalate on the clock too")
  assert.equal(depthFor(10, 60 * 60).depth.index, DEPTHS.length - 1)
  // The ratchet: a band, once entered, can never be left.
  for (let i = 0; i < DEPTHS.length; i++) {
    assert.equal(depthFor(0, 0, i).depth.index, i, "floorBand must pin the band")
    assert.ok(depthFor(0, 1, i).depth.index >= i)
  }
  assert.equal(overdrive(10), 0)
  assert.ok(overdrive(500000) > overdrive(50000))
  assert.ok(overdrive(1e12) <= 1.6, "overdrive must stay bounded or the tuning it scales runs away")
})

test("a run climbs: the band never falls and a banked rung cannot be taken back", () => {
  const world = new World(createStubHost({ seed: 31 }), specFor("high"), 9)
  let lowestSinceBand = Infinity
  let band = 0
  // Six minutes of a deliberately BAD player: never aims, never surges, walks
  // into everything. This is the profile that used to oscillate 154 → 65 → 332
  // → 122 → 152 and finish where it started.
  // Six minutes of PLAY time, not of wall time. The depth clock rides `playTime`
  // now — an inert Resonance is not a second of the run — and a bot that never
  // answers spends a real share of the wall clock inside beats, so counting frames
  // would be counting the wrong thing and the assertion at the bottom would be
  // measuring the guard rather than the ratchet.
  for (let f = 0; f < 60 * 60 * 30 && world.playTime < 60 * 6; f++) {
    world.aimX = Math.sin(f * 0.011) * 1400
    world.aimY = Math.cos(f * 0.008) * 1400
    world.step(1 / 60)
    assert.ok(world.depth.index >= band, `band fell from ${band} to ${world.depth.index}`)
    if (world.depth.index > band) {
      band = world.depth.index
      lowestSinceBand = Infinity
    }
    lowestSinceBand = Math.min(lowestSinceBand, world.mass)
    assert.ok(
      world.mass >= world.checkpoint - 1e-6,
      `mass ${world.mass} fell through the banked checkpoint ${world.checkpoint}`,
    )
  }
  assert.ok(band >= 3, `six minutes of play must show more than a couple of depths, saw ${band + 1} in ${world.playTime.toFixed(0)}s`)
  assert.ok(lowestSinceBand >= FLOOR_MASS)
})

/**
 * The regression that matters most, and the reason it asserts on *shape*
 * rather than on a number.
 *
 * Three separate bugs each turned a twenty-minute climb into an exponential
 * explosion — an uncapped near-tie mote, an uncapped rival kill, and a
 * progress floor that let a rupture *pay* the player. Every one of them was
 * invisible in a thirty-second look at the screen and obvious after one
 * simulated run.
 *
 * What must hold is not "mass stays below N". Growth in this genre is
 * deliberately proportional and deliberately endless. What must hold is that
 * the *relative* experience survives: the first minute is a climb and not a
 * detonation, and at the end of twenty minutes the ladder is still live —
 * there are still things in the water that can eat you. An economy that has
 * run away trivialises the arena, and that is the failure worth failing on.
 */
test("a twenty-minute run escalates without trivialising the arena", () => {
  const answers: { correct: boolean }[] = []
  const host = createStubHost({ seed: 0xa11ce, onReport: (r) => answers.push({ correct: r.correct }) })
  const world = new World(host, specFor("mid"), 0xbeef)
  let seen = -1
  let sphere = -1
  let peak = 0
  let massAtOneMinute = 0

  for (let f = 0; f < 60 * 60 * 20; f++) {
    const res = world.resonance
    if (res.active && res.phase === 2) {
      if (seen !== res.openedAt) {
        seen = res.openedAt
        sphere = res.spheres[res.correctSlot] as number
      }
      if (sphere >= 0 && world.malive[sphere]) {
        world.aimX = world.mx[sphere] as number
        world.aimY = world.my[sphere] as number
      }
    } else {
      seen = -1
      let best = -1
      let bestScore = -1
      for (let i = 0; i < world.mx.length; i++) {
        if (!world.malive[i] || world.mkind[i] === 3) continue
        const v = world.mval[i] as number
        if (v < 0 || v >= world.mass * 0.92) continue
        const d = Math.hypot((world.mx[i] as number) - world.px, (world.my[i] as number) - world.py)
        const s = (v + 6) / (d + 90)
        if (s > bestScore) {
          bestScore = s
          best = i
        }
      }
      if (best >= 0) {
        world.aimX = world.mx[best] as number
        world.aimY = world.my[best] as number
      } else {
        world.aimX = world.px + Math.cos(world.time) * 600
        world.aimY = world.py + Math.sin(world.time * 0.8) * 600
      }
    }
    world.step(1 / 60)
    peak = Math.max(peak, world.mass)
    if (f === 60 * 60) massAtOneMinute = world.mass

    assert.ok(Number.isFinite(world.mass), `mass went non-finite at frame ${f}`)
    assert.ok(world.mass >= FLOOR_MASS, `mass fell through the floor at frame ${f}`)
  }

  // The opening minute is a climb, not a detonation. Every economy bug this
  // test has caught blew past 30,000 inside sixty seconds.
  assert.ok(massAtOneMinute > 60, `no escalation in the first minute: ${Math.round(massAtOneMinute)}`)
  assert.ok(massAtOneMinute < 30_000, `first minute detonated: ${Math.round(massAtOneMinute)}`)
  assert.ok(peak > 400, `run never escalated; peak mass was only ${Math.round(peak)}`)
  // The legibility contract, at the other end. This bot answers every question
  // correctly AND eats everything it can reach, which is the strongest line of
  // play in the game, and after twenty minutes of it the player's own core must
  // still be a number a seven-year-old can read. It is also the only assertion
  // that holds the prize taper honest: with `prizeRate` flattened to its
  // ceiling the same run reaches 5,745,335.
  assert.ok(peak < 1e6, `twenty minutes of perfect play reached ${Math.round(peak)} — that is not a readable number`)

  // The ladder is still live after twenty minutes: something out there can
  // still eat you, and the board is still populated.
  let bigger = 0
  let alive = 0
  for (let k = 0; k < world.rmass.length; k++) {
    if (!world.ralive[k]) continue
    alive++
    if ((world.rmass[k] as number) > world.mass) bigger++
  }
  assert.ok(alive >= 8, `the arena emptied out: only ${alive} rivals left`)
  assert.ok(bigger >= 1, "nothing in the water can eat the player any more — the economy ran away")

  // The curriculum beat kept firing, and the host heard about every answer.
  assert.ok(answers.length >= 15, `only ${answers.length} questions were answered in twenty minutes`)
  assert.ok(world.time > 1190 && world.time < 1210)
})

/**
 * The mathematics has to survive the round trip out to the renderer and back.
 *
 * A sphere's drawn label goes through `mval`, an Int32Array, because that is
 * what the numeral layer consumes. What must NOT go through it is the answer
 * reported to the Host, which is the child's work and drives a mastery model:
 * it is the Host's own option string, byte for byte. And the verdict is slot
 * identity, never a comparison of two numbers, so there is no arithmetic
 * anywhere on the path that decides whether a child was right.
 */
test("the answer reported to the host is the host's own string, and slot identity decides", () => {
  const reports: { questionId: string; correct: boolean; ms: number; answered: string }[] = []
  const asked = new Map<string, Question>()
  const stub = createStubHost({ seed: 5, onReport: (r) => reports.push(r) })
  const host: Host = {
    next: (o) => {
      const q = stub.next(o)
      asked.set(q.id, q)
      return q
    },
    report: (r) => stub.report(r),
    haptic: (k) => stub.haptic(k),
    prefersReducedMotion: () => false,
  }

  const world = new World(host, specFor("low"), 77)
  for (let f = 0; f < 60 * 60 * 6; f++) {
    const res = world.resonance
    if (res.active && res.phase === 2) {
      // Alternate right and wrong on purpose, so both branches of the report
      // are exercised and a verdict that is always `true` cannot pass.
      const want = reports.length % 2 === 0 ? res.correctSlot : (res.correctSlot + 1) % 4
      const i = res.spheres[want] as number
      if (i >= 0 && world.malive[i]) {
        world.aimX = world.mx[i] as number
        world.aimY = world.my[i] as number
      }
    } else {
      world.aimX = world.px + Math.cos(world.time * 0.7) * 500
      world.aimY = world.py + Math.sin(world.time * 0.5) * 500
    }
    world.step(1 / 60)
  }

  assert.ok(reports.length >= 6, `only ${reports.length} answers were reported in six minutes`)
  assert.ok(
    reports.some((r) => r.correct) && reports.some((r) => !r.correct),
    "the run never produced both a right and a wrong answer, so the verdict is untested",
  )
  for (const r of reports) {
    const q = asked.get(r.questionId)
    assert.ok(q, `a report arrived for a question the host never issued: ${r.questionId}`)
    const options = [q.answer, ...q.distractors]
    assert.ok(
      options.includes(r.answered),
      `answered "${r.answered}" is not one of the host's options ${JSON.stringify(options)}`,
    )
    // The verdict is decided by slot, the string is carried verbatim; if those
    // two ever disagree the game is marking correct work wrong.
    assert.equal(r.correct, r.answered === q.answer, `verdict and reported answer disagree on ${r.questionId}`)
    assert.ok(r.ms >= 0 && Number.isFinite(r.ms), `latency was not a sane number: ${r.ms}`)
  }

  // The specific round trip that would be silent: the sphere's LABEL goes
  // through `mval`, an Int32Array, and the answer reported to the host must not
  // take that trip. A padded string is the cheapest item that can tell the
  // difference — `Number("0500")` is 500, so a game reporting `String(mval)`
  // says "500" while the host said "0500", and every other value in the product
  // survives the round trip and hides the bug.
  const padReports: { correct: boolean; answered: string }[] = []
  const padHost: Host = {
    next: () => ({
      id: "pad-1",
      prompt: "500 + 0",
      answer: "0500",
      distractors: ["0501", "0499", "0510"],
      domain: "add",
      difficulty: 5,
    }),
    report: (r) => padReports.push({ correct: r.correct, answered: r.answered }),
    haptic: () => {},
    prefersReducedMotion: () => false,
  }
  const pw = new World(padHost, specFor("low"), 21)
  for (let f = 0; f < 60 * 60 * 2 && padReports.length === 0; f++) {
    const res = pw.resonance
    if (res.active && res.phase === 2) {
      const i = res.spheres[res.correctSlot] as number
      if (i >= 0 && pw.malive[i]) {
        pw.aimX = pw.mx[i] as number
        pw.aimY = pw.my[i] as number
      }
    }
    pw.step(1 / 60)
  }
  assert.equal(padReports.length, 1, "the padded-answer resonance never resolved")
  assert.equal((padReports[0] as { correct: boolean }).correct, true)
  assert.equal(
    (padReports[0] as { answered: string }).answered,
    "0500",
    "the answer came back as a different string — it went through the Int32Array",
  )
})

/**
 * The other half of the same seam, and a live defect until this pass.
 *
 * `mval` is an `Int32Array` and `openResonance` clamps anything past 2^31 to
 * **zero** on the way in. So a sphere carrying the answer to `37388 × 85585`
 * (= 3,199,851,980) was drawn reading `0`: the child was asked to find an answer
 * that was not on the screen, four spheres all lied, and whichever one they flew
 * into cost them mass.
 *
 * Measured through the real host over the whole 66-rung ladder, 40 items a rung:
 * the top rung is `dw.mul.multidigit.long-multiplication` L2 and **24 of 40 of
 * its answers exceed 2^31**. ARENA's old integer difficulty request landed on
 * exactly that rung whenever the breath reached its ceiling, so this was
 * reachable by playing well.
 *
 * The fix is the rule ARENA already had for an item it cannot pose with four
 * distinct options, applied to the other way a beat can lie: it declines.
 */
test("a question ARENA cannot draw is never asked, and never costs a child anything", () => {
  const reports: unknown[] = []
  const warnings: string[] = []
  const realWarn = console.warn
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "))
  }
  try {
    const bigHost: Host = {
      next: () => ({
        id: "big-1",
        prompt: "37388 × 85585",
        answer: "3199851980",
        distractors: ["3199851981", "3199851979", "3199851990"],
        domain: "multiply",
        difficulty: 5,
      }),
      report: (r) => reports.push(r),
      haptic: () => {},
      prefersReducedMotion: () => false,
    }
    const bw = new World(bigHost, specFor("low"), 21)
    let everOpened = 0
    let drawnZero = 0
    for (let f = 0; f < 60 * 60 * 4; f++) {
      const res = bw.resonance
      if (res.active) {
        everOpened++
        for (let s = 0; s < 4; s++) {
          const i = res.spheres[s] as number
          if (i >= 0 && bw.malive[i] && bw.mval[i] === 0) drawnZero++
        }
        const i = res.spheres[res.correctSlot] as number
        if (i >= 0 && bw.malive[i]) {
          bw.aimX = bw.mx[i] as number
          bw.aimY = bw.my[i] as number
        }
      }
      bw.step(1 / 60)
    }
    assert.equal(everOpened, 0, "a question whose answer cannot be drawn was posed to a child anyway")
    assert.equal(drawnZero, 0, "a sphere was drawn reading 0 instead of its answer")
    assert.equal(reports.length, 0, "declining to ask a question still reported something to the host")
    assert.ok(
      warnings.some((w) => w.includes("cannot draw") && w.includes("3199851980")),
      `declining was silent — warnings were ${JSON.stringify(warnings)}`,
    )
  } finally {
    console.warn = realWarn
  }
})

/**
 * Declining is half a capability. This is the other half.
 *
 * The test above proves ARENA never poses a numeral it cannot print. On its own
 * that is a pack that stops asking questions while looking exactly like a pack
 * that is working: the host has no reason to stop offering the rung, so the beat
 * is refused, retried twenty seconds later, and refused again, for the rest of
 * the session. That is the defect `next({ maxDifficulty })` exists for, and it is
 * the one this pack was carrying — POLARITY and TREBUCHET each shipped a release
 * of it before the window grew the half they needed.
 *
 * Two claims, and the second is the one that makes it a capability rather than a
 * mood: the ceiling is DERIVED from the refused item's own ordinate, and it only
 * ever goes down.
 */
test("meeting a numeral it cannot print makes ARENA state a ceiling, once and downward", () => {
  const realWarn = console.warn
  console.warn = () => {}
  try {
    const asks: ({ difficulty?: number; maxDifficulty?: number } | undefined)[] = []
    // The LOW rung first, then the high one for the rest of the run. This
    // ordering is the whole reason the fixture is shaped like this: a ceiling
    // that simply tracked the latest refusal would be set to 0.70, then RAISED to
    // 0.93 on the next question, and would re-admit the very rung it was set for.
    // Written the other way round — high first, then low — every mutation of the
    // monotone guard still passes, because the numbers happen to descend on their
    // own. (It was written that way round first, and M4 below caught nothing.)
    //
    // This stub deliberately ignores `maxDifficulty`: what is under test is what
    // ARENA says, not whether a host obeys it.
    const ordinates = [0.71, 0.94]
    let served = 0
    const bigHost: Host = {
      next: (opts) => {
        asks.push(opts)
        const at = ordinates[Math.min(served, ordinates.length - 1)] as number
        served++
        return {
          id: `big-${String(served)}`,
          prompt: "37388 × 85585",
          answer: "3199851980",
          distractors: ["3199851981", "3199851979", "3199851990"],
          domain: "multiply",
          difficulty: at,
        }
      },
      report: () => {},
      haptic: () => {},
      prefersReducedMotion: () => false,
    }
    const bw = new World(bigHost, specFor("low"), 21)
    for (let f = 0; f < 60 * 60 * 4; f++) bw.step(1 / 60)

    assert.ok(asks.length >= 3, `the host was asked ${String(asks.length)} times — too few to see a ceiling`)
    // Nothing is claimed before there is evidence for it. A pack that asserted a
    // ceiling on its opening request would be guessing at a ladder it cannot see.
    assert.equal(
      asks[0]?.maxDifficulty,
      undefined,
      "ARENA stated a ceiling before it had ever been handed something it could not draw",
    )
    // …and every request after the first refusal carries one, under the rung
    // that was refused rather than at it: `items.ts` caps with
    // `floor(maxDifficulty * span)`, so a ceiling set AT the refused ordinate
    // re-admits the rung it was set for.
    const after = asks.slice(1)
    for (const ask of after) {
      assert.equal(typeof ask?.maxDifficulty, "number", `a request after a refusal carried no ceiling: ${JSON.stringify(ask)}`)
    }
    const first = after[0]?.maxDifficulty as number
    assert.ok(
      first < 0.71,
      `the ceiling was ${String(first)}, which does not exclude the 0.71 rung that was refused — ` +
        `\`items.ts\` caps with floor(maxDifficulty × span), so a ceiling set AT the refused ` +
        `ordinate re-admits the rung it was set for`,
    )
    // Derived from the refusal, not typed: it tracks the ordinate that arrived.
    // A margin of zero, or a hard-coded ceiling, or one read off the wrong
    // question all miss this by more than a float's worth.
    assert.ok(
      Math.abs(first - 0.7) < 1e-9,
      `the ceiling was ${String(first)} — not one margin under the 0.71 rung the host actually offered`,
    )
    // Monotone. Every question after the first is offered at 0.94, which is ABOVE
    // the ceiling already set: a ceiling that tracked the latest refusal would
    // climb to 0.93 here and hand a child back the rung it had just excluded.
    for (const ask of after) {
      const c = ask?.maxDifficulty as number
      assert.ok(
        Math.abs(c - 0.7) < 1e-9,
        `the ceiling moved from 0.7 to ${String(c)} — a refusal at a HARDER rung raised it`,
      )
    }
    assert.equal(bw.drawableCeiling, first, "the world reports a different ceiling from the one it sends")
  } finally {
    console.warn = realWarn
  }
})

/**
 * The other exploit, and the one that decided the shape of `devourGain`.
 *
 * The twenty-minute test above flies a bot that eats motes. This one flies the
 * bot a determined child actually becomes: it ignores food entirely and hunts
 * nothing but the largest rival it is still legally allowed to swallow, which
 * is the single highest-yield action in the game. If kills are an exponential
 * route, this is the run that finds it.
 *
 * It asserts a *legibility* bound rather than a balance one. The premise of the
 * whole game is telling 3,418 from 3,481 at speed, and that premise does not
 * survive the player's own core reading 1,301,388,804 — which is what an
 * earlier uncapped curve actually printed. Five or six digits after twenty
 * minutes of the strongest possible play is the contract.
 */
test("hunting nothing but rivals for twenty minutes is not an exponential", () => {
  const world = new World(createStubHost({ seed: 7 }), specFor("mid"), 4242)
  let peak = 0

  for (let f = 0; f < 60 * 60 * 20; f++) {
    // Answer every Resonance correctly, then go back to hunting.
    //
    // This is new, and it is what makes the test a worst case again rather than
    // merely a hostile one. The world's density, rival count and pace are now
    // driven by a controller fed on the child's ANSWERS, so a bot that ignores
    // every question is a bot playing in the emptiest, calmest ocean the game
    // has — four rivals and a sparse field — and it simply cannot find enough
    // prey to run away with anything. Measured: peak 92 over twenty minutes,
    // which proves nothing about the kill economy at all.
    //
    // A determined child does not ignore the questions; answering them is how
    // the water fills up with things to eat. So the bot answers perfectly AND
    // hunts nothing but the largest rival it is legally allowed to swallow,
    // which is the genuinely highest-yield line of play available. If kills are
    // an exponential route, this is the run that finds it.
    const res = world.resonance
    if (res.active && res.phase === 2) {
      const i = res.spheres[res.correctSlot] as number
      if (i >= 0 && world.malive[i]) {
        world.aimX = world.mx[i] as number
        world.aimY = world.my[i] as number
        world.step(1 / 60)
        peak = Math.max(peak, world.mass)
        continue
      }
    }
    let best = -1
    let bestScore = -1
    for (let k = 0; k < world.rmass.length; k++) {
      if (!world.ralive[k]) continue
      const m = world.rmass[k] as number
      // Only what the collision rule will actually let the player eat.
      if (m >= world.mass / 1.07) continue
      const d = Math.hypot((world.rx[k] as number) - world.px, (world.ry[k] as number) - world.py)
      const s = m / (d + 200)
      if (s > bestScore) {
        bestScore = s
        best = k
      }
    }
    if (best >= 0) {
      world.aimX = world.rx[best] as number
      world.aimY = world.ry[best] as number
    } else {
      // Nothing edible on the board: fall back to food so the bot keeps growing
      // into range rather than stalling and proving nothing.
      let bm = -1
      let bs = -1
      for (let i = 0; i < world.mx.length; i++) {
        if (!world.malive[i] || world.mkind[i] === 3) continue
        const v = world.mval[i] as number
        if (v < 0 || v >= world.mass * 0.95) continue
        const d = Math.hypot((world.mx[i] as number) - world.px, (world.my[i] as number) - world.py)
        const s = (v + 6) / (d + 90)
        if (s > bs) {
          bs = s
          bm = i
        }
      }
      if (bm >= 0) {
        world.aimX = world.mx[bm] as number
        world.aimY = world.my[bm] as number
      }
    }
    world.step(1 / 60)
    peak = Math.max(peak, world.mass)
    assert.ok(Number.isFinite(world.mass), `mass went non-finite at frame ${f}`)
  }

  assert.ok(peak > 2000, `the kill bot never got going; peak was only ${Math.round(peak)}`)
  assert.ok(peak < 1e6, `kills ran away: peak mass ${Math.round(peak)} is not a readable number`)

  // …and it must not have eaten the world doing it.
  let bigger = 0
  let alive = 0
  for (let k = 0; k < world.rmass.length; k++) {
    if (!world.ralive[k]) continue
    alive++
    if ((world.rmass[k] as number) > world.mass) bigger++
  }
  assert.ok(alive >= 8, `the arena emptied out: only ${alive} rivals left`)
  assert.ok(bigger >= 1, "nothing in the water can eat the player any more — the economy ran away")
})

test("a rupture costs real mass at your peak, and can never pay you", () => {
  const host = createStubHost({ seed: 3 })
  const world = new World(host, specFor("low"), 11)
  const rupture = (world as unknown as { rupture(m: number): void }).rupture.bind(world)

  // The ordinary case: at your high water mark a rupture hurts, a lot, and it
  // stops at the checkpoint rather than deleting the run.
  world.mass = 5000
  world.bestMass = 5000
  rupture(9999)
  assert.ok(world.mass < 5000 * 0.95, `a rupture at your peak must hurt: 5000 -> ${world.mass}`)
  assert.ok(world.mass >= world.checkpoint - 1e-6, "a rupture must never break the checkpoint")

  // The pathological case that once printed six orders of magnitude of free
  // mass: a high water mark sitting far ABOVE your current mass. It may cost
  // nothing; it may never hand anything back.
  world.mass = 5000
  world.bestMass = 40000
  rupture(9999)
  assert.ok(world.mass <= 5000, `rupture paid the player: 5000 -> ${world.mass}`)
  assert.ok(world.mass >= FLOOR_MASS)
})

// ---------------------------------------------------------------------------
// THE BREATH — pace, crowding, control, and the numbers a child has to read
// ---------------------------------------------------------------------------

/** Fly a competent-but-not-perfect child for `seconds`, answering at `accuracy`. */
function fly(
  world: World,
  seconds: number,
  accuracy: number,
  seed: number,
  onFrame?: (f: number) => void,
  beforeFrame?: (f: number) => void,
  surgeDuty = 0,
): void {
  const coin = new Rng(seed)
  let target = -1
  for (let f = 0; f < 60 * seconds; f++) {
    beforeFrame?.(f)
    if (surgeDuty > 0) world.surging = (f / 60) % 1 < surgeDuty
    const res = world.resonance
    if (res.active && res.phase === 2) {
      if (target < 0) target = coin.f() < accuracy ? res.correctSlot : (res.correctSlot + 1 + coin.int(0, 2)) % 4
      const i = res.spheres[target] as number
      if (i >= 0 && world.malive[i]) {
        world.aimX = world.mx[i] as number
        world.aimY = world.my[i] as number
      }
    } else {
      target = -1
      let best = -1
      let bs = -1
      for (let i = 0; i < world.mx.length; i++) {
        if (!world.malive[i] || world.mkind[i] === 3) continue
        const v = world.mval[i] as number
        if (v < 0 || v >= world.mass * 0.92) continue
        const d = Math.hypot((world.mx[i] as number) - world.px, (world.my[i] as number) - world.py)
        const s = (v + 6) / (d + 90)
        if (s > bs) {
          bs = s
          best = i
        }
      }
      if (best >= 0) {
        world.aimX = world.mx[best] as number
        world.aimY = world.my[best] as number
      }
    }
    world.step(1 / 60)
    onFrame?.(f)
  }
}

/**
 * The founder's headline complaint, as an assertion.
 *
 *   "arena gets so crowded so fast I can hardly move"
 *
 * Measured before this pass, mid tier: the FIRST FRAME of a run carried 155
 * motes and 16 rivals — the same counts the twentieth minute carries, because
 * `reset()` spawned the tier ceiling and nothing ever ramped. There was no
 * onset of any kind.
 */
test("a run opens sparse and fills up only as the world is earned", () => {
  const spec = specFor("mid")
  const world = new World(createStubHost({ seed: 2 }), spec, 808)

  let rivals = 0
  let motes = 0
  for (let k = 0; k < world.rmass.length; k++) if (world.ralive[k]) rivals++
  for (let i = 0; i < world.malive.length; i++) if (world.malive[i]) motes++

  assert.ok(rivals <= spec.rivals * 0.4, `the opening frame carried ${rivals} rivals of a ${spec.rivals} ceiling`)
  assert.ok(motes <= spec.motes * 0.55, `the opening frame carried ${motes} motes of a ${spec.motes} ceiling`)
  assert.ok(rivals >= 2, "…but an arena with nobody in it is a screensaver, not an arena")
  assert.ok(motes >= 20, "…and a child must have something to eat from the first second")

  // Fifteen seconds in it has not quietly filled up behind the ramp.
  fly(world, 15, 0, 5)
  let r15 = 0
  for (let k = 0; k < world.rmass.length; k++) if (world.ralive[k]) r15++
  assert.ok(r15 <= spec.rivals * 0.45, `fifteen seconds in there were already ${r15} rivals`)

  // A player who answers well gets the full ocean; the ceiling is still real.
  const busy = new World(createStubHost({ seed: 2 }), spec, 808)
  fly(busy, 300, 1, 5)
  let rBusy = 0
  for (let k = 0; k < busy.rmass.length; k++) if (busy.ralive[k]) rBusy++
  assert.ok(rBusy > r15, `answering well did not fill the ocean: ${r15} -> ${rBusy} rivals`)
})

/**
 * "we go from 10 to >1000 in minutes .. it should start with 1,2,3 and really
 *  get into the 2nd and 3rd grade for a while"
 *
 * Measured before, seeded, mid tier, an ordinary mote-chasing player:
 * mass 104 at five seconds, 537 at fifteen, 1,771 at thirty, 2,624 at sixty.
 * Four digits inside the first minute, for everybody, forever after.
 *
 * The assertion is on BANDS rather than on numbers, because the exact value is
 * seed-dependent and the property is not.
 */
test("the numbers a child reads stay in a workable range for a long time", () => {
  // Four seeds and a median, where this used to be one seed and a number.
  //
  // The change is forced by exact absorption and it makes the test stronger,
  // not looser. A single early kill is now worth up to 94% of you rather than
  // 25%, so ONE seed's fifteen-second mass is a coin flip on whether a rival
  // wandered into range — measured across five seeds after this pass: 131, 67,
  // 62, 52, 47. Asserting the band on the median keeps the property the test
  // names, and the per-seed ceiling below keeps a single run from hiding a
  // detonation inside a lucky median.
  const marks = [15, 30, 60, 120, 300]
  const runs: Record<number, number>[] = []
  for (const [host, world, coin] of [[4, 0xbeef, 9], [6, 31337, 11], [15, 606, 4], [21, 1234, 3]] as const) {
    const w = new World(createStubHost({ seed: host }), specFor("mid"), world)
    const at: Record<number, number> = {}
    fly(w, 300, 0.3, coin, (f) => {
      const t = (f + 1) / 60
      for (const m of marks) if (Math.abs(t - m) < 1 / 120) at[m] = w.mass
    })
    runs.push(at)
  }
  const median = (m: number): number => {
    const xs = runs.map((r) => r[m] as number).sort((a, b) => a - b)
    return ((xs[1] as number) + (xs[2] as number)) / 2
  }
  const worst = (m: number): number => Math.max(...runs.map((r) => r[m] as number))

  assert.ok(median(15) < 100, `mass was already ${Math.round(median(15))} after fifteen seconds`)
  assert.ok(median(30) < 200, `mass was already ${Math.round(median(30))} after half a minute`)
  assert.ok(median(60) < 600, `mass was already ${Math.round(median(60))} after one minute`)
  // No single run may be an order of magnitude out of band either. Every
  // economy bug this file has caught was two or more orders out, not one.
  assert.ok(worst(15) < 300, `a run reached ${Math.round(worst(15))} in fifteen seconds`)
  assert.ok(worst(30) < 900, `a run reached ${Math.round(worst(30))} in half a minute`)
  assert.ok(worst(60) < 2500, `a run reached ${Math.round(worst(60))} in one minute`)
  // …and it must still be a climb, not a stall. A game where nothing grows is
  // not calmer, it is dead.
  assert.ok(median(300) > median(30) * 3, "five minutes of play went nowhere")
})

/**
 * The whole point of the controller, end to end through the simulation.
 * Struggle and the world gets sparser AND calmer AND easier, together.
 */
test("the world breathes out for a child who is struggling, and in for one who is not", () => {
  const mk = (): World => new World(createStubHost({ seed: 6 }), specFor("mid"), 31337)

  const lost = mk()
  fly(lost, 420, 0, 11)
  const thriving = mk()
  fly(thriving, 420, 1, 11)

  const count = (w: World): { rivals: number; motes: number } => {
    let rivals = 0
    let motes = 0
    for (let k = 0; k < w.rmass.length; k++) if (w.ralive[k]) rivals++
    for (let i = 0; i < w.malive.length; i++) if (w.malive[i]) motes++
    return { rivals, motes }
  }
  const a = count(lost)
  const b = count(thriving)

  assert.ok(b.rivals > a.rivals, `struggling and thriving got the same crowd: ${a.rivals} vs ${b.rivals} rivals`)
  assert.ok(b.motes > a.motes, `struggling and thriving got the same field: ${a.motes} vs ${b.motes} motes`)
  assert.ok(thriving.rung > lost.rung, `the maths did not adapt: rung ${lost.rung} vs ${thriving.rung}`)
  assert.equal(lost.rung, 0, "a child getting everything wrong must reach the very bottom of the ladder")
  assert.ok(lost.voidRate < thriving.voidRate, "the water did not calm down for the struggling child")
})

/**
 * Time is MEASURED and REWARDED, never imposed — and after this pass it is not
 * even bounded.
 *
 *   "I like infinite time to think in most cases too ... we can usually
 *    measure, pace and reward, not cause anxiety"
 *
 *   "if you can do something like 34801 / 37 in your head in 5 seconds you are a
 *    total math stud .. maybe they allow infinite time and even invite the kid to
 *    take out a piece of paper and work it out for 10 minutes for the points"
 *
 * Three clocks have been deleted from this beat in turn. The first shrank with
 * the number of questions asked (`max(6.5, 10.5 - resonanceCount * 0.16)`). The
 * second was spheres drifting away at a flat 22 units a second while you thought.
 * The third — deleted here — was `valueAt(intensity, 26, 6, "gentle")`: a window
 * a fast player *earned*, which was defensible until the ladder started serving
 * five-column long division into six seconds of it.
 *
 * What is left is measured over the whole cross product of run states below: the
 * guard is a function of the item and of nothing else.
 */
test("the time a child gets is a function of the question, and of nothing about the run", () => {
  // The same item, asked of a world at rest, a world that has been struggling for
  // five minutes, and a world that has been perfect for seven. If any of the
  // three disagrees, something about the run is in the window.
  // The guard is read off the LIVE WORLD — `world.resonance.guard`, installed by
  // `openResonance` — and never recomputed here.
  //
  // The first cut of this test called `guardSeconds(item)` once per arm and
  // compared the three results. `guardSeconds` is a pure import and `item` is a
  // module const, so all three were the same constant expression: three
  // assertions that could not fail, and that would have passed happily while
  // `openResonance` installed `guardSeconds(q) * (1 - intensity)`. Building three
  // worlds and flying them for seven minutes made it look like a measurement.
  const item = { prompt: "34801 ÷ 37", answer: "941" }
  const fixedHost = (): Host => ({
    next: () => ({
      id: "fixed-1",
      prompt: item.prompt,
      answer: item.answer,
      distractors: ["942", "940", "951"],
      domain: "divide",
      difficulty: 5,
    }),
    report: () => {},
    haptic: () => {},
    prefersReducedMotion: () => false,
  })
  const at = (seconds: number, accuracy: number): { guard: number; intensity: number } => {
    const w = new World(fixedHost(), specFor("mid"), 55)
    if (seconds > 0) fly(w, seconds, accuracy, 13)
    // Run on until a beat is actually open, and take what the world put there.
    for (let f = 0; f < 60 * 120; f++) {
      w.step(1 / 60)
      const res = w.resonance
      if (res.active && res.phase === 2) return { guard: res.guard, intensity: w.intensity }
    }
    throw new Error("no Resonance opened, so nothing was measured")
  }
  const rest = at(0, 0)
  const lost = at(300, 0)
  const ace = at(420, 1)
  assert.ok(
    ace.intensity > lost.intensity + 0.3,
    `the three worlds did not actually diverge, so the claim is untested: ${lost.intensity} vs ${ace.intensity}`,
  )
  assert.equal(rest.guard, lost.guard, "five minutes of struggle changed the time the same question gets")
  assert.equal(rest.guard, ace.guard, "seven minutes of mastery changed the time the same question gets")
  // …and it is the founder's ten minutes, for the item he named.
  assert.equal(rest.guard, 600, `${item.prompt} was given ${rest.guard}s, not the ten minutes he asked for`)
  // Belt and braces: the world's number is the module's number, checked once.
  assert.equal(rest.guard, guardSeconds(item), "the world installed something other than the item's own guard")

  // The spheres do not recede, at any point on the ladder. The old drift was
  // earned on the same curve as the old window, so at the top of the ladder the
  // answer physically walked away from a hesitating child at 22 units a second.
  for (const w of [
    new World(createStubHost({ seed: 8 }), specFor("mid"), 55),
    (() => {
      const x = new World(createStubHost({ seed: 8 }), specFor("mid"), 55)
      fly(x, 420, 1, 13)
      return x
    })(),
  ]) {
    // Held open with a still hand, and the ring measured at both ends.
    let opened = false
    let r0 = 0
    let r1 = 0
    for (let f = 0; f < 60 * 240; f++) {
      const res = w.resonance
      if (res.active && res.phase === 2) {
        const i = res.spheres[0] as number
        if (i >= 0 && w.malive[i]) {
          const r = Math.hypot((w.mx[i] as number) - res.centreX, (w.my[i] as number) - res.centreY)
          if (!opened) {
            opened = true
            r0 = r
          }
          r1 = r
        }
      }
      // The hand never moves: `aim` is parked, which is what `mount` writes when
      // nothing is being touched.
      w.aimX = w.px
      w.aimY = w.py
      w.step(1 / 60)
      if (opened && !w.resonance.active) break
    }
    assert.ok(opened, "no Resonance opened in four minutes")
    assert.ok(
      Math.abs(r1 - r0) < r0 * 0.02,
      `the answer moved from ${r0.toFixed(0)} to ${r1.toFixed(0)} units away while the child thought`,
    )
  }
})

/**
 * The guard fires only on silence, and firing costs nothing.
 *
 * `games/claim`: **a clock may never take anything away from a child.** So the
 * thing that ends an unanswered Resonance measures a *pause* and not a round, it
 * refills on any hand on the glass, and when it does fire the host is told
 * nothing, the pacing controller does not move, and no mass changes hands.
 */
test("the guard measures silence, refills on a hand, and takes nothing when it fires", () => {
  const reports: unknown[] = []
  const world = new World(createStubHost({ seed: 3, onReport: (r) => reports.push(r) }), specFor("low"), 404)

  // Sit through one whole beat without ever touching anything.
  let fired = 0
  let openedAt = -1
  let guard = 0
  let massAtOpen = 0
  let successAtOpen = 0
  for (let f = 0; f < 60 * 900; f++) {
    const res = world.resonance
    if (res.active && res.phase === 2 && openedAt < 0) {
      openedAt = world.time
      guard = res.guard
      massAtOpen = world.mass
      successAtOpen = world.success
    }
    world.aimX = world.px
    world.aimY = world.py
    world.step(1 / 60)
    for (let e = 0; e < world.eventLen; e++) {
      if ((world.events[e] as { kind: string }).kind === "resonance-fade") fired++
    }
    if (fired > 0) break
  }
  assert.ok(fired === 1, `the guard never fired in fifteen minutes of stillness (fired ${fired})`)
  assert.ok(guard >= 60, `the guard was only ${guard}s`)
  // A frame of slack: `openedAt` is stamped the first frame the harness OBSERVES
  // phase 2, which is one step after the world zeroed `idle`.
  const held = world.time - openedAt
  assert.ok(held >= guard - 0.1, `the beat was withdrawn after ${held.toFixed(2)}s against a ${guard}s guard`)
  assert.equal(reports.length, 0, "a withdrawn question was reported to the host")
  assert.equal(world.success, successAtOpen, "a withdrawn question moved the pacing controller")
  assert.ok(world.mass >= massAtOpen, `a withdrawn question cost ${(massAtOpen - world.mass).toFixed(1)} mass`)

  // Now the same beat with a hand on it, wandering — the child is steering, not
  // answering. This arm used to assert the beat stayed open, on the theory that any
  // input is a hand on the rack. It is the opposite assertion now, and the reason
  // is in `stepResonance`: steering is not answering, so a child who ignores the
  // question must not be able to hold a beat open forever.
  const w2 = new World(createStubHost({ seed: 3 }), specFor("low"), 404)
  let longest = 0
  let openFor = 0
  let fades = 0
  for (let f = 0; f < 60 * 1200; f++) {
    const res = w2.resonance
    if (res.active && res.phase === 2) {
      openFor += 1 / 60
      // A hand on the stick the whole time, going nowhere near a sphere.
      w2.aimX = w2.px + (f % 120 < 60 ? 60 : -60)
      w2.aimY = w2.py
    } else {
      longest = Math.max(longest, openFor)
      openFor = 0
    }
    w2.step(1 / 60)
    for (let e = 0; e < w2.eventLen; e++) {
      if ((w2.events[e] as { kind: string }).kind === "resonance-fade") fades++
    }
  }
  longest = Math.max(longest, openFor)
  assert.ok(fades > 0, "a child who steered for twenty minutes without answering never had a beat withdrawn")
  assert.ok(
    longest <= MAX_GUARD_SECONDS + 2,
    `a beat stayed open for ${longest.toFixed(0)}s — longer than any item's allowance, so the game could not resume`,
  )
})

/**
 * Speed is still worth something, and it is worth it as a BONUS.
 *
 * The earned countdown is gone; the reward for mastery it stood for is not. A
 * brisk correct answer pays up to 70% more mass than a laboured one and the
 * celebration scales with it, and that is now the whole of ARENA's relationship
 * with the clock. `game-pacing/flow.ts`: "a countdown that kills you and a bonus
 * that accrues when you are fast read the same clock and produce opposite
 * emotional experiences."
 */
test("a fast answer earns more, and a slow one still wins", () => {
  const play = (thinkFrames: number): { gain: number; quick: number; mass: number } => {
    const world = new World(createStubHost({ seed: 44 }), specFor("low"), 707)
    let gain = 0
    let quick = -1
    let waited = 0
    for (let f = 0; f < 60 * 600 && quick < 0; f++) {
      const res = world.resonance
      if (res.active && res.phase === 2) {
        if (waited < thinkFrames) {
          waited++
          // Thinking. The hand is on the stick, so the guard never runs down —
          // and this is also the only way to spend real time in a beat now.
          world.aimX = world.px + (waited % 2 === 0 ? 40 : -40)
          world.aimY = world.py
        } else {
          const i = res.spheres[res.correctSlot] as number
          if (i >= 0 && world.malive[i]) {
            world.aimX = world.mx[i] as number
            world.aimY = world.my[i] as number
          }
        }
      }
      world.step(1 / 60)
      for (let e = 0; e < world.eventLen; e++) {
        // `a` is the mass gained; `r` is the quickness the world paid it at —
        // `resolveResonance` puts it there so the presentation layer can spend it
        // on spectacle without recomputing it.
        const ev = world.events[e] as { kind: string; a: number; r: number }
        if (ev.kind !== "resonance-hit") continue
        gain = ev.a
        quick = ev.r
      }
    }
    return { gain, quick, mass: 0 }
  }

  const brisk = play(0)
  const slow = play(60 * 20)
  assert.ok(brisk.quick > 0.5, `an immediate answer scored quickness ${brisk.quick.toFixed(2)}`)
  assert.ok(slow.quick <= 0.001, `a twenty-second answer still scored quickness ${slow.quick.toFixed(2)}`)
  assert.ok(brisk.gain > slow.gain, `being fast paid ${brisk.gain.toFixed(1)} against ${slow.gain.toFixed(1)} for being slow`)
  assert.ok(slow.gain > 0, "a slow correct answer paid nothing at all — slowness must never be a punishment")
})

/**
 * The invariant, measured through the REAL scheduler rather than by calling
 * `guardSeconds` twice.
 *
 * `window.test.ts` proves the function is monotone and pure. This proves the game
 * installs what the function returned, on every beat, over a real run — which is
 * the assertion that survives somebody adding a "just a small nudge" multiplier
 * inside `openResonance`.
 *
 * Twenty minutes at each of three abilities, every beat's guard recorded against
 * the item that produced it. Two claims: the guard the world installed is exactly
 * the item's, and across the whole population a wider item never got less.
 */
test("through the real scheduler, the guard is the item's and a harder item never gets less", () => {
  type Seen = { prompt: string; answer: string; guard: number; p90: number; intensity: number }
  const seen: Seen[] = []

  for (const accuracy of [0, 0.5, 1]) {
    const asked = new Map<string, Question>()
    const stub = createStubHost({ seed: 5150 })
    const host: Host = {
      next: (o) => {
        const q = stub.next(o)
        asked.set(q.id, q)
        return q
      },
      report: (r) => stub.report(r),
      haptic: () => {},
      prefersReducedMotion: () => false,
    }
    const world = new World(host, specFor("mid"), 8080)
    let lastId = ""
    fly(world, 1200, accuracy, 4242, () => {
      const res = world.resonance
      if (!res.active || res.phase < 1 || !res.question) return
      if (res.question.id === lastId) return
      lastId = res.question.id
      const q = asked.get(res.question.id) as Question
      seen.push({
        prompt: q.prompt,
        answer: q.answer,
        guard: res.guard,
        p90: comprehensionSeconds({ prompt: q.prompt, answer: q.answer }),
        intensity: world.intensity,
      })
    })
  }

  assert.ok(seen.length >= 60, `only ${seen.length} questions in an hour of play across three abilities`)

  // 1. What the world installed is what the item asked for. No fudge factor, no
  //    scaling, no floor applied on the way through.
  for (const s of seen) {
    assert.equal(
      s.guard,
      guardSeconds({ prompt: s.prompt, answer: s.answer }),
      `"${s.prompt}" was given a ${s.guard}s guard, not the item's own`,
    )
  }

  // 2. The population is monotone in the item's own difficulty. Sorted by p90,
  //    the guard may never step down.
  const sorted = [...seen].sort((a, b) => a.p90 - b.p90)
  for (let i = 1; i < sorted.length; i++) {
    const lo = sorted[i - 1] as Seen
    const hi = sorted[i] as Seen
    assert.ok(
      hi.guard >= lo.guard,
      `"${hi.prompt}" (p90 ${hi.p90}s) got ${hi.guard}s while the easier "${lo.prompt}" (p90 ${lo.p90}s) got ${lo.guard}s`,
    )
  }

  // 3. And the same item text always got the same guard, however hot the run was
  //    when it came up. This is the assertion the old `resonanceSeconds` failed.
  const byPrompt = new Map<string, Seen[]>()
  for (const s of seen) {
    const list = byPrompt.get(s.prompt) ?? []
    list.push(s)
    byPrompt.set(s.prompt, list)
  }
  let compared = 0
  for (const [prompt, group] of byPrompt) {
    if (group.length < 2) continue
    const spread = Math.max(...group.map((g) => g.intensity)) - Math.min(...group.map((g) => g.intensity))
    for (const g of group) {
      assert.equal(
        g.guard,
        (group[0] as Seen).guard,
        `"${prompt}" got ${g.guard}s once and ${(group[0] as Seen).guard}s another time`,
      )
    }
    if (spread > 0.2) compared++
  }
  assert.ok(compared > 0, "no item ever came up twice at meaningfully different intensities, so the claim is untested")

  const widest = seen.reduce((m, s) => Math.max(m, s.p90), 0)
  const narrowest = seen.reduce((m, s) => Math.min(m, s.p90), 1e9)
  assert.ok(
    widest > narrowest,
    `every question in an hour of play was the same class (p90 ${widest}s) — the monotonicity claim is vacuous`,
  )
  console.log(
    `[measured] ${seen.length} questions through the real scheduler, ` +
      `p90 ${narrowest}s..${widest}s, guard ${narrowest * 10}s..${widest * 10}s, ` +
      `${byPrompt.size} distinct prompts`,
  )
})

/**
 * The lurch, and why it was arithmetic rather than judgement.
 *
 *   "the higher levels need to come more gently and not jump right into Max Cohen
 *    mode"
 *
 * `DIFFICULTY_RUNGS` is 10; the shared bridge maps a 1..10 ladder index onto the
 * host's ladder as `(value - 1) / 9`; the host's ladder is **66 rungs**. So the
 * integer request `rung + 1` could only ever name curriculum rungs
 * {0, 7, 14, 22, 29, 36, 43, 51, 58, 65} — and one step of ARENA's breath was a
 * 7.2-rung jump. Measured through the real host:
 *
 *     ARENA rung 6 -> curriculum 43 -> dw.add.regroup.add-multidigit L2  `506 + 394`
 *     ARENA rung 7 -> curriculum 51 -> dw.div.whole.divide-exact L3      `721308 ÷ 84`
 *
 * Unrounded, the same climb walks the ladder a rung at a time.
 */
/**
 * The host's ladder, as the bridge maps ARENA's request onto it: `(d - 1) / 9`
 * across 66 curriculum rungs. Both figures are the host's and neither is ARENA's
 * to choose, so they are stated here as the frame the measurement is read in.
 */
const CURRICULUM_RUNGS = 66

/** Every difficulty ARENA asked for in `seconds` of play, as curriculum rungs. */
function requestedRungs(seconds: number, accuracy: number, seed: number): number[] {
  const asks: number[] = []
  const stub = createStubHost({ seed: 66 })
  const host: Host = {
    next: (o) => {
      if (o?.difficulty !== undefined) {
        assert.ok(
          (o.difficulty as number) >= 1 && (o.difficulty as number) <= 10,
          `asked the host for difficulty ${String(o.difficulty)}, outside the 1..10 ladder scale the bridge documents`,
        )
        asks.push(Math.round((((o.difficulty as number) - 1) / 9) * (CURRICULUM_RUNGS - 1)))
      }
      return stub.next(o)
    },
    report: () => {},
    haptic: () => {},
    prefersReducedMotion: () => false,
  }
  const world = new World(host, specFor("mid"), seed)
  fly(world, seconds, accuracy, 271)
  return asks
}

test("the climb walks the curriculum a rung at a time, and a lucky streak cannot reach the top", () => {
  const perfect = requestedRungs(900, 1, 3141)
  assert.ok(perfect.length >= 20, `only ${perfect.length} questions were asked in fifteen minutes`)

  const distinct = new Set(perfect)
  let smallestStep = Infinity
  let largestStep = 0
  for (let i = 1; i < perfect.length; i++) {
    const step = Math.abs((perfect[i] as number) - (perfect[i - 1] as number))
    if (step > 0) smallestStep = Math.min(smallestStep, step)
    largestStep = Math.max(largestStep, step)
  }
  console.log(
    `[measured] a perfect player, 15 min: ${perfect.length} requests, ` +
      `${distinct.size} distinct curriculum rungs of ${CURRICULUM_RUNGS}, ` +
      `steps ${smallestStep}..${largestStep}, highest rung ${Math.max(...perfect)}`,
  )

  // THE LURCH, first, because it is the founder's actual sentence and every other
  // assertion here is a corroborating measurement of it. Before this pass a
  // perfect player's requests went `0, 3, 21, 25, 32, 39, 47, 55, 63, 65` — an
  // EIGHTEEN-rung step between two consecutive questions.
  assert.ok(
    largestStep <= 4,
    `one answer moved the child ${largestStep} curriculum rungs — that is "jump right into Max Cohen mode", and it is what this test exists to stop`,
  )

  // "You get a few right just by being lucky and all of a sudden you are asked to
  // do like 87364/9." Five-digit long division is around curriculum rung 40; the
  // top of the ladder is 65. Neither is reachable on a short lucky streak.
  const firstFive = perfect.slice(0, 5)
  assert.ok(
    Math.max(...firstFive) < 12,
    `five correct answers put a child on curriculum rung ${Math.max(...firstFive)} of ${CURRICULUM_RUNGS - 1} — a lucky streak reached content nobody has shown they can do`,
  )

  // Ten is what an INTEGER request could reach at all: `rung + 1` over
  // `DIFFICULTY_RUNGS` = 10 could only ever name curriculum rungs
  // {0, 7, 14, 22, 29, 36, 43, 51, 58, 65}. Anything past ten distinct rungs is a
  // resolution the old request did not have.
  assert.ok(
    distinct.size > DIFFICULTY_RUNGS,
    `the climb reached only ${distinct.size} distinct curriculum rungs — ten is all the old integer request could name`,
  )
  // …and it can step by ONE. Measured before this pass, the smallest non-zero step
  // a perfect player's request ever took was 2, and the median was 7.
  assert.ok(
    smallestStep <= 1,
    `the smallest non-zero step up the curriculum was ${smallestStep} rungs, so the ladder is still quantised`,
  )
  // Crossing the whole ladder takes the number of answers the HOST's own
  // recalibrated ladder would take — see `LADDER_CLIMB_ANSWERS`. Fifteen minutes
  // of flawless play is about 33 answers, so it must not be at the top yet.
  assert.ok(
    Math.max(...perfect) < CURRICULUM_RUNGS - 1,
    `flawless play reached the very top of the curriculum in ${perfect.length} answers`,
  )

  // A child at the founder's own "right level" sits, rather than being raced.
  const sitting = requestedRungs(900, 0.85, 3141)
  console.log(
    `[measured] an 85%-correct player, 15 min: rungs ${Math.min(...sitting)}..${Math.max(...sitting)} of ${CURRICULUM_RUNGS - 1}`,
  )
  assert.ok(
    Math.max(...sitting) < 30,
    `a child right 85% of the time was carried to curriculum rung ${Math.max(...sitting)} — "if you are getting 85% you are at the right level"`,
  )

  // And a struggling child is at the bottom, which is the property that must not
  // regress in the other direction.
  const lost = requestedRungs(600, 0, 3141)
  assert.ok(Math.max(...lost) <= 4, `a child getting everything wrong was asked for curriculum rung ${Math.max(...lost)}`)
})

/**
 * The answer does not move, **including at the edge of the world.**
 *
 * `sphereOrbit` rotates the ring about the ring's own centre; `stepMotes` clamps
 * every live mote radially about the WORLD ORIGIN. Those two disagree, and with the
 * player parked against the membrane they fight: the rotation carries a sphere
 * outside `arenaR`, the clamp drags it back toward the origin, and the ring slides
 * along the membrane instead of turning in place.
 *
 * The pull and the flip in `stepMotes` already skipped `MK_ANSWER`; the clamp was
 * the one of the three that did not. Narrow — `ringR` is about 0.3% of `arenaR` —
 * but `sphereOrbit` and the README both promise the answer is exactly where the
 * child found it ten minutes later, with no qualification, so the code should hold
 * it with no qualification.
 */
test("the answer stays put even with the player pinned against the membrane", () => {
  const reports: unknown[] = []
  const world = new World(createStubHost({ seed: 17, onReport: (r) => reports.push(r) }), specFor("low"), 2024)
  // Open a beat, then put the player hard against the membrane so the clamp and
  // the rotation are both live on the same spheres.
  let opened = false
  for (let f = 0; f < 60 * 120 && !opened; f++) {
    world.aimX = world.px
    world.aimY = world.py
    world.step(1 / 60)
    opened = world.resonance.active && world.resonance.phase === 2
  }
  assert.ok(opened, "no Resonance opened")

  const res = world.resonance
  const edge = world.arenaR
  // Move the player and the whole ring out to the membrane together, so the ring
  // straddles it — the geometry the clamp would fight.
  const dx = edge - res.centreX
  const dy = -res.centreY
  world.px += dx
  world.py += dy
  res.centreX += dx
  res.centreY += dy
  for (let s = 0; s < 4; s++) {
    const i = res.spheres[s] as number
    if (i < 0) continue
    world.mx[i] = (world.mx[i] as number) + dx
    world.my[i] = (world.my[i] as number) + dy
  }
  const radii = (): number[] => {
    const out: number[] = []
    for (let s = 0; s < 4; s++) {
      const i = res.spheres[s] as number
      if (i < 0 || !world.malive[i]) continue
      out.push(Math.hypot((world.mx[i] as number) - res.centreX, (world.my[i] as number) - res.centreY))
    }
    return out
  }
  const before = radii()
  assert.equal(before.length, 4, "the ring was not intact before the measurement")
  assert.ok(
    before.some((r, k) => Math.hypot(res.centreX, res.centreY) + r > edge && k >= 0),
    "the ring does not actually straddle the membrane, so the clamp is not being exercised",
  )

  const reportsAtStart = reports.length
  for (let f = 0; f < 60 * 30; f++) {
    world.aimX = world.px
    world.aimY = world.py
    world.step(1 / 60)
  }

  // **The ring must still be a ring**, asserted BEFORE the radii and by count.
  //
  // The first cut of this compared `before[k]` against `after[k]` over
  // `after.length`, and the defect it was written for retires spheres — so the two
  // arrays had different lengths, one surviving sphere was compared against the
  // first of four, and two equal numbers agreed about nothing. Measured under the
  // mutation: three of the four spheres were gone inside 253 frames.
  const after = radii()
  assert.equal(
    after.length,
    4,
    `${4 - after.length} of the four spheres were consumed while the child sat still at the membrane`,
  )

  // …and what consumed them was the clamp pushing one into the player, which the
  // beat read as the child CHOOSING it. That is the severe form of this bug: a
  // verdict, and a mass penalty, for an answer nobody gave.
  assert.equal(
    reports.length,
    reportsAtStart,
    "a sphere was pushed into a motionless child and answered the question for them",
  )

  for (let k = 0; k < 4; k++) {
    const r0 = before[k] as number
    const r1 = after[k] as number
    assert.ok(
      Math.abs(r1 - r0) < r0 * 0.02,
      `sphere ${k} slid from ${r0.toFixed(0)} to ${r1.toFixed(0)} units from the ring centre at the membrane`,
    )
  }
})

/**
 * **Stalling must not make the maths harder.**
 *
 * `LADDER_CLIMB_ANSWERS` is stated in ANSWERS and converted to seconds on the
 * assumption that seconds only pass between answers — and an allowance of up to
 * ten minutes breaks that assumption inside a single unanswered beat. With the
 * leash on raw `dt`, measured: six correct answers put the request on curriculum
 * rung 9, and then two ABANDONED questions — nothing answered, nothing reported,
 * nothing taken — carried it to rung 40, which is five-digit long division.
 *
 * Two things wrong with that at once. Answering nothing was a way to make the
 * questions harder; and a child who takes the founder's ten minutes on paper and
 * gets it right was charged nearly half the ladder for the minutes they spent
 * thinking. Both are the bill for thinking that this pass exists to cancel.
 */
test("stalling on a question does not climb the ladder", () => {
  const item = { prompt: "34801 ÷ 37", answer: "941" }
  const host: Host = {
    next: () => ({
      id: "long-1",
      prompt: item.prompt,
      answer: item.answer,
      distractors: ["942", "940", "951"],
      domain: "divide",
      difficulty: 5,
    }),
    report: () => {},
    haptic: () => {},
    prefersReducedMotion: () => false,
  }
  const world = new World(host, specFor("low"), 606)

  // Answer six correctly and fast, so the BREATH is pinned at its ceiling and the
  // leash is genuinely in its climbing branch. Without this the test exercises the
  // falling branch and proves nothing.
  let answered = 0
  for (let f = 0; f < 60 * 600 && answered < 6; f++) {
    const res = world.resonance
    if (res.active && res.phase === 2) {
      const i = res.spheres[res.correctSlot] as number
      if (i >= 0 && world.malive[i]) {
        world.aimX = world.mx[i] as number
        world.aimY = world.my[i] as number
      }
    }
    world.step(1 / 60)
    for (let e = 0; e < world.eventLen; e++) {
      if ((world.events[e] as { kind: string }).kind === "resonance-hit") answered++
    }
  }
  assert.equal(answered, 6, `only ${answered} answers landed, so the climbing branch was never entered`)
  assert.ok(world.intensity > 0.9, `the breath is only at ${world.intensity.toFixed(3)}, so the leash is not climbing`)
  const beforeStall = world.ladderPosition
  assert.ok(beforeStall > 0, "the ladder never left the floor, so a rise could not be detected")

  // Now stall out two whole allowances without answering anything.
  let fades = 0
  for (let f = 0; f < 60 * 1500 && fades < 2; f++) {
    world.aimX = world.px
    world.aimY = world.py
    world.step(1 / 60)
    for (let e = 0; e < world.eventLen; e++) {
      if ((world.events[e] as { kind: string }).kind === "resonance-fade") fades++
    }
  }
  assert.equal(fades, 2, `only ${fades} questions were abandoned, so the claim is untested`)

  // Time passed — twenty minutes of it — and the ladder did not move, because
  // none of it was time anybody answered in.
  // Exactly nothing, not merely "not much": the leash is paid in answers, so with
  // no answers there is no rung to spend. A per-second version leaked here.
  const climbed = world.ladderPosition - beforeStall
  assert.ok(
    climbed <= 1e-9,
    `two abandoned questions carried the request ${(climbed * 100).toFixed(1)}% of the way up the ladder ` +
      `(${beforeStall.toFixed(3)} -> ${world.ladderPosition.toFixed(3)}, about curriculum rung ` +
      `${Math.round(world.ladderPosition * 65)} of 65) without a single answer`,
  )
})

/**
 * Relief is not earned. The maths ladder falls as fast as the breath does.
 *
 * The leash on `mathsIntensity` is one-directional on purpose, and it is the same
 * asymmetry `game-pacing` already applies to `fallSeconds` and #715 applies to its
 * bands: "Up needs two things, down needs one." A slew limit in both directions
 * would be a child who missed four in a row still being asked for long division
 * twenty minutes later.
 */
test("a struggling child's questions get easier at once, not on a leash", () => {
  const world = new World(createStubHost({ seed: 71 }), specFor("mid"), 1717)
  // Climb first, so there is something to fall from.
  fly(world, 900, 1, 271)
  const high = world.mathsIntensity
  assert.ok(high > 0.2, `the climb never got anywhere: mathsIntensity ${high.toFixed(3)}`)

  // Now miss everything, and watch the two scalars come down together.
  fly(world, 120, 0, 271)
  assert.ok(
    world.mathsIntensity <= world.intensity + 1e-9,
    `the maths lagged the breath on the way DOWN: ${world.mathsIntensity.toFixed(3)} against ${world.intensity.toFixed(3)}`,
  )
  assert.ok(
    world.mathsIntensity < high * 0.5,
    `two minutes of missing everything only took the maths from ${high.toFixed(3)} to ${world.mathsIntensity.toFixed(3)}`,
  )
})

/**
 * Thinking is not run time.
 *
 * With no length on a Resonance the quiet tide became a bill for using the
 * founder's invitation: eight minutes on paper is more than the tide's whole
 * 420-second ramp, so a child would put the tablet down in a calm ocean and pick
 * it up in a fully escalated one. The tide rides `playTime`, which excludes every
 * second the arena spent inert.
 */
test("time spent thinking does not escalate the ocean", () => {
  // A child who does exactly what the founder invited: opens a long question, puts
  // the tablet on the table, and works it out. Nothing is eaten, nothing is
  // gained, and the aim never moves — the guard's own design case.
  const longHost: Host = {
    next: () => ({
      id: "long-1",
      prompt: "34801 ÷ 37",
      answer: "941",
      distractors: ["942", "940", "951"],
      domain: "divide",
      difficulty: 5,
    }),
    report: () => {},
    haptic: () => {},
    prefersReducedMotion: () => false,
  }
  const world = new World(longHost, specFor("mid"), 12321)

  // Fly to the first open beat, and photograph the world.
  let opened = false
  for (let f = 0; f < 60 * 120 && !opened; f++) {
    world.aimX = world.px
    world.aimY = world.py
    world.step(1 / 60)
    opened = world.resonance.active && world.resonance.phase === 2
  }
  assert.ok(opened, "no Resonance opened")
  const before = {
    depth: world.depth.index,
    over: world.over,
    world: world.worldIntensity,
    hunters: world.hunterBudget,
    voids: world.voidRate,
    mass: world.mass,
    play: world.playTime,
  }
  assert.ok(world.resonance.guard >= 600, `the beat only carried a ${world.resonance.guard}s guard`)

  // Sit out the entire guard without touching anything.
  let inert = 0
  for (let f = 0; f < 60 * 900; f++) {
    if (world.resonance.active) inert++
    world.aimX = world.px
    world.aimY = world.py
    world.step(1 / 60)
    if (!world.resonance.active && inert > 60 * 300) break
  }
  assert.ok(inert > 60 * 550, `only ${(inert / 60).toFixed(0)}s was spent inside the beat`)

  // 1. The bookkeeping. `playTime` did not advance while the arena was inert.
  assert.ok(
    Math.abs(world.playTime - before.play) < 2,
    `${(world.playTime - before.play).toFixed(1)}s of thinking was charged to the run`,
  )

  // 2. THE ESCALATION SPINE, and this is the assertion the first cut of this test
  //    was missing. `refreshDepth` was still on `this.time`, and `DEPTH_CLOCK_SECONDS`
  //    is 100 with a floored band — so ten minutes of thinking sank the run six
  //    bands, from DRIFT to THE ABYSSAL, and handed the child back four hunters, a
  //    leviathan, 18% void motes and temper 0.86. It never came back, because the
  //    band cannot fall. Asserting only the `playTime` arithmetic left that green.
  assert.equal(
    world.depth.index,
    before.depth,
    `thinking sank the run from depth ${before.depth} to depth ${world.depth.index} — the child paid for the paper in hunters`,
  )
  assert.ok(
    world.over <= before.over + 1e-9,
    `thinking drove overdrive from ${before.over.toFixed(3)} to ${world.over.toFixed(3)}`,
  )
  assert.ok(
    world.worldIntensity <= before.world + 1e-9,
    `thinking drove the world from ${before.world.toFixed(3)} to ${world.worldIntensity.toFixed(3)}`,
  )
  assert.ok(world.hunterBudget <= before.hunters, `thinking bought ${world.hunterBudget - before.hunters} extra hunters`)
  assert.ok(world.voidRate <= before.voids + 1e-9, "thinking put more void motes in the water")

  // 3. …and it cost no mass either, which is the other half of "takes nothing".
  assert.ok(world.mass >= before.mass, `thinking cost ${(before.mass - world.mass).toFixed(1)} mass`)

  // 4. And the ladder did not climb on seconds nobody answered in. With the leash
  //    on raw `dt`, two abandoned questions moved the request from curriculum rung
  //    9 to rung 40 — five-digit long division, bought by answering nothing.
  assert.ok(
    world.ladderPosition <= 0.12,
    `stalling carried the request to ladder position ${world.ladderPosition.toFixed(3)} without answering anything`,
  )
})

/** Mashing must not be a strategy, and must not be punished either. */
test("swimming into a random sphere parks a child at the bottom, and costs them almost nothing", () => {
  let answered = 0
  const world = new World(createStubHost({ seed: 12, onReport: () => answered++ }), specFor("mid"), 99)
  const coin = new Rng(7)
  let pick = -1
  let worstDrop = 0
  for (let f = 0; f < 60 * 420; f++) {
    const res = world.resonance
    if (res.active && res.phase === 2) {
      // One sphere per question, chosen at random. Re-rolling every frame is
      // not mashing, it is oscillating between four points and never arriving.
      if (pick < 0) pick = coin.int(0, 3)
      const i = res.spheres[pick] as number
      if (i >= 0 && world.malive[i]) {
        world.aimX = world.mx[i] as number
        world.aimY = world.my[i] as number
      }
    } else {
      pick = -1
    }
    const before = world.mass
    world.step(1 / 60)
    // Scoped to the MISS specifically. A rupture is a separate mechanic with its
    // own checkpoint and its own mercy, and folding it in here would measure
    // something this test is not about.
    for (let e = 0; e < world.eventLen; e++) {
      if ((world.events[e] as { kind: string }).kind !== "resonance-miss") continue
      worstDrop = Math.max(worstDrop, (before - world.mass) / before)
    }
  }
  assert.ok(answered > 0, "the masher never actually reached a sphere")
  assert.ok(world.intensity < 0.35, `mashing climbed to ${world.intensity.toFixed(2)} — guessing must not pay`)
  assert.ok(
    worstDrop < 0.06,
    `a wrong answer cost ${(worstDrop * 100).toFixed(0)}% of the run — a child who is guessing is a child who is stuck`,
  )
})

/**
 * "The other 'players' can get so big that they are bigger than the whole
 *  screen on a mobile device and they just basically envelope me and I can't do
 *  anything."
 *
 * Measured before, five minutes, seeded: the largest core on the field reached
 * 27.4x the player's mass — 1.99 times the WIDTH of a 1080x2340 phone. The
 * exemption `!this.rleviathan[k]` on the size recycler was the whole bug.
 */
test("nothing in the water may ever be wider than the screen", () => {
  const PORTRAIT = 1080 / 2340
  for (const [tier, accuracy] of [["mid", 1], ["high", 0.5], ["low", 0]] as const) {
    const world = new World(createStubHost({ seed: 21 }), specFor(tier), 1234)
    world.viewAspect = PORTRAIT
    let worstRatio = 0
    let worstCover = 0
    fly(world, 600, accuracy, 3, () => {
      const width = viewSpanFor(world.mass) * PORTRAIT
      for (let k = 0; k < world.rmass.length; k++) {
        if (!world.ralive[k]) continue
        const m = world.rmass[k] as number
        worstRatio = Math.max(worstRatio, m / world.mass)
        worstCover = Math.max(worstCover, (2 * 9 * Math.sqrt(m)) / width)
      }
    })
    assert.ok(
      worstCover < 1,
      `${tier}: a rival reached ${worstCover.toFixed(2)}x the width of a phone held tall — it can enclose a child`,
    )
    assert.ok(
      worstRatio < 4.6,
      `${tier}: a rival reached ${worstRatio.toFixed(1)}x the player's mass`,
    )
  }
})

/**
 * "Why is there an edge of the board?"
 *
 * Because there was one, five seconds away. `arenaRadiusFor` was
 * `max(2600, span * 3.4)` and at the starting mass the `max` chose the
 * constant, so a 2,600-unit pond surrounded a 463-unit view. Measured:
 * swimming in one straight line from the centre, the wall arrived after 4.77
 * seconds — inside a child's first attempt at moving.
 */
test("a child cannot find the edge of the world by swimming at it", () => {
  const world = new World(createStubHost({ seed: 14 }), specFor("mid"), 5)
  let touched = -1
  for (let f = 0; f < 60 * 150; f++) {
    world.aimX = world.px + 500_000
    world.aimY = world.py
    world.step(1 / 60)
    const rad = Math.hypot(world.px, world.py)
    if (touched < 0 && rad > world.arenaR - 9 * Math.sqrt(world.mass) - 2) touched = f / 60
  }
  assert.equal(touched, -1, `the membrane was reached after ${touched}s of swimming in one direction`)
  // …and it is still there, because Float32 positions need bounding.
  for (const m of [10, 500, 40_000, 5_000_000]) {
    assert.ok(Number.isFinite(arenaRadiusFor(m)))
    assert.ok(arenaRadiusFor(m) > viewSpanFor(m) * 60, `the arena is only ${arenaRadiusFor(m) / viewSpanFor(m)} spans wide at mass ${m}`)
  }
})

/**
 * "when you get big the game seems to slow down ... It seems like maybe the
 *  scale of the world just changes such that it feels like I'm moving extremely
 *  slowly ... it could stay a little faster feeling when floating around"
 *
 * He was right about the cause and it was worth measuring before touching
 * anything, because two duller explanations had to die first.
 *
 *   * NOT the framerate. Mid tier, one seed, a twenty-minute run: the sim cost
 *     0.030 ms a frame at mass 36 and 0.030 ms a frame at mass 47,301, with no
 *     trend anywhere in between. It cannot move — the mote and rival budgets are
 *     hard caps (360 and 26) that are not functions of mass, and the field at
 *     twenty minutes carried 94 motes against the opening field's 83.
 *   * NOT a damping term. There is no speed-versus-mass penalty in the sim at
 *     all; world speed RISES with mass, 403 u/s to 2,456 u/s across that run.
 *
 * It was the third thing: `viewSpanFor` widened 6.4x while speed rose 4.7x, so
 * the ratio — the only quantity a player can actually perceive — fell from 1.03
 * screen-widths a second to 0.23. Nothing in the file owned that number, so it
 * was whatever the two curves happened to leave behind.
 *
 * It is owned now, and this is the assertion on it. The property is a BAND, not
 * a constant: growing must still slow you down, because that is where the sense
 * of scale comes from. It may no longer slow you down without limit.
 */
test("apparent speed is a designed band, and the opening is not in it", () => {
  const masses: number[] = []
  for (let m = 10; m <= 1_000_000; m *= 1.3) masses.push(Math.round(m))

  let lo = Infinity
  let hi = 0
  let loAt = 0
  for (const m of masses) {
    const apparent = traversalSpeedFor(m) / viewSpanFor(m)
    if (apparent < lo) {
      lo = apparent
      loAt = m
    }
    hi = Math.max(hi, apparent)
  }

  // The floor is the whole fix: at a million mass the old curve crossed the
  // glass at 0.037 screen-heights a second, which is the founder's "extremely
  // slowly" and is 13x slower than the opening.
  // The number is written out here rather than read from `APPARENT_FLOOR`, and
  // that is not a style choice: the first cut of this test asserted against the
  // constant, so setting the constant to zero — deleting the entire fix — moved
  // the goalposts with it and the assertion passed. A design decision has to be
  // pinned somewhere the code cannot reach.
  assert.ok(
    lo >= 0.24 - 1e-9,
    `the slowest the arena ever feels is ${lo.toFixed(4)} screen-heights/s at mass ${loAt}, under the 0.24 floor the design chose`,
  )
  // …and the ceiling is the opening, untouched. A "fix" that made the whole
  // game faster would pass the floor and fail the founder, who likes the
  // opening: "Arena is pretty good."
  assert.ok(hi <= 0.49, `the arena now peaks at ${hi.toFixed(4)} screen-heights/s; the opening was 0.4835`)
  assert.ok(hi / lo <= 2.05, `apparent speed still swings ${(hi / lo).toFixed(2)}x across a run; it used to swing 13x`)

  // Growing is still a real cost — this is a floor, not a flattening.
  const openApparent = traversalSpeedFor(10) / viewSpanFor(10)
  const grownApparent = traversalSpeedFor(1000) / viewSpanFor(1000)
  assert.ok(
    openApparent > grownApparent,
    `growing to mass 1,000 cost nothing: ${openApparent.toFixed(4)} -> ${grownApparent.toFixed(4)} screen-heights/s`,
  )

  // Bigger is never slower in WORLD units. Agar's law lives on `agility`, and a
  // floor that ran downhill anywhere would be a floor applied to the wrong term.
  for (let i = 1; i < masses.length; i++) {
    const a = traversalSpeedFor(masses[i - 1] as number)
    const b = traversalSpeedFor(masses[i] as number)
    assert.ok(b >= a, `speed fell from ${a.toFixed(1)} to ${b.toFixed(1)} between mass ${masses[i - 1]} and ${masses[i]}`)
  }

  // Below the crossover nothing changed at all, to the bit. The opening was
  // tuned by hand and is not what he complained about.
  for (const m of [10, 30, 100, 300, 1000, 2000]) {
    assert.equal(speedScaleFor(m), 1, `the scale engaged at mass ${m}, inside the opening`)
    assert.equal(traversalSpeedFor(m), baseSpeedFor(m), `travel speed moved at mass ${m}, inside the opening`)
  }

  assert.equal(APPARENT_FLOOR, 0.24, "the floor moved; if that was deliberate, the numbers in this file move with it")
})

/**
 * The same property, measured off the simulation rather than off the formula.
 *
 * A test that only calls `traversalSpeedFor` is a test that passes with the fix
 * deleted from `stepPlayer`, which is exactly the failure mode this file has
 * shipped before. So this one swims: it pins a mass, points the core at a
 * horizon five million units away, waits out the turn lag, and measures how much
 * of the SCREEN the next two seconds actually bought.
 */
test("a child at any size crosses the glass at a rate the design chose", () => {
  const swum = (mass: number, seed: number): number => {
    const world = new World(createStubHost({ seed }), specFor("mid"), seed * 13)
    world.mass = mass
    world.bestMass = mass
    world.massVis = mass
    // Mass is re-pinned every frame: this measures travel, and a swallow or a
    // sting mid-sample would be measuring the economy instead.
    const aim = (): void => {
      world.mass = mass
      world.aimX = world.px + 5_000_000
      world.aimY = world.py
    }
    for (let f = 0; f < 180; f++) {
      aim()
      world.step(1 / 60)
    }
    let travelled = 0
    for (let f = 0; f < 120; f++) {
      aim()
      const x0 = world.px
      const y0 = world.py
      world.step(1 / 60)
      travelled += Math.hypot(world.px - x0, world.py - y0)
    }
    return travelled / 2 / viewSpanFor(mass)
  }

  // Measured before this pass, same harness: 0.484 / 0.368 / 0.248 / 0.147 /
  // 0.073 / 0.037. The last three are the complaint.
  for (const seed of [3, 21]) {
    for (const mass of [5_000, 20_000, 100_000, 400_000]) {
      const apparent = swum(mass, seed)
      // 0.228 is the 0.24 floor with 5% of slack for the turn lag and for
      // Float32 position resolution out at the far coordinates. Written out,
      // not read from the constant — see the note in the test above.
      assert.ok(
        apparent >= 0.228,
        `at mass ${mass} a child actually swims ${apparent.toFixed(4)} screen-heights a second, under the 0.24 the design chose`,
      )
      assert.ok(apparent <= 0.49, `at mass ${mass} a child swims ${apparent.toFixed(4)} screen-heights a second — faster than the opening`)
    }
  }

  // And the opening still swims at the number the previous pass tuned it to.
  assert.ok(Math.abs(swum(10, 3) - 0.4835) < 0.01, `the opening now swims at ${swum(10, 3).toFixed(4)}, not 0.4835`)
})

/**
 * The ribbon may never print a sum that is false.
 *
 * `Math.round(before)`, `Math.round(delta)` and `Math.round(after)` do not have
 * to agree — 10.4 + 4.4 = 14.8 rounds to "10 + 4 = 15" — so the ends are
 * rounded and the middle is derived from them. This is a maths product; there
 * is no acceptable rate of printing wrong arithmetic.
 */
test("the running equation is always true, and never fires for a change of nothing", () => {
  for (const seed of [1, 77, 4242]) {
    const world = new World(createStubHost({ seed }), specFor("mid"), seed * 7)
    let seq = world.eqSeq
    let lines = 0
    fly(world, 420, 0.6, seed, () => {
      if (world.eqSeq === seq) return
      seq = world.eqSeq
      lines++
      assert.equal(
        world.eqA + world.eqD,
        world.eqC,
        `the ribbon printed ${world.eqA} ${world.eqD < 0 ? "−" : "+"} ${Math.abs(world.eqD)} = ${world.eqC}`,
      )
      assert.ok(Number.isInteger(world.eqA) && Number.isInteger(world.eqD) && Number.isInteger(world.eqC))
      assert.notEqual(world.eqD, 0, "the ribbon printed a change of zero")
    })
    assert.ok(lines > 40, `only ${lines} equations in seven minutes — the ribbon is barely alive`)
  }
})

/**
 * The founder's sketch, run as arithmetic:
 *
 *     10 + 4 = 14
 *     14 + 10 = 24
 *     24 - 5 = 19
 *
 * Three swallows, three lines, and every term is the number that was drawn on
 * the thing the player touched. Before this pass the first line came out as
 * `10 + 1 = 11`, because absorption saturated and a `4` at mass 10 was worth
 * one; the third came out as `24 - 2 = 22`, because a void's damage was clamped
 * to 11% of mass while its label was not.
 *
 * Deterministic on purpose. The soak below covers the run; this covers the
 * sentence, and it is the one a child actually reads.
 */
test("the ribbon prints the founder's three lines, exactly", () => {
  const world = new World(createStubHost({ seed: 44 }), specFor("mid"), 1010)
  const swallow = (value: number, kind: number): void => {
    // One thing in the water, right next to the player, and nothing else.
    world.malive.fill(0)
    world.ralive.fill(0)
    world.mwall.fill(0)
    world.moteCount = 0
    world.rivalCount = 0
    world.stingGrace = 0
    world.mx[0] = world.px
    world.my[0] = world.py
    world.mvx[0] = 0
    world.mvy[0] = 0
    world.mval[0] = value
    world.mr[0] = radiusForValue(value)
    world.mkind[0] = kind
    world.mflip[0] = 1
    world.malive[0] = 1
    world.moteCount = 1
    const seq = world.eqSeq
    for (let f = 0; f < 12 && world.eqSeq === seq; f++) {
      world.aimX = world.px
      world.aimY = world.py
      world.step(1 / 60)
    }
    assert.notEqual(world.eqSeq, seq, `the ${value} was never touched`)
  }

  swallow(4, MK_FOOD)
  assert.deepEqual([world.eqA, world.eqD, world.eqC], [10, 4, 14], `got ${world.eqA} + ${world.eqD} = ${world.eqC}`)
  swallow(10, MK_FOOD)
  assert.deepEqual([world.eqA, world.eqD, world.eqC], [14, 10, 24], `got ${world.eqA} + ${world.eqD} = ${world.eqC}`)
  swallow(-5, MK_VOID)
  assert.deepEqual([world.eqA, world.eqD, world.eqC], [24, -5, 19], `got ${world.eqA} − ${-world.eqD} = ${world.eqC}`)
  assert.equal(world.mass, 19, `the ribbon says 19 and the simulation says ${world.mass}`)
})

/**
 * …and the same claim over a long seeded run, asserted line by line rather than
 * in shape: the ribbon's arithmetic must be IDENTICAL to the simulation's, not
 * merely plausible against it.
 *
 * Two things are checked on every single change:
 *
 *   * the printed answer is the player's actual number — `eqC` is `mass`,
 *     rounded, at the end of the frame that produced it, and `eqA + eqD` is
 *     `eqC` exactly; and
 *   * the printed CHANGE is the number that was drawn on the thing eaten. Each
 *     absorb event is paired back to the specific mote index it came from (by
 *     the position the event carries, which nothing rewrites once the mote is
 *     dead) and the gain is compared against that mote's own `mval`.
 *
 * The pairing is what makes this a test of the arithmetic rather than of the
 * bookkeeping. A saturating curve passes every internal-consistency check ever
 * written — `10 + 1 = 11` is a perfectly true sentence — and fails this.
 */
test("the ribbon's arithmetic is the simulation's arithmetic, line for line", () => {
  for (const seed of [1, 4242]) {
    const world = new World(createStubHost({ seed }), specFor("mid"), seed * 7)
    const preVal = new Int32Array(world.mval.length)
    const preAlive = new Uint8Array(world.malive.length)
    let seq = world.eqSeq
    let lines = 0
    let paired = 0
    let tBefore = 0

    fly(
      world,
      420,
      0.6,
      seed,
      () => {
        // Every numeral that left the water this frame, with the number it was
        // wearing when the frame began. `maintain` refills a freed slot inside
        // the same step, so "gone" has to mean reborn as well as dead.
        const consumed: number[] = []
        for (let i = 0; i < preAlive.length; i++) {
          if (!preAlive[i]) continue
          if (world.malive[i] && (world.mborn[i] as number) <= tBefore && world.mval[i] === preVal[i]) continue
          consumed.push(preVal[i] as number)
        }
        for (let e = 0; e < world.eventLen; e++) {
          const ev = world.events[e] as { kind: string; x: number; y: number; a: number }
          if (ev.kind !== "absorb") continue
          // Full coverage, one-to-one: the gain must be spent against a numeral
          // that actually left, and no two absorbs may claim the same one.
          const at = consumed.indexOf(ev.a)
          assert.ok(
            at >= 0,
            `the arena grew by ${ev.a} and nothing wearing ${ev.a} left the water: [${consumed.join(",")}]`,
          )
          consumed.splice(at, 1)
          paired++
          // …and where the slot was not recycled, pin the absorb to the exact
          // mote index by the position the event carries, which nothing
          // rewrites once the mote is dead.
          for (let i = 0; i < preAlive.length; i++) {
            if (!preAlive[i] || world.malive[i]) continue
            if (world.mx[i] !== ev.x || world.my[i] !== ev.y) continue
            assert.equal(
              ev.a,
              preVal[i],
              `the arena swallowed a numeral reading ${preVal[i]} and grew by ${ev.a}`,
            )
            break
          }
        }
        if (world.eqSeq === seq) return
        seq = world.eqSeq
        lines++
        assert.equal(
          world.eqA + world.eqD,
          world.eqC,
          `the ribbon printed ${world.eqA} ${world.eqD < 0 ? "−" : "+"} ${Math.abs(world.eqD)} = ${world.eqC}`,
        )
        assert.equal(
          world.eqC,
          Math.round(world.mass),
          `the ribbon answered ${world.eqC} while the player's own number was ${Math.round(world.mass)}`,
        )
      },
      () => {
        preVal.set(world.mval)
        preAlive.set(world.malive)
        tBefore = world.time
      },
    )

    assert.ok(lines > 200, `only ${lines} equations in seven minutes — the ribbon is barely alive`)
    assert.ok(paired > 300, `only ${paired} absorbs were traced back to a numeral — the pairing proved nothing`)
  }
})

/**
 * THE WALL RULE, which is what pays for exact absorption.
 *
 * A number born bigger than you is there to be read and avoided. It is not a
 * deposit that matures into a free doubling the moment you grow past it — and
 * with absorption exact, that is precisely what letting it flip would be. See
 * WALL_RATE in world.ts: measured with the walls left flippable, a struggling
 * run passed 100,000 inside the first minute.
 */
test("a wall is never food, and outgrowing one bursts it into crumbs", () => {
  const world = new World(createStubHost({ seed: 61 }), specFor("mid"), 3003)
  const place = (value: number, wall: number, dx: number): void => {
    world.malive.fill(0)
    world.mwall.fill(0)
    world.moteCount = 0
    world.mx[0] = world.px + dx
    world.my[0] = world.py
    world.mvx[0] = 0
    world.mvy[0] = 0
    world.mval[0] = value
    world.mr[0] = radiusForValue(value)
    world.mkind[0] = MK_FOOD
    world.mflip[0] = wall ? 0 : 1
    world.mwall[0] = wall
    world.malive[0] = 1
    world.moteCount = 1
  }
  const collide = (world as unknown as { collide(dt: number): void }).collide.bind(world)

  // Sitting inside the player, worth half of it, and it may not be eaten. This
  // is the guard in `collide`, exercised on its own: a wall can be outgrown
  // MID-FRAME, several absorbs deep, and reach the collision test edible.
  world.mass = 100
  world.ralive.fill(0)
  world.rivalCount = 0
  place(50, 1, 0)
  collide(1 / 60)
  // It may sting — it is still a wall, and touching one costs you — but it may
  // never PAY. Growing past a wall mid-frame is the one way one can reach the
  // collision test looking edible.
  assert.ok(world.mass <= 100, `a wall worth 50 was swallowed at mass 100 -> ${world.mass}`)

  // …and the same mote, not marked a wall, IS eaten for exactly its number.
  // Without this the assertion above passes for any reason at all.
  world.mass = 100
  world.stingGrace = 0
  place(50, 0, 0)
  collide(1 / 60)
  assert.equal(world.mass, 150, `an ordinary 50 at mass 100 was worth ${world.mass - 100}`)

  // Outgrow one and it comes apart: it is gone, it left crumbs on the food
  // scale, and it paid nothing.
  world.mass = 100
  place(50, 1, 400)
  const before = world.mass
  world.aimX = world.px
  world.aimY = world.py
  world.step(1 / 60)
  // Asserted on the whole field, not on slot 0: `maintain` tops the population
  // back up inside the same step and hands the freed slot straight out again.
  for (let i = 0; i < world.malive.length; i++) {
    assert.ok(
      !(world.malive[i] && world.mwall[i] && world.mval[i] === 50),
      "an outgrown wall is still sitting there",
    )
  }
  assert.equal(world.mass, before, `bursting a wall paid ${world.mass - before}`)
  let shards = 0
  let biggest = 0
  for (let i = 0; i < world.malive.length; i++) {
    if (!world.malive[i] || world.mkind[i] !== MK_SHED) continue
    shards++
    biggest = Math.max(biggest, world.mval[i] as number)
  }
  assert.ok(shards >= 4, `a burst wall left ${shards} crumbs`)
  assert.ok(biggest < 50 * 0.25, `a crumb of ${biggest} carries a quarter of the wall — the doubling came back`)
  assert.ok(
    world.events.slice(0, world.eventLen).some((e) => (e as { kind: string }).kind === "flip"),
    "the wall came apart in silence — the genre's best moment is not being played",
  )
})

/**
 * THE SPAWN TABLE, asserted directly rather than through a run.
 *
 * Every property here is load-bearing for exact absorption and every one of
 * them is a coin-flip away from being invisible in a seeded soak, so they are
 * read off `rollValue` itself, tens of thousands of draws at a time.
 *
 *   * a WALL is never below your mass — if it were it would be food, and food
 *     worth all of you is the exponential this whole pass exists to remove;
 *   * a PRIZE always is, or it is not a prize at all, just a wall that got
 *     rounded up by `tidyValue`;
 *   * a VOID never wears a number bigger than 11% of you, which is the mercy
 *     that used to live on the damage and now has to live on the label, because
 *     the label is what gets subtracted; and
 *   * the prize is RATIONED, and the ration falls with mass. That last one is
 *     the difference between a twenty-minute run finishing at 222,742 and at
 *     5,745,335.
 */
test("the spawn table cannot hand out a wall you can eat, or a void that outweighs its number", () => {
  const prizeFrac: Record<number, number> = {}
  // 43,910 and 43,960 are not decoration. `tidyValue` rounds past a thousand to
  // three significant figures, so at those masses the raw draw at the very edge
  // of each band rounds ACROSS the player's own mass — a wall down to 43,900
  // and a prize up to 44,000 — which is how a wall becomes edible and a prize
  // becomes a wall. Round masses like 40,000 land exactly on the step and hide
  // it. The draw count rises with mass because the prize ration falls with it,
  // and a band nobody drew from is a band nobody tested.
  for (const mass of [10, 40, 137, 1237, 43_910, 43_960]) {
    const draws = mass > 1000 ? 900_000 : 40_000
    const world = new World(createStubHost({ seed: 71 }), specFor("mid"), 9090)
    // The opening band carries no voids at all, so the run is nudged past it
    // first — otherwise the void assertions below are being skipped rather than
    // passed. The depth is a ratchet, so setting the mass afterwards keeps it.
    fly(world, 200, 0.5, 5)
    assert.ok(world.voidRate > 0, "the field still has no voids in it — the void assertions are vacuous")
    world.mass = mass
    const roll = (world as unknown as { rollValue(): { v: number; kind: number; wall: number } }).rollValue.bind(world)
    let voids = 0
    let walls = 0
    let prizes = 0
    let food = 0
    for (let n = 0; n < draws; n++) {
      const { v, kind, wall } = roll()
      if (kind === MK_VOID) {
        voids++
        assert.ok(v < 0, `a void wearing ${v} is not a loss`)
        // Stated as a bound, not re-derived from the constant: a test that
        // recomputes `Math.round(mass * VOID_MAX_FRACTION)` passes for every
        // value of VOID_MAX_FRACTION and pins nothing.
        assert.ok(
          -v <= Math.max(1, mass * 0.12),
          `a void wearing ${-v} at mass ${mass} takes ${((-v / mass) * 100).toFixed(0)}% in one touch`,
        )
        continue
      }
      if (wall) {
        walls++
        assert.ok(v >= mass, `a wall wearing ${v} is edible at mass ${mass}`)
        continue
      }
      assert.ok(v < mass, `an ordinary mote wearing ${v} is not edible at mass ${mass}`)
      // 0.85, not 0.5. The prize band is [0.90M, M-1] and the mid band is
      // capped at 0.55M, so this discriminates the two whatever FOOD_A is —
      // at 0.5 it only worked because today's FOOD_A leaves the mid band far
      // below its own ceiling.
      if (v >= mass * 0.85) prizes++
      else food++
    }
    assert.ok(voids > 0 && walls > 0 && food > 0, `mass ${mass}: ${voids} voids, ${walls} walls, ${food} crumbs`)
    // The walls keep their full share at every size — the reading is the point
    // and it may not thin out with the economy.
    assert.ok(walls / draws > 0.09, `mass ${mass}: only ${walls} walls in ${draws} — the field has nothing to flee`)
    // …and the prize never does, at any size.
    assert.ok(prizes / draws <= 0.006, `mass ${mass}: ${prizes} free doublings in ${draws} draws`)
    assert.ok(prizes > 0, `mass ${mass}: not one prize in ${draws} draws — the prize assertions are vacuous`)
    prizeFrac[mass] = prizes / draws
  }

  // Rationed, and the ration FALLS — this is the anti-exponential, and it is
  // the only place it is stated as a property rather than as a measured run.
  assert.ok(
    (prizeFrac[43_910] as number) < (prizeFrac[137] as number) * 0.25,
    `the prize ration barely tapered: ${prizeFrac[137]} at mass 137, ${prizeFrac[43_910]} at 43,910`,
  )
  assert.ok(
    (prizeFrac[1237] as number) < (prizeFrac[10] as number) * 0.6,
    `the prize ration barely tapered: ${prizeFrac[10]} at mass 10, ${prizeFrac[1237]} at 1,237`,
  )
})

/**
 * A Resonance sphere is recycled from whatever mote happened to be nearest, and
 * that mote may well have been a wall. If the flag comes with it, `stepMotes`
 * sees a wall it has outgrown and BURSTS the answer out of the water in front
 * of the child mid-question.
 */
test("a Resonance sphere is never still carrying a wall's flag", () => {
  const world = new World(createStubHost({ seed: 23 }), specFor("mid"), 8123)
  // Spheres are recycled through `freeMote`, which hands back a DEAD slot with
  // whatever it was last carrying. Waiting for a run to happen to seat a sphere
  // on a dead wall is waiting on a coin: every slot that is free at the moment
  // the beat opens is poisoned here instead, which is the same state the game
  // reaches on its own and reaches it every time.
  let opened = 0
  for (let f = 0; f < 60 * 300; f++) {
    world.aimX = world.px
    world.aimY = world.py
    const res = world.resonance
    if (!res.active) for (let i = 0; i < world.malive.length; i++) if (!world.malive[i]) world.mwall[i] = 1
    world.step(1 / 60)
    if (!res.active || res.phase < 1 || res.phase > 2) continue
    opened++
    for (let sl = 0; sl < 4; sl++) {
      const i = res.spheres[sl] as number
      assert.ok(i >= 0, "a Resonance opened without four spheres")
      // Aliveness is the assertion that matters: a sphere carrying the flag is
      // burst by `stepMotes` and the answer disappears out of the water in
      // front of the child. The flag alone would only be read in the frames
      // where the bug had not fired yet.
      assert.equal(world.malive[i], 1, "an answer sphere vanished while the question was still open")
      assert.equal(world.mwall[i], 0, "an answer sphere is flagged as a wall — it can burst mid-question")
    }
  }
  assert.ok(opened > 60, `only ${opened} frames of open Resonance in five minutes — nothing was checked`)
})

/**
 * THE EXHAUST, and the hole this test exists to close.
 *
 * `surging` was never set to `true` anywhere in this file. Not in `fly`, not in
 * the twenty-minute soak, not in the kill-hunting bot — every regression this
 * suite has ever run flew a child who could not press the boost. So the largest
 * term in the whole economy was untested, and the moment absorption went exact
 * it became a mass printer: the trail used to lay down 26 motes a second worth
 * 3.5% of the player each, against a burn of 11% a second, and the only thing
 * that made that survivable was the saturation this pass deleted. Measured on
 * the branch before the fix, holding surge one second in five: 42,287 at one
 * minute, 28,074,058 at two, 4,268,470,964 at four, against 1,913 / 10,483 /
 * 51,909 on main.
 *
 * The exhaust is a ledger now — a fixed share of the mass actually taken off
 * you, and not one unit more — so the property is simple and total: **surging
 * may never pay.** Turn round and hoover up every crumb of your own trail and
 * you are still down on the deal.
 */
test("holding the surge always costs mass, even if you eat your own trail", () => {
  // Head straight back down the trail every other half-second, which is the
  // hoover: the exhaust is ejected backwards at 150 u/s into a pull field that
  // reaches 3.4 radii and pulls at up to 260, so turning round collects it.
  const hoover = (surgeDuty: number, seconds: number): World => {
    const world = new World(createStubHost({ seed: 33 }), specFor("mid"), 777)
    let seq = world.eqSeq
    for (let f = 0; f < 60 * seconds; f++) {
      const t = f / 60
      world.surging = (t % 1) < surgeDuty
      const back = Math.floor(t * 2) % 2 === 1
      const sp = Math.hypot(world.pvx, world.pvy) || 1
      world.aimX = world.px + (back ? -world.pvx / sp : world.pvx / sp) * 900 + Math.cos(t) * 40
      world.aimY = world.py + (back ? -world.pvy / sp : world.pvy / sp) * 900 + Math.sin(t) * 40
      world.step(1 / 60)
      assert.ok(Number.isFinite(world.mass), `mass went non-finite at frame ${f}`)
      // The ribbon has to survive the one thing that moves mass by a fraction
      // sixty times a second. `stepPlayer` burns before `collide` notes, so the
      // printed answer is still the player's number at the end of the frame —
      // asserted rather than assumed, because nothing else in this file ever
      // had the surge on.
      if (world.eqSeq !== seq) {
        seq = world.eqSeq
        assert.equal(world.eqA + world.eqD, world.eqC, "the ribbon printed a false sum under a surge")
        assert.equal(
          world.eqC,
          Math.round(world.mass),
          `the ribbon answered ${world.eqC} while the surging player's number was ${Math.round(world.mass)}`,
        )
      }
    }
    return world
  }

  // A player who never answers and never eats anything but their own exhaust
  // must go DOWN. This is the printer, stated as an assertion.
  const burned = hoover(1, 120)
  assert.ok(
    burned.mass < 10,
    `two minutes of held surge left the player at ${Math.round(burned.mass)} — the exhaust is paying for itself`,
  )
  assert.ok(burned.mass >= FLOOR_MASS, "…but it may never take a child below the floor")

  // …and the same at a realistic duty cycle, against the same player not
  // surging at all. Without this the assertion above passes for a game in which
  // nobody grows, and the bot above eats a little of the ordinary field too.
  const idle = hoover(0, 120)
  assert.ok(
    burned.mass < idle.mass,
    `surging the whole time (${Math.round(burned.mass)}) beat never surging (${Math.round(idle.mass)})`,
  )

  // The trail is real and it is on the field: a surge lays down numerals a
  // child can see and a rival can steal, which is the whole point of paying in
  // mass rather than in a bar.
  const world = new World(createStubHost({ seed: 34 }), specFor("mid"), 90210)
  world.mass = 4000
  let shed = 0
  for (let f = 0; f < 60; f++) {
    world.surging = true
    world.aimX = world.px + 2000
    world.aimY = world.py
    world.step(1 / 60)
    for (let e = 0; e < world.eventLen; e++) void world.events[e]
  }
  for (let i = 0; i < world.malive.length; i++) if (world.malive[i] && world.mkind[i] === MK_SHED) shed++
  assert.ok(shed >= 6, `a second of surge at mass 4,000 laid down only ${shed} numerals`)

  // The ledger, measured against the burn, in isolation. The field is wiped
  // every frame so that nothing but the exhaust can be MK_SHED and nothing but
  // the burn can move the player's mass; every free slot is poisoned with a
  // dead wall's flag, because `freeMote` hands those straight back and a crumb
  // that reads as a wall is burst by `stepMotes` the same frame — or, when the
  // burst queue is full, stings the player with their own exhaust.
  const solo = new World(createStubHost({ seed: 36 }), specFor("mid"), 61616)
  solo.mass = 20_000
  solo.ralive.fill(0)
  solo.rivalCount = 0
  const before = solo.mass
  let laid = 0
  let bursts = 0
  for (let f = 0; f < 240; f++) {
    for (let i = 0; i < solo.malive.length; i++) {
      solo.malive[i] = 0
      solo.mwall[i] = 1
    }
    solo.moteCount = 0
    solo.surging = true
    solo.aimX = solo.px + 60_000
    solo.aimY = solo.py
    solo.step(1 / 60)
    for (let e = 0; e < solo.eventLen; e++) if ((solo.events[e] as { kind: string }).kind === "flip") bursts++
    for (let i = 0; i < solo.malive.length; i++) {
      if (!solo.malive[i] || solo.mkind[i] !== MK_SHED) continue
      assert.equal(solo.mwall[i], 0, "a crumb of exhaust is flagged as a wall")
      laid += solo.mval[i] as number
    }
  }
  const burnt = before - solo.mass
  assert.equal(bursts, 0, `${bursts} crumbs of exhaust were burst as walls the frame they were laid`)
  assert.ok(laid > burnt * 0.2, `four seconds of surge burned ${Math.round(burnt)} and laid down only ${laid}`)
  assert.ok(
    laid < burnt * 0.85,
    `the trail (${laid}) is worth as much as the surge cost (${Math.round(burnt)}) — boosting is free`,
  )

  // Finally, an ordinary player who boosts: the ribbon must stay true through
  // the one thing that moves mass by a fraction sixty times a second, and the
  // climb must stay inside the same band a player who never boosts gets.
  const boosting = new World(createStubHost({ seed: 35 }), specFor("mid"), 5150)
  let seq = boosting.eqSeq
  let lines = 0
  fly(boosting, 300, 0.6, 12, () => {
    if (boosting.eqSeq === seq) return
    seq = boosting.eqSeq
    lines++
    assert.equal(boosting.eqA + boosting.eqD, boosting.eqC, "the ribbon printed a false sum under a surge")
    assert.equal(
      boosting.eqC,
      Math.round(boosting.mass),
      `the ribbon answered ${boosting.eqC} while the surging player's number was ${Math.round(boosting.mass)}`,
    )
  }, undefined, 0.4)
  assert.ok(lines > 150, `only ${lines} equations in five minutes of boosting — nothing was checked`)
  assert.ok(
    boosting.mass < 40_000,
    `five minutes of a boosting player reached ${Math.round(boosting.mass)} — the trail is paying for itself`,
  )
})

/**
 * A seeded run must be reproducible, and it very nearly stopped being.
 *
 * The controller is fed by how long an answer took, and the first cut fed it
 * `performance.now()` — the wall clock — which made the difficulty ladder, and
 * therefore the whole world, depend on how fast the machine was. `?seed=`
 * reproducing a run is the only way a playtest can be discussed.
 */
test("the same seed and the same inputs give the same run, on any machine", () => {
  const runOnce = (): number[] => {
    const world = new World(createStubHost({ seed: 3 }), specFor("mid"), 24601)
    const out: number[] = []
    fly(world, 240, 0.7, 42, (f) => {
      if ((f + 1) % (60 * 30) === 0) out.push(Math.round(world.mass * 1000), world.rung, Math.round(world.intensity * 1e6))
    })
    return out
  }
  assert.deepEqual(runOnce(), runOnce(), "two runs of the same seed diverged — something wall-clock is steering the world")
})

/**
 * Two properties of the ribbon that a full-run test cannot reach, so they are
 * exercised against `note` directly.
 *
 * Both were found by deleting the fix and watching NOTHING fail: a run simply
 * does not happen to produce a sub-rounding mass change often enough for a
 * seeded soak to catch one.
 */
test("the ribbon derives its middle term, and stays silent for a change of nothing", () => {
  const world = new World(createStubHost({ seed: 9 }), specFor("low"), 17)
  const note = (world as unknown as { note(before: number): void }).note.bind(world)

  // A change too small to round to anything is not arithmetic; it is noise, and
  // printing "1503 + 0 = 1503" sixty times a second buries every real line.
  world.mass = 100.4
  const quiet = world.eqSeq
  note(100.2)
  assert.equal(world.eqSeq, quiet, "the ribbon fired for a change that rounds to zero")

  // The middle term is DERIVED from the two rounded ends, never rounded on its
  // own. Rounding it independently is how "10 + 4 = 15" gets printed: here the
  // ends round to 90 and 100 while the true delta is 10.4, which rounds to 10 —
  // agreeing by luck — and the case below does not.
  world.mass = 652.6
  note(687.4)
  assert.equal(world.eqA, 687)
  assert.equal(world.eqC, 653)
  assert.equal(world.eqD, -34, "the delta was rounded on its own: 687 − 35 = 653 is not true")
  assert.equal(world.eqA + world.eqD, world.eqC)
  assert.equal(world.eqSeq, quiet + 1)
})

/**
 * The reveal: patience where it teaches, and nowhere else.
 *
 * At the bottom of the range a child who is not producing answers is still
 * absorbing numerals and the shape of an equation resolving, so the arena
 * finishes the sum for them and holds it. At the top, holding a player who
 * already knew it would be a punishment for being good.
 */
test("a missed answer is completed patiently at the floor and skipped at the ceiling", () => {
  const calm = new World(createStubHost({ seed: 15 }), specFor("mid"), 606)
  assert.ok(calm.revealSeconds > 3, `a fresh run gives only ${calm.revealSeconds.toFixed(1)}s of reveal`)

  const ace = new World(createStubHost({ seed: 15 }), specFor("mid"), 606)
  fly(ace, 420, 1, 4)
  assert.ok(ace.revealSeconds < 0.5, `a player in wizard mode is still held for ${ace.revealSeconds.toFixed(1)}s`)

  // …and the hold is real, not just a number: a miss at the floor keeps the
  // question on screen for meaningfully longer than a right answer does.
  const holdAfterMiss = (accuracy: number): number => {
    const w = new World(createStubHost({ seed: 15 }), specFor("mid"), 606)
    if (accuracy > 0) fly(w, 420, 1, 4)
    let held = -1
    let frames = 0
    const coin = new Rng(3)
    let pick = -1
    for (let f = 0; f < 60 * 400 && held < 0; f++) {
      const res = w.resonance
      if (res.active && res.phase === 2) {
        if (pick < 0) pick = (res.correctSlot + 1 + coin.int(0, 2)) % 4
        const i = res.spheres[pick] as number
        if (i >= 0 && w.malive[i]) {
          w.aimX = w.mx[i] as number
          w.aimY = w.my[i] as number
        }
      }
      w.step(1 / 60)
      if (w.resonance.phase === 3 && !w.resonance.wasCorrect) frames++
      else if (frames > 0) held = frames / 60
    }
    return held
  }
  const calmHold = holdAfterMiss(0)
  assert.ok(calmHold > 2.5, `the reveal at the floor lasted only ${calmHold.toFixed(1)}s`)
})

/**
 * THE LATENCY CONTRACT.
 *
 * Latency starts when the child can first READ AND ACT ON the question, and
 * ends at the moment they COMMIT. Nothing else belongs in it.
 *
 * This is not pedantry. The difficulty controller separates "already knew it"
 * from "worked it out" on response time alone, so anything that inflates the
 * number — an opening animation, a projectile's flight, a settle — is a
 * SYSTEMATIC error, not a noisy one. It never averages out, it looks like a
 * plausible number, and its effect is to quietly refuse to promote the children
 * who answered fastest. A sibling game was found reporting 2-3 seconds of
 * boulder flight time as though it were thinking time.
 *
 * ARENA had two contaminants, both smaller and both real:
 *
 *   * a 0.55 s phase-1 ramp during which `resolveResonance` refuses to register
 *     anything and the prompt is still fading up, and
 *   * the traversal to a sphere, which is genuinely part of the act and so stays
 *     in the reported number, but is not deliberation and so comes out of the
 *     steering signal.
 */
test("thinking time excludes the opening ramp and the swim to the answer", () => {
  const world = new World(createStubHost({ seed: 19 }), specFor("mid"), 4004)
  const res = world.resonance

  // Open one, and hold still through the whole ramp.
  let opened = -1
  for (let f = 0; f < 60 * 120 && !res.active; f++) {
    world.aimX = world.px
    world.aimY = world.py
    world.step(1 / 60)
    if (res.active) opened = world.time
  }
  assert.ok(opened > 0, "no Resonance ever opened")
  assert.equal(res.phase, 1)

  // The clock must NOT be running during the ramp.
  const stampAtOpen = res.openedT
  while (res.phase === 1) {
    world.aimX = world.px
    world.aimY = world.py
    world.step(1 / 60)
  }
  assert.ok(
    res.openedT > stampAtOpen,
    "the clock started at the moment the beat opened — 0.55s of animation a child cannot answer inside is being charged to them",
  )
  assert.ok(
    Math.abs(res.openedT - world.time) < 0.02,
    `the clock started ${(world.time - res.openedT).toFixed(2)}s from the moment the question became answerable`,
  )

  // The traversal floor is real, matches how `stepPlayer` actually moves, and
  // is what the controller subtracts.
  assert.ok(res.reachSeconds > 0.3, `the swim to an answer was costed at ${res.reachSeconds}s`)
  assert.ok(res.reachSeconds <= 1.4, `the swim was costed at ${res.reachSeconds}s — that is more than the traversal floor allows`)
  assert.ok(
    res.reachSeconds <= res.ringR / world.playerSpeed + 1e-6,
    "the costed swim is longer than swimming it at the player's own speed would take",
  )

  // A child who answers the instant they can must be seen as instant. Swim
  // straight at the correct sphere and check the controller was not handed
  // something that looks laboured.
  const i = res.spheres[res.correctSlot] as number
  const t0 = world.time
  for (let f = 0; f < 60 * 30 && res.phase === 2; f++) {
    world.aimX = world.mx[i] as number
    world.aimY = world.my[i] as number
    world.step(1 / 60)
  }
  const wall = world.time - t0
  assert.ok(wall > 0, "the sphere was never reached")
  // Asserted on what the controller was HANDED, not on a subtraction this test
  // performs itself — a test that redoes the arithmetic passes when the
  // arithmetic is deleted from the simulation.
  assert.ok(
    res.thinkSeconds < 1,
    `answering as fast as the game physically allows was scored as ${res.thinkSeconds.toFixed(2)}s of thinking`,
  )
  assert.ok(
    res.thinkSeconds < wall - 0.2,
    `the swim to the answer (${res.reachSeconds.toFixed(2)}s of a ${wall.toFixed(2)}s answer) is being charged as deliberation`,
  )
  // …and the host still gets the honest observable, ramp excluded but swim
  // included, because swimming there is what the child did.
  assert.ok(res.answerMs >= 0 && Number.isFinite(res.answerMs))
})
