// THE TWO CORNERS, AND THE NOTCH.
//
// This game declares `viewport-fit=cover`, which is not a neutral setting: it
// opts the canvas *into* the notch, the home indicator and the rounded corners.
// And the host paints two 44px controls over every pack it runs — an exit
// chevron top-LEFT and the how-to-play button top-RIGHT. Neither is something a
// canvas can see. The shipped chrome drew `OPENED` at `(14, 12)` and `BEST` at
// `(w - 14, 12)`, which is underneath both of them and underneath a 47px notch
// as well, and nothing in this suite noticed, because every other test here is
// about mathematics.
//
// So this drives the REAL renderer — `Scene.draw`, through the same code path a
// frame takes — against a context that records instead of paints, and asserts
// what a screenshot on a notched phone would have shown: every word the child
// reads is inside the safe area and clear of both corners, and the tile bar,
// which is TAPPABLE (a tap on it drops the hold), is a target they can actually
// reach.
//
// Asserting the layout function on its own would not have caught the shipped
// bug: the bug was that the renderer did not consult one.
//
// Everything here is seeded. Reduced motion is on, which also means the screen
// shake — the one `Math.random` in the draw path — is exactly zero.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  hitsHostChrome,
  safeRect,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts"
import { Rng } from "../core/rng.ts"
import { Arena } from "../game/arena.ts"
import { hudLayout } from "../render/hud.ts"
import { Scene } from "../render/scene.ts"
import { Grid } from "../sim/grid.ts"
import { createStubHost } from "../stubHost.ts"
import { grindToPrimes } from "./harness.ts"

/** Every shape the fleet actually has, including the smallest phone. */
const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait, tall", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
]

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
/** A notched phone held upright: the sensor housing, and the home indicator. */
const PORTRAIT_NOTCH: Insets = { top: 47, right: 0, bottom: 34, left: 0 }
/** The same phone on its side: the housing moves to one edge, the bar shortens. */
const LANDSCAPE_NOTCH: Insets = { top: 0, right: 47, bottom: 21, left: 47 }

type Drawn = { text: string; box: Rect }

/**
 * One glyph is about 0.58em wide in the faces this game uses. The exact figure
 * does not matter as long as the recorder and `measureText` agree, which is
 * what makes the centred strings land where the renderer thinks they did.
 */
const advance = (text: string, px: number): number => text.length * px * 0.58

function fontSize(font: string): number {
  const m = /(\d+(?:\.\d+)?)px/.exec(font)
  return m ? Number(m[1]) : 16
}

/**
 * A 2D context that answers everything and writes down what it was told to
 * draw, in order — including the state (`font`, `textAlign`, `textBaseline`)
 * that was live at the moment of each `fillText`.
 */
function recorder(): { ctx: CanvasRenderingContext2D; log: Drawn[]; restores: number[] } {
  const log: Drawn[] = []
  const restores: number[] = []
  const state: Record<string, unknown> = {
    font: "16px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
  }
  // Save/restore DEPTH, not a raw count of `restore` calls.
  //
  // The world is drawn inside one save/restore pair and every husk, the ship and
  // the resonator save and restore *inside* it, so a raw count says nothing
  // about where the world ended. Only the restores that bring the depth back to
  // zero are boundaries between one block of drawing and the next, and the first
  // of those is the end of the world and the start of the chrome.
  let depth = 0
  const api: Record<string, unknown> = {
    measureText: (text: string) => ({ width: advance(text, fontSize(String(state.font))) }),
    createRadialGradient: () => ({ addColorStop() {} }),
    save: () => {
      depth += 1
    },
    restore: () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) restores.push(log.length)
    },
    fillText: (text: string, x: number, y: number) => {
      const px = fontSize(String(state.font))
      const w = advance(text, px)
      const align = String(state.textAlign)
      const baseline = String(state.textBaseline)
      const x0 = align === "left" || align === "start" ? x : align === "right" ? x - w : x - w / 2
      const y0 = baseline === "top" ? y : baseline === "middle" ? y - px / 2 : y - px
      log.push({ text, box: { x: x0, y: y0, w, h: px } })
    },
  }

  const ctx = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop in api) return api[prop]
        if (prop in state) return state[prop]
        return () => undefined
      },
      set(_t, prop: string, value) {
        state[prop] = value
        return true
      },
    },
  ) as unknown as CanvasRenderingContext2D

  return { ctx, log, restores }
}

function fakeCanvas(w: number, h: number, ctx: CanvasRenderingContext2D): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    style: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width: w, height: h, left: 0, top: 0 }),
    remove() {},
  } as unknown as HTMLCanvasElement
}

