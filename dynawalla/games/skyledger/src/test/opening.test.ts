// THE CALM OPENING, measured.
//
// > "sky ledger is pretty cool. but to start it needs to be Wayy slower. only
// > one problem to look at and maybe even a tutorial. only once the user has
// > proven they have the hang of it should we put more than one problem on the
// > board"
//
// Three claims, and each is asserted against the real `Game` rather than against
// the table in `game/opening.ts`:
//
//   1. a first sitting has **one** ledger line in the air and keeps having one;
//   2. a second one arrives when the child has **logged stars**, never when a
//      clock has run out;
//   3. the top of the ramp is the game as it shipped, byte for byte.
//
// The observable throughout is `state === "falling" && t > 0` — the exact filter
// `mount.view` applies before handing the sky to the renderer, so what is counted
// here is what is on the glass and not what is in an array.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import { Game, type Star } from "../game/game.ts"
import {
  CALM_STEPS,
  LOGGED_AT,
  LOGGED_PAST_CALM,
  openingAt,
  revealFor,
  stepFor,
} from "../game/opening.ts"
import { loggedEver, noteLogged, resetLoggedForTest } from "../game/seen.ts"
import { answerOf, stationOf } from "../game/station.ts"
import { mountSkyLedger } from "../mount.ts"
import { BRASS_LIT, OXIDE } from "../render/palette.ts"
import { createStubHost } from "../stubHost.ts"
import { setHostInsets } from "../../../../packs/shared/game-chrome/index.ts"
import { makeSurface } from "./surface.ts"

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 1)
const STEP = 50

function game(seed: number, experience: number): Game {
  const host = createStubHost({ seed })
  const g = new Game(host, new Rng(seed ^ 0x5ec2), 0, false, experience)
  g.begin(0)
  return g
}

/** What `mount.view` would hand the renderer: the readable ledger lines. */
function onBoard(g: Game): number {
  let n = 0
  for (const s of g.stars) if (s.state === "falling" && s.t > 0) n += 1
  return n
}

/** Work the sighted star correctly. Returns false when there was nothing to work. */
function solve(g: Game, now: number): boolean {
  const star: Star | null = g.sighted
  if (!star) return false
  const value = answerOf(star.item)
  if (value === null) return false
  const want = stationOf(value)
  for (let i = 0; i < 12 && g.station.x !== want.x; i++) g.dial("ones", 1)
  for (let i = 0; i < 12 && g.station.y !== want.y; i++) g.dial("tens", 1)
  g.mark(now)
  return true
}

/**
 * A sitting.
 *
 * `thinkMs` is `null` for a child who never touches anything at all. Nothing in
 * here reads a difficulty, a speed or a streak; it is a clock only so that the
 * ASSERTIONS can be about how little the clock matters.
 */
function sit(
  g: Game,
  untilMs: number,
  thinkMs: number | null,
): { peak: number; board: number[]; logged: number } {
  const board: number[] = []
  let due = thinkMs ?? Number.POSITIVE_INFINITY
  for (let t = STEP; t <= untilMs; t += STEP) {
    g.tick(STEP, t)
    if (g.shown !== null) g.dismiss(t + 1000)
    if (t >= due) {
      solve(g, t)
      due = t + (thinkMs ?? Number.POSITIVE_INFINITY)
    }
    board.push(onBoard(g))
  }
  return { peak: Math.max(0, ...board), board, logged: g.ledger.logged }
}

// ── the table ───────────────────────────────────────────────────────────────

test("the ramp is monotone in every direction, and never reverses on a child", () => {
  let previous = openingAt(0)
  assert.equal(previous.onBoard, 1, `a first sitting is ${previous.onBoard} ledger lines, not one`)
  for (let step = 1; step <= CALM_STEPS + 6; step++) {
    const at = openingAt(step)
    assert.ok(
      at.onBoard >= previous.onBoard,
      `step ${step} puts ${at.onBoard} on the board where step ${step - 1} put ${previous.onBoard}`,
    )
    assert.ok(
      at.fall <= previous.fall,
      `step ${step} falls at ×${at.fall} where step ${step - 1} fell at ×${previous.fall}`,
    )
    assert.ok(
      Number(at.reading) <= Number(previous.reading),
      `the written reading came back at step ${step}`,
    )
    assert.ok(
      at.intensity >= previous.intensity,
      `step ${step} is calmer (${at.intensity}) than step ${step - 1} (${previous.intensity})`,
    )
    assert.ok(
      revealFor(at).holdMs <= revealFor(previous).holdMs,
      `the reveal came back at step ${step}`,
    )
    previous = at
  }
})

