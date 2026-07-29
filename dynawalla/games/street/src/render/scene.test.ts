// The rendered-output gate in `EXPERIENCE_DESIGN.md` is a human looking at
// PNGs, and it should be. This is the part a machine can hold: that the scene
// draws without throwing at every size, in both motion branches and at every
// phase; that the rectangles it draws are the rectangles input reads; that a
// touch target is a touch target; and — the one that is a design claim rather
// than a robustness claim — that **being wrong puts no more ink on the screen
// than being right**.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  hitsHostChrome,
  safeRect,
  type Insets,
} from "../../../../packs/shared/game-chrome/index.ts"
import { newCrowd, strike } from "../game/crowd.ts"
import { bar } from "../game/factor.ts"
import { newShutter } from "../game/shutter.ts"
import type { Phase } from "../game/street.ts"
import { Rng } from "../core/rng.ts"
import { fakeCanvas } from "./fakeCanvas.ts"
import { Scene, hit, layoutFor, type Frame, type Layout } from "./scene.ts"

const PHASES: readonly Phase[] = [
  "shutter-down",
  "shutter",
  "rivet",
  "shutter-up",
  "approach",
  "melee",
  "crack",
  "ringoff",
  "bounce",
  "fall",
  "clear",
  "shove",
] as const

const SIZES: ReadonlyArray<readonly [number, number]> = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1366, 1024],
] as const

function plate() {
  return newShutter(
    { id: "q", prompt: "5,001 − 2,798", answer: "2203", distractors: ["2213", "3203", "2797"] },
    new Rng(7),
  )
}

function frame(over: Partial<Frame> = {}): Frame {
  return {
    phase: "melee",
    progress: 0.5,
    crowd: newCrowd(12),
    shutter: plate(),
    pressure: 0.25,
    pushMarks: 2,
    blocks: 3,
    best: 5,
    waveOfBlock: 1,
    wavesPerBlock: 3,
    hintSeam: 0,
    lastSeam: 3,
    lastRemainder: 0,
    clean: false,
    reduced: false,
    ...over,
  }
}

function sceneAt(w: number, h: number) {
  const { canvas, rec } = fakeCanvas(w, h)
  const scene = new Scene(canvas as HTMLCanvasElement)
  return { scene, rec }
}

test("the scene draws at every size, in every phase, in both motion branches", () => {
  for (const [w, h] of SIZES) {
    const { scene, rec } = sceneAt(w, h)
    for (const phase of PHASES) {
      for (const reduced of [false, true]) {
        for (const crowd of [newCrowd(4), newCrowd(13), newCrowd(24), { ...newCrowd(24), ranks: 8, size: 3 }]) {
          for (const progress of [0, 0.5, 1]) {
            rec.reset()
            scene.draw(frame({ phase, reduced, crowd, progress }))
            assert.ok(rec.ink().length > 0, `${phase} at ${w}×${h} drew nothing`)
          }
        }
      }
    }
  }
})

test("an empty street and a spent mob still draw", () => {
  const { scene, rec } = sceneAt(390, 844)
  for (const phase of PHASES) {
    rec.reset()
    scene.draw(frame({ phase, crowd: { ranks: 0, size: 2, downed: 24, total: 24 } }))
    assert.ok(rec.ink().length > 0, phase)
  }
  rec.reset()
  scene.draw(frame({ shutter: null, phase: "melee" }))
  assert.ok(rec.ink().length > 0)
})