/**
 * Run `body` with a document whose `env(safe-area-inset-*)` resolve to `insets`.
 *
 * `safeInsets` measures the real thing through a hidden probe and
 * `getComputedStyle`, so this is the only way to put a notch on a machine that
 * has no screen — and it exercises the same code the device runs.
 */
function withInsets(insets: Insets, body: () => void): void {
  const saved = new Map<string, PropertyDescriptor | undefined>()
  const set = (key: string, value: unknown): void => {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const element = { style: {} as Record<string, string>, setAttribute() {} }
  set("document", {
    body: { appendChild() {} },
    getElementById: () => null,
    createElement: () => element,
  })
  set("getComputedStyle", () => ({
    paddingTop: `${insets.top}px`,
    paddingRight: `${insets.right}px`,
    paddingBottom: `${insets.bottom}px`,
    paddingLeft: `${insets.left}px`,
  }))
  try {
    body()
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}

type Frame = { scene: Scene; chrome: Drawn[] }

/**
 * Play a few seconds of a real sitting and draw one real frame.
 *
 * The hold is filled first, because an empty tile bar draws nothing and a test
 * that never renders the tiles is a test that cannot see them collide.
 */
function frame(
  w: number,
  h: number,
  opts: { stalled: boolean; paused: boolean; hintTaps?: number },
): Frame {
  const seed = 0x1a771ce
  const host = createStubHost({ seed, reducedMotion: true })
  const { ctx, log, restores } = recorder()
  const scene = new Scene(fakeCanvas(w, h, ctx), true)
  const arena = new Arena(host, new Rng(seed ^ 0x51de), { width: w, height: h })
  const grid = new Grid({ cols: 8, rows: 8, width: w, height: h, reduced: true })
  arena.begin(0)

  // Grind the field to primes and sweep a handful, so the tile bar has tiles
  // and a running product beside them.
  grindToPrimes(arena)
  for (const body of arena.bodies.slice(0, 5)) arena.touch(body.id)
  assert.ok(arena.bank.size > 0, "the hold stayed empty, so the tile bar drew nothing")

  // The factor tree is chrome too — every numeral and every `?` on it is
  // something the child reads — so it has to be on screen when this measures.
  // Asked for rather than waited for: the clock here is a literal `0`.
  for (let i = 0; i < (opts.hintTaps ?? 0); i++) arena.askHint(0)

  scene.say("RESONANCE", "#f0d878")
  const state = {
    best: 12,
    paused: opts.paused,
    stalled: opts.stalled,
    hint: arena.hint(0),
  }
  // Two frames, and the first one is thrown away: the tree schedules its own
  // arrival on the frame it is first drawn, so a single frame would measure
  // every node at a fifth of its size and prove nothing about where a
  // full-sized numeral lands.
  scene.draw(arena, grid, state)
  scene.advance(900)
  log.length = 0
  restores.length = 0
  scene.draw(arena, grid, state)

  // Everything after the LAST `restore()` is chrome: the world is drawn inside
  // one save/restore pair and the tile bar, the counters and the banner are
  // drawn after it. Bodies and the resonator's prompt are playfield — they
  // drift wherever the physics takes them, including under a corner, and that
  // is the point of `cover`.
  //
  // The hint tree draws inside its own save/restore, so the slice is taken from
  // the restore that closes the WORLD — index 0 of what is left after the world
  // is the first thing the chrome drew.
  const last = restores[0] ?? 0
  return { scene, chrome: log.slice(last) }
}

const inside = (box: Rect, area: Rect): boolean =>
  box.x >= area.x - 0.5 &&
  box.y >= area.y - 0.5 &&
  box.x + box.w <= area.x + area.w + 0.5 &&
  box.y + box.h <= area.y + area.h + 0.5

for (const [name, w, h] of VIEWPORTS) {
  for (const insets of [NO_INSETS, w > h ? LANDSCAPE_NOTCH : PORTRAIT_NOTCH]) {
    const label = insets === NO_INSETS ? "no insets" : "with a notch"
    test(`nothing the child reads is under the host's chrome at ${name} (${w}×${h}), ${label}`, () => {
      withInsets(insets, () => {
        const area = safeRect(w, h)
        for (const state of [
          { stalled: false, paused: false },
          { stalled: true, paused: false },
          { stalled: false, paused: true },
          // The silhouette, the partial, and the whole tree. Every `?` and
          // every numeral on it is something the child has to read.
          { stalled: false, paused: false, hintTaps: 1 },
          { stalled: false, paused: false, hintTaps: 4 },
          { stalled: false, paused: false, hintTaps: 6 },
        ]) {
          const { chrome } = frame(w, h, state)
          assert.ok(chrome.length > 0, "no chrome was drawn at all")
          for (const drawn of chrome) {
            assert.equal(
              hitsHostChrome(drawn.box, w),
              false,
              `"${drawn.text}" is under the host's chrome at ${w}×${h}`,
            )
            assert.ok(
              inside(drawn.box, area),
              `"${drawn.text}" is outside the safe area at ${w}×${h}: ` +
                `${JSON.stringify(drawn.box)} vs ${JSON.stringify(area)}`,
            )
          }
        }
      })
    })

    test(`the tile bar can be tapped at ${name} (${w}×${h}), ${label}`, () => {
      // The bar is not decoration: tapping it throws the hold back on the field,
      // which is the only way out of a wrong hold. So it is a touch target, and
      // it must be neither under a host button nor under the home indicator.
      withInsets(insets, () => {
        const area = safeRect(w, h)
        const { scene } = frame(w, h, { stalled: false, paused: false })

        const corners: Rect[] = [
          { x: insets.left + HOST_MARGIN, y: insets.top + HOST_PROGRESS_H + HOST_MARGIN, w: HOST_CONTROL, h: HOST_CONTROL },
          {
            x: w - insets.right - HOST_MARGIN - HOST_CONTROL,
            y: insets.top + HOST_PROGRESS_H + HOST_MARGIN,
            w: HOST_CONTROL,
            h: HOST_CONTROL,
          },
        ]
        for (const corner of corners) {
          for (let i = 0; i <= 4; i++) {
            for (let j = 0; j <= 4; j++) {
              const x = corner.x + (corner.w * i) / 4
              const y = corner.y + (corner.h * j) / 4
              assert.equal(scene.hitsTileBar(x, y), false, `the tile bar reaches ${x},${y}`)
            }
          }
        }

        // And nothing of it hangs below the safe area, where a swipe belongs to
        // the operating system rather than to the game.
        const floor = area.y + area.h
        for (let i = 0; i <= 20; i++) {
          const x = (w * i) / 20
          assert.equal(
            scene.hitsTileBar(x, floor + 1),
            false,
            `the tile bar hangs into the home indicator at x=${x}`,
          )
          assert.equal(scene.hitsTileBar(x, h - 1), false, "the tile bar reaches the canvas floor")
        }

        // It is still a real target where it says it is, rather than merely
        // being somewhere harmless.
        assert.equal(
          scene.hitsTileBar(area.x + area.w / 2, floor - 30),
          true,
          "the tile bar is not where it says",
        )
      })
    })

    test(`the hint control can be tapped and never drops the hold at ${name} (${w}×${h}), ${label}`, () => {
      // Two failures this catches, and the second is the expensive one:
      //
      //   * a hint control under the host's exit chevron or under the home
      //     indicator, which is a child who cannot ask for help at all; and
      //   * a hint control OVERLAPPING the tile bar, which is a child who
      //     reaches for help and instead throws away the hold they have spent a
      //     minute assembling. That is the exact shape of "a hint costs
      //     something", built out of geometry rather than out of rules.
      withInsets(insets, () => {
        const area = safeRect(w, h)
        const { scene } = frame(w, h, { stalled: false, paused: false })
        const { cx, cy, r } = hudLayout(w, area).hint

        assert.ok(r * 2 >= 44, `the hint control is ${r * 2}px across, under the 44px minimum`)
        assert.equal(scene.hitsHint(cx, cy), true, "the hint control is not where it says")
        assert.ok(
          inside({ x: cx - r, y: cy - r, w: r * 2, h: r * 2 }, area),
          `the hint control is outside the safe area at ${w}×${h}`,
        )
        assert.equal(
          hitsHostChrome({ x: cx - r, y: cy - r, w: r * 2, h: r * 2 }, w),
          false,
          "the hint control is under one of the host's corners",
        )

        // Nowhere the hint control answers may the tile bar answer too.
        for (let i = 0; i <= 6; i++) {
          for (let j = 0; j <= 6; j++) {
            const x = cx - r + (r * 2 * i) / 6
            const y = cy - r + (r * 2 * j) / 6
            if (!scene.hitsHint(x, y)) continue
            assert.equal(
              scene.hitsTileBar(x, y),
              false,
              `asking for a hint at ${x},${y} would also drop the hold`,
            )
          }
        }
      })
    })
  }
}

test("the tree has somewhere to be at every shape the fleet has", () => {
  // A hint nobody can read is not a hint. `TREE_SHARE` set to zero, or a stack
  // that put the tree box behind the counters, both leave the layout function
  // returning a perfectly valid rectangle one pixel tall, and every other
  // assertion in this file goes on passing — the numerals still land inside the
  // safe area, because they are drawn inside a box that is not there.
  //
  // Three claims, in the order they would break: the box is big enough to read,
  // it is inside the safe area, and it is stacked clear of the two things it
  // sits on — the hint control and, under that, the tile bar.
  for (const [name, w, h] of VIEWPORTS) {
    for (const insets of [NO_INSETS, w > h ? LANDSCAPE_NOTCH : PORTRAIT_NOTCH]) {
      withInsets(insets, () => {
        const area = safeRect(w, h)
        const l = hudLayout(w, area)
        const box: Rect = l.tree

        // 130 × 180 is the floor the widest and deepest tree in the band needs:
        // `512 = 2⁹` is nine leaves over four rows, and at the renderer's minimum
        // node radius of 9 that is 182px across and about 100px down. Anything
        // under this and the worst case is drawn on top of itself.
        assert.ok(box.h >= 130, `${name}: the tree gets ${box.h}px of height, which is not a tree`)
        assert.ok(box.w >= 180, `${name}: the tree gets ${box.w}px of width`)
        assert.ok(inside(box, area), `${name}: the tree box is outside the safe area`)

        // The control sits BESIDE the tree at the bottom-left of its band, and
        // the whole band sits on the tile bar. So the separation to check is
        // horizontal for the control and vertical for the bar.
        assert.ok(
          box.x >= l.hint.cx + l.hint.r,
          `${name}: the tree box runs over the hint control`,
        )
        assert.ok(
          box.y + box.h <= l.bar.y - Math.max(22, l.bar.size) + 0.5,
          `${name}: the tree hangs into the tile bar's tap zone`,
        )
        assert.ok(
          l.hint.cy + Math.max(22, l.hint.r) <= l.bar.y - Math.max(22, l.bar.size) + 0.5,
          `${name}: the hint control hangs into the tile bar's tap zone`,
        )
        // And it begins below the counters rather than through them.
        assert.ok(box.y >= l.status.top + l.status.lineH * 2, `${name}: the tree covers the counters`)
      })
    }
  }
})

test("on a pane too short for it, the tree gives way to the counters", () => {
  // A Split View slice and a phone held sideways with the keyboard up are both
  // real shapes, and on them the third-of-the-height cap is not what runs out
  // first — the top of the screen is. So the tree has a ceiling as well as a
  // share, and this is the shape that proves the ceiling is load-bearing rather
  // than decorative: at 1024×320 it is the binding constraint, and without it
  // the tree draws straight through OPENED and CHAIN.
  for (const [w, h] of [
    [1024, 320],
    [1180, 300],
    [900, 340],
  ] as Array<[number, number]>) {
    withInsets(NO_INSETS, () => {
      const l = hudLayout(w, safeRect(w, h))
      assert.ok(
        l.tree.y >= l.status.top + l.status.lineH * 2,
        `${w}×${h}: the tree draws through the counters (${l.tree.y} vs ${
          l.status.top + l.status.lineH * 2
        })`,
      )
      assert.ok(l.tree.h > 0, `${w}×${h}: the tree has no height at all`)
    })
  }
})

test("the layout consumes the insets it is given", () => {
  // The safe rectangle is the whole contract with the notch, and `hudLayout`
  // takes it as a REQUIRED argument for the same reason `layoutFor` does in
  // SKY LEDGER: optional, a caller that forgets it compiles and draws the score
  // under the sensor housing, and the only way to find out is on a device.
  const w = 390
  const h = 844
  const plain = hudLayout(w, safeRect(w, h, NO_INSETS))
  const notched = hudLayout(w, safeRect(w, h, PORTRAIT_NOTCH))

  assert.ok(notched.status.top >= plain.status.top + 47, "the counters ignored the notch")
  assert.ok(notched.status.top >= 47, "the counters are inside the notch")
  assert.ok(notched.bar.y <= plain.bar.y - 34, "the tile bar ignored the home indicator")
  assert.equal(plain.status.left, 14)
  assert.ok(
    plain.status.top >= HOST_PROGRESS_H + HOST_MARGIN + HOST_CONTROL,
    "the counters begin inside the host's corner controls",
  )
})
