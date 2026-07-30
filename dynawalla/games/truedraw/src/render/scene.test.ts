import assert from "node:assert/strict"
import { test } from "node:test"

import { coinsFor } from "../game/bag.ts"
import type { Outcome } from "../game/response.ts"
import { OUTCOMES } from "../game/response.ts"
import type { Phase } from "../game/round.ts"
import { newRun, applyOutcome, type Run } from "../game/run.ts"
import type { Statement } from "../game/statement.ts"
import { fakeCanvas, numbersIn, type Recorder } from "./fakeCanvas.ts"
import { Gesture } from "../game/gesture.ts"
import { Scene, type Drag, type SceneState } from "./scene.ts"

const SIZES: readonly [number, number][] = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1280, 800],
]

const PHASES: readonly Phase[] = ["idle", "raise", "still", "call", "verdict", "clear", "over"]

function statement(over: Partial<Statement> = {}): Statement {
  return {
    questionId: "q",
    expression: "4003 − 87",
    claimed: "3926",
    answer: "3916",
    truth: false,
    text: "4003 − 87 = 3926",
    windowMs: 27000,
    stillMs: 320,
    p50Ms: 11000,
    ...over,
  }
}

function state(over: Partial<SceneState> = {}): SceneState {
  return {
    phase: "call",
    progress: 0.5,
    elapsedMs: 400,
    statement: statement(),
    outcome: null,
    run: newRun(),
    coins: 0,
    best: 0,
    reduced: false,
    drag: null,
    ...over,
  }
}

function scene(w: number, h: number): { scene: Scene; rec: Recorder } {
  const { canvas, rec } = fakeCanvas(w, h)
  return { scene: new Scene(canvas as HTMLCanvasElement), rec }
}

const settle = (run: Run, outcome: Outcome): Run =>
  applyOutcome(run, outcome, coinsFor(outcome, 1))

test("the street draws without throwing at every phase, size, motion branch and drag", () => {
  const DRAGS: readonly (Drag | null)[] = [
    null,
    { dy: 0, pull: 0, heading: null },
    { dy: 14, pull: 0.2, heading: "keep" },
    { dy: -14, pull: 0.2, heading: "toss" },
    { dy: 900, pull: 1, heading: "keep" },
    { dy: -900, pull: 1, heading: "toss" },
  ]
  for (const [w, h] of SIZES) {
    for (const reduced of [false, true]) {
      const { scene: s, rec } = scene(w, h)
      for (const phase of PHASES) {
        for (const outcome of [null, ...OUTCOMES]) {
          for (const progress of [0, 0.24, 0.5, 0.76, 1]) {
            for (const drag of DRAGS) {
              for (const coins of [0, 10, -12]) {
                for (const masked of [false, true]) {
                  rec.reset()
                  s.draw(
                    state({
                      phase,
                      outcome,
                      progress,
                      elapsedMs: progress * 900,
                      reduced,
                      drag,
                      coins,
                      masked,
                    }),
                  )
                  const bad = numbersIn(rec.ops).filter((n) => !Number.isFinite(n))
                  assert.equal(
                    bad.length,
                    0,
                    `${String(w)}×${String(h)} ${phase}/${String(outcome)} drag=${JSON.stringify(drag)}`,
                  )
                }
              }
            }
          }
        }
      }
    }
  }
})

test("THE SLATE FOLLOWS THE FINGER, and it follows it the right way", () => {
  // The whole of the added juice. A flick down carries the slate towards the bag, a
  // flick up carries it towards the chute, and a renderer that ignored the drag would
  // make the gesture feel like a keypress.
  const { scene: s, rec } = scene(390, 844)
  const yOf = (drag: Drag | null): number => {
    rec.reset()
    s.draw(state({ phase: "call", drag }))
    const box = rec.ops.find((op) => op.name === "fillRect" && Number(op.args[0]) > 1 && Number(op.args[3]) > 40)
    return Number(box?.args[1] ?? Number.NaN)
  }
  const rest = yOf(null)
  const down = yOf({ dy: 60, pull: 0.8, heading: "keep" })
  const up = yOf({ dy: -60, pull: 0.8, heading: "toss" })
  assert.ok(Number.isFinite(rest))
  assert.ok(down > rest + 20, `a downward flick moved the slate from ${String(rest)} to ${String(down)}`)
  assert.ok(up < rest - 20, `an upward flick moved the slate from ${String(rest)} to ${String(up)}`)
})

