// WHAT THE GAME TELLS THE HOST.
//
// CLAIM had exactly one `host.report`, inside `finishGate`, and the only route
// to it was `die() -> openGate()`. **Every answer the game had ever reported was
// preceded by a crash.** A child who cleared level after level without dying was,
// to an adaptive controller reading that stream, a child who had answered
// nothing — and the sample it did get was drawn entirely from the moment a run
// fell apart.
//
// So this file plays the actual game, through the same `tick()`/`hold()` seam QA
// uses, on the smallest browser stub that will hold it up.

import { test } from "node:test"
import assert from "node:assert/strict"

import { stubDom } from "./domstub.ts"

stubDom()


const { mount } = await import("../src/game/index.ts")
const { createStubHost } = await import("../src/stubHost.ts")
const { PLATE_ARM, PLATE_SPOTS } = await import("../src/game/plates.ts")

/**
 * A stub-host seed whose level one can be cleared by the straight-cut routine at
 * the bottom of this file without the drifter ever catching the line.
 *
 * The game is deterministic given the host's question stream (`startLevel`
 * re-seeds from the first question id), so this is a *replay*, not a fixture —
 * change the arena, the hunter or the claim rule and this run changes with it.
 */
const CLEAN_RUN = "both"

type Report = { questionId: string; correct: boolean; ms: number; answered: string }

type Harness = {
  game: {
    tick(dt: number): void
    hold(x: number, y: number): void
    stats(): Record<string, number | string>
  }
  reports: Report[]
  unmount(): void
}

function start(seed: string | number): Harness {
  const el = stubDom()
  const reports: Report[] = []
  const host = createStubHost({
    total: 7200,
    seed,
    onReport: (r: Report) => reports.push(r),
  })
  const handle = mount(el as unknown as HTMLElement, host)
  const game = (el as unknown as { __claim: Harness["game"] }).__claim
  return { game, reports, unmount: handle.unmount }
}

/** Run `seconds` of real frames at 60Hz. */
function run(h: Harness, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) h.game.tick(1 / 60)
}

/**
 * Sit through the clear card until the gate is actually up.
 *
 * Not a fixed wait: a frame spent here is a frame that has already gone by when
 * the plates appear, and this file exists to keep that kind of accounting
 * honest. (There is no longer a clock on the answer for it to eat — see
 * `gate.test.ts` — but the vault's abandonment guard is still real.)
 */
function runToGate(h: Harness): void {
  const G = h.game as unknown as { phase: string }
  for (let i = 0; i < 900 && G.phase !== "gate"; i++) h.game.tick(1 / 60)
  assert.equal(G.phase, "gate", "no gate ever opened")
}

test("the game runs headlessly at all — the stub holds up", () => {
  const h = start("smoke")
  run(h, 2)
  const s = h.game.stats()
  assert.equal(s.total, 7200)
  assert.ok(Number(s.level) >= 1)
  h.unmount()
})

// ---------------------------------------------------------------------------
// The hole.
// ---------------------------------------------------------------------------

test("clearing a level opens a gate, so a run that never dies can still answer", () => {
  const h = start(CLEAN_RUN)
  // Skip the intro card, then take the whole plane: with no hunter able to
  // reach it, the first closed loop claims everything and clears the level.
  run(h, 2)
  clearALevel(h)
  assert.equal(Number(h.game.stats().lives), 3, "nobody died getting here")

  // The clear card, then the vault.
  runToGate(h)
  const plates = platesOf(h)
  assert.equal(plates.length, 3, "a level clear must put a question up")

  // Drive onto the right one and hold it.
  const want = plates.find((p) => p.correct)
  assert.ok(want, "one plate must be the answer")
  driveTo(h, want.gx, want.gy)
  run(h, PLATE_ARM + 0.4)

  assert.equal(h.reports.length, 1, `expected one report, got ${JSON.stringify(h.reports)}`)
  const r = h.reports[0] as Report
  assert.equal(r.correct, true, "a correct answer, reported, with no death anywhere in the run")
  assert.equal(r.answered, want.label, "exact in, exact out")
  assert.equal(Number(h.game.stats().lives), 3, "and it cost nothing")
  h.unmount()
})

