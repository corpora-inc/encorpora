// THE GATE HAS NO CLOCK ON IT.
//
// CLAIM's revive gate ran on a flat `GATE_SECONDS = 7`, drawn as a draining
// ring, and that one budget had to pay for three unlike things: reading the
// prompt, computing the answer, and **driving the snake across the arena to the
// plate**. The third is motor work and it is not small — the founder's report
// was "we need almost infinite time ... especially since we need to run into
// it .. it's almost impossible".
//
// The first test in this file measures the drive on the running game, from a
// rail corner a child can genuinely die at, and then plays out the whole thing
// a child actually does: arrive, read, think, drive, hold. The rest pin the
// shape of the fix.
//
// Everything here goes through `tick()`/`hold()` — the same update, the same
// collision, the same claim rule, the same gate. There is no cheat seam and
// nothing here forces a phase: the revive gate is reached by dying, and the
// death is a real one (a stalled cut burning back to nothing).

import { test } from "node:test"
import assert from "node:assert/strict"

import { stubDom } from "./domstub.ts"

stubDom()

const { mount } = await import("../src/game/index.ts")
const { createStubHost } = await import("../src/stubHost.ts")
const { PLATE_ARM } = await import("../src/game/plates.ts")
const { ARENAS, makeGrid } = await import("../src/game/grid.ts")
const { levelAt } = await import("../src/game/levels.ts")
const { Renderer } = await import("../src/game/render.ts")
const { NO_LIMIT, gateBudget, readSeconds, worstTravelCells, worstTravelSeconds } = await import(
  "../src/game/gate.ts"
)

/** The ring the gate used to close after. Kept here only to measure against. */
const OLD_GATE_SECONDS = 7

/**
 * `docs/EXPERIENCE_DESIGN.md`, cadence targets: single-digit fact 2.8 s p50.
 * The **easiest** item this product will ever serve, at the **median** child.
 */
const EASIEST_ITEM_P50 = 2.8

type Report = { questionId: string; correct: boolean; ms: number; answered: string }
type P = { gx: number; gy: number; label: string; correct: boolean; charge: number }

type Game = { tick(dt: number): void; hold(x: number, y: number): void; stats(): Record<string, number | string> }

type Harness = {
  game: Game & { raw: Game }
  reports: Report[]
  unmount(): void
  /** Frames stepped so far, so a leg of a drive can be timed. */
  t: { frames: number }
}

function start(seed: string | number): Harness {
  const el = stubDom()
  const reports: Report[] = []
  const host = createStubHost({ total: 7200, seed, onReport: (r: Report) => reports.push(r) })
  const handle = mount(el as unknown as HTMLElement, host)
  const raw = (el as unknown as { __claim: Harness["game"] }).__claim
  // Every frame goes through here so a leg of a drive can be timed in frames
  // rather than in wall clock, which a test runner does not control.
  const t = { frames: 0 }
  const game = {
    raw,
    tick(dt: number) {
      t.frames++
      raw.tick(dt)
    },
    hold: (x: number, y: number) => raw.hold(x, y),
    stats: () => raw.stats(),
  }
  return { game, reports, unmount: handle.unmount, t }
}

/** The private state the assertions are about. Reading it is not driving it. */
function inner(h: Harness): Record<string, unknown> {
  return h.game.raw as unknown as Record<string, unknown>
}

function seconds(h: Harness, from: number): number {
  return (h.t.frames - from) / 60
}

function run(h: Harness, secs: number): void {
  for (let i = 0; i < Math.round(secs * 60); i++) h.game.tick(1 / 60)
}

function platesOf(h: Harness): P[] {
  return inner(h).plates as P[]
}

function playerAt(h: Harness): [number, number] {
  const g = inner(h)
  return [(g.cx as number) + 0.5, (g.cy as number) + 0.5]
}

/** Steer to a cell the way a thumb would: one axis, then the other. */
function driveTo(h: Harness, tx: number, ty: number): void {
  for (const axis of ["x", "y"] as const) {
    for (let i = 0; i < 900; i++) {
      const [px, py] = playerAt(h)
      const d = axis === "x" ? tx - px : ty - py
      if (Math.abs(d) < 0.75) break
      if (axis === "x") h.game.hold(Math.sign(d), 0)
      else h.game.hold(0, Math.sign(d))
      h.game.tick(1 / 60)
    }
  }
  h.game.hold(0, 0)
}