/**
 * The brightness of the chevrons ABOVE the slate and BELOW it, told apart by where
 * they were actually drawn.
 *
 * The previous version of this took a `side` argument and then `void side`, returning
 * the max alpha over every chevron in the frame — so its two calls computed the
 * identical number and swapping the chute and the bag in `drawGutters` left it
 * passing. A `stroke` op carries no coordinates, so each one is attributed to the y
 * of the most recent `moveTo` before it, which does.
 */
function gutterGlow(
  s: Scene,
  rec: Recorder,
  drag: Drag | null,
): { above: number; below: number } {
  rec.reset()
  s.draw(state({ phase: "call", drag }))
  // The STATIC layout, not the drawn slate: under a drag the slate moves and the
  // gutters do not, so attributing chevrons to where the slate currently is would
  // reclassify them the moment a finger pulled. `chute` is above the slate's rest
  // position and `bag` is below it, by construction and by `street.test.ts`.
  const { chute, bag } = s.layout
  let cursorY = Number.NaN
  let above = 0
  let below = 0
  for (const op of rec.ops) {
    if (op.name === "moveTo") cursorY = Number(op.args[1])
    if (op.name !== "stroke") continue
    const alpha = Number(/rgba\(230, 194, 129, ([\d.]+)\)/.exec(op.style)?.[1] ?? Number.NaN)
    if (!Number.isFinite(alpha) || !Number.isFinite(cursorY)) continue
    // A chevron's `moveTo` is one of its two feet, so the band is widened by the
    // chevron's own rise rather than being the box exactly.
    const rise = chute.h
    if (cursorY <= chute.y + chute.h + rise) above = Math.max(above, alpha)
    else if (cursorY >= bag.y - rise) below = Math.max(below, alpha)
  }
  return { above, below }
}

test("THE DESTINATION LIGHTS UP UNDER A COMMITTING FINGER — the RIGHT one", () => {
  // The affordance that means the controls do not have to be explained twice, and the
  // direction is half of it: pulling UP must light the chute above the slate and pulling
  // DOWN must light the bag below it. Getting that backwards would teach a child the
  // wrong gesture and would cost them a shot every time they believed it.
  const { scene: s, rec } = scene(390, 844)
  const idle = gutterGlow(s, rec, null)
  const up = gutterGlow(s, rec, { dy: -70, pull: 0.95, heading: "toss" })
  const down = gutterGlow(s, rec, { dy: 70, pull: 0.95, heading: "keep" })

  assert.ok(idle.above > 0 && idle.below > 0, "the gutters are not drawn at rest at all")
  assert.ok(
    up.above > idle.above * 2,
    `pulling up barely lit the chute: ${idle.above.toFixed(3)} → ${up.above.toFixed(3)}`,
  )
  assert.ok(
    down.below > idle.below * 2,
    `pulling down barely lit the bag: ${idle.below.toFixed(3)} → ${down.below.toFixed(3)}`,
  )
  // ...and the OTHER side stays where it was. This is the assertion the old version
  // could not make, and the one that catches the two being swapped.
  assert.ok(
    up.below < up.above,
    `pulling up lit the bag as brightly as the chute: below ${up.below.toFixed(3)} vs above ${up.above.toFixed(3)}`,
  )
  assert.ok(
    down.above < down.below,
    `pulling down lit the chute as brightly as the bag: above ${down.above.toFixed(3)} vs below ${down.below.toFixed(3)}`,
  )
})

