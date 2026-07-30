// THE SHIP.
//
// > "the ship moves around too wildly too - at least on my android .. I'd like
// > the ship to be a little bit smoother and easier to control."
//
// "At least on my android" is the whole diagnosis. `render/scene.ts` says the
// arena's coordinate space *is* CSS pixel space, so the world is exactly as big
// as the viewport — and every speed in `arena.ts` was an absolute number of CSS
// pixels per second, tuned against a tablet. Measured on the shipped code:
//
//     phone landscape 800×360   top 597px/s = 0.68 of the world's diagonal a second
//     phone portrait  390×740   top 597px/s = 0.71 diagonals a second
//     tablet         1180×820   top 597px/s = 0.42 diagonals a second
//
// The same ship crossed 1.72× more screen per second on the phone than on the
// tablet it was tuned on. That is not tuning and it is not fixable by lowering a
// constant — lowering it would make the tablet sluggish. After: 0.300 diag/s on
// all three, exactly.
//
// And two frame-rate defects behind it, of the class `games/balance` found when a
// spring integrator reached −1.2×10²⁰⁴ at 20fps:
//
//     top speed        144fps 610px/s   60fps 597px/s   20fps 556px/s
//     coast            144fps 143px     60fps 137px     20fps 119px
//     shots that hit   144fps 80/80     60fps 80/80     20fps 71/80
//
// A ninth of every shot passed straight through the husk it was aimed at on a
// slow Android, because a shot travels 56px in a 50ms frame against a 58px-wide
// hit window and the arena was not substepped. "My shots don't hit" is not the
// child's aim.
//
// **Every assertion below has been verified to fail with the fix removed**, by
// putting the old constants and the single-step integrator back — see the report
// on the pull request for the exact failure messages.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import { Arena, HUSK_R, MOTE_R, SHIP_R, SHOT_R } from "../game/arena.ts"
import { createStubHost } from "../stubHost.ts"

/** The three screens this pack has to be the same game on. */
const SCREENS: Array<readonly [string, number, number]> = [
  ["phone landscape", 800, 360],
  ["phone portrait", 390, 740],
  ["tablet", 1180, 820],
]
/**
 * The rates the ship has to be the same ship at.
 *
 * 60/30/20 are the three anybody measures, and they are also the three where
 * `ceil(dt / 16.667)` lands on a substep of exactly 1/60s — so a merely
 * *substepped* integrator agrees perfectly at all three and is 2% fast at 45fps
 * and 4% fast on a 144Hz screen, which is every current flagship. The ship's
 * dynamics are solved in closed form rather than iterated, so the list can
 * include the awkward rates.
 */
const RATES = [144, 120, 90, 72, 60, 50, 45, 30, 24, 20]

type Spawn = { spawnAt(v: number, x: number, y: number, vx: number, vy: number): void }

/** An arena with nothing in it, so the ship is the only thing being measured. */
function bare(w: number, h: number, seed = 0x5417): Arena {
  const host = createStubHost({ seed, reducedMotion: true })
  const arena = new Arena(host, new Rng(seed), { width: w, height: h })
  arena.begin(0)
  arena.bodies.length = 0
  arena.shots.length = 0
  arena.resonator = null
  return arena
}

/**
 * Full deflection along the long axis from the near wall, so nothing bounces.
 *
 * Two seconds by default, which is fifteen time constants: the ship is at its
 * steady state to within a rounding error, so what comes back is the top speed
 * and not "how far along the ramp 600ms happened to get at this frame rate".
 */
function runUp(arena: Arena, w: number, h: number, fps: number, ms = 2000): number {
  const dt = 1000 / fps
  const alongX = w >= h
  arena.ship.x = alongX ? SHIP_R + 1 : w / 2
  arena.ship.y = alongX ? h / 2 : SHIP_R + 1
  arena.ship.vx = 0
  arena.ship.vy = 0
  arena.setMove(alongX ? 1 : 0, alongX ? 0 : 1)
  for (let t = 0; t < ms; t += dt) arena.step(dt)
  return Math.hypot(arena.ship.vx, arena.ship.vy)
}

test("the ship covers the same fraction of the screen on every screen", () => {
  // The Android bug. Not "the same number of pixels" — the same fraction, because
  // the world is the viewport and a fraction is what a thumb feels.
  const fractions = SCREENS.map(([name, w, h]) => {
    const diagonal = Math.hypot(w, h)
    const top = runUp(bare(w, h), w, h, 60)
    return { name, fraction: top / diagonal, top }
  })
  const lo = Math.min(...fractions.map((f) => f.fraction))
  const hi = Math.max(...fractions.map((f) => f.fraction))
  assert.ok(
    hi / lo < 1.05,
    `the ship crosses ${(hi / lo).toFixed(2)}× more screen per second on ` +
      `${fractions.find((f) => f.fraction === hi)?.name} than on ` +
      `${fractions.find((f) => f.fraction === lo)?.name}: ` +
      fractions.map((f) => `${f.name} ${f.fraction.toFixed(3)} diag/s`).join(", "),
  )
  // And the absolute speeds really do differ, or the test above proves nothing:
  // a ship that ignored the screen would pass it too.
  const tops = fractions.map((f) => Math.round(f.top))
  assert.notEqual(
    new Set(tops).size,
    1,
    `every screen got the same absolute speed ${tops.join("/")} — the scaling is not happening`,
  )
})