/**
 * Die, honestly, and land on the revive gate.
 *
 * Dip one cut off the rail and then let go of the stick. `updateFuse` waits out
 * `fuseGrace`, burns the stalled line back cell by cell, and calls `die("fuse")`
 * when there is nothing left of it. No forced phase, no injected death.
 */
function reviveGate(h: Harness): void {
  const g = inner(h)
  const grid = g.g as { w: number; h: number }
  run(h, 2) // the intro card

  // Walk along whichever rail the respawn landed on to a cell that is not a
  // corner, then step inward. Crossing the plane to get there would cut it, and
  // a full-height cut on level one clears the level — which opens the *vault*,
  // not the gate this function is named after.
  const onTopOrBottom = g.cy === 0 || g.cy === grid.h - 1
  if (onTopOrBottom) driveTo(h, Math.floor(grid.w / 2), g.cy as number)
  else driveTo(h, g.cx as number, Math.floor(grid.h / 2))
  const inward: [number, number] = onTopOrBottom
    ? [0, g.cy === 0 ? 1 : -1]
    : [g.cx === 0 ? 1 : -1, 0]

  h.game.hold(inward[0], inward[1])
  run(h, 0.5) // off the rail: the cut is open
  h.game.hold(0, 0)
  for (let i = 0; i < 60 * 25 && g.phase !== "gate"; i++) h.game.tick(1 / 60)
  assert.equal(g.phase, "gate", "the stalled cut never burnt back to a death")
  assert.equal(g.gateKind, "revive", "this must be the gate that death opens")
  assert.equal(platesOf(h).length, 3, "a revive gate must put three plates up")
}

/** Clear level one with straight rail-to-rail cuts, then sit through to the vault. */
function vaultGate(h: Harness): void {
  const g = inner(h)
  const grid = g.g as { w: number; h: number }
  run(h, 2)
  for (let pass = 0; pass < 40 && g.phase === "play"; pass++) {
    const x = 3 + pass * 3
    if (x > grid.w - 3) break
    driveTo(h, x, pass % 2 === 0 ? 0 : grid.h - 1)
    driveTo(h, x, pass % 2 === 0 ? grid.h - 1 : 0)
    run(h, 0.3)
  }
  for (let i = 0; i < 900 && g.phase !== "gate"; i++) h.game.tick(1 / 60)
  assert.equal(g.phase, "gate", "no vault ever opened")
  assert.equal(g.gateKind, "vault", "this must be the gate a clear opens")
}

/** The rail corner furthest from a plate — where a child who died there starts. */
function worstCorner(h: Harness, p: P): [number, number] {
  const grid = inner(h).g as { w: number; h: number }
  const corners: Array<[number, number]> = [
    [0, 0],
    [grid.w - 1, 0],
    [0, grid.h - 1],
    [grid.w - 1, grid.h - 1],
  ]
  return corners.sort(
    (a, b) =>
      Math.abs(p.gx - b[0]) + Math.abs(p.gy - b[1]) - (Math.abs(p.gx - a[0]) + Math.abs(p.gy - a[1])),
  )[0] as [number, number]
}

// ---------------------------------------------------------------------------
// The defect, measured on the running game.
// ---------------------------------------------------------------------------