test("A COMMITTED FLICK LEAVES NO LIVE DRAG BEHIND IT", () => {
  // The bug this closes: a finger does not stop when it crosses the threshold, it keeps
  // travelling and then RESTS. The recogniser's live-drag accessors go neutral the
  // instant a verdict commits (`gesture.ts`), so a slate that has been answered — and,
  // 1.2s later, the NEXT slate — is never handed a drag from a finger that is merely
  // still down.
  const g = new Gesture(50)
  g.begin(100, 400)
  assert.equal(g.move(100, 460), "keep")
  // The finger travels on, and then rests.
  g.move(100, 700)
  g.move(100, 700)
  assert.equal(g.committed, true)
  assert.equal(g.dy, 0, "a committed gesture still reports travel")
  assert.equal(g.pull, 0)
  assert.equal(g.heading, null)
  // And the renderer therefore draws the slate at rest.
  const { scene: s, rec } = scene(390, 844)
  const yOf = (drag: Drag | null): number => {
    rec.reset()
    s.draw(state({ phase: "call", drag }))
    return Number(
      rec.ops.find((op) => op.name === "fillRect" && Number(op.args[0]) > 1 && Number(op.args[3]) > 40)
        ?.args[1],
    )
  }
  const live: Drag | null = g.down ? { dy: g.dy, pull: g.pull, heading: g.heading } : null
  assert.equal(yOf(live), yOf(null), "the slate was drawn thrown by a finger merely resting")
})

test("THE SLATE GOES BLANK BEHIND A SHEET", () => {
  // Same rule as the lead-in. The manual dims and blurs the frame, but "mostly
  // illegible" is the wrong standard for readable, unanswerable thinking time in a game
  // whose reaction clock now drives both the bag and the difficulty.
  const { scene: s, rec } = scene(768, 1024)
  for (const phase of ["call", "verdict"] as const) {
    rec.reset()
    s.draw(state({ phase, masked: true }))
    const texts = rec.ops.filter((op) => op.name === "fillText").map((op) => String(op.args[0]))
    assert.ok(
      !texts.includes("4") && !texts.includes("9"),
      `the statement was legible behind the sheet during ${phase}: ${texts.join("")}`,
    )
    // The slate itself still stands — it is masked, not removed.
    assert.ok(
      rec.ops.some((op) => op.name === "fillRect" && Number(op.args[0]) > 1 && Number(op.args[3]) > 40),
      `the slate vanished during ${phase}`,
    )
  }
})

test("THE SLATE IS BLANK BEFORE THE WINDOW OPENS", () => {
  // Not a rendering detail — it is what makes the reaction time honest. The statement
  // used to be legible, unlit, for up to 1.15 s of unanswerable lead-in, so a child
  // could read it before the clock started and the ladder would read a deliberate
  // child as a lightning-fast one.
  const { scene: s, rec } = scene(768, 1024)
  for (const phase of ["raise", "still"] as const) {
    rec.reset()
    s.draw(state({ phase, progress: 0.9 }))
    const texts = rec.ops.filter((op) => op.name === "fillText").map((op) => String(op.args[0]))
    assert.ok(
      !texts.includes("4") && !texts.includes("9"),
      `the statement was legible during ${phase}: ${texts.join("")}`,
    )
  }
  rec.reset()
  s.draw(state({ phase: "call", elapsedMs: 10 }))
  const lit = rec.ops.filter((op) => op.name === "fillText").map((op) => String(op.args[0]))
  assert.ok(lit.includes("4"), `the statement is not on the slate when the window opens: ${lit.join("")}`)
})

test("the slate leaves in the direction it was thrown", () => {
  const { scene: s, rec } = scene(390, 844)
  const yOf = (outcome: Outcome): number => {
    rec.reset()
    s.draw(state({ phase: "clear", outcome, progress: 0.8 }))
    const box = rec.ops.find((op) => op.name === "fillRect" && Number(op.args[0]) > 1 && Number(op.args[3]) > 40)
    return Number(box?.args[1] ?? Number.NaN)
  }
  const rest = (() => {
    rec.reset()
    s.draw(state({ phase: "call" }))
    return Number(rec.ops.find((op) => op.name === "fillRect" && Number(op.args[0]) > 1 && Number(op.args[3]) > 40)?.args[1])
  })()
  assert.ok(yOf("bank") > rest, "a kept slate did not go down into the bag")
  assert.ok(yOf("dud") > rest, "a kept counterfeit did not go down — you kept it")
  assert.ok(yOf("spot") < rest, "a thrown slate did not fly up")
  assert.ok(yOf("burn") < rest, "a thrown good slate did not fly up")
})