test("the vault answers with the plate you held, not the ones you drove over", () => {
  // The defect: three plates on one row, answered on contact. Reaching the far
  // one meant crossing the near ones, and the first box entered took the answer.
  const h = start(CLEAN_RUN)
  run(h, 2)
  clearALevel(h)
  runToGate(h)
  const plates = platesOf(h)
  assert.equal(plates.length, 3)
  const want = plates.find((p) => p.correct)
  assert.ok(want)

  // Go straight over a wrong one on the way. `plates.test.ts` walks every plate
  // on every arena at every speed the ladder reaches.
  const [px, py] = playerAt(h)
  const wrong = plates
    .filter((p) => !p.correct)
    .sort((a, b) => Math.hypot(a.gx - px, a.gy - py) - Math.hypot(b.gx - px, b.gy - py))[0]
  assert.ok(wrong)
  driveTo(h, wrong.gx, wrong.gy)
  driveTo(h, wrong.gx + 7, wrong.gy)
  assert.equal(h.reports.length, 0, `driving over a plate answered: ${JSON.stringify(h.reports)}`)
  assert.equal(wrong.charge, 0, "leaving a plate must empty it")

  driveTo(h, want.gx, want.gy)
  run(h, PLATE_ARM + 0.4)
  assert.equal(h.reports.length, 1, `expected the held plate to answer: ${JSON.stringify(h.reports)}`)
  assert.equal((h.reports[0] as Report).correct, true)
  assert.equal((h.reports[0] as Report).answered, want.label)
  h.unmount()
})

test("a vault nobody touched is not reported as a wrong answer", () => {
  // The trap in adding a second question surface: a bonus that opens after
  // every level, reported as failed whenever a child ignores it, would hand the
  // adaptive controller a stream of failures the game manufactured itself.
  const h = start(CLEAN_RUN)
  run(h, 2)
  clearALevel(h)
  runToGate(h)
  // The vault's guard is derived per item and per arena, not a constant — read
  // it rather than guessing at it, and then walk away for longer than it.
  // `gate.test.ts` is where the guard's shape is pinned.
  const guard = (h.game as unknown as { gateGuard: number }).gateGuard
  assert.ok(Number.isFinite(guard) && guard > 7, `a vault must outlast the old ring: ${guard}`)
  run(h, guard + 2) // nobody ever stands on a plate
  assert.deepEqual(h.reports, [], "not answering is not answering wrong")
  assert.ok(Number(h.game.stats().level) >= 2, "and the vault must not stall the ladder")
  h.unmount()
})

test("the plates are never all on one line", () => {
  // Pinned here as well as in `plates.test.ts` because this is the arrangement
  // the running game actually builds.
  const h = start(CLEAN_RUN)
  run(h, 2)
  clearALevel(h)
  runToGate(h)
  const ps = platesOf(h)
  const rows = new Set(ps.map((p) => Math.round(p.gy)))
  const cols = new Set(ps.map((p) => Math.round(p.gx)))
  assert.equal(rows.size, 3, "three answers on one row is the bug")
  assert.equal(cols.size, 3)
  assert.equal(PLATE_SPOTS.length, 3)
  h.unmount()
})

/* ------------------------------- driving --------------------------------- */

type P = { gx: number; gy: number; label: string; correct: boolean; charge: number }

function platesOf(h: Harness): P[] {
  return (h.game as unknown as { plates: P[] }).plates
}

function playerAt(h: Harness): [number, number] {
  const g = h.game as unknown as { cx: number; cy: number }
  return [g.cx + 0.5, g.cy + 0.5]
}

/** Steer to a cell the way a thumb would: one axis, then the other. */
function driveTo(h: Harness, tx: number, ty: number): void {
  for (const axis of ["x", "y"] as const) {
    for (let i = 0; i < 600; i++) {
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
 * Play a level the way it is meant to be played: straight cuts, rail to rail,
 * working across the plane a few columns at a time until the meter reaches the
 * band. No cheat seam, no forced state — `closeCut` decides, exactly as it does
 * on a tablet.
 */
function clearALevel(h: Harness): void {
  const G = h.game as unknown as { g: { w: number; h: number }; phase: string }
  for (let pass = 0; pass < 40; pass++) {
    if (G.phase !== "play") return
    const x = 3 + pass * 3
    if (x > G.g.w - 3) return
    driveTo(h, x, pass % 2 === 0 ? 0 : G.g.h - 1)
    driveTo(h, x, pass % 2 === 0 ? G.g.h - 1 : 0)
    run(h, 0.3)
  }
}