test("the top of the ramp is the game as it shipped", () => {
  for (const step of [CALM_STEPS, CALM_STEPS + 1, CALM_STEPS + 40]) {
    const at = openingAt(step)
    assert.equal(at.onBoard, Number.POSITIVE_INFINITY, `step ${step} still caps the board`)
    assert.equal(at.fall, 1, `step ${step} still stretches the descent`)
    assert.equal(at.reading, false, `step ${step} still writes the reading out`)
    assert.equal(revealFor(at).holdMs, 0, `step ${step} still completes sums for the child`)
  }
  // …and every calm step holds its reveal until a hand takes it down. The
  // decision is `game-pacing`'s; this is the claim that it comes out the way
  // this game needs.
  for (let step = 0; step < CALM_STEPS; step++) {
    assert.equal(
      revealFor(openingAt(step)).holdMs,
      Number.POSITIVE_INFINITY,
      `step ${step} puts a deadline on a completed sum`,
    )
    assert.ok(revealFor(openingAt(step)).settleMs > 0, `step ${step} can be dismissed by a stray tap`)
  }
})

test("the step is a function of stars logged, and it is monotone in them", () => {
  assert.equal(stepFor(0), 0, "a child who has logged nothing is not at the start of the ramp")
  let previous = 0
  for (let logged = 0; logged <= 400; logged++) {
    const step = stepFor(logged)
    assert.ok(step >= previous, `logging one more star moved a child from step ${previous} to ${step}`)
    assert.ok(step <= CALM_STEPS, `${logged} logged put a child at step ${step}, past the table`)
    previous = step
  }
  assert.equal(stepFor(LOGGED_PAST_CALM), CALM_STEPS, "the ramp never actually ends")
  // The board opens up only after a real number of right answers, not after one.
  assert.ok(
    (LOGGED_AT[2] as number) >= 3,
    `a second ledger line arrives after only ${LOGGED_AT[2]} logged stars`,
  )
  assert.equal(stepFor((LOGGED_AT[2] as number) - 1), 1, "the second line arrives a star early")
  assert.equal(openingAt(stepFor((LOGGED_AT[2] as number) - 1)).onBoard, 1)
  assert.equal(openingAt(stepFor(LOGGED_AT[2] as number)).onBoard, 2)
})

// ── what a first sitting actually walks into ────────────────────────────────

test("a first sitting is ONE ledger line, on the first frame and for the whole minute", () => {
  for (const seed of SEEDS) {
    const g = game(seed, 0)
    assert.equal(onBoard(g), 0, `seed ${seed}: a star was already falling before the first frame`)
    g.tick(STEP, STEP)
    assert.equal(onBoard(g), 1, `seed ${seed}: the first frame had ${onBoard(g)} ledger lines on it`)

    // Ten minutes of a child who is only LOOKING at it. Not a second line, ever.
    const idle = sit(g, 600_000, null)
    assert.equal(
      idle.peak,
      1,
      `seed ${seed}: a child who never touched anything was shown ${idle.peak} ledger lines`,
    )
  }
})

test("a practised child gets the board the game always gave them", () => {
  // The counter-measurement, and the reason the one above is not vacuous: the
  // same drive, the same seeds, the same observable — four lines inside eight
  // seconds and five inside the minute, which is the report this work came from.
  let mostAtEight = 0
  let mostAtSixty = 0
  for (const seed of SEEDS) {
    const g = game(seed, LOGGED_PAST_CALM)
    const eight = sit(g, 8000, null)
    mostAtEight = Math.max(mostAtEight, eight.peak)
    const minute = sit(g, 52_000, null)
    mostAtSixty = Math.max(mostAtSixty, minute.peak)
  }
  assert.equal(mostAtEight, 4, `the shipped opening put ${mostAtEight} lines up in eight seconds`)
  assert.equal(mostAtSixty, 5, `the shipped first minute peaked at ${mostAtSixty} lines`)
})

