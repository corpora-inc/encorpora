import { test } from "node:test"
import assert from "node:assert/strict"
import { absorbGain, devourGain, radiusForValue, viewSpanFor, arenaRadiusFor, World, FLOOR_MASS } from "./world.ts"
import { Rng } from "../core/rng.ts"
import { DEPTHS, depthFor, overdrive } from "./depths.ts"
import { specFor } from "../core/tier.ts"
import { createStubHost } from "../host/stubHost.ts"
import type { Host, Question } from "../contract.ts"

test("absorption saturates, and saturates harder as you grow", () => {
  for (const mass of [10, 60, 500, 4000, 90000, 3_000_000]) {
    let peak = 0
    for (let v = 1; v <= mass; v = Math.max(v + 1, Math.round(v * 1.05))) {
      const g = absorbGain(v, mass)
      assert.ok(g >= 1, "a swallow always gives at least one")
      assert.ok(Number.isInteger(g))
      assert.ok(g <= v + 1, `gain ${g} exceeded the mote's own value ${v}`)
      peak = Math.max(peak, g)
    }
    // mass/(1+K) with K = 6, plus a rounding unit.
    assert.ok(peak <= mass / 7 + 1, `peak gain ${peak} broke the cap at mass ${mass}`)
  }

  // The early game must stay explosive: below the soft point the curve is
  // within a few per cent of the flat-K one it replaced.
  //
  // This assertion used to read `absorbGain(10, 10) >= 10 / 7 * 0.92` and could
  // never have passed, against either curve. `absorbGain` returns an INTEGER,
  // and at the smallest mass in the game the rounding quantum is the whole
  // quantity under test: the flat-K curve it names as its reference is
  // round(10 / 7) = 1, not 1.43, so it was comparing a rounded number against
  // an unrounded target and failing on the rounding rather than on the nerf it
  // meant to catch. The property is real; it just has to be stated against the
  // reference put through the same rounding, over the mass range the claim
  // actually covers — the tens to low hundreds, which is the first two minutes.
  const flatK = (value: number, mass: number): number =>
    Math.max(1, Math.round(value / (1 + (6 * value) / Math.max(1, mass))))
  for (const m of [10, 20, 40, 80, 120]) {
    assert.ok(
      absorbGain(m, m) >= flatK(m, m) * 0.92,
      `the first minute was nerfed at mass ${m}: ${absorbGain(m, m)} vs ${flatK(m, m)}`,
    )
  }

  // …and the late game must stop being an exponential. A near-tie is a fixed
  // fraction of you only until it isn't; past that the fraction itself falls.
  const frac = (m: number): number => absorbGain(Math.round(m * 0.98), m) / m
  assert.ok(frac(1e4) < frac(1e2), "the near-tie fraction must fall with mass")
  assert.ok(frac(1e7) < frac(1e4) * 0.5, "…and keep falling, or a bot finds the exponential")
})

/**
 * The kill curve is deliberately mass-INVARIANT, unlike the mote curve, and the
 * asymmetry is asserted here rather than left to a comment. See DEVOUR_K in
 * world.ts: the near-tie mote is a manufactured, continuous supply and the
 * rival is not, so the sqrt(mass) tightening belongs on one and not the other.
 */
test("devouring a rival is generous but still bounded", () => {
  for (const mass of [10, 500, 90000]) {
    const equal = devourGain(mass, mass)
    assert.ok(equal > mass * 0.22, "eating your own size should feel enormous")
    assert.ok(equal <= mass * 0.32 + 1, "…but it may never approach a doubling")
    // Monotonic in the prey's size.
    let prev = 0
    for (let m = 1; m <= mass * 3; m = Math.max(m + 1, Math.round(m * 1.1))) {
      const g = devourGain(m, mass)
      assert.ok(g >= prev, "gain must never fall as prey grows")
      prev = g
    }
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
): void {
  const coin = new Rng(seed)
  let target = -1
  for (let f = 0; f < 60 * seconds; f++) {
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
  const world = new World(createStubHost({ seed: 4 }), specFor("mid"), 0xbeef)
  const at: Record<number, number> = {}
  const marks = [15, 30, 60, 120, 300]
  fly(world, 300, 0.3, 9, (f) => {
    const t = (f + 1) / 60
    for (const m of marks) if (Math.abs(t - m) < 1 / 120) at[m] = world.mass
  })

  assert.ok((at[15] as number) < 100, `mass was already ${Math.round(at[15] as number)} after fifteen seconds`)
  assert.ok((at[30] as number) < 200, `mass was already ${Math.round(at[30] as number)} after half a minute`)
  assert.ok((at[60] as number) < 600, `mass was already ${Math.round(at[60] as number)} after one minute`)
  // …and it must still be a climb, not a stall. A game where nothing grows is
  // not calmer, it is dead.
  assert.ok((at[300] as number) > (at[30] as number) * 3, "five minutes of play went nowhere")
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
