// THE COMPREHENSION WINDOW — the child's time, and what they can see while
// they spend it.
//
// `docs/EXPERIENCE_DESIGN.md`: **"T=0→C COMPREHENSION — not budgeted. The
// child's time. Measured, never limited."**
//
// Three things have to be true for that sentence to mean anything in a game
// where the question walks down a lattice, and each of them is a test below:
//
//   1. **The question is on the screen, legibly, for as long as an answer is
//      accepted.** A prompt that is deleted at the fracture line turns column
//      arithmetic into a memory test with a shooter running underneath it.
//   2. **The window follows the ITEM, never the motion.** The descent speed is
//      the excitement knob. If the two share a knob then the harder question
//      gets the shorter window, which is the exact inversion of the rule.
//   3. **Running out of time is not being wrong.** A child who was still
//      computing must not be written into the learner model as a child who
//      cannot do the skill.
//
// These are asserted through the real `mountBeam` on a virtual clock, with a
// recording 2D context, because every one of them was true of the code's
// *comments* while being false of the code.

import { test } from "node:test"
import assert from "node:assert/strict"

import { REVEAL_SETTLE_MS } from "../../../../packs/shared/game-pacing/index.ts"
import { mount } from "../contract.ts"
import type { Host, Question } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { geomForViewport } from "../render/geom.ts"
import { promptPlate, PROMPT_MIN_PX } from "../render/hall.ts"
import { buildCore } from "../sim/core.ts"
import { Director, readingRelief } from "../sim/director.ts"
import { noteRead, resetReadForTest } from "../sim/learned.ts"
import { CALM_CORES } from "../sim/opening.ts"
import { A_CANDIDATE, A_ORDINARY } from "../sim/field.ts"
import { shovedUrgency } from "../sim/pulse.ts"
import {
  comprehensionWindow,
  MAX_WINDOW_SECONDS,
  MIN_WINDOW_SECONDS,
  needsRegrouping,
  widestColumn,
} from "../sim/window.ts"
import { createStubHost } from "../stubHost.ts"

// ─── A surface that remembers what was painted ────────────────────────────────

type Painted = { text: string; px: number; x: number; y: number }

type Recorder = {
  el: HTMLElement
  install(step?: number): () => void
  step(ms: number): void
  /** What `fillText` drew, frame by frame. Index is the frame number. */
  readonly frames: Painted[][]
  press(key: string): void
}

/**
 * Like `loop.test.ts`'s stub surface, but the 2D context is a recorder rather
 * than a black hole: `font` is parsed and every `fillText` is filed under the
 * frame it happened in. That is the only way to assert the thing that actually
 * matters here — that a child looking at the screen can READ the question.
 *
 * `measureText` returns a realistic advance width for the current size, so a
 * plate that shrinks its type to fit shrinks it in this test too.
 */
function recorder(width: number, height: number, wallClock: number): Recorder {
  const rect = { left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }
  const keys = new Map<string, (e: unknown) => void>()
  const frames: Painted[][] = []
  let px = 10

  const ctx = {
    font: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: "",
    textBaseline: "",
    globalCompositeOperation: "",
    canvas: { width, height },
    setTransform: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    translate: () => undefined,
    scale: () => undefined,
    rotate: () => undefined,
    transform: () => undefined,
    resetTransform: () => undefined,
    beginPath: () => undefined,
    closePath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    arc: () => undefined,
    ellipse: () => undefined,
    rect: () => undefined,
    fill: () => undefined,
    stroke: () => undefined,
    fillRect: () => undefined,
    clearRect: () => undefined,
    clip: () => undefined,
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    createRadialGradient: () => ({ addColorStop: () => undefined }),
    measureText: (t: string) => ({ width: t.length * px * 0.56 }),
    fillText: (t: string, x: number, y: number) => {
      const frame = frames[frames.length - 1]
      // Position too: it is what proves the hall is HELD during a reveal
      // rather than merely still carrying the same numerals.
      if (frame) frame.push({ text: t, px, x, y })
    },
  }
  // `font` is a plain property on a real context and the size has to be read
  // back out of the shorthand, which is what a browser does too.
  Object.defineProperty(ctx, "font", {
    get: () => `${String(px)}px sans-serif`,
    set: (value: string) => {
      const m = /(\d+(?:\.\d+)?)px/.exec(value)
      if (m?.[1] !== undefined) px = Number(m[1])
    },
    configurable: true,
  })

  const makeEl = (): HTMLElement => {
    const el = {
      style: { cssText: "" },
      width: 0,
      height: 0,
      id: "",
      type: "",
      className: "",
      textContent: "",
      tabIndex: 0,
      hidden: false,
      scrollTop: 0,
      appendChild: () => undefined,
      append: () => undefined,
      remove: () => undefined,
      focus: () => undefined,
      setAttribute: () => undefined,
      getAttribute: () => null,
      removeAttribute: () => undefined,
      getBoundingClientRect: () => rect,
      getContext: () => ctx,
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
      hasPointerCapture: () => false,
      addEventListener: (k: string, h: (e: unknown) => void) => keys.set(k, h),
      removeEventListener: (k: string) => keys.delete(k),
    }
    return el as unknown as HTMLElement
  }

  let pending: ((t: number) => void) | null = null
  let clock = 0

  const saved = {
    raf: globalThis.requestAnimationFrame,
    caf: globalThis.cancelAnimationFrame,
    ro: (globalThis as { ResizeObserver?: unknown }).ResizeObserver,
    now: performance.now,
    key: globalThis.addEventListener,
    unkey: globalThis.removeEventListener,
    dpr: (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
    doc: (globalThis as { document?: unknown }).document,
    dateNow: Date.now,
    nav: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
  }

  return {
    el: makeEl(),
    frames,
    /**
     * @param step where on the ramp this child is. **The steady state by
     *   default**, exactly as `games/lattice`'s `rig()` defaults its
     *   `experience` — every case in this file was written about the shipped
     *   game and must keep asking about the shipped game. `opening.test.ts` is
     *   the one that asks for a first sitting, and it says so out loud.
     *
     *   Reset either way: the ramp's memory is module state, node has no
     *   `localStorage`, and it survives every mount in the process. A test that
     *   did not clear it would play a different game than the one before it did.
     */
    install: (step: number = CALM_CORES) => {
      resetReadForTest()
      for (let i = 0; i < step; i++) noteRead()
      globalThis.requestAnimationFrame = ((cb: (t: number) => void): number => {
        pending = cb
        return 1
      }) as typeof globalThis.requestAnimationFrame
      globalThis.cancelAnimationFrame = ((): void => {
        pending = null
      }) as typeof globalThis.cancelAnimationFrame
      ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
        observe(): void {}
        disconnect(): void {}
      }
      performance.now = () => clock
      Date.now = () => wallClock
      Object.defineProperty(globalThis, "navigator", {
        value: { hardwareConcurrency: 12 },
        configurable: true,
        writable: true,
      })
      ;(globalThis as { devicePixelRatio?: number }).devicePixelRatio = 2
      globalThis.addEventListener = ((k: string, h: (e: unknown) => void): void => {
        keys.set(k, h)
      }) as unknown as typeof globalThis.addEventListener
      globalThis.removeEventListener = ((k: string): void => {
        keys.delete(k)
      }) as unknown as typeof globalThis.removeEventListener
      ;(globalThis as { document?: unknown }).document = {
        createElement: () => makeEl(),
        getElementById: () => null,
        body: makeEl(),
      }
      return () => {
        globalThis.requestAnimationFrame = saved.raf
        globalThis.cancelAnimationFrame = saved.caf
        ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = saved.ro
        performance.now = saved.now
        ;(globalThis as { devicePixelRatio?: number }).devicePixelRatio = saved.dpr
        globalThis.addEventListener = saved.key
        globalThis.removeEventListener = saved.unkey
        ;(globalThis as { document?: unknown }).document = saved.doc
        Date.now = saved.dateNow
        if (saved.nav) Object.defineProperty(globalThis, "navigator", saved.nav)
      }
    },
    step: (ms: number) => {
      clock += ms
      frames.push([])
      const cb = pending
      pending = null
      cb?.(clock)
    },
    press: (key: string) => {
      keys.get("keydown")?.({ key, preventDefault: () => undefined })
    },
  }
}