test("a wrong verdict adds no mark, no light and no colour", () => {
  // The design claim, at the level of the renderer. The bag losing coins is the ledger
  // telling the truth; it is not a reaction. So: no strike, no correction, no bow, and
  // the street exactly as dim as the window left it. What HAS changed since the old
  // "not one op" fingerprint is that the slate now leaves — in the direction the child
  // threw it — and coins come out of the bag. Those two, and nothing else.
  const { scene: s, rec } = scene(768, 1024)
  const st = statement({ windowMs: 2800 })

  const inkOf = (over: Partial<SceneState>): { texts: string[]; brass: number } => {
    rec.reset()
    s.draw(state({ statement: st, ...over }))
    return {
      texts: rec.ops.filter((op) => op.name === "fillText").map((op) => String(op.args[0])),
      brass: rec.ops.filter((op) => op.style === "#e6c281" || /230, 194, 129/.test(op.style)).length,
    }
  }

  const wrong = inkOf({ phase: "verdict", outcome: "dud", progress: 0.6, coins: -12 })
  const right = inkOf({ phase: "verdict", outcome: "bank", progress: 0.6, coins: 10 })
  // The corrected digit is the slate admitting it was wrong, and it happens only when
  // the child spotted it. A wrong keep never gets the answer handed to it.
  assert.ok(!wrong.texts.includes("1"), "a wrong keep was shown the correction")
  // And the stamp — the one bright mark in the game — is only ever on a correct keep.
  assert.ok(right.brass > wrong.brass, "a wrong verdict got as much brass as a right one")
})

