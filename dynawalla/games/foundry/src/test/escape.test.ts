// THE WRESTLERS MUST SURVIVE A CORRECT ANSWER.
//
// The report this file exists for, verbatim:
//
//   "'the grapple foundry' seems completely broken now. I do something that I
//    think is correct 0+3=3 so I tap 1 and 2 and the screen basically goes blank
//    but there are still sounds .. not completely blank but the wrestlers go
//    away."
//
// What was happening. A kick-out lays a scorch on the mat, and only a kick-out
// does. The scorch's glow is a radial gradient whose stops were
// `withAlpha(heatColor(heat), a)` — and `withAlpha` parsed hex while `heatColor`
// returned `rgb(...)`, so the stop colour came out as `rgba(NaN,11,37,0.3)`.
// `CanvasGradient.addColorStop` throws on that. The throw is inside `drawMat`,
// which runs *before* the two bodies, the referee, the near ropes and the entire
// HUD, and `frame()` re-arms its `requestAnimationFrame` on its first line — so
// the loop stayed alive and every frame painted the crowd, the far posts and the
// mat and then died in the same place. The audio graph is not on the frame loop,
// so the hall kept roaring. Exactly the screenshot.
//
// Two properties are asserted, and they fail for different reasons:
//
//   1. **No frame throws**, across a correct answer and the twelve seconds a
//      scorch takes to cool. This is the direct one.
//   2. **The player is still being drawn**, measured as filled marks in cast-iron
//      inside the ring. "Blank" is not a small number of draw calls — the
//      founder's screenshot had the crowd, the posts and the mat on it — so
//      counting calls cannot tell a live ring from a dead one. Positions can.
//
// The host here is not the stub: the stub climbs a ladder of two-to-four-digit
// column sums and never serves `0 + 3`. Single-digit and zero-bearing items are
// new content, and a target of 3 is the smallest thing this game can be asked
// for — `choosePlates` cannot split it across two plates that are both used, so
// it falls back to a 1 and a 2, which is the pair the founder tapped.

import assert from "node:assert/strict"
import { test } from "node:test"

import { mount, type Host, type Question } from "../contract.ts"
import { choosePlates, minTapsFor } from "../game/plates.ts"
import { Rng } from "../core/rng.ts"
import { computeLayout } from "../render/layout.ts"
import { drawGrapple } from "../render/ring.ts"
import { IRON } from "../render/palette.ts"
import { safeRect } from "../../../../packs/shared/game-chrome/index.ts"
import { canvasOf, pump, recorder, recordingContext, withBrowser, type Mark } from "./rig.ts"

const W = 390
const H = 844

/**
 * Items the way the ladder now serves them at the bottom: single digits, and a
 * zero as an operand.
 */
const ITEMS: Array<[string, string]> = [
  ["0 + 3", "3"],
  ["2 + 5", "7"],
  ["6 + 1", "7"],
  ["4 + 4", "8"],
]

function tinyHost(onReport?: (correct: boolean) => void): Host {
  let served = 0
  return {
    next(): Question {
      const [prompt, answer] = ITEMS[served % ITEMS.length] as [string, string]
      served++
      return { id: `q${served}`, prompt, answer, distractors: [], domain: "add", difficulty: 0 }
    },
    report(r) {
      onReport?.(r.correct)
    },
    haptic() {},
    prefersReducedMotion: () => false,
  }
}

/**
 * The pinned player, as marks on the canvas.
 *
 * `drawGrapple` is the only thing in the game that *fills a path* in `IRON`: the
 * ring frame uses `fillRect` for its posts and the pedals have their own colours,
 * so this is the player's torso, legs and head and nothing else. The challenger
 * fills in `IRON_DARK`, which the mat apron also uses, so the lighter body is the
 * cleaner probe.
 */
function playerMarks(marks: Mark[]): Mark[] {
  return marks.filter((m) => m.kind === "fill" && m.style === IRON)
}