test("every body standing is drawn, and drawn inside the street", () => {
  // The rectangle is the arithmetic, so a rank clipped off the bottom is a
  // picture of a lie: `12 = 4 × 3` has to have twelve people in it. One `arc`
  // per head, and the heads are the only arcs the scene draws.
  for (const [w, h] of SIZES) {
    const { scene, rec } = sceneAt(w, h)
    for (const crowd of [
      newCrowd(24),
      { ...newCrowd(24), ranks: 12, size: 2 },
      { ...newCrowd(24), ranks: 8, size: 3 },
      { ...newCrowd(16), ranks: 8, size: 2 },
      { ...newCrowd(9), ranks: 3, size: 3 },
    ]) {
      rec.reset()
      const layout = scene.draw(frame({ crowd, phase: "melee", pressure: 1 }))
      const heads = rec.ops.filter((op) => op.name === "arc")
      assert.equal(
        heads.length,
        crowd.ranks * crowd.size,
        `${crowd.ranks} × ${crowd.size} drew ${heads.length} bodies at ${w}×${h}`,
      )
      for (const head of heads) {
        const y = head.args[1] as number
        assert.ok(y >= 0 && y <= layout.mob.y + layout.mob.h, `a body sat at y=${y} at ${w}×${h}`)
      }
    }
  }
})

test("a stud is always a real touch target", () => {
  // A stud smaller than a finger reads as "that number did not work", which is
  // the one misreading this game cannot afford.
  for (const [w, h] of SIZES) {
    const { scene } = sceneAt(w, h)
    for (const size of [4, 12, 24]) {
      const layout = scene.draw(frame({ crowd: newCrowd(size) }))
      assert.equal(layout.studs.length, bar(size).length, `the bar for ${size}`)
      for (const stud of layout.studs) {
        assert.ok(stud.rect.w >= 40, `a ${stud.rect.w}px stud at ${w}×${h}`)
        assert.ok(stud.rect.h >= 44, `a ${stud.rect.h}px stud at ${w}×${h}`)
        assert.ok(stud.rect.x >= 0 && stud.rect.x + stud.rect.w <= w + 0.5, "a stud ran off the side")
        assert.ok(stud.rect.y + stud.rect.h <= h + 0.5, "a stud ran off the bottom")
      }
    }
  }
})

test("a rivet is always a real touch target, and is on the plate", () => {
  for (const [w, h] of SIZES) {
    const { scene } = sceneAt(w, h)
    const f = frame({ phase: "shutter", progress: 1 })
    const layout = scene.draw(f)
    assert.equal(layout.rivets.length, 4)
    for (const rivet of layout.rivets) {
      assert.ok(rivet.rect.h >= 44, `a ${rivet.rect.h}px rivet at ${w}×${h}`)
      assert.ok(rivet.rect.w >= 44, `a ${rivet.rect.w}px rivet at ${w}×${h}`)
      assert.ok(rivet.rect.x >= 0 && rivet.rect.x + rivet.rect.w <= w + 0.5)
      assert.ok(rivet.rect.y + rivet.rect.h <= h + 0.5)
    }
  }
})

test("nothing a finger can touch overlaps anything else it can touch", () => {
  const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a): boolean =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  for (const [w, h] of SIZES) {
    const { scene } = sceneAt(w, h)
    for (const size of [4, 9, 16, 24]) {
      const layout = scene.draw(frame({ crowd: newCrowd(size) }))
      for (let i = 0; i < layout.studs.length; i++) {
        for (let j = i + 1; j < layout.studs.length; j++) {
          const a = layout.studs[i]?.rect
          const b = layout.studs[j]?.rect
          assert.ok(a && b && !overlaps(a, b), `studs ${i} and ${j} overlap at ${w}×${h}`)
        }
        const stud = layout.studs[i]?.rect
        assert.ok(stud && !overlaps(stud, layout.mob), "a stud sits on top of the mob")
      }
    }
  }
})

test("the rectangle drawn is the rectangle struck", () => {
  const { scene } = sceneAt(390, 844)
  const layout = scene.draw(frame({ crowd: newCrowd(12) }))
  for (const stud of layout.studs) {
    const cx = stud.rect.x + stud.rect.w / 2
    const cy = stud.rect.y + stud.rect.h / 2
    assert.equal(hit(stud.rect, cx, cy), true, `the centre of stud ${stud.k} is not on stud ${stud.k}`)
    for (const other of layout.studs) {
      if (other.k === stud.k) continue
      assert.equal(hit(other.rect, cx, cy), false, `stud ${stud.k} also reads as ${other.k}`)
    }
  }
  assert.equal(hit(layout.mob, layout.mob.x + 1, layout.mob.y + 1), true)
  assert.equal(hit(layout.mob, layout.mob.x - 1, layout.mob.y), false)
})