test("seven seconds was mostly driving: a child who reads and then drives could not answer in it", () => {
  const h = start("gate-travel")
  reviveGate(h)

  const plates = platesOf(h)
  const want = plates.find((p) => p.correct)
  assert.ok(want, "one plate must be the answer")

  // Start where a child who died in the far corner starts.
  const [cx, cy] = worstCorner(h, want)
  driveTo(h, cx, cy)

  // Now read it. The prompt and three four-digit candidates, priced by this
  // product's own cadence table rather than by anything this test invented.
  const prompt = (inner(h).gateQ as { prompt: string }).prompt
  const think = readSeconds(
    prompt,
    plates.map((p) => p.label),
  )
  assert.ok(think > EASIEST_ITEM_P50, `the cadence table must price "${prompt}" above the easiest item`)
  run(h, think)

  // And only now drive to it, and hold it.
  const t0 = h.t.frames
  driveTo(h, want.gx, want.gy)
  run(h, PLATE_ARM + 0.4)
  const drive = seconds(h, t0)

  // The measurement. This is the number the seven-second ring was spending
  // before the child had read a single digit.
  assert.ok(
    drive + EASIEST_ITEM_P50 > OLD_GATE_SECONDS,
    `driving from the corner to the answer and holding it took ${drive.toFixed(2)}s of a ${OLD_GATE_SECONDS}s ring, ` +
      `leaving ${(OLD_GATE_SECONDS - drive).toFixed(2)}s to read a prompt and three candidates — ` +
      `the easiest item in the product has a ${EASIEST_ITEM_P50}s p50`,
  )

  // The behaviour. A child who read it properly still gets to answer.
  assert.equal(
    h.reports.length,
    1,
    `a child who read for ${think.toFixed(1)}s and then drove for ${drive.toFixed(2)}s must still be able to answer: ${JSON.stringify(h.reports)}`,
  )
  const r = h.reports[0] as Report
  assert.notEqual(
    r.answered,
    "",
    "a report with nothing answered on it is a ring that closed, not a child who chose",
  )
  assert.equal(r.correct, true, "and the answer they held is the answer that counted")
  assert.equal(r.answered, want.label, "exact in, exact out")
  // `ms` is `performance.now()`, i.e. wall clock, so a replay that steps 40
  // virtual seconds in 150 real ones cannot assert a duration on it. What it
  // can assert is that thinking was free: the life comes back.
  assert.equal(Number(h.game.stats().lives), 3, "the life the death cost comes back")
  h.unmount()
})

// ---------------------------------------------------------------------------
// What replaced it.
// ---------------------------------------------------------------------------

test("the revive gate never closes on its own, however long the child takes", () => {
  const h = start("gate-forever")
  reviveGate(h)
  const g = inner(h)
  const lives = Number(h.game.stats().lives)

  // Three minutes of frames with the stick untouched. A child reading, or
  // counting on their fingers, or being asked to come to dinner.
  run(h, 180)

  assert.equal(g.phase, "gate", "the gate closed while the child was still thinking")
  assert.deepEqual(h.reports, [], "a slow child is not a wrong child")
  assert.equal(platesOf(h).length, 3, "the answers must still be on the board")
  assert.equal(Number(h.game.stats().lives), lives, "and it cost nothing to think")
  assert.equal(g.gateLeft, NO_LIMIT, "the revive gate carries no budget at all")

  // And it is still answerable at the end of it.
  const want = platesOf(h).find((p) => p.correct)
  assert.ok(want)
  driveTo(h, want.gx, want.gy)
  run(h, PLATE_ARM + 0.4)
  assert.equal(h.reports.length, 1, `answering after three minutes must work: ${JSON.stringify(h.reports)}`)
  assert.equal((h.reports[0] as Report).correct, true)
  assert.equal(Number(h.game.stats().lives), lives + 1, "the life comes back")
  h.unmount()
})

test("the vault's guard measures abandonment, not thought", () => {
  // `report.test.ts`'s replay seed: level one is clearable by the straight-cut
  // routine without the drifter ever reaching the line.
  const h = start("both")
  vaultGate(h)
  const g = inner(h)
  const guard = g.gateGuard as number

  assert.ok(
    guard > OLD_GATE_SECONDS * 2,
    `the vault guard is ${guard.toFixed(1)}s, which is not meaningfully more than the ${OLD_GATE_SECONDS}s ring it replaced`,
  )

  // Well past the old ring, doing nothing.
  run(h, OLD_GATE_SECONDS * 2)
  assert.equal(g.phase, "gate", "the vault closed inside twice the old ring")

  // A child fiddling with the stick every few seconds keeps it open forever.
  // `gateKind` is checked too: without the refill this vault lapses mid-loop
  // and the run carries on until something kills the player, and a *revive*
  // gate standing open would otherwise read as a vault that never closed.
  for (let i = 0; i < 24; i++) {
    h.game.hold(1, 0)
    run(h, 0.1)
    h.game.hold(0, 0)
    run(h, 5)
    assert.equal(g.gateKind, "vault", `steering must put the whole budget back (nudge ${i})`)
    assert.equal(g.phase, "gate", `steering must put the whole budget back (nudge ${i})`)
  }
  assert.deepEqual(h.reports, [], "and none of that is an answer")

  // Genuinely walk away, though, and the ladder still moves — with nothing
  // posted to the host, because nobody chose a plate.
  const level = Number(h.game.stats().level)
  run(h, guard + 2)
  assert.notEqual(g.phase, "gate", `an abandoned vault must lapse after ${guard.toFixed(1)}s`)
  assert.deepEqual(h.reports, [], "not answering is still not answering wrong")
  assert.ok(Number(h.game.stats().level) > level, "and the next level starts")
  h.unmount()
})