test("the ship behaves identically at every frame rate a device has", () => {
  // Solved rather than stepped, so this is exact agreement across ten rates from
  // 144fps down to 20 — not a tolerance, which is what makes it worth asserting.
  for (const [name, w, h] of SCREENS) {
    const tops = RATES.map((fps) => runUp(bare(w, h), w, h, fps))
    const lo = Math.min(...tops)
    const hi = Math.max(...tops)
    assert.ok(
      hi - lo < 0.01,
      `${name}: top speed was ${tops.map((t) => t.toFixed(3)).join(" / ")} at ` +
        `${RATES.join("/")}fps — the ship is faster on a fast phone`,
    )

    // And the same for the coast, which is the part a thumb feels most.
    const coasts = RATES.map((fps) => {
      const dt = 1000 / fps
      const arena = bare(w, h)
      const top = runUp(arena, w, h, fps)
      arena.ship.x = w / 2
      arena.ship.y = h / 2
      arena.ship.vx = w >= h ? top : 0
      arena.ship.vy = w >= h ? 0 : top
      arena.setMove(0, 0)
      const from = w >= h ? arena.ship.x : arena.ship.y
      for (let t = 0; t < 2000; t += dt) arena.step(dt)
      return Math.abs((w >= h ? arena.ship.x : arena.ship.y) - from)
    })
    assert.ok(
      Math.max(...coasts) - Math.min(...coasts) < 0.05,
      `${name}: the coast was ${coasts.map((c) => c.toFixed(2)).join(" / ")}px at ${RATES.join("/")}fps`,
    )
  }
})

test("the ship can stop on a mote instead of only passing over one", () => {
  // What "moves around too wildly" is, mechanically. The coast was 126px against
  // a 32px sweep reach — four sweeps' worth of overshoot, so a child could never
  // arrive at a mote, only fly past it and come back.
  const reach = SHIP_R + MOTE_R
  for (const [name, w, h] of SCREENS) {
    const arena = bare(w, h)
    assert.ok(
      arena.shipCoast < reach * 2,
      `${name}: the ship carries ${arena.shipCoast.toFixed(0)}px after the thumb comes off, ` +
        `against a ${reach}px sweep reach`,
    )
    // And it is not so tight that the ship cannot cross its own arena: a coast
    // shorter than the ship's own radius would be a brick.
    assert.ok(arena.shipCoast > SHIP_R, `${name}: the ship stops dead in ${arena.shipCoast}px`)
  }
})

test("a shot hits the husk it was aimed at, at every frame rate", () => {
  // The tunnelling. A shot's step at 20fps is 56px against a 58px window, so it
  // stepped over its target about a ninth of the time; substepping closes it.
  const window = (SHOT_R + HUSK_R) * 2
  for (const [name, w, h] of SCREENS) {
    for (const fps of RATES) {
      const dt = 1000 / fps
      let cracked = 0
      const runs = 60
      for (let k = 0; k < runs; k++) {
        const arena = bare(w, h, 0x5417 + k)
        const alongX = w >= h
        const top = runUp(arena, w, h, fps, 500)
        void top
        const here = alongX ? arena.ship.x : arena.ship.y
        const long = alongX ? w : h
        // A husk a little further away each run, so a phase that happens to line
        // up cannot carry the result.
        const gap = Math.min(long - here - 60, 180 + (k / runs) * 200)
        assert.ok(gap >= 80, `${name}: no room to fire in — the run-up ate the arena`)
        ;(arena as unknown as Spawn).spawnAt(
          72,
          alongX ? here + gap : w / 2,
          alongX ? h / 2 : here + gap,
          0,
          0,
        )
        arena.setAim(alongX ? 1 : 0, alongX ? 0 : 1)
        const before = arena.bodies.length
        arena.fire()
        arena.setMove(0, 0)
        for (let t = 0; t < 1600; t += dt) arena.step(dt)
        if (arena.bodies.length !== before) cracked += 1
      }
      assert.equal(
        cracked,
        runs,
        `${name} at ${fps}fps: ${runs - cracked} of ${runs} shots passed through the husk ` +
          `(a ${window}px window)`,
      )
    }
  }
})