test("the bar narrows with the rank, so a five never shows a nine", () => {
  const { scene } = sceneAt(390, 844)
  const twelve = scene.draw(frame({ crowd: newCrowd(12) }))
  const cracked = strike(newCrowd(12), 3)
  assert.equal(cracked.kind, "crack")
  const three = scene.draw(frame({ crowd: cracked.kind === "crack" ? cracked.crowd : newCrowd(3) }))
  assert.deepEqual(twelve.studs.map((s) => s.k), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  assert.deepEqual(three.studs.map((s) => s.k), [2])
})

test("being wrong puts no more ink on the screen than being right", () => {
  // The temptation this guards is specific: a refused seam wants sparks the
  // whole width of the street. `energy(SLIP) < energy(SEAT)` is the numeric
  // form of the rule; this is the drawn form.
  //
  // Measured as the ink a reaction *adds* over the same street at rest, because
  // the bar narrows with the rank size and a raw frame count would be comparing
  // two different sets of studs rather than two reactions.
  const { scene, rec } = sceneAt(390, 844)
  const ink = (f: Frame): number => {
    rec.reset()
    scene.draw(f)
    return rec.ink().length
  }
  const added = (crowd: Frame["crowd"], over: Partial<Frame>): number =>
    ink(frame({ crowd, ...over })) - ink(frame({ crowd, phase: "melee", lastSeam: 0, lastRemainder: 0 }))

  const twelve = newCrowd(12)
  const cracked = { ...twelve, ranks: 4, size: 3 }

  const right = added(cracked, { phase: "crack", lastSeam: 3 })
  const wrong = added(twelve, { phase: "ringoff", lastSeam: 5, lastRemainder: 2 })
  const bounced = added(twelve, { phase: "bounce" })

  assert.ok(right > 0, "a landing seam added no ink at all")
  assert.ok(wrong <= right, `a refused seam added ${wrong} marks against a landing seam's ${right}`)
  assert.ok(bounced <= right, `a bounce added ${bounced} marks against a landing seam's ${right}`)
})

test("the reduced branch keeps the crack and drops the travel", () => {
  // Reduced motion is a branch, not a degradation: the crack still crosses the
  // street, because the crack is how the child knows the seam landed.
  const { scene, rec } = sceneAt(390, 844)
  const crowd = { ...newCrowd(12), ranks: 4, size: 3 }
  rec.reset()
  scene.draw(frame({ phase: "crack", crowd, reduced: true, progress: 0.4 }))
  const strokes = rec.ops.filter((op) => op.name === "stroke")
  assert.ok(strokes.length > 0, "the reduced branch drew no crack")
  assert.ok(rec.ink().length > 0)
})

test("a resize does not strand the layout input reads", () => {
  const { canvas, rec } = fakeCanvas(390, 844)
  const scene = new Scene(canvas as HTMLCanvasElement)
  assert.equal(scene.lastLayout, null)
  scene.draw(frame())
  assert.ok(scene.lastLayout)
  scene.resize()
  assert.equal(scene.lastLayout, null, "a stale layout survived a resize")
  rec.reset()
  const layout = scene.draw(frame())
  assert.equal(scene.lastLayout, layout)
})

// --------------------------------------------------------- host chrome --

/** The shapes the fleet actually has, small phone first. */
const CHROME_SIZES: ReadonlyArray<readonly [number, number]> = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [844, 390],
] as const

/**
 * Everything on this frame a child must READ or TOUCH.
 *
 * The street, the furnace glow, the cobbles and the bodies are all deliberately
 * left out: they bleed to the edges and under the host's controls, which is
 * what `viewport-fit=cover` is for. What is listed here is the HUD band, the
 * stud bar, the plate — drawn clipped to `mob` — and its rivets, plus `mob`
 * itself, because a tap anywhere in `mob` swings.
 */