type Wave = {
  id: string
  prompt: string
  /** The frame the item became the live CORE. */
  from: number
  /** The frame the wave was resolved — answered, or run out. */
  to: number
  /** How it ended. */
  end: "answered" | "unanswered"
}

/**
 * Play the real game and return every wave that ran to a conclusion, with the
 * frames it was on the lattice for.
 *
 * The stub host is wrapped rather than replaced: `next` is what tells us which
 * item became a CORE and when, and `report`/`skip` are what tell us the wave
 * ended. Items drawn and passed over never end, so they never appear.
 */
function playRecording(
  seed: number,
  frames: number,
  input: (frame: number, press: (k: string) => void, rng: Rng) => void,
  size: [number, number] = [768, 1024],
): { waves: Wave[]; painted: Painted[][]; reports: Question["id"][] } {
  const rec = recorder(size[0], size[1], seed * 7919)
  const restore = rec.install()
  const stub = createStubHost({ seed, reducedMotion: false })
  const promptById = new Map<string, string>()
  const open = new Map<string, { prompt: string; from: number }>()
  const waves: Wave[] = []
  const reports: string[] = []
  let frame = 0

  const close = (id: string, end: Wave["end"]): void => {
    const live = open.get(id)
    if (!live) return
    open.delete(id)
    waves.push({ id, prompt: live.prompt, from: live.from, to: frame, end })
  }

  const host: Host = {
    next: (o) => {
      const q = stub.next(o)
      promptById.set(q.id, q.prompt)
      // Every draw is a candidate for becoming the CORE; the one that does is
      // the one that is later reported or skipped. Overwriting is right: only
      // the last draw of a frame can be the one that was built.
      open.set(q.id, { prompt: q.prompt, from: frame })
      return q
    },
    report: (r) => {
      reports.push(r.questionId)
      close(r.questionId, "answered")
    },
    skip: (id) => {
      close(id, "unanswered")
    },
    haptic: () => undefined,
    prefersReducedMotion: () => false,
  }

  const handle = mount(rec.el, host)
  const rng = new Rng(seed ^ 0x51de)
  try {
    for (let i = 0; i < frames; i++) {
      frame = i
      rec.step(16)
      input(i, rec.press, rng)
    }
  } finally {
    handle.unmount()
    restore()
  }
  return { waves, painted: rec.frames, reports }
}

/** A child's hands: mostly moving, firing often. Same shape as `loop.test.ts`. */
const flailing = (_i: number, press: (k: string) => void, rng: Rng): void => {
  if (rng.chance(0.09)) press(rng.chance(0.5) ? "ArrowLeft" : "ArrowRight")
  if (rng.chance(0.22)) press(" ")
}

type Ending = {
  id: string
  prompt: string
  answer: string
  /** The frame the item became the live CORE. */
  from: number
  /** The frame it was resolved. */
  frame: number
  end: Wave["end"]
}

/**
 * A run against ONE fixed, deliberately small item, played by a child who never
 * touches the controls.
 *
 * This exists because a wave running out is nearly unreachable by accident:
 * random flailing hits a candidate long before a twenty-three second window
 * closes, and a child who fires at nothing loses their anchors first. Both of
 * those are the game working. But the timeout path still has to be RIGHT, so it
 * is reached on purpose: `4 + 4` earns the six-second floor, which closes well
 * inside the first anchor's life.
 *
 * That is also the only reason this file can assert anything about it. The
 * suite's existing `if (r.answered === "") assert.equal(r.correct, false)` was
 * guarding a branch no test in the package had ever executed.
 */
function playOneSmallItem(
  size: [number, number],
  frames: number,
  /** Frames the child pulls the trigger on. Nothing else is ever pressed. */
  fireAt: readonly number[] = [],
): { endings: Ending[]; painted: Painted[][]; reports: number } {
  const rec = recorder(size[0], size[1], 0x5a1e)
  const restore = rec.install()
  const endings: Ending[] = []
  let served = 0
  let reports = 0
  let frame = 0
  const items = new Map<string, { prompt: string; answer: string; from: number }>()

  const host: Host = {
    next: () => {
      served++
      const id = `tiny-${String(served)}`
      const q: Question = {
        id,
        prompt: "4 + 4",
        answer: "8",
        distractors: ["6", "9", "12"],
        domain: "add",
        difficulty: 1,
      }
      items.set(id, { prompt: q.prompt, answer: q.answer, from: frame })
      return q
    },
    report: (r) => {
      reports++
      const it = items.get(r.questionId)
      if (it) endings.push({ id: r.questionId, ...it, frame, end: "answered" })
    },
    skip: (id) => {
      const it = items.get(id)
      if (it) endings.push({ id, ...it, frame, end: "unanswered" })
    },
    haptic: () => undefined,
    prefersReducedMotion: () => false,
  }

  const handle = mount(rec.el, host)
  try {
    for (let i = 0; i < frames; i++) {
      frame = i
      rec.step(16)
      if (fireAt.includes(i)) rec.press(" ")
    }
  } finally {
    handle.unmount()
    restore()
  }
  return { endings, painted: rec.frames, reports }
}