test("the second ledger line is bought with right answers, never with time", () => {
  for (const seed of SEEDS.slice(0, 12)) {
    // Two children, same seed, same opening. One works; one watches.
    const worker = game(seed, 0)
    const watcher = game(seed, 0)

    const watched = sit(watcher, 600_000, null)
    assert.equal(watched.peak, 1, `seed ${seed}: ten minutes alone opened the board up`)
    assert.equal(watcher.opened.step, 0, `seed ${seed}: ten idle minutes moved the ramp`)

    const worked = sit(worker, 600_000, 3000)
    assert.ok(worked.logged > 0, `seed ${seed}: the worker never logged anything`)
    assert.ok(
      worker.opened.step > 0,
      `seed ${seed}: ${worked.logged} logged stars did not move the ramp`,
    )
    assert.ok(
      worked.peak >= 2,
      `seed ${seed}: ${worked.logged} logged stars never bought a second ledger line`,
    )

    // And the second one does not arrive before the third right answer.
    const secondAt = worked.board.findIndex((n) => n >= 2)
    assert.ok(secondAt >= 0)
    const g2 = game(seed, 0)
    let loggedWhenSecondAppeared = 0
    for (let i = 0, t = STEP; i <= secondAt; i++, t += STEP) {
      g2.tick(STEP, t)
      if (g2.shown !== null) g2.dismiss(t + 1000)
      if (t % 3000 === 0) solve(g2, t)
      if (onBoard(g2) >= 2) {
        loggedWhenSecondAppeared = g2.ledger.logged
        break
      }
    }
    assert.ok(
      loggedWhenSecondAppeared >= (LOGGED_AT[2] as number),
      `seed ${seed}: the second line arrived on ${loggedWhenSecondAppeared} logged stars`,
    )
  }
})

test("the calm descent is slower, and it is a function of the step and of nothing else", () => {
  for (const seed of SEEDS.slice(0, 20)) {
    const calm = game(seed, 0)
    const shipped = game(seed, LOGGED_PAST_CALM)
    const a = calm.stars[0]
    const b = shipped.stars[0]
    assert.ok(a && b)
    assert.ok(
      a.fallMs > b.fallMs * 1.5,
      `seed ${seed}: a first sitting falls in ${a.fallMs} ms against the shipped ${b.fallMs} ms`,
    )
    // Ten minutes of wall clock does not touch it. Only a right answer does.
    const before = calm.opened
    sit(calm, 600_000, null)
    assert.deepEqual(calm.opened, before, `seed ${seed}: the opening moved on the clock`)
  }
})

// ── the tutorial: the plate says what the rings are for ─────────────────────

test("the sighted plate is the child's OWN reading, standing where the answer goes", () => {
  const g = game(0x71a1, 0)
  g.tick(STEP, STEP)
  const star = g.sighted
  assert.ok(star)
  assert.equal(
    g.guide,
    `${star.item.prompt} = ${g.reading}`,
    "the guided plate is not the prompt completed with the reading",
  )
  // It follows the rings, because it IS the rings.
  const seen = new Set<string>()
  for (let i = 0; i < 10; i++) {
    g.dial("ones", 1)
    const line = g.guide
    assert.ok(line !== null)
    assert.ok(line.endsWith(` = ${g.reading}`), `the plate said ${line} while the rings said ${g.reading}`)
    seen.add(line)
  }
  assert.equal(seen.size, 10, "turning the ones ring ten times produced fewer than ten readings")
})

test("the guidance comes off, and a practised child is never shown it", () => {
  const g = game(0x71a2, LOGGED_PAST_CALM)
  g.tick(STEP, STEP)
  assert.ok(g.sighted, "nothing was under the sight")
  assert.equal(g.guide, null, "a practised child was handed the guided plate")
})

// ── a miss completes the sum, and holds it ──────────────────────────────────