test("a correct answer does not take the ring down with it", () => {
  const rec = recorder()
  const correct: boolean[] = []
  withBrowser({ w: W, h: H }, recordingContext(rec), ({ host, frames, created }) => {
    const handle = mount(host as unknown as HTMLElement, tinyHost((c) => correct.push(c)))
    const down = canvasOf(created).listeners.get("pointerdown")?.[0]
    assert.ok(down, "no pointerdown listener was installed")

    const tap = (side: "a" | "b"): void => {
      down({ preventDefault() {}, clientX: side === "a" ? W * 0.25 : W * 0.75, clientY: H * 0.9 })
    }

    // Through the lockup and into the pin. The bodies are on the mat already.
    let t = pump(frames, 90)
    rec.marks.length = 0
    t = pump(frames, 6, t)
    const before = playerMarks(rec.marks).length
    assert.ok(before > 0, "the player was never drawn even before the escape")

    // 0 + 3 = 3, on plates of 1 and 2: one tap each. This is the founder's input.
    tap("a")
    t = pump(frames, 2, t)
    tap("b")
    t = pump(frames, 2, t)
    assert.deepEqual(correct, [true], `the escape was not reported correct: ${correct.join()}`)

    // A scorch cools over twelve seconds, so the whole cooling ramp is walked —
    // the throw was in the glow, which only exists while the mark still has heat
    // in it. 900 frames at 60Hz is fifteen seconds.
    rec.marks.length = 0
    t = pump(frames, 900, t)

    const after = playerMarks(rec.marks).length
    assert.ok(
      after > before * 100,
      `the player stopped being drawn after the escape: ${before} marks in 6 frames before, ` +
        `${after} in 900 frames after`,
    )
    // And the whole draw ran, right down to the last thing on it. The pedals are
    // drawn after the bodies, so their labels are proof the frame reached the end.
    assert.ok(rec.text.includes("HEAVY"), "the pedals stopped being drawn after the escape")
    assert.deepEqual(
      [...new Set(rec.invalid)],
      [],
      "a colour the canvas cannot parse was produced during or after the escape",
    )
    assert.equal(rec.imbalance, 0, "a draw call restored more than it saved")

    handle.unmount()
  })
})

test("every target the bottom of the ladder can serve hangs a pair that escapes it", () => {
  // What FOUNDRY needs from an item: an integer answer of 1 or more, which it
  // then has to be able to *build* out of two plate values. `0 + 1` and `0 + 3`
  // are new content, and 1, 2, 3 and 4 are the targets that cannot be split
  // across two distinct plates that are both used. An unplayable pair here would
  // be the trebuchet failure — a fall laid out with no way out of it.
  const rng = new Rng(0x4a11)
  for (let target = 1; target <= 40; target++) {
    const p = choosePlates(target, rng, { pressure: 0 })
    assert.ok(p.a > 0 && p.b > 0, `target ${target}: a plate with no weight (${p.a}, ${p.b})`)
    assert.equal(
      p.a * p.x + p.b * p.y,
      target,
      `target ${target}: ${p.x}×${p.a} + ${p.y}×${p.b} is not ${target}`,
    )
    const min = minTapsFor(target, p.a, p.b)
    assert.ok(min !== null && min >= 1, `target ${target}: no escape from (${p.a}, ${p.b})`)
  }
})

test("the pinned player never rotates out from under the bar, however long the session", () => {
  // `pose.wobble` is a monotonic clock in seconds. Using it as an angle rotated
  // the body without bound: level at the start of a session, upside down about a
  // minute in, and past the mat edge after that. So the same pose is drawn at
  // times spanning ten minutes and the head has to stay put.
  const l = computeLayout(W, H, safeRect(W, H))
  const head = (wobble: number): Mark => {
    const rec = recorder()
    const g = recordingContext(rec)
    drawGrapple(g, l, { rise: 0, press: 0.4, wobble, count: 0 }, 0, 0)
    const marks = playerMarks(rec.marks)
    // The head is the last thing the player's body fills.
    const last = marks[marks.length - 1]
    assert.ok(last, `nothing was drawn for the player at wobble ${wobble}`)
    return last
  }

  const at0 = head(0)
  for (const wobble of [0.7, 3, 11, 31, 63, 100, 157, 300, 600]) {
    const m = head(wobble)
    assert.ok(
      Math.abs(m.x - at0.x) < l.unit * 0.5 && Math.abs(m.y - at0.y) < l.unit * 0.5,
      `at ${wobble}s the player's head is at (${m.x.toFixed(1)}, ${m.y.toFixed(1)}), ` +
        `which is off from (${at0.x.toFixed(1)}, ${at0.y.toFixed(1)}) by more than half a unit`,
    )
  }
})