test("a mote in the ship's path is swept and not flown over", () => {
  for (const [name, w, h] of SCREENS) {
    for (const fps of RATES) {
      const dt = 1000 / fps
      let swept = 0
      const runs = 40
      for (let k = 0; k < runs; k++) {
        const arena = bare(w, h, 0x9107 + k)
        const alongX = w >= h
        const top = runUp(arena, w, h, fps, 500)
        const here = alongX ? arena.ship.x : arena.ship.y
        const gap = 110 + (k / runs) * (top / fps)
        ;(arena as unknown as Spawn).spawnAt(
          5,
          alongX ? here + gap : w / 2,
          alongX ? h / 2 : here + gap,
          0,
          0,
        )
        const limit = (alongX ? w : h) - SHIP_R - 2
        for (let t = 0; t < 1500 && (alongX ? arena.ship.x : arena.ship.y) < limit; t += dt) {
          arena.step(dt)
        }
        if (arena.bank.size > 0) swept += 1
      }
      assert.equal(swept, runs, `${name} at ${fps}fps: ${runs - swept} of ${runs} motes flown over`)
    }
  }
})

test("nothing that is not a number can reach the ship's position", () => {
  // Three doors, and none of them was guarded. `move` is multiplied into the
  // ship's velocity every substep, so one NaN puts the ship beyond recovery for
  // the rest of the session: `dist2` returns NaN, every `<` against it is false,
  // and nothing can be swept or struck again. Silent, total and unreported.
  const said: unknown[][] = []
  const realError = console.error
  console.error = (...args: unknown[]) => said.push(args)
  try {
    const arena = bare(900, 700)
    const x0 = arena.ship.x
    arena.setMove(Number.NaN, 0)
    arena.setMove(0, Number.POSITIVE_INFINITY)
    arena.setAim(Number.NaN, Number.NaN)
    arena.step(Number.NaN)
    arena.step(16)
    arena.resize(Number.NaN, 700)
    assert.ok(Number.isFinite(arena.ship.x), `the ship's x became ${arena.ship.x}`)
    assert.ok(Number.isFinite(arena.ship.y), `the ship's y became ${arena.ship.y}`)
    assert.ok(Number.isFinite(arena.ship.vx) && Number.isFinite(arena.ship.vy))
    assert.equal(arena.ship.x, x0, "a NaN stick moved the ship")
    assert.ok(Number.isFinite(arena.aiming.x) && Number.isFinite(arena.aiming.y))
    assert.equal(arena.bounds.width, 900, "a NaN resize took the arena's box with it")
    // And it was loud about every one of them. Silence is the actual defect here.
    assert.equal(said.length, 5, `${said.length} of 5 bad inputs were reported`)
  } finally {
    console.error = realError
  }
})

test("the hull turns toward the guns rather than snapping to them", () => {
  // Pure calm, and the reason it is `facing` and not `aiming`: the shots leave
  // along `aiming` on the frame the stick moved, so nothing about this makes the
  // ship point anywhere its bullets are not going.
  const arena = bare(900, 700)
  arena.setAim(1, 0)
  arena.step(16)
  assert.ok(arena.facing.x > 0.99, "the hull did not settle on the direction it was given")
  arena.setAim(-1, 0)
  assert.equal(arena.aiming.x, -1, "the guns waited for the hull")
  arena.step(16)
  // One 16ms step at 18/s turns the hull a quarter of the way, so it is still
  // pointing most of the way forward. `> -1` would be satisfied by anything short
  // of a mathematically exact snap, which is not the claim.
  assert.ok(
    arena.facing.x > 0.5,
    `one frame took the hull from +1 to ${arena.facing.x.toFixed(3)}, which is a snap`,
  )
  // And it gets there — a hull that eased forever would be a hull that lies.
  for (let i = 0; i < 60; i++) arena.step(16)
  assert.ok(arena.facing.x < -0.99, `the hull stalled at ${arena.facing.x.toFixed(3)}`)
  assert.ok(
    Math.abs(Math.hypot(arena.facing.x, arena.facing.y) - 1) < 1e-6,
    "the hull's direction stopped being a direction",
  )
})

test("the arena still slows a frame that arrives after a minute", () => {
  // The substepping must not have replaced the clamp: a backgrounded tab hands
  // back a delta of minutes, and simulating all of it would tear the whole sheet
  // at once and teleport every husk.
  const arena = bare(900, 700)
  arena.setMove(1, 0)
  const x0 = arena.ship.x
  arena.step(120_000)
  const far = arena.ship.x - x0
  const other = bare(900, 700)
  other.setMove(1, 0)
  other.step(120)
  assert.ok(
    Math.abs(far - (other.ship.x - x0)) < 1,
    `a two-minute frame moved the ship ${far.toFixed(0)}px`,
  )
})