test("the light goes out of the window, and that is the only clock", () => {
  const { scene: s, rec } = scene(768, 1024)
  const st = statement({ windowMs: 2800 })
  const brightness: number[] = []
  for (const elapsedMs of [90, 700, 1400, 2100, 2800]) {
    rec.reset()
    s.draw(state({ phase: "call", elapsedMs, progress: elapsedMs / st.windowMs, statement: st }))
    const glyph = rec.ops.find((op) => op.name === "fillText")
    // "rgb(r, g, b)" — the green channel is a fine proxy for how lit it is.
    const green = Number(/rgb\(\d+, (\d+)/.exec(glyph?.style ?? "")?.[1] ?? "0")
    brightness.push(green)
  }
  for (let i = 1; i < brightness.length; i++) {
    assert.ok(
      (brightness[i] ?? 0) < (brightness[i - 1] ?? 0),
      `the street must keep cooling: ${brightness.join(" → ")}`,
    )
  }
  // Unlit chalk is #5c6577 — green 101. The end of the window must still be
  // meaningfully brighter than that.
  assert.ok((brightness.at(-1) ?? 0) > 130, `too dark to read at the end: ${brightness.join(" → ")}`)
})

test("spotting a counterfeit is the loudest thing on the screen", () => {
  const { scene: s, rec } = scene(768, 1024)
  const run = newRun()
  const counts: Record<string, number> = {}
  for (const outcome of OUTCOMES) {
    rec.reset()
    s.draw(
      state({
        phase: "verdict",
        outcome,
        progress: 0.6,
        elapsedMs: 500,
        run,
        coins: coinsFor(outcome, 1),
      }),
    )
    counts[outcome] = rec.ink().length
  }
  for (const quiet of ["dud", "burn", "lapse"] as const) {
    assert.ok((counts[quiet] ?? 0) < (counts["spot"] ?? 0), `${quiet} is as loud as a spot`)
  }
  assert.ok((counts["lapse"] ?? 0) < (counts["bank"] ?? 0), "a lapse is louder than a bank")
})

test("coins fly in on a correct call and out on a wrong one", () => {
  const { scene: s, rec } = scene(768, 1024)
  const coinsDrawn = (outcome: Outcome, coins: number): { lit: number; dim: number } => {
    rec.reset()
    s.draw(state({ phase: "verdict", outcome, progress: 0.5, elapsedMs: 300, coins }))
    return {
      lit: rec.ops.filter((op) => op.name === "fill" && op.style === "#e6c281").length,
      dim: rec.ops.filter((op) => op.name === "fill" && op.style === "#6b5730").length,
    }
  }
  const banked = coinsDrawn("bank", 10)
  const lost = coinsDrawn("dud", -12)
  const nothing = coinsDrawn("lapse", 0)
  assert.ok(banked.lit > 0, "no coins went into the bag on a correct call")
  assert.ok(lost.dim > 0, "no coins came out of the bag on a wrong call")
  assert.equal(nothing.lit + nothing.dim, 0, "a lapse moved coins")
})

test("a bigger call puts more coins in flight, so the bonus is visible", () => {
  const { scene: s, rec } = scene(768, 1024)
  const flying = (coins: number): number => {
    rec.reset()
    s.draw(state({ phase: "verdict", outcome: "bank", progress: 1, elapsedMs: 500, coins }))
    return rec.ops.filter((op) => op.name === "fill" && op.style === "#e6c281").length
  }
  assert.ok(flying(10) > flying(6), `a fast call showed ${String(flying(10))} coins, a slow one ${String(flying(6))}`)
})

test("the correction is drawn whether or not the digit counts match", () => {
  const { scene: s, rec } = scene(768, 1024)
  for (const claim of [
    // Same width: the columns roll.
    statement({ claimed: "3926", answer: "3916", text: "4003 − 87 = 3926" }),
    // Different width: there is no column to roll in, so it cross-fades.
    statement({ claimed: "90", answer: "100", expression: "95 + 5", text: "95 + 5 = 90" }),
  ]) {
    for (const reduced of [false, true]) {
      rec.reset()
      s.draw(state({ phase: "verdict", outcome: "spot", progress: 0.6, statement: claim, reduced }))
      const texts = rec.ops.filter((op) => op.name === "fillText").map((op) => String(op.args[0]))
      assert.ok(texts.includes("1"), `the corrected digit is on the slate: ${texts.join("")}`)
      assert.equal(numbersIn(rec.ops).filter((n) => !Number.isFinite(n)).length, 0)
    }
  }
})

test("the corrected value is visible at the end of the cross-fade, not transparent", () => {
  // The bug this test exists for: a running `globalAlpha *= (1 - t)` paired with a `/=`
  // to undo it is exactly zero at `t = 1`, the division cannot recover it, and every
  // glyph drawn afterwards — including the corrected numeral the whole fade exists to
  // reveal — lands at alpha zero.
  const { scene: s, rec } = scene(768, 1024)
  const claim = statement({ claimed: "90", answer: "100", expression: "95 + 5", text: "95 + 5 = 90" })
  for (const progress of [0.5, 0.74, 0.9, 1]) {
    rec.reset()
    s.draw(state({ phase: "verdict", outcome: "spot", progress, statement: claim }))
    const corrected = rec.ops.filter((op) => op.name === "fillText" && op.args[0] === "1")
    assert.ok(corrected.length > 0, `no corrected digit at ${String(progress)}`)
    assert.ok(
      corrected.some((op) => op.alpha > 0.2),
      `the corrected digit was drawn at alpha ${String(corrected[0]?.alpha)} at ${String(progress)}`,
    )
  }
})

test("the slate leaves the context's alpha exactly as it found it", () => {
  const { scene: s, rec } = scene(768, 1024)
  for (const outcome of [null, ...OUTCOMES]) {
    for (const progress of [0, 0.5, 1]) {
      rec.reset()
      s.draw(state({ phase: "verdict", outcome, progress }))
      // Whatever the slate did inside its save/restore, the shot pips drawn after it
      // must not inherit a faded or zeroed alpha.
      const tail = rec.ops.slice(rec.ops.findLastIndex((op) => op.name === "restore") + 1)
      const pips = tail.filter((op) => op.name === "fill" || op.name === "stroke")
      assert.ok(pips.length > 0, "the shots are drawn")
      for (const pip of pips) {
        assert.ok(
          pip.alpha > 0.2,
          `${String(outcome)} at ${String(progress)}: alpha ${String(pip.alpha)}`,
        )
      }
    }
  }
})

test("the crowd is the tally and never draws more people than calls", () => {
  const { scene: s, rec } = scene(768, 1024)
  let previous = -1
  let run: Run = newRun()
  for (let i = 0; i <= 20; i++) {
    rec.reset()
    s.draw(state({ phase: "still", run }))
    const figures = rec.ops.filter((op) => op.name === "rotate").length
    assert.ok(figures >= previous, "the crowd never steps back into the haze")
    previous = figures
    run = settle(run, "bank")
  }
  // The caller plus fourteen witnesses, and no more.
  assert.equal(previous, 15)
})

test("the crowd never shrinks even as the bag does", () => {
  // The bag is the score and the founder's economy says it falls. The crowd is
  // construction and construction never regresses (P-04). Both, at once.
  const { scene: s, rec } = scene(768, 1024)
  let run: Run = newRun()
  for (let i = 0; i < 5; i++) run = settle(run, "bank")
  const before = run.bag
  const crowdOps = (r: Run): number => {
    rec.reset()
    s.draw(state({ phase: "call", run: r }))
    return rec.ops.filter((op) => op.name === "rotate").length
  }
  const crowd = crowdOps(run)
  run = settle(run, "dud")
  assert.ok(run.bag < before, "the bag did not fall on a wrong keep")
  assert.equal(crowdOps(run), crowd, "the crowd stepped back into the haze")
})

test("the ledger shows the bag and never a percentage", () => {
  const { scene: s, rec } = scene(768, 1024)
  let run = newRun()
  for (let i = 0; i < 3; i++) run = settle(run, "bank")
  for (let i = 0; i < 3; i++) run = settle(run, "dud")
  rec.reset()
  s.draw(state({ phase: "over", progress: 1, elapsedMs: 1200, run, best: 90 }))
  const texts = rec.ops.filter((op) => op.name === "fillText").map((op) => String(op.args[0]))
  assert.ok(texts.includes(String(run.bag)), `the bag, and it is ${String(run.bag)}: ${texts.join("|")}`)
  assert.ok(!texts.some((t) => t.includes("%")), "there is no percentage anywhere")
  assert.ok(texts.some((t) => t.startsWith("BEST")), "the best bag is not shown")
})

test("the bag's count is on the street the whole time you are playing", () => {
  // It is the score. A score a child cannot see while they are building it is not a
  // score, and the old game showed no score at all.
  const { scene: s, rec } = scene(390, 844)
  let run = newRun()
  for (let i = 0; i < 4; i++) run = settle(run, "spot")
  for (const phase of ["raise", "still", "call", "verdict", "clear"] as const) {
    rec.reset()
    s.draw(state({ phase, run }))
    const texts = rec.ops.filter((op) => op.name === "fillText").map((op) => String(op.args[0]))
    assert.ok(texts.includes(String(run.bag)), `the bag is not on the street during ${phase}`)
  }
})

test("a drag on a slate that is not answerable does not move it", () => {
  // A finger down during `raise` or `still` is a flinch. A renderer that let it drag
  // the blank slate around would tell the child their touch had done something.
  const { scene: s, rec } = scene(390, 844)
  const yOf = (phase: Phase, drag: Drag | null): number => {
    rec.reset()
    s.draw(state({ phase, progress: 1, drag }))
    return Number(rec.ops.find((op) => op.name === "fillRect" && Number(op.args[0]) > 1 && Number(op.args[3]) > 40)?.args[1])
  }
  for (const phase of ["raise", "still"] as const) {
    assert.equal(
      yOf(phase, { dy: 80, pull: 1, heading: "keep" }),
      yOf(phase, null),
      `a blank slate was dragged during ${phase}`,
    )
  }
})

test("reduced motion does not tilt the slate, and still follows the finger", () => {
  const { scene: s, rec } = scene(390, 844)
  const drag: Drag = { dy: 70, pull: 0.9, heading: "keep" }
  for (const reduced of [true, false]) {
    rec.reset()
    s.draw(state({ phase: "call", drag, reduced }))
    const rotates = rec.ops.filter((op) => op.name === "rotate")
    // The crowd and the caller rotate too; the slate's tilt is the only one that is a
    // function of the drag, so it is detected by comparing against no drag.
    rec.reset()
    s.draw(state({ phase: "call", drag: null, reduced }))
    const restRotates = rec.ops.filter((op) => op.name === "rotate")
    if (reduced) {
      assert.equal(rotates.length, restRotates.length, "reduced motion tilted the slate")
    } else {
      assert.ok(rotates.length > restRotates.length, "the slate did not tilt as it was thrown")
    }
  }
})