// ---------------------------------------------------------------------------
// The ring.
// ---------------------------------------------------------------------------

/** A canvas context that remembers the arcs drawn through it. */
function recorder(): { ctx: unknown; arcs: Array<{ r: number; sweep: number; width: number }> } {
  const arcs: Array<{ r: number; sweep: number; width: number }> = []
  const state: Record<string, unknown> = { lineWidth: 0 }
  const ctx = new Proxy(state, {
    get(t, k) {
      if (k === "arc")
        return (_x: number, _y: number, r: number, a0: number, a1: number) =>
          arcs.push({ r, sweep: a1 - a0, width: t.lineWidth as number })
      if (k in t) return t[k as string]
      return () => undefined
    },
    set(t, k, v) {
      t[k as string] = v
      return true
    },
  })
  return { ctx, arcs }
}

function halo(hold: number, time: number): Array<{ r: number; sweep: number; width: number }> {
  const { ctx, arcs } = recorder()
  const draw = (Renderer.prototype as unknown as Record<string, (...a: unknown[]) => void>).drawGateHalo
  assert.equal(typeof draw, "function", "the gate must still draw something")
  draw.call({ ctx, w: 1000, h: 1000 }, hold, time, false)
  return arcs
}

test("the gate's ring is not a countdown — it answers to the child, not to a clock", () => {
  // A visible countdown is an anxiety cue even when it is generous, so when the
  // limit went the drain went with it. `drawGateRing(gateLeft / GATE_SECONDS)`
  // must not come back under any name.
  assert.equal(
    (Renderer.prototype as unknown as Record<string, unknown>).drawGateRing,
    undefined,
    "the draining countdown ring is back",
  )

  // Nobody on a plate: one full circle, and it is the same circle a minute
  // later. Nothing anywhere in it counts down.
  const idle0 = halo(0, 0)
  const idle60 = halo(0, 60)
  assert.equal(idle0.length, 1, "an idle gate draws exactly one ring")
  assert.equal(idle60.length, 1)
  assert.ok(Math.abs(idle0[0]!.sweep - Math.PI * 2) < 1e-9, "and it is closed, not a fraction")
  assert.equal(idle0[0]!.sweep, idle60[0]!.sweep, "a minute of thinking must take nothing off the ring")

  // Standing on a plate: a second, heavier arc that grows with the hold.
  const half = halo(0.5, 0)
  const full = halo(1, 0)
  assert.equal(half.length, 2, "committing to a plate must show at the edge of vision too")
  assert.ok(Math.abs(half[1]!.sweep - Math.PI) < 1e-9, "half held is half closed")
  assert.ok(Math.abs(full[1]!.sweep - Math.PI * 2) < 1e-9, "held is closed")
  assert.ok(full[1]!.width > half[1]!.width, "and it thickens as you commit")
  assert.ok(full[0]!.r < idle0[0]!.r, "the ring tightens on the arena as the answer lands")
})

// ---------------------------------------------------------------------------
// The numbers, on every arena the game can be played on.
// ---------------------------------------------------------------------------

test("the drive to a plate is a real cost on every arena, at every level", () => {
  const rows: string[] = []
  for (const a of ARENAS) {
    const g = makeGrid(a)
    for (const i of [1, 5, 9, 20, 40]) {
      const lv = levelAt(i)
      const drive = worstTravelSeconds(g.w, g.h, lv.railSpeed)
      rows.push(`${g.w}x${g.h} lvl${i} ${drive.toFixed(2)}s`)

      // The founder's report was "especially in the early stages". On the
      // hand-written ladder the drive alone spent so much of the ring that what
      // was left did not cover the median child on the easiest item in the
      // product — never mind the four-digit cell counts CLAIM actually asks.
      if (i <= 9) {
        assert.ok(
          drive + PLATE_ARM + EASIEST_ITEM_P50 > OLD_GATE_SECONDS,
          `${g.w}x${g.h} lvl${i}: ${drive.toFixed(2)}s of driving + ${PLATE_ARM}s of holding left ` +
            `${(OLD_GATE_SECONDS - drive - PLATE_ARM).toFixed(2)}s of a ${OLD_GATE_SECONDS}s ring to think in`,
        )
      }
      // And the rail never gets fast enough to make the drive small: even with
      // `railSpeed` at its 40 c/s ceiling it is over half the old ring.
      assert.ok(
        drive + PLATE_ARM > OLD_GATE_SECONDS / 2,
        `${g.w}x${g.h} lvl${i}: driving is only ${drive.toFixed(2)}s`,
      )
      assert.ok(
        gateBudget("vault", { prompt: "5/8 of 7200" }, ["4500", "3600", "5040"], g.w, g.h, lv.railSpeed) >
          drive + PLATE_ARM,
        `${g.w}x${g.h} lvl${i}: the vault guard must pay for the drive before it prices any thinking`,
      )
    }
  }
  assert.equal(worstTravelCells(62, 122), 141, `tall-phone worst drive changed: ${rows.join(" · ")}`)
})