// ─── 1. The question stays on the screen ──────────────────────────────────────

test("THE PROMPT IS LEGIBLE FOR AS LONG AS AN ANSWER IS ACCEPTED", () => {
  // The defect this exists to make impossible: the three-digit column sum was
  // painted at the 9px floor near the vanishing point for about one and a
  // third seconds, and then the CORE body was killed at the fracture line and
  // the prompt was drawn NOWHERE. From that frame the child was doing column
  // arithmetic from memory while an automaton reached the floor every second.
  //
  // So: every frame from the CORE arriving to the wave being resolved must
  // paint the prompt, at a size a seven-year-old can read across a tablet.
  // First, deterministically, where the window is spent in full rather than
  // cut short by a lucky shot: a child who is thinking, and a wave that runs
  // the whole way to the floor. This is the case the old code turned into a
  // memory test with a shooter running underneath it.
  const small = playOneSmallItem([768, 1024], 1400)
  const ran = small.endings.find((e) => e.end === "unanswered")
  assert.ok(ran, "the deliberate wave never ran out")
  const blind: number[] = []
  let smallest = Infinity
  for (let f = ran.from; f < ran.frame; f++) {
    const hit = (small.painted[f] ?? []).filter((p) => p.text === ran.prompt)
    if (hit.length === 0) blind.push(f)
    else smallest = Math.min(smallest, Math.max(...hit.map((p) => p.px)))
  }
  assert.equal(
    blind.length,
    0,
    `"${ran.prompt}" vanished for ${String(blind.length)} of ` +
      `${String(ran.frame - ran.from)} frames it could still be answered in`,
  )
  assert.ok(smallest >= PROMPT_MIN_PX, `it fell to ${smallest.toFixed(1)}px`)
  // And then across three runs of a child flailing at the controls.
  let checked = 0
  for (const seed of [0x11be, 0x22be, 0x33be]) {
    const { waves, painted } = playRecording(seed, 2600, flailing)
    assert.ok(waves.length > 0, `seed ${String(seed)} never resolved a wave`)
    for (const w of waves) {
      const blind: number[] = []
      let smallest = Infinity
      // Up to but not including `to`: the wave is resolved inside that frame's
      // simulation step, so nothing drawn afterwards is still answerable.
      for (let f = w.from; f < w.to; f++) {
        const hit = (painted[f] ?? []).filter((p) => p.text === w.prompt)
        if (hit.length === 0) {
          blind.push(f)
          continue
        }
        smallest = Math.min(smallest, Math.max(...hit.map((p) => p.px)))
      }
      assert.equal(
        blind.length,
        0,
        `"${w.prompt}" was not on the screen at all for ${String(blind.length)} of ` +
          `${String(w.to - w.from + 1)} frames it could still be answered in`,
      )
      assert.ok(
        smallest >= PROMPT_MIN_PX,
        `"${w.prompt}" fell to ${smallest.toFixed(1)}px while it was still answerable ` +
          `(floor ${String(PROMPT_MIN_PX)}px)`,
      )
      checked++
    }
  }
  assert.ok(checked >= 6, `only ${String(checked)} waves were checked`)

})

test("THE CORE ACTUALLY WALKS DOWN THE LATTICE CARRYING THE PROBLEM", () => {
  // Not a duplicate of the plate. `spawnCore` claimed a body from the pool and
  // called `retune` before dressing it, and `retune` disperses every ORDINARY
  // body that no beam divides — the blank defaults are `kind: A_ORDINARY,
  // value: 0`, and no beam divides zero. So the CORE was killed on the frame it
  // was born, every wave, since the function was written. The wide lapis slab
  // the how-to-play sheet describes as "a big blue robot comes down the middle
  // with a sum on it" has never existed. What fractured instead was whichever
  // ordinary automaton the pool handed that slot to next, deleted mid-descent
  // for a question nobody had read.
  //
  // The plate alone hides this perfectly, which is exactly why it is asserted
  // separately: the problem must be ON something that descends.
  const { endings, painted } = playOneSmallItem([768, 1024], 1400)
  const ran = endings.find((e) => e.end === "unanswered")
  assert.ok(ran, "the wave never ran out")

  // Every y the prompt was painted at, in order. The plate is one fixed
  // position; the slab is a moving one.
  const ys: number[] = []
  for (let f = ran.from; f < ran.frame; f++) {
    for (const p of painted[f] ?? []) if (p.text === ran.prompt) ys.push(p.y)
  }
  const distinct = new Set(ys.map((y) => y.toFixed(1)))
  assert.ok(
    distinct.size > 3,
    `the problem was only ever painted at ${String(distinct.size)} position(s) — ` +
      `nothing carried it down the lattice`,
  )
  const moving = ys.filter((y) => ys.filter((z) => z === y).length < ys.length / 4)
  const first = moving[0]
  const last = moving[moving.length - 1]
  assert.ok(first !== undefined && last !== undefined)
  assert.ok(last > first, "whatever carried the problem was not descending")
})

test("the prompt plate is legible on the smallest lattice, and clear of the host's corners", () => {
  for (const [w, h] of [
    [320, 480],
    [360, 640],
    [768, 1024],
    [1024, 768],
    [1366, 1024],
  ] as const) {
    const geom = geomForViewport(w, h, 5)
    const plate = promptPlate(geom, "1,234 + 5,678")
    // And a prompt far longer than anything the curriculum serves today. The
    // plate shrinks to fit, but never below the floor: an unreadable question
    // is worse than one that runs a little wide.
    const long = promptPlate(geom, "123,456,789 + 987,654,321")
    assert.ok(
      long.px >= PROMPT_MIN_PX,
      `${String(w)}x${String(h)}: a long prompt shrank to ${long.px.toFixed(1)}px`,
    )
    assert.ok(
      plate.px >= PROMPT_MIN_PX,
      `${String(w)}x${String(h)}: prompt would be ${plate.px.toFixed(1)}px`,
    )
    // Inside the safe rectangle: `viewport-fit=cover` means the notch and the
    // home indicator are ours to avoid, and the prompt is the most important
    // text in the game.
    assert.ok(plate.box.x >= geom.area.x, `${String(w)}x${String(h)}: plate crosses the left inset`)
    assert.ok(
      plate.box.x + plate.box.w <= geom.area.x + geom.area.w + 0.001,
      `${String(w)}x${String(h)}: plate crosses the right inset`,
    )
    assert.ok(plate.box.y >= geom.area.y, `${String(w)}x${String(h)}: plate crosses the top inset`)
  }
})