function missOn(g: Game, now: number): { star: Star; truth: number } {
  const star = g.sighted
  assert.ok(star, "nothing was under the sight")
  const truth = answerOf(star.item)
  assert.ok(truth !== null)
  const want = stationOf(truth)
  // One detent off the ones ring: wrong, and wrong in a way a child is wrong.
  const wrong = { x: (want.x + 1) % 10, y: want.y }
  for (let i = 0; i < 12 && g.station.x !== wrong.x; i++) g.dial("ones", 1)
  for (let i = 0; i < 12 && g.station.y !== wrong.y; i++) g.dial("tens", 1)
  g.mark(now)
  return { star, truth }
}

test("a miss in the calm opening completes the sum, in full, and holds it", () => {
  for (const seed of SEEDS.slice(0, 20)) {
    const reports: Array<{ questionId: string; correct: boolean }> = []
    const host = createStubHost({ seed, onReport: (r) => reports.push(r) })
    const g = new Game(host, new Rng(seed ^ 0x5ec2), 0, false, 0)
    g.begin(0)
    g.tick(STEP, STEP)

    const { star, truth } = missOn(g, 1000)
    assert.equal(
      g.shown,
      `${star.item.prompt} = ${truth}`,
      `seed ${seed}: a miss left ${g.shown} on the glass`,
    )
    assert.equal(star.state, "shown", `seed ${seed}: the shown star is still ${star.state}`)

    // Reported exactly once, as the wrong answer it was. Being shown the sum is
    // not being credited with it.
    const mine = reports.filter((r) => r.questionId === star.item.id)
    assert.equal(mine.length, 1, `seed ${seed}: ${mine.length} reports for one ledger line`)
    assert.equal(mine[0]?.correct, false, `seed ${seed}: a shown sum was reported correct`)

    // Ten minutes. Nothing takes it down but a hand — and nothing moves behind it.
    const lamps = g.lamps
    for (let t = 1050; t < 600_000; t += 500) g.tick(500, t)
    assert.equal(g.shown, `${star.item.prompt} = ${truth}`, `seed ${seed}: the sum timed itself out`)
    assert.equal(g.lamps, lamps, `seed ${seed}: a lamp went out behind a held sum`)
    for (const s of g.stars) {
      if (s.id !== star.id) {
        assert.ok(s.t < 1, `seed ${seed}: a star landed behind a held sum`)
      }
    }
  }
})

test("a completed sum outlasts a stray second tap, and then the child's own hand ends it", () => {
  const g = game(0x5e77, 0)
  g.tick(STEP, STEP)
  missOn(g, 1000)
  const line = g.shown
  assert.ok(line)

  const settle = revealFor(g.opened).settleMs
  assert.ok(settle > 0)
  // The second tap of a double-tap, arriving inside the fade-in.
  assert.deepEqual(g.dismiss(1000 + settle - 1), [], "a stray tap took the lesson down")
  assert.equal(g.shown, line, "a stray tap took the lesson down")

  g.dismiss(1000 + settle)
  assert.equal(g.shown, null, "the child's own hand did not end it")
  // And the world starts again, with the next ledger line under the sight as
  // soon as the watch's own release gap has passed — a star waits for its gap
  // AND for room, and dismissing a lesson only ever grants the second.
  let t = 1000 + settle
  for (let i = 0; i < 200 && g.sighted === null; i++) {
    t += STEP
    g.tick(STEP, t)
  }
  assert.ok(g.sighted, "nothing was ever put under the sight after the lesson")
  assert.equal(onBoard(g), 1, "the lesson ending put more than one line on the board")
})

test("a practised child's miss is the miss the game always gave them", () => {
  const g = game(0x5e78, LOGGED_PAST_CALM)
  g.tick(STEP, STEP)
  const { star } = missOn(g, 1000)
  assert.equal(g.shown, null, "the shipped game completed a sum for a practised child")
  assert.equal(star.state, "falling", "the shipped game took the star away")
  // And the world is still running.
  g.tick(STEP, 1050)
  assert.ok((g.stars.find((s) => s.id === star.id)?.t ?? 0) > 0)
})

