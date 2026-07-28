import assert from "node:assert/strict"
import { test } from "node:test"

import type { Outcome } from "../game/response.ts"
import type { Phase } from "../game/round.ts"
import { newRun, applyOutcome, type Run } from "../game/run.ts"
import type { Statement } from "../game/statement.ts"
import { fakeCanvas, numbersIn, type Recorder } from "./fakeCanvas.ts"
import { Scene, type SceneState } from "./scene.ts"

const SIZES: readonly [number, number][] = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1280, 800],
]

const PHASES: readonly Phase[] = ["idle", "raise", "still", "call", "verdict", "clear", "over"]
const OUTCOMES: readonly Outcome[] = ["hit", "bow", "wild", "slow"]

function statement(over: Partial<Statement> = {}): Statement {
  return {
    questionId: "q",
    expression: "4003 − 87",
    claimed: "3926",
    answer: "3916",
    truth: false,
    text: "4003 − 87 = 3926",
    windowMs: 2800,
    stillMs: 1400,
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
    best: 0,
    reduced: false,
    ...over,
  }
}

function scene(w: number, h: number): { scene: Scene; rec: Recorder } {
  const { canvas, rec } = fakeCanvas(w, h)
  return { scene: new Scene(canvas as HTMLCanvasElement), rec }
}

test("the street draws without throwing at every phase, size and motion branch", () => {
  for (const [w, h] of SIZES) {
    for (const reduced of [false, true]) {
      const { scene: s, rec } = scene(w, h)
      for (const phase of PHASES) {
        for (const outcome of [null, ...OUTCOMES]) {
          for (const progress of [0, 0.24, 0.5, 0.76, 1]) {
            rec.reset()
            s.draw(state({ phase, outcome, progress, elapsedMs: progress * 900, reduced }))
            const bad = numbersIn(rec.ops).filter((n) => !Number.isFinite(n))
            assert.equal(bad.length, 0, `${String(w)}×${String(h)} ${phase}/${String(outcome)}`)
          }
        }
      }
    }
  }
})

test("a wrong draw changes nothing on the street — not one op, alpha or colour", () => {
  // The design claim, at the level of the renderer, asserted as strictly as it
  // can be: take the very last frame of the open window, then every frame of
  // the wild verdict that follows, and require the street — everything up to
  // and including the slate — to be *identical*. Same draw calls, same order,
  // same alphas, same colours. No mark cut, no light regained, no bow.
  //
  // The hud is excluded and only the hud: one shot pip becomes a ring. That is
  // the entire visible consequence of a wrong draw.
  const fingerprint = (rec: ReturnType<typeof scene>["rec"]): string => {
    const end = rec.ops.findLastIndex((op) => op.name === "restore")
    return rec.ops
      .slice(0, end + 1)
      .map((op) => `${op.name}|${op.alpha.toFixed(4)}|${op.style}|${op.args.join(",")}`)
      .join("\n")
  }

  const { scene: s, rec } = scene(768, 1024)
  const run = newRun()
  const st = statement({ windowMs: 2800 })

  rec.reset()
  s.draw(state({ phase: "call", progress: 1, elapsedMs: st.windowMs, statement: st, run }))
  const window = fingerprint(rec)
  assert.ok(window.length > 500, "the fingerprint is not vacuously short")

  const spent = applyOutcome(run, "wild")
  for (const progress of [0, 0.1, 0.5, 0.99, 1]) {
    rec.reset()
    s.draw(
      state({
        phase: "verdict",
        outcome: "wild",
        progress,
        elapsedMs: progress * 620,
        statement: st,
        run: spent,
      }),
    )
    assert.equal(fingerprint(rec), window, `the street changed at ${String(progress)}`)
  }
})

test("the light goes out of the window, and that is the only clock", () => {
  // No bar, no ring, no countdown, nothing that moves — the statement simply
  // cools as the beat runs out. It must still be plainly legible at the end.
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

test("a correct hold is the loudest thing on the screen", () => {
  const { scene: s, rec } = scene(768, 1024)
  const run = newRun()
  const counts: Record<string, number> = {}
  for (const outcome of OUTCOMES) {
    rec.reset()
    s.draw(state({ phase: "verdict", outcome, progress: 0.6, elapsedMs: 500, run }))
    counts[outcome] = rec.ink().length
  }
  assert.ok((counts["wild"] ?? 0) < (counts["hit"] ?? 0), "being ignored is the quietest")
  assert.ok((counts["wild"] ?? 0) < (counts["bow"] ?? 0))
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
      s.draw(
        state({ phase: "verdict", outcome: "bow", progress: 0.6, statement: claim, reduced }),
      )
      const texts = rec.ops.filter((op) => op.name === "fillText").map((op) => String(op.args[0]))
      assert.ok(texts.includes("1"), `the corrected digit is on the slate: ${texts.join("")}`)
      assert.equal(numbersIn(rec.ops).filter((n) => !Number.isFinite(n)).length, 0)
    }
  }
})

test("the corrected value is visible at the end of the cross-fade, not transparent", () => {
  // The bug this test exists for: a running `globalAlpha *= (1 - t)` paired
  // with a `/=` to undo it is exactly zero at `t = 1`, the division cannot
  // recover it, and every glyph drawn afterwards — including the corrected
  // numeral the whole fade exists to reveal — lands at alpha zero. The slate
  // would appear to erase itself instead of correcting itself.
  const { scene: s, rec } = scene(768, 1024)
  const claim = statement({ claimed: "90", answer: "100", expression: "95 + 5", text: "95 + 5 = 90" })
  for (const progress of [0.5, 0.74, 0.9, 1]) {
    rec.reset()
    s.draw(state({ phase: "verdict", outcome: "bow", progress, statement: claim }))
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
      // Whatever the slate did inside its save/restore, the shot pips drawn
      // after it must not inherit a faded or zeroed alpha. The pips are the
      // first thing past the last `restore`, and they set no alpha of their own
      // until after they are drawn — so they are the honest witness.
      const tail = rec.ops.slice(rec.ops.findLastIndex((op) => op.name === "restore") + 1)
      const pips = tail.filter((op) => op.name === "fill" || op.name === "stroke")
      assert.ok(pips.length > 0, "the shots are drawn")
      for (const pip of pips) {
        assert.ok(pip.alpha > 0.2, `${String(outcome)} at ${String(progress)}: alpha ${String(pip.alpha)}`)
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
    run = applyOutcome(run, "hit")
  }
  // The caller plus fourteen witnesses, and no more.
  assert.equal(previous, 15)
})

test("the ledger shows a length and never a percentage", () => {
  const { scene: s, rec } = scene(768, 1024)
  let run = newRun()
  for (let i = 0; i < 3; i++) run = applyOutcome(run, "hit")
  for (let i = 0; i < 3; i++) run = applyOutcome(run, "wild")
  rec.reset()
  s.draw(state({ phase: "over", progress: 1, elapsedMs: 1200, run, best: 9 }))
  const texts = rec.ops.filter((op) => op.name === "fillText").map((op) => String(op.args[0]))
  assert.ok(texts.includes("3"), "the run's length, and it is three")
  assert.ok(!texts.some((t) => t.includes("%")), "there is no percentage anywhere")
})