// ─── 2. The window follows the item, not the motion ───────────────────────────

test("THE WINDOW IS MONOTONE NON-DECREASING IN THE ITEM'S DIFFICULTY", () => {
  // The invariant, stated once: a harder question may never get less time than
  // an easier one. The old window was `1.184 × descentSeconds`, and
  // `descentSeconds` is the motion constant the pressure curve tightens — so
  // the window ran 11.84s down to 6.87s on exactly the curve that took the
  // requested difficulty from 2 to 9.
  const classes: { prompt: string; answer: number }[] = [
    { prompt: "4 + 3", answer: 7 },
    { prompt: "6 + 2", answer: 8 },
    { prompt: "31 + 24", answer: 55 },
    { prompt: "27 + 15", answer: 42 },
    { prompt: "342 + 216", answer: 558 },
    { prompt: "247 + 158", answer: 405 },
    { prompt: "5341 + 2216", answer: 7557 },
    { prompt: "5001 − 2798", answer: 2203 },
  ]
  let previous = 0
  for (const item of classes) {
    const w = comprehensionWindow(item)
    assert.ok(
      w >= previous,
      `"${item.prompt}" gets ${w.toFixed(1)}s, less than the easier item before it ` +
        `at ${previous.toFixed(1)}s`,
    )
    assert.ok(w >= MIN_WINDOW_SECONDS && w <= MAX_WINDOW_SECONDS, `"${item.prompt}" → ${String(w)}s`)
    previous = w
  }
  // And the house cadence table is actually met, not merely bracketed.
  // p90 for two-digit-with-regrouping is 14s; for the `5,001 − 2,798` class, 40s.
  assert.ok(
    comprehensionWindow({ prompt: "27 + 15", answer: 42 }) >= 14,
    "two-digit regrouping is served under the house p90 of 14s",
  )
  assert.ok(
    comprehensionWindow({ prompt: "5001 − 2798", answer: 2203 }) >= 40,
    "the `5,001 − 2,798` class is served under the house p90 of 40s",
  )
})

test("the window is monotone over every column width and every regrouping", () => {
  // Over the whole partial order the window is defined on, rather than a
  // handful of examples: more columns is never less time, and needing to
  // regroup is never less time than not needing to. Every item below is a real
  // item — its answer really has that many columns, and it really does or does
  // not carry — because the function reads the item, not a label on it.
  const plain: Record<number, { prompt: string; answer: number }> = {
    1: { prompt: "4 + 3", answer: 7 },
    2: { prompt: "31 + 24", answer: 55 },
    3: { prompt: "342 + 216", answer: 558 },
    4: { prompt: "5341 + 2216", answer: 7557 },
  }
  const carried: Record<number, { prompt: string; answer: number }> = {
    2: { prompt: "27 + 15", answer: 42 },
    3: { prompt: "247 + 158", answer: 405 },
    4: { prompt: "5001 − 2798", answer: 2203 },
  }
  for (let d = 1; d <= 4; d++) {
    const flat = plain[d]
    assert.ok(flat, `no ${String(d)}-column item`)
    assert.equal(widestColumn(flat), d)
    assert.equal(needsRegrouping(flat.prompt), false)
    const carry = carried[d]
    if (carry) {
      assert.equal(widestColumn(carry), d)
      assert.equal(needsRegrouping(carry.prompt), true)
      assert.ok(
        comprehensionWindow(flat) <= comprehensionWindow(carry),
        `${String(d)} columns: regrouping got less time than not regrouping`,
      )
    }
    // The step up a column is never a step down in time — including from a
    // regrouping item to a wider one that does not regroup, which is the
    // crossing the two terms could most easily have got wrong.
    const wider = plain[d + 1]
    if (wider) {
      assert.ok(
        comprehensionWindow(carry ?? flat) <= comprehensionWindow(wider),
        `${String(d)} → ${String(d + 1)} columns went down`,
      )
    }
  }
})

test("EXCITEMENT AND COMPREHENSION DO NOT SHARE A KNOB", () => {
  // The window may not move when the motion constant moves. `Director.pressure`
  // is the whole difficulty curve of the run; drive it from a cold start to the
  // top and the window for one fixed item must not budge by a millisecond.
  const item = { prompt: "247 + 158", answer: 405 }
  const cold = comprehensionWindow(item)
  const director = new Director()
  const seen = new Set<number>()
  for (let i = 0; i < 200; i++) {
    director.advance(1)
    director.recordKill()
    seen.add(comprehensionWindow(item))
  }
  const hot = director.pressure()
  assert.ok(hot.level > 0.99, `the pressure curve never reached the top (${String(hot.level)})`)
  assert.ok(hot.descentSeconds < 6, "the motion constant did not tighten")
  assert.deepEqual(
    [...seen],
    [cold],
    "the comprehension window moved while the run escalated — it is still on the motion knob",
  )
})

test("the answering window a wave is built with is the window its item earns", () => {
  const rng = new Rng(0xc0de)
  for (const source of [
    { id: "a", prompt: "27 + 15", answer: "42", distractors: ["32", "52", "24"] },
    { id: "b", prompt: "247 + 158", answer: "405", distractors: ["395", "415", "504"] },
  ]) {
    const built = buildCore(source, 5, () => rng.next())
    assert.ok(built, `${source.prompt} could not be built`)
    assert.equal(
      built.windowSeconds,
      comprehensionWindow({ prompt: source.prompt, answer: Number(source.answer) }),
    )
  }
})

test("A WAVE REALLY IS ANSWERABLE FOR ITS WHOLE WINDOW, ON THE CLOCK", () => {
  // End to end, on a virtual clock, through the real frame loop: how long the
  // candidates of a six-second item are actually on the lattice.
  const { endings } = playOneSmallItem([768, 1024], 1400)
  const ran = endings.filter((e) => e.end === "unanswered")
  assert.ok(
    ran.length > 0,
    "a six-second item never ran out inside a whole run — its fall is being timed by " +
      "something other than the item, and that something is longer than the lattice lasts",
  )
  const first = ran[0]
  assert.ok(first)
  const seconds = (first.frame * 16) / 1000
  const earned = comprehensionWindow({ prompt: first.prompt, answer: Number(first.answer) })
  assert.equal(earned, MIN_WINDOW_SECONDS)
  // Spawned two seconds in, approached, fractured, then fell for the window.
  // Never less than the window itself; the old code would have given this same
  // item 6.87s at the top of the pressure curve and 11.84s at the bottom, on
  // the same knob that decides how fast the room is.
  assert.ok(
    seconds >= earned,
    `the wave was on the lattice for ${seconds.toFixed(2)}s, under its ${String(earned)}s window`,
  )
  // And bounded above, which is the half that catches a window quietly going
  // back onto the motion knob. Everything before the fall is the two-second
  // dead gap plus the core's approach, `0.26 x descentSeconds x 0.85`, which is
  // under five seconds at every point on the pressure curve. A window taken
  // from `descentSeconds` would put this item at fifteen seconds or more.
  assert.ok(
    seconds <= earned + 7,
    `the wave was on the lattice for ${seconds.toFixed(2)}s against a ${String(earned)}s window ` +
      `— the fall is not being timed by the item`,
  )
})