test("the vault guard is derived from the item AND the drive, never a constant", () => {
  const item = { prompt: "47 + 25" }
  const labels = ["72", "62", "73"]
  const tall = { w: 62, h: 122 }

  // The drive half. A slower rail is a longer drive and must buy more time; a
  // bigger arena is a longer drive and must buy more time. A flat constant
  // cannot do either, which is exactly what `GATE_SECONDS = 7` was.
  const slowRail = gateBudget("vault", item, labels, tall.w, tall.h, levelAt(1).railSpeed)
  const fastRail = gateBudget("vault", item, labels, tall.w, tall.h, levelAt(40).railSpeed)
  assert.ok(slowRail > fastRail, `a ${levelAt(1).railSpeed} c/s rail got ${slowRail}s, a 40 c/s rail ${fastRail}s`)
  const small = gateBudget("vault", item, labels, 82, 92, levelAt(1).railSpeed)
  assert.ok(slowRail > small, `the 62x122 arena is a longer drive than 82x92 but got ${slowRail}s vs ${small}s`)

  // The item half. Harder maths, never less time.
  const hard = gateBudget(
    "vault",
    { prompt: "4001 − 2798" },
    ["1203", "1303", "1103"],
    tall.w,
    tall.h,
    levelAt(1).railSpeed,
  )
  assert.ok(hard > slowRail, `"4001 − 2798" got ${hard}s against "47 + 25"'s ${slowRail}s`)

  // And in no case is it anything like the ring it replaced.
  assert.ok(fastRail > OLD_GATE_SECONDS * 2, `the smallest guard the game can produce is ${fastRail}s`)
})

test("the revive gate has no budget to derive", () => {
  for (const a of ARENAS) {
    const g = makeGrid(a)
    assert.equal(
      gateBudget("revive", { prompt: "12 + 9" }, ["21", "11", "3"], g.w, g.h, levelAt(1).railSpeed),
      NO_LIMIT,
    )
  }
  assert.equal(NO_LIMIT - 1e9, NO_LIMIT, "subtracting a frame from it must not move it")
})

test("a harder item is never given less time than an easier one", () => {
  const three = ["100", "200", "300"]
  // More digits.
  let prev = 0
  for (const [prompt, labels] of [
    ["3 + 4", ["7", "8", "1"]],
    ["30 + 40", ["70", "80", "10"]],
    ["300 + 400", three],
    ["3000 + 4000", ["7000", "8000", "1000"]],
  ] as Array<[string, string[]]>) {
    const s = readSeconds(prompt, labels)
    assert.ok(s >= prev, `"${prompt}" got ${s}s, less than the narrower item's ${prev}s`)
    prev = s
  }
  // Regrouping.
  assert.ok(
    readSeconds("47 + 25", ["72", "62", "73"]) > readSeconds("42 + 25", ["67", "57", "68"]),
    "carrying must not be priced the same as not carrying",
  )
  // More candidates to scan.
  assert.ok(
    readSeconds("300 + 400", three) > readSeconds("300 + 400", ["700"]),
    "two extra numbers to read is time the child spends",
  )
  // A prompt the parser cannot read gets the longer allowance, never the shorter.
  assert.ok(
    readSeconds("5/8 of 7200", ["4500", "3600", "5040"]) >=
      readSeconds("4000 + 3200", ["7200", "7100", "6200"]),
    "an unparseable prompt must be guessed in the child's favour",
  )
})