function critical(layout: Layout): Array<{ name: string; rect: ReturnType<typeof box> }> {
  return [
    { name: "the readouts", rect: box(layout.hud) },
    { name: "the mob (a tap here swings)", rect: box(layout.mob) },
    ...layout.studs.map((s) => ({ name: `stud ${s.k}`, rect: box(s.rect) })),
    ...layout.rivets.map((r) => ({ name: `rivet ${r.index}`, rect: box(r.rect) })),
  ]
}

const box = (r: { x: number; y: number; w: number; h: number }) => ({
  x: r.x,
  y: r.y,
  w: r.w,
  h: r.h,
})

test("nothing a child reads or touches lands under the host's chrome", () => {
  // The host paints an exit control in the top-LEFT corner and a how-to-play
  // control in the top-RIGHT, 44px each, floating OVER the game. It does not
  // reserve a band — reserving one costs a twelfth of a small phone's height.
  // The whole promise a game makes in exchange is these two squares.
  //
  // Run through `scene.draw`, which is the path the game itself takes at every
  // frame, so a layout that only clears the corners when called by hand cannot
  // pass this.
  for (const [w, h] of CHROME_SIZES) {
    const { scene } = sceneAt(w, h)
    for (const crowd of [newCrowd(4), newCrowd(12), newCrowd(13), newCrowd(24)]) {
      for (const phase of ["melee", "shutter", "crack", "shove"] as const) {
        const layout = scene.draw(frame({ crowd, phase, progress: 1 }))
        for (const { name, rect } of critical(layout)) {
          assert.equal(
            hitsHostChrome(rect, w),
            false,
            `${w}×${h}, ${phase}, mob of ${crowd.ranks}×${crowd.size}: ${name} is under the host's chrome`,
          )
        }
      }
    }
  }
})

test("the safe rect is what the layout is built on, not the raw frame", () => {
  // A notched phone held upright, and the same phone on its side. The street
  // still fills the glass; the studs, the readouts and the plate do not.
  const NOTCH: Insets = { top: 59, right: 0, bottom: 34, left: 0 }
  const SIDEWAYS: Insets = { top: 0, right: 59, bottom: 21, left: 59 }
  for (const [w, h, insets] of [
    [390, 844, NOTCH],
    [844, 390, SIDEWAYS],
  ] as const) {
    const area = safeRect(w, h, insets)
    const layout = layoutFor(w, h, area, frame({ phase: "shutter", progress: 1 }))
    for (const { name, rect } of critical(layout)) {
      assert.ok(rect.x >= area.x - 0.5, `${name} runs out the left of the safe rect at ${w}×${h}`)
      assert.ok(
        rect.x + rect.w <= area.x + area.w + 0.5,
        `${name} runs out the right of the safe rect at ${w}×${h}`,
      )
      assert.ok(rect.y >= area.y - 0.5, `${name} runs under the notch at ${w}×${h}`)
      assert.ok(
        rect.y + rect.h <= area.y + area.h + 0.5,
        `${name} runs under the home indicator at ${w}×${h}`,
      )
      assert.equal(
        hitsHostChrome(rect, w, insets),
        false,
        `${name} is under the host's chrome at ${w}×${h}`,
      )
    }
  }
})

test("the hint is drawn as a lit stud rather than as a sentence", () => {
  // No transient status text anywhere: state lives in the design. The only
  // thing a shove-back changes on screen is which stud is brass-bright.
  const { scene, rec } = sceneAt(390, 844)
  rec.reset()
  scene.draw(frame({ crowd: newCrowd(12), hintSeam: 0 }))
  const plain = rec.ops.filter((op) => op.name === "fillText").map((op) => String(op.args[0]))
  rec.reset()
  scene.draw(frame({ crowd: newCrowd(12), hintSeam: 2 }))
  const hinted = rec.ops.filter((op) => op.name === "fillText").map((op) => String(op.args[0]))
  assert.deepEqual(hinted, plain, "the hint added words to the screen")
})