// ─── 3. Running out of time is not being wrong ────────────────────────────────

test("A WAVE THAT RUNS OUT IS NOT REPORTED AS A WRONG ANSWER", () => {
  // What the old code did: `host.report({ correct: false, answered: "" })`.
  // The shared adapter discards `correct` and forwards `answered` as the
  // response to `items.answer`, and an empty response does not parse, so the
  // host recorded a MISS and stepped the ladder down — against a child who may
  // simply have still been carrying the hundreds column.
  const { endings, reports } = playOneSmallItem([768, 1024], 2400)
  // The report count comes first, deliberately: a timeout that goes out as an
  // answer would otherwise be misread as "no wave ran out" and the failure
  // would name the wrong thing.
  assert.equal(
    reports,
    0,
    `a child who never touched the controls was reported on as having answered ` +
      `${String(reports)} time(s)`,
  )
  const ran = endings.filter((e) => e.end === "unanswered")
  assert.ok(ran.length > 0, "no wave ever ran out, so nothing was proved")
})

test("nothing is ever reported with an empty answer", () => {
  // The one report in the game that was not the result of an action. There is
  // no longer any such report: an unanswered item is skipped, not answered.
  const seen: string[] = []
  const rec = recorder(768, 1024, 0x99)
  const restore = rec.install()
  const stub = createStubHost({ seed: 0x99, reducedMotion: false })
  const host: Host = {
    next: (o) => stub.next(o),
    report: (r) => {
      seen.push(r.answered)
    },
    haptic: () => undefined,
    prefersReducedMotion: () => false,
  }
  const handle = mount(rec.el, host)
  const rng = new Rng(0x99 ^ 0x51de)
  try {
    for (let i = 0; i < 5000; i++) {
      rec.step(16)
      flailing(i, rec.press, rng)
    }
  } finally {
    handle.unmount()
    restore()
  }
  assert.ok(seen.length > 0, "nothing was reported at all")
  for (const answered of seen) {
    assert.ok(/^\d+$/.test(answered), `a report carried "${answered}" — nothing was handed in`)
  }
  // And the run that actually times out: not one report, empty or otherwise.
  assert.equal(playOneSmallItem([768, 1024], 2400).reports, 0)
})

test("a host with no skip hook is not a crash — the timeout is simply silent", () => {
  // `skip` is feature-detected exactly like `transition`. The shared adapter
  // does not implement it today, so on a real tablet an unanswered item is
  // reported as nothing at all, which is the honest thing and is never a miss.
  const rec = recorder(768, 1024, 0x5150)
  const restore = rec.install()
  const stub = createStubHost({ seed: 0x5150, reducedMotion: false })
  const bare: Host = {
    next: (o) => stub.next(o),
    report: () => undefined,
    haptic: () => undefined,
    prefersReducedMotion: () => false,
  }
  const handle = mount(rec.el, bare)
  const rng = new Rng(0x5150 ^ 0x51de)
  try {
    for (let i = 0; i < 3000; i++) {
      rec.step(16)
      flailing(i, rec.press, rng)
    }
  } finally {
    handle.unmount()
    restore()
  }
})

// ─── 4. The sum finishes on the screen ────────────────────────────────────────

test("AFTER A TIMEOUT THE SUM IS COMPLETED ON SCREEN, LEGIBLY, AND HELD", () => {
  // A five-year-old getting everything wrong and putting nonsense in is still
  // watching numerals, a `+`, and a column sum resolving — and that exposure is
  // worth something even when the answer is not. It only works if the game
  // shows the arithmetic HAPPEN. The miss is the teaching moment, and spending
  // it on feedback about the failure and then deleting the evidence is the
  // worst available arrangement.
  //
  // So, after the wave runs out: the finished statement, at the same size the
  // question was, for long enough to read it.
  for (const size of [
    [320, 480],
    [360, 640],
    [768, 1024],
  ] as const) {
    const { endings, painted } = playOneSmallItem([size[0], size[1]], 1400)
    const ran = endings.find((e) => e.end === "unanswered")
    assert.ok(ran, `${String(size[0])}x${String(size[1])}: the wave never ran out`)
    const finished = `${ran.prompt} = ${ran.answer}`
    let held = 0
    let smallest = Infinity
    for (let f = ran.frame; f < painted.length; f++) {
      const hit = (painted[f] ?? []).filter((p) => p.text === finished)
      if (hit.length === 0) continue
      held++
      smallest = Math.min(smallest, Math.max(...hit.map((p) => p.px)))
    }
    // Long enough to read a completed sum, not a frame of it.
    assert.ok(
      held >= 60,
      `${String(size[0])}x${String(size[1])}: "${finished}" was on screen for ` +
        `${String(held)} frames (${((held * 16) / 1000).toFixed(2)}s)`,
    )
    assert.ok(
      smallest >= PROMPT_MIN_PX,
      `${String(size[0])}x${String(size[1])}: the completed sum was ${smallest.toFixed(1)}px`,
    )
  }
})