test("a held sum takes no input but its own dismissal", () => {
  const g = game(0x5e79, 0)
  g.tick(STEP, STEP)
  missOn(g, 1000)
  const ring = { ...g.station }
  assert.deepEqual(g.dial("ones", 1), [], "a ring turned under a held sum")
  assert.deepEqual(g.station, ring, "a ring turned under a held sum")
  assert.deepEqual(g.mark(2000), [], "a mark was taken under a held sum")
  assert.deepEqual(g.sight(1), [], "a star was sighted under a held sum")
})

test("a sheet raised over a held sum does not hand it back already dismissible", () => {
  const g = game(0x5e7a, 0)
  g.tick(STEP, STEP)
  missOn(g, 1000)
  const settle = revealFor(g.opened).settleMs

  g.pause(1100)
  g.resume(1100 + 30_000)
  // The tap that took the host's sheet down must not take the lesson with it.
  assert.deepEqual(g.dismiss(1100 + 30_000), [], "thirty seconds of sheet spent the settle")
  assert.equal(g.shown !== null, true)
  g.dismiss(1000 + settle + 30_000 + 1)
  assert.equal(g.shown, null, "the lesson could not be dismissed after the sheet came off")
})

// ── the wire ────────────────────────────────────────────────────────────────
//
// Everything above would pass in full with `mount.ts` never reading or writing
// the count, so the shell is driven for itself.

test("the shell reads the ramp back and writes to it, across sittings", () => {
  const surface = makeSurface()
  const restore = surface.install()
  try {
    resetLoggedForTest()
    assert.equal(loggedEver(), 0, "the slot was not empty at the start of a first sitting")

    const host = createStubHost({ seed: 0x91e1 })
    const handle = mountSkyLedger(surface.root as unknown as HTMLElement, host)
    // Four minutes of a child at the keyboard — the shell's own input path, so
    // every turn and every mark goes through the same `apply` a finger does.
    // The rings are walked over every station and MARK is pressed at each, which
    // is a brute force and is exactly why it works here: whatever the answer is,
    // this child will find it, and the count that comes back is real.
    for (let i = 0; i < 15_000; i++) {
      surface.step(16)
      if (i % 7 === 0) key(surface, "ArrowRight")
      if (i % 71 === 0) key(surface, "ArrowUp")
      if (i % 11 === 0) key(surface, " ")
    }
    handle.unmount()

    const banked = loggedEver()
    assert.ok(banked > 0, "a whole sitting of marks banked nothing")
    assert.equal(
      Number(globalThis.localStorage.getItem("dw.skyledger.logged")),
      banked,
      "the logged count never reached storage",
    )

    // The read side: a fresh shell on the same device is past the first step.
    resetLoggedForTest()
    assert.equal(loggedEver(), banked, "the count did not survive a fresh module")
  } finally {
    restore()
  }
})

function key(surface: ReturnType<typeof makeSurface>, k: string): void {
  surface.fireGlobal("keydown", { key: k, preventDefault: () => undefined })
}

// ── the glass ───────────────────────────────────────────────────────────────

test("the completed sum reaches the glass, in brass and never in the refusal colour", () => {
  const surface = makeSurface()
  const restore = surface.install()
  try {
    resetLoggedForTest()
    assert.equal(loggedEver(), 0, "this has to be a first sitting or there is no reveal to draw")

    const host = createStubHost({ seed: 0x9c1a })
    const handle = mountSkyLedger(surface.root as unknown as HTMLElement, host)
    for (let i = 0; i < 40; i++) surface.step(16)

    // A wrong mark, through the shell: turn the ones ring once and press space.
    // One of the ten readings is right; nine are not, and one turn from the
    // origin is not the answer for any ledger line this stub draws at 0x9c1a.
    key(surface, "ArrowRight")
    key(surface, " ")
    surface.clearPainted()
    surface.step(16)

    const painted = surface.painted()
    const sum = painted.find((p) => /^\d+\s*[+−-]\s*\d+\s*=\s*\d+$/.test(p.text.trim()))
    assert.ok(
      sum,
      `no completed sum was painted; the glass had ${painted.map((p) => p.text).join(" | ")}`,
    )
    // Brass, the ink this observatory writes its own record in. Never OXIDE,
    // which is this palette's refusal colour, and never anything red.
    assert.equal(sum.fill, BRASS_LIT, `the completed sum was painted ${sum.fill}`)
    assert.notEqual(sum.fill, OXIDE, "the completed sum was painted in the refusal colour")
    for (const p of painted) {
      assert.notEqual(p.fill, OXIDE, `${p.text} was painted in the refusal colour`)
    }
    handle.unmount()
  } finally {
    restore()
  }
})

