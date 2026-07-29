import { test } from "node:test"
import assert from "node:assert/strict"
import { absorbGain, devourGain, radiusForValue, viewSpanFor, arenaRadiusFor, World, FLOOR_MASS, MK_FOOD, MK_VOID, MK_SHED } from "./world.ts"
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
  for (let f = 0; f < 60 * 60 * 6; f++) {
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
  assert.ok(band >= 3, `six minutes must show more than a couple of depths, saw ${band + 1}`)
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

  // The specific round trip that would be silent: an answer past 2^31, which
  // an Int32Array wraps to a *different number* rather than to an error. The
  // stub host never emits one; a real curriculum eventually will.
  const big: string[] = ["8030000000", "8030000001", "8029999999", "8030000010"]
  const bigReports: { correct: boolean; answered: string }[] = []
  const bigHost: Host = {
    next: () => ({
      id: "big-1",
      prompt: "big",
      answer: big[0] as string,
      distractors: big.slice(1),
      domain: "compare",
      difficulty: 5,
    }),
    report: (r) => bigReports.push({ correct: r.correct, answered: r.answered }),
    haptic: () => {},
    prefersReducedMotion: () => false,
  }
  const bw = new World(bigHost, specFor("low"), 21)
  for (let f = 0; f < 60 * 60 * 2 && bigReports.length === 0; f++) {
    const res = bw.resonance
    if (res.active && res.phase === 2) {
      const i = res.spheres[res.correctSlot] as number
      if (i >= 0 && bw.malive[i]) {
        bw.aimX = bw.mx[i] as number
        bw.aimY = bw.my[i] as number
      }
    }
    bw.step(1 / 60)
  }
  assert.equal(bigReports.length, 1, "the big-number resonance never resolved")
  assert.equal((bigReports[0] as { correct: boolean }).correct, true)
  assert.equal(
    (bigReports[0] as { answered: string }).answered,
    "8030000000",
    "an answer past 2^31 came back as a different number — it went through the Int32Array",
  )
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
 * Time is MEASURED and REWARDED, never imposed.
 *
 *   "I like infinite time to think in most cases too ... we can usually
 *    measure, pace and reward, not cause anxiety"
 *
 * Two clocks used to run on every child regardless: a window that shrank with
 * the number of questions asked — `max(6.5, 10.5 - resonanceCount * 0.16)` —
 * and spheres that drifted away at a flat 22 units a second while you thought.
 */
test("a struggling player is never put on a clock, and a fast one is paid for being fast", () => {
  const world = new World(createStubHost({ seed: 8 }), specFor("mid"), 55)
  assert.ok(
    world.resonanceSeconds >= 24,
    `a fresh run gives only ${world.resonanceSeconds.toFixed(1)}s to think`,
  )
  assert.ok(
    world.sphereDrift * world.resonanceSeconds < 2,
    `the spheres drift ${(world.sphereDrift * world.resonanceSeconds).toFixed(1)} units over a whole window — the answer walks away from a child at the bottom of the ladder`,
  )

  // Struggle: the window gets LONGER, never shorter.
  const before = world.resonanceSeconds
  fly(world, 300, 0, 13)
  assert.ok(
    world.resonanceSeconds >= before - 1e-9,
    `five minutes of struggle SHRANK the window ${before.toFixed(1)} -> ${world.resonanceSeconds.toFixed(1)}`,
  )

  // Climb, and a real countdown appears — earned, not imposed.
  const ace = new World(createStubHost({ seed: 8 }), specFor("mid"), 55)
  fly(ace, 420, 1, 13)
  assert.ok(ace.resonanceSeconds < 14, `a mathlete was still given ${ace.resonanceSeconds.toFixed(1)}s`)
  assert.ok(ace.sphereDrift > 5, "…and the spheres never started moving")
  assert.ok(ace.intensity > world.intensity)
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