test("after a wrong submission the sum is completed on screen too", () => {
  // The same beat, reached the other way: the child handed in a value and it
  // was not the one. Nothing about what follows says so — the statement simply
  // finishes, in the colour a correct answer is celebrated in.
  //
  // **The floor is the settle and not a duration.** The reveal no longer expires
  // at all (see `mount.reveal` and `game-pacing`'s `revealPlan`), so the only
  // thing that ends one is the child's own hand — and the bot below is leaning
  // on the controls, so what is measured here is a child who dismissed it
  // immediately. `REVEAL_SETTLE_MS` is the lockout that stops the second tap of
  // a double-tap taking down a sum the first tap only just put up, and it is
  // what a completed sum is worth even to a child who wants nothing to do with
  // it. The test below this one is the other end: nobody touches anything, and
  // the sum is still there three minutes later.
  const settleFrames = Math.floor(REVEAL_SETTLE_MS / 16)
  let seen = 0
  for (const seed of [0x2b1, 0x2b2, 0x2b3, 0x2b4]) {
    const rec = recorder(360, 640, seed * 31)
    const restore = rec.install()
    const stub = createStubHost({ seed, reducedMotion: false })
    const items = new Map<string, string>()
    const misses: { finished: string; frame: number }[] = []
    let frame = 0
    const host: Host = {
      next: (o) => {
        const q = stub.next(o)
        items.set(q.id, `${q.prompt} = ${q.answer}`)
        return q
      },
      report: (r) => {
        const finished = items.get(r.questionId)
        if (!r.correct && finished !== undefined) misses.push({ finished, frame })
      },
      skip: () => undefined,
      haptic: () => undefined,
      prefersReducedMotion: () => false,
    }
    const handle = mount(rec.el, host)
    const rng = new Rng(seed ^ 0x51de)
    try {
      for (let i = 0; i < 3000; i++) {
        frame = i
        rec.step(16)
        flailing(i, rec.press, rng)
      }
    } finally {
      handle.unmount()
      restore()
    }
    for (const miss of misses) {
      // A miss in the last breath of the run has no room left to be held FOR;
      // the recording simply stops. Counting one would be measuring the length
      // of the test rather than the length of the reveal.
      if (miss.frame + settleFrames >= rec.frames.length) continue
      let held = 0
      let smallest = Infinity
      for (let f = miss.frame; f < rec.frames.length; f++) {
        const hit = (rec.frames[f] ?? []).filter((p) => p.text === miss.finished)
        if (hit.length === 0) continue
        held++
        smallest = Math.min(smallest, Math.max(...hit.map((p) => p.px)))
      }
      assert.ok(
        held >= settleFrames,
        `"${miss.finished}" was completed for only ${String(held)} frames, under the ` +
          `${String(settleFrames)}-frame settle`,
      )
      assert.ok(smallest >= PROMPT_MIN_PX, `the completed sum was ${smallest.toFixed(1)}px`)
      seen++
    }
  }
  assert.ok(seen > 0, "random play never once missed, so nothing was proved")
})

test("THE FINISHED SUM DOES NOT EXPIRE — IT WAITS FOR THE CHILD'S OWN HAND", () => {
  // > "you should be able to study the answers and then go on, not just have the
  // > answers flashed for a second and then go on"
  //
  // `revealSeconds` used to answer that with one and a half to three seconds and
  // then take the sum away whether or not anybody had finished reading it. The
  // child who has just missed is the slowest reader in the session; a timer
  // sized for a fluent one removes the evidence exactly when it becomes useful.
  //
  // Nobody touches anything here. Three minutes later the sum is still up, the
  // hall is still held, and NOTHING has been drawn from the host in the
  // meantime — a reveal that quietly let the next wave in behind it would pass
  // the first assertion and fail the child.
  const rec = recorder(768, 1024, 0x5e77)
  const restore = rec.install()
  let served = 0
  const host: Host = {
    next: () => {
      served++
      return {
        id: `tiny-${String(served)}`,
        prompt: "4 + 4",
        answer: "8",
        distractors: ["6", "9", "12"],
        domain: "add",
        difficulty: 1,
      }
    },
    report: () => undefined,
    skip: () => undefined,
    haptic: () => undefined,
    prefersReducedMotion: () => false,
  }
  const handle = mount(rec.el, host)
  try {
    // Long enough for the first wave to arrive and run out untouched.
    for (let i = 0; i < 1400 && !handle.snapshot().revealed; i++) rec.step(16)
    assert.equal(handle.snapshot().revealed, true, "no wave ever ran out, so nothing was proved")
    const askedWhenRevealed = handle.snapshot().asked
    // Three minutes of a child reading, and a child reading touches nothing.
    for (let i = 0; i < 11_250; i++) rec.step(16)
    assert.equal(
      handle.snapshot().revealed,
      true,
      "the finished sum took itself away while the child was still reading it",
    )
    assert.equal(
      handle.snapshot().asked,
      askedWhenRevealed,
      "the game drew the next question from behind the sum it was still showing",
    )
    assert.equal(handle.snapshot().prompt, null, "a wave was live behind the reveal")

    // And now the child's own hand, which is the only thing that ends it. The
    // first key is refused — that is `REVEAL_SETTLE_MS`, and by three minutes in
    // it has long since run down, so this one lands.
    rec.press(" ")
    rec.step(16)
    assert.equal(handle.snapshot().revealed, false, "the child could not put the sum away")
  } finally {
    handle.unmount()
    restore()
  }
})

test("a tap arriving in the same breath as the miss cannot take the sum away", () => {
  // `REVEAL_SETTLE_MS` is latency and not patience. The gesture that ended the
  // wave is routinely still arriving on a touch screen — the second tap of an
  // impatient double-tap, a finger that had already committed — and without a
  // lockout those land inside the reveal's own fade-in and the child watches the
  // lesson appear and vanish in one breath.
  const rec = recorder(768, 1024, 0x5e78)
  const restore = rec.install()
  let served = 0
  const host: Host = {
    next: () => {
      served++
      return {
        id: `tiny-${String(served)}`,
        prompt: "4 + 4",
        answer: "8",
        distractors: ["6", "9", "12"],
        domain: "add",
        difficulty: 1,
      }
    },
    report: () => undefined,
    skip: () => undefined,
    haptic: () => undefined,
    prefersReducedMotion: () => false,
  }
  const handle = mount(rec.el, host)
  try {
    for (let i = 0; i < 1400 && !handle.snapshot().revealed; i++) rec.step(16)
    assert.equal(handle.snapshot().revealed, true, "no wave ever ran out")
    // Every frame of the settle, hammered. None of them may land. `floor` and
    // not `ceil`: the frame the settle actually runs out ON is the first one
    // allowed to let go, and asserting it is still up would be asserting a
    // rounding.
    const settleFrames = Math.floor(REVEAL_SETTLE_MS / 16)
    for (let i = 0; i < settleFrames; i++) {
      rec.press(" ")
      assert.equal(
        handle.snapshot().revealed,
        true,
        `a key ${String(i)} frame(s) into the settle took the sum away`,
      )
      rec.step(16)
    }
    // And then it lets go, on the child's next key and not on its own.
    rec.step(16)
    assert.equal(handle.snapshot().revealed, true, "the sum expired rather than being dismissed")
    rec.press(" ")
    assert.equal(handle.snapshot().revealed, false, "the settle never let go")
  } finally {
    handle.unmount()
    restore()
  }
})