// ── the safe rect ───────────────────────────────────────────────────────────

test("the layout follows the safe rect when the host moves it, with no resize", () => {
  // `env(safe-area-inset-*)` resolves to ZERO inside a pack frame, so the real
  // numbers arrive from the host and can arrive LATE — and can change again on
  // an iPadOS Split View without the canvas box moving at all. `Layout` is
  // computed from `safeRect()` inside `Scene.resize` and nowhere else.
  //
  // The observable is a pixel: where MARK is engraved on the boss. And the
  // event fired is `orientationchange`, which `mount` does NOT listen for on its
  // own — only `onInsetsChange` does — so a shell that dropped the subscription
  // and kept its own `resize` handler fails here.
  const surface = makeSurface()
  const restore = surface.install()
  try {
    resetLoggedForTest()
    setHostInsets(null)
    const handle = mountSkyLedger(
      surface.root as unknown as HTMLElement,
      createStubHost({ seed: 0x5afe }),
    )
    surface.step(16)
    surface.clearPainted()
    surface.step(16)
    const before = surface.painted().find((p) => p.text === "MARK")
    assert.ok(before, "MARK was never engraved on the boss")

    setHostInsets({ top: 180, right: 0, bottom: 120, left: 0 })
    surface.fireGlobal("orientationchange")
    surface.clearPainted()
    surface.step(16)
    const after = surface.painted().find((p) => p.text === "MARK")
    assert.ok(after)
    assert.notEqual(
      Math.round(after.y),
      Math.round(before.y),
      `the astrolabe stayed at y=${before.y} after the host moved the safe rect`,
    )
    handle.unmount()
  } finally {
    setHostInsets(null)
    restore()
  }
})

test("the guided plate reaches the glass, and a practised child's plate does not", () => {
  // `game.guide` being right is a claim about the rules. THIS is the claim that
  // anything ever draws it: the shell has to put it on the sighted star's plate,
  // and a `view` that kept handing over `s.item.prompt` would pass every rules
  // assertion in this file.
  const sums = /^\s*\d+\s*[+−-]\s*\d+\s*=\s*\d+\s*$/

  const first = makeSurface()
  const restoreFirst = first.install()
  let firstSitting: readonly string[] = []
  try {
    resetLoggedForTest()
    const handle = mountSkyLedger(
      first.root as unknown as HTMLElement,
      createStubHost({ seed: 0x91a7 }),
    )
    for (let i = 0; i < 60; i++) first.step(16)
    key(first, "ArrowRight")
    key(first, "ArrowUp")
    first.clearPainted()
    first.step(16)
    firstSitting = first.painted().map((p) => p.text)
    handle.unmount()
  } finally {
    restoreFirst()
  }
  assert.ok(
    firstSitting.some((t) => sums.test(t)),
    `no plate on a first sitting was written out as a whole sum; the glass had ${firstSitting.join(" | ")}`,
  )

  const later = makeSurface()
  const restoreLater = later.install()
  let practised: readonly string[] = []
  try {
    resetLoggedForTest()
    for (let i = 0; i < LOGGED_PAST_CALM; i++) noteLogged()
    const handle = mountSkyLedger(
      later.root as unknown as HTMLElement,
      createStubHost({ seed: 0x91a7 }),
    )
    for (let i = 0; i < 60; i++) later.step(16)
    key(later, "ArrowRight")
    key(later, "ArrowUp")
    later.clearPainted()
    later.step(16)
    practised = later.painted().map((p) => p.text)
    handle.unmount()
  } finally {
    restoreLater()
  }
  assert.ok(
    practised.length > 0,
    "the practised sitting drew nothing at all, so this half proves nothing",
  )
  assert.ok(
    !practised.some((t) => sums.test(t)),
    `a practised child's plate was written out for them: ${practised.filter((t) => sums.test(t)).join(" | ")}`,
  )
})