test("THE REVEAL HOLDS THE HALL, AND THE HOLD IS BILLED TO NOBODY", () => {
  // STACK holds its sweep for the whole reveal so the child never reads one
  // thing while aiming at another, and that hold is the part that makes it
  // work. Here it has a second job: a frozen lattice cannot land an automaton
  // on an anchor while the child is reading, so the time this game spends
  // teaching is never time it takes off them.
  const { endings, painted } = playOneSmallItem([768, 1024], 1400)
  const ran = endings.find((e) => e.end === "unanswered")
  assert.ok(ran, "the wave never ran out")
  const finished = `${ran.prompt} = ${ran.answer}`
  const shown = painted
    .map((frame, i) => ({ i, frame }))
    .filter(({ frame }) => frame.some((p) => p.text === finished))
    .map(({ i }) => i)
  assert.ok(shown.length >= 60, `the completed sum held for only ${String(shown.length)} frames`)

  // Everything on the lattice, frame by frame, with the completed statement
  // itself taken out — that one is supposed to be there and is supposed to be
  // still. If the hall were running, a hull would have moved a pixel.
  const world = (i: number): string =>
    (painted[i] ?? [])
      .filter((p) => p.text !== finished)
      .map((p) => `${p.text}@${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join("|")
  for (let k = 1; k < shown.length - 1; k++) {
    const a = shown[k - 1]
    const b = shown[k]
    assert.ok(a !== undefined && b !== undefined)
    assert.equal(
      world(b),
      world(a),
      `the lattice moved on frame ${String(b)} while the sum was being read`,
    )
  }
})

// ─── The pause, closed properly ───────────────────────────────────────────────

test("BEHIND THE HOST'S SHEET, NOTHING STEPS AND NOTHING IS DRAWN", () => {
  // `loop.test.ts` has had a pause test since the day the guard was written and
  // it does not cover this. Take the `if (paused) return` out of the frame loop
  // and that test still passes: input is refused by its own separate guards, so
  // with nobody firing, nothing gets answered — and the run quietly dies of
  // breaches behind the sheet instead, which resolves nothing and reports
  // nothing. A pack whose lattice keeps running under a purchase surface would
  // have shipped green.
  //
  // What is asserted here is the promise the frame loop actually makes: while
  // paused the canvas holds its last frame. Not one `fillText`, and when the
  // sheet lifts the hall is exactly where it was left.
  const rec = recorder(768, 1024, 0x9ee9)
  const restore = rec.install()
  const stub = createStubHost({ seed: 0x9ee9, reducedMotion: false })
  const host: Host = {
    next: (o) => stub.next(o),
    report: () => undefined,
    skip: () => undefined,
    haptic: () => undefined,
    prefersReducedMotion: () => false,
  }
  const handle = mount(rec.el, host)
  const rng = new Rng(0x9ee9 ^ 0x51de)
  let lastLive = 0
  try {
    for (let i = 0; i < 400; i++) {
      rec.step(16)
      flailing(i, rec.press, rng)
    }
    lastLive = rec.frames.length - 1
    handle.setPaused(true)
    const from = rec.frames.length
    // Three minutes behind the sheet, with a child leaning on the controls.
    for (let i = 0; i < 11_250; i++) {
      rec.step(16)
      if (i % 5 === 0) rec.press(" ")
      if (i % 11 === 0) rec.press("ArrowLeft")
    }
    let painted = 0
    for (let f = from; f < rec.frames.length; f++) painted += (rec.frames[f] ?? []).length
    assert.equal(painted, 0, `${String(painted)} things were drawn while the game was paused`)

    handle.setPaused(false)
    rec.step(16)
    const before = (rec.frames[lastLive] ?? []).map((p) => `${p.text}@${p.x.toFixed(1)}`).join("|")
    const after = (rec.frames[rec.frames.length - 1] ?? [])
      .map((p) => `${p.text}@${p.x.toFixed(1)}`)
      .join("|")
    assert.ok(after.length > 0, "the game did not come back after the sheet lifted")
    assert.equal(after, before, "the lattice moved behind the sheet")
  } finally {
    handle.unmount()
    restore()
  }
})

test("the sheet's minutes are not billed to the child as thinking time", () => {
  // The other half of the pause, and the half that reaches the learner model:
  // `waveAskedAt` is a wall-clock mark, so without shifting it forward by
  // exactly the time the sheet was up, the next report carries the sheet's
  // three minutes as the child's latency. The host reads latency to decide
  // whether the ladder climbs.
  const rec = recorder(768, 1024, 0x1a7e)
  const restore = rec.install()
  const latencies: number[] = []
  let served = 0
  const host: Host = {
    next: () => {
      served++
      return {
        id: `slow-${String(served)}`,
        // Three columns and a carry, so the window is long enough to still be
        // open on the far side of three minutes behind a sheet.
        prompt: "247 + 158",
        answer: "405",
        distractors: ["395", "415", "504"],
        domain: "add",
        difficulty: 5,
      }
    },
    report: (r) => latencies.push(r.ms),
    skip: () => undefined,
    haptic: () => undefined,
    prefersReducedMotion: () => false,
  }
  const handle = mount(rec.el, host)
  try {
    // Far enough in that a wave is certainly on the lattice.
    for (let i = 0; i < 400; i++) rec.step(16)
    handle.setPaused(true)
    for (let i = 0; i < 11_250; i++) rec.step(16)
    handle.setPaused(false)
    // And now answer it, by sweeping the lattice and firing.
    for (let i = 0; i < 900; i++) {
      rec.step(16)
      rec.press(" ")
      if (i % 9 === 0) rec.press(i % 18 === 0 ? "ArrowLeft" : "ArrowRight")
    }
  } finally {
    handle.unmount()
    restore()
  }
  assert.ok(latencies.length > 0, "nothing was answered after the sheet lifted")
  for (const ms of latencies) {
    assert.ok(
      ms < 60_000,
      `a report carried ${String(ms)}ms — the sheet's three minutes leaked into the ` +
        `child's thinking time`,
    )
  }
})

// ─── 5. Space around the answering moment ─────────────────────────────────────

test("ON THE REAL LATTICE, THE STREAM REALLY DOES BACK OFF WHILE READING", () => {
  // The test below this one asserts `readingRelief` and NOTHING ELSE. Both of
  // its call sites in `mount.ts` could be deleted and the suite would stay
  // green — and worse than that had already happened: `Director.wantsSpawn`
  // looked its own pressure up instead of taking the one it was handed, so the
  // relieved `spawnGap` and `floorCount` reached nothing at all. The only field
  // that DID arrive was `descentSeconds`, which makes every hull linger 30%
  // longer, so the lattice got about 25% denser during the one moment it is
  // supposed to thin. A tautological test sat on top of that the whole time.
  //
  // An automaton is born at `t = 0`, which projects to exactly the horizon, so
  // a spawn is directly observable: a numeral painted on the horizon line. The
  // score is a numeral too and sits well above it, which is why this is pinned
  // to the horizon rather than to "near the top".
  const geom = geomForViewport(768, 1024, 5)
  const { endings, painted } = playOneSmallItem([768, 1024], 1400)
  const ran = endings.find((e) => e.end === "unanswered")
  assert.ok(ran, "the wave never ran out")

  const births: number[] = []
  for (let f = 0; f < painted.length; f++) {
    const born = (painted[f] ?? []).some(
      (p) => /^\d+$/.test(p.text) && Math.abs(p.y - geom.horizonY) < 0.5,
    )
    // A hull sits on the horizon for a frame or three; one arrival, not three.
    if (born && (births.length === 0 || f - (births[births.length - 1] ?? 0) > 10) ) births.push(f)
  }
  const during = births.filter((f) => f >= ran.from && f < ran.frame)
  assert.ok(during.length >= 2, `only ${String(during.length)} automata arrived during the wave`)

  const relieved = readingRelief(new Director().pressure())
  for (let i = 1; i < during.length; i++) {
    const a = during[i - 1]
    const b = during[i]
    assert.ok(a !== undefined && b !== undefined)
    const gap = ((b - a) * 16) / 1000
    // At a cold start the stream runs every 2.0s and the relief widens it to
    // 3.5s. Measured at 3.42s, which is the gap minus the frame the spawn is
    // noticed on; the floor here sits between the two so it cannot be met by
    // an unrelieved lattice.
    assert.ok(
      gap > 3,
      `automata arrived ${gap.toFixed(2)}s apart while a question was being read — ` +
        `the relief wants ${relieved.spawnGap.toFixed(2)}s and the plain stream gives 2.00s`,
    )
  }
})

test("the lattice thins out while a question is being read — sparser, not duller", () => {
  // The founder's direction: keep the juice, give the space AROUND the
  // answering moment room. So while a CORE's candidates are in the air the
  // stream backs off — fewer automata, further apart, descending slower — and
  // it does so at every point on the pressure curve, not just at the start.
  const director = new Director()
  for (let i = 0; i <= 20; i++) {
    const p = director.pressure()
    const r = readingRelief(p)
    assert.ok(r.floorCount <= p.floorCount, "the field did not thin while reading")
    assert.ok(r.spawnGap > p.spawnGap, "spawns did not spread out while reading")
    assert.ok(r.descentSeconds > p.descentSeconds, "the stream did not slow while reading")
    assert.ok(r.floorCount >= 1, "the lattice went empty — there is no mathematics on an empty one")
    // Relief is not a difficulty reset: the tight-divisor bias, which is the
    // pedagogy in the economy, is untouched.
    assert.equal(r.tightness, p.tightness)
    assert.equal(r.level, p.level)
    for (let k = 0; k < 8; k++) director.advance(1)
    director.recordKill()
  }
})

test("ON THE REAL LATTICE, A STRAY SHOT DOES NOT SHORTEN THE WINDOW", () => {
  // The test below this one asserts the pure function and NOTHING ELSE, which
  // means the whole fix could be unwired from `dissonance()` and the suite
  // would stay green. It was, and it did. So: the same deterministic run,
  // played once with no input and then once per single trigger pull, and every
  // pull that did not hand a value in must leave the wave running out on
  // exactly the same frame.
  //
  // With the shove restored, eight of the nine non-submitting timings below
  // close the window early — by up to 92 frames, a second and a half taken off
  // a six-second window for one stray shot at a hexagon.
  const quiet = playOneSmallItem([768, 1024], 1400).endings.find((e) => e.end === "unanswered")
  assert.ok(quiet, "the silent run never ran out")

  let rung = 0
  for (let f = 300; f < 660; f += 20) {
    const { endings } = playOneSmallItem([768, 1024], 1400, [f])
    const ran = endings.find((e) => e.end === "unanswered")
    // A shot that submitted resolved the wave honestly and is not a sample.
    if (!ran || endings.some((e) => e.end === "answered" && e.frame < ran.frame)) continue
    rung++
    // Never EARLIER. Later is fine and is sometimes right: three kills on one
    // pulse is a HARMONIC and spends slow-motion, which hands the child a few
    // more frames. The invariant is one-directional — a stray shot may not
    // take thinking time away.
    assert.ok(
      ran.frame >= quiet.frame,
      `a shot on frame ${String(f)} moved the wave's end from ${String(quiet.frame)} ` +
        `to ${String(ran.frame)} — firing at the candidates costs thinking time`,
    )
  }
  assert.ok(rung >= 6, `only ${String(rung)} shots landed without submitting`)
})

test("RINGING A CANDIDATE DOES NOT SHORTEN THE TIME TO ANSWER IT", () => {
  // A dissonant strike shoves an ORDINARY automaton down the lattice — the cost
  // of a wrong read is time, which is the right cost. Applied to a CANDIDATE it
  // is something else entirely: probing the beams is the listening verb, and
  // charging the comprehension window for it rations exactly what may not be
  // rationed. A candidate rings and does not move.
  assert.ok(shovedUrgency(A_ORDINARY, 1) > 1, "an ordinary automaton was not shoved")
  assert.equal(shovedUrgency(A_CANDIDATE, 1), 1, "a candidate was shoved: the window shrank")
  assert.equal(shovedUrgency(A_CANDIDATE, 2.4), 2.4)
  // And the shove is bounded, so a column of stray shots cannot teleport one.
  let u = 1
  for (let i = 0; i < 40; i++) u = shovedUrgency(A_ORDINARY, u)
  assert.ok(u <= 2.4, `urgency ran away to ${String(u)}`)
})

// ─── The window function itself ───────────────────────────────────────────────

test("the window reads the item's columns and its regrouping, not its prose", () => {
  assert.equal(widestColumn({ prompt: "4 + 3", answer: 7 }), 1)
  assert.equal(widestColumn({ prompt: "27 + 15", answer: 42 }), 2)
  // The answer is a column wider than either operand, and it counts.
  assert.equal(widestColumn({ prompt: "62 + 79", answer: 141 }), 3)
  assert.equal(widestColumn({ prompt: "5001 − 2798", answer: 2203 }), 4)
  assert.equal(needsRegrouping("27 + 15"), true)
  assert.equal(needsRegrouping("31 + 24"), false)
  assert.equal(needsRegrouping("52 − 27"), true)
  assert.equal(needsRegrouping("59 − 27"), false)
  // A prompt shaped like nothing the parser knows is given the LONGER window,
  // never the shorter one. Guessing against the child is not an option.
  assert.equal(needsRegrouping("what is the tessera count"), true)
})
