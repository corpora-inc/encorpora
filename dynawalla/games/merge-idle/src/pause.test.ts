/**
 * The reef stops while the rules are up.
 *
 * "All games should pause while reading the instructions .. I can hear
 * counterweight playing in the background while I'm reading the instructions ...
 * stressing me out even more."
 *
 * Sound, keys and taps are held by the shared sheet for every game. A game's own
 * simulation clock is the one thing it cannot reach, and ABYSSAL BLOOM is the
 * genre where that clock is the *subject*: essence accrues with nobody's hands
 * on the glass, vents cough polyps out on a timer, a choked vent warms back up
 * on a timer, and a swell rises on a timer. All of it ran behind the manual.
 *
 * **The idle question was decided deliberately, not by accident.** A read is
 * outside of time: nothing accrues and nothing decays. See `setPaused` in
 * `game.ts` for why crediting the read would have been a second, unquestioned
 * path to essence — and, because the hold is measured on the wall clock, a way
 * to farm backgrounded time past the tide gate that exists to charge for it.
 *
 * **This is a mount-level test, on purpose.** ABYSSAL BLOOM had no headless
 * harness: every one of its existing tests proves a pure function or a layout
 * number and not one of them constructs the game. A pause test written against a
 * pure function would prove nothing about the wiring, which is the only thing
 * here that can be wrong. So this file builds the harness — a fake document, a
 * fake `requestAnimationFrame`, a fake `performance.now`/`Date.now`, a fake
 * `ResizeObserver`, and a 2d context that counts every call made through it.
 *
 * **Removing the fix fails this file.** Delete the `onOpen`/`onClose` pair in
 * `game.ts` and the reef keeps blooming behind the sheet; delete the `if
 * (this.paused)` guard in `frame` and it blooms regardless of the flag; delete
 * the wall-clock rebasing and a read is billed to the child as thinking time,
 * or banked as away-time the next launch pays out.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { Game } from './game.ts'
import { makeStubHost } from './stubHost.ts'
import { useSaveSlot } from './core/save.ts'

type Handler = (e: unknown) => void

/** A fake element. Every one carries its OWN listener map — see `control`. */
type FakeEl = {
  className: string
  listeners: Map<string, Handler[]>
  children: FakeEl[]
} & Record<string, unknown>

type Save = {
  essence: number
  magnitude: number
  cols: number
  rows: number
  cells: Array<[number, number]>
  vents: Array<{ tier: number }>
  lastSeen: number
}

type Harness = {
  root: HTMLElement
  install(): () => void
  /** a frame delivered, and the clock moved with it */
  step(ms: number): void
  /** the clock moved with NO frame — a backgrounded app */
  advance(ms: number): void
  now(): number
  made: FakeEl[]
  draws(): number
  /** every save the reef has written, newest last */
  saves: Save[]
  /** dispatch a key the way a browser would, honouring `stopPropagation` */
  press(key: string): void
}

/** A fixed instant, so a run seeded from the calendar is the same run every time. */
const DAY0 = 1_780_000_000_000
const T0 = 1000

function harness(w = 820, h = 1180): Harness {
  const made: FakeEl[] = []
  const saves: Save[] = []
  let drawCalls = 0
  const rect = { left: 0, top: 0, width: w, height: h, right: w, bottom: h, x: 0, y: 0 }

  // Counts every call made through it and returns itself, so chains like
  // `createLinearGradient(...).addColorStop(...)` survive with no real canvas.
  const ctx: unknown = new Proxy(function () {} as unknown as Record<string, unknown>, {
    get: (_t, prop) => {
      if (prop === 'then') return undefined
      // Any coercion of a context value yields 0, so a real comparison in the
      // renderer — `measureText(label).width <= maxW` — reaches a decision
      // instead of throwing on an object with no primitive form.
      if (prop === Symbol.toPrimitive) return () => 0
      return ctx
    },
    set: () => true,
    apply: () => {
      drawCalls++
      return ctx
    },
  })

  const makeEl = (): FakeEl => {
    const listeners = new Map<string, Handler[]>()
    const children: FakeEl[] = []
    const style: Record<string, unknown> = {
      cssText: '',
      setProperty(k: string, v: string) {
        style[k] = v
      },
      removeProperty(k: string) {
        delete style[k]
      },
    }
    const classes = new Set<string>()
    const el: FakeEl = {
      className: '',
      listeners,
      children,
      style,
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
        toggle: (c: string, on?: boolean) => {
          const want = on ?? !classes.has(c)
          if (want) classes.add(c)
          else classes.delete(c)
          return want
        },
        contains: (c: string) => classes.has(c),
      },
      textContent: '',
      id: '',
      type: '',
      hidden: false,
      disabled: false,
      dataset: {},
      tabIndex: 0,
      scrollTop: 0,
      width: 0,
      height: 0,
      offsetWidth: 100,
      offsetHeight: 40,
      clientWidth: w,
      clientHeight: h,
      appendChild: (c: FakeEl) => {
        children.push(c)
        return c
      },
      append: (...cs: FakeEl[]) => {
        children.push(...cs)
      },
      replaceChildren: (...cs: FakeEl[]) => {
        children.length = 0
        children.push(...cs)
      },
      remove: () => undefined,
      querySelectorAll: () => [],
      focus: () => undefined,
      animate: () => ({ onfinish: null }),
      setAttribute: () => undefined,
      getAttribute: () => null,
      removeAttribute: () => undefined,
      getBoundingClientRect: () => rect,
      getContext: () => ctx,
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
      addEventListener: (k: string, fn: Handler) => {
        const list = listeners.get(k) ?? []
        list.push(fn)
        listeners.set(k, list)
      },
      removeEventListener: (k: string, fn: Handler) => {
        listeners.set(k, (listeners.get(k) ?? []).filter((x) => x !== fn))
      },
      get firstElementChild(): FakeEl | null {
        return children[0] ?? null
      },
      get lastElementChild(): FakeEl | null {
        return children[children.length - 1] ?? null
      },
    }
    made.push(el)
    return el
  }

  // A QUEUE, not a slot. The HUD schedules its own `requestAnimationFrame`
  // for a toast fade, and a harness that kept only the newest callback
  // silently dropped the GAME's frame the first time a toast appeared —
  // the loop stopped five seconds in and every assertion after that was
  // measuring a game that had quietly died.
  let pending: Array<(t: number) => void> = []
  let clock = T0

  // A LIST per type, not one handler per type. The shared how-to-play surface
  // registers a capture-phase swallow for `keydown` on top of the game's own
  // `keydown`, and a map that kept only the last one would quietly delete half
  // the wiring this file is here to test.
  const globals = new Map<string, Handler[]>()

  const saved = {
    raf: globalThis.requestAnimationFrame,
    caf: globalThis.cancelAnimationFrame,
    ro: (globalThis as { ResizeObserver?: unknown }).ResizeObserver,
    now: performance.now,
    dateNow: Date.now,
    add: globalThis.addEventListener,
    rm: globalThis.removeEventListener,
    doc: (globalThis as { document?: unknown }).document,
    win: (globalThis as { window?: unknown }).window,
    dpr: (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
    nav: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
  }

  const root = makeEl()

  const install = (): (() => void) => {
    globalThis.requestAnimationFrame = ((cb: (t: number) => void): number => {
      pending.push(cb)
      return pending.length
    }) as typeof globalThis.requestAnimationFrame
    globalThis.cancelAnimationFrame = ((): void => {
      pending = []
    }) as typeof globalThis.cancelAnimationFrame
    ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    }
    performance.now = () => clock
    // Tied to the same clock rather than frozen: `lastSeen` is what `offlineHaul`
    // measures from, so a `Date.now` that never moves would make the one thing
    // this game banks unobservable. It still starts at a fixed instant, which is
    // what the run's seed is drawn from.
    Date.now = () => DAY0 + (clock - T0)
    globalThis.addEventListener = ((k: string, fn: Handler): void => {
      const list = globals.get(k) ?? []
      list.push(fn)
      globals.set(k, list)
    }) as unknown as typeof globalThis.addEventListener
    globalThis.removeEventListener = ((k: string, fn: Handler): void => {
      globals.set(k, (globals.get(k) ?? []).filter((x) => x !== fn))
    }) as unknown as typeof globalThis.removeEventListener
    ;(globalThis as { document?: unknown }).document = {
      createElement: () => makeEl(),
      createElementNS: () => makeEl(),
      createTextNode: () => makeEl(),
      getElementById: () => null,
      body: makeEl(),
      head: makeEl(),
      hidden: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }
    ;(globalThis as { window?: unknown }).window = globalThis
    ;(globalThis as { devicePixelRatio?: number }).devicePixelRatio = 2
    Object.defineProperty(globalThis, 'navigator', {
      value: { hardwareConcurrency: 8 },
      configurable: true,
      writable: true,
    })
    // The reef's save is a seam precisely so a pack frame with no `localStorage`
    // still remembers. Here it is the best observable the game has: it carries
    // the essence, the shelf and the wall-clock stamp `offlineHaul` measures from.
    useSaveSlot({
      read: () => null,
      write: (value) => {
        saves.push(JSON.parse(value) as Save)
      },
    })
    return () => {
      globalThis.requestAnimationFrame = saved.raf
      globalThis.cancelAnimationFrame = saved.caf
      ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = saved.ro
      performance.now = saved.now
      Date.now = saved.dateNow
      globalThis.addEventListener = saved.add
      globalThis.removeEventListener = saved.rm
      ;(globalThis as { document?: unknown }).document = saved.doc
      ;(globalThis as { window?: unknown }).window = saved.win
      ;(globalThis as { devicePixelRatio?: number }).devicePixelRatio = saved.dpr
      if (saved.nav) Object.defineProperty(globalThis, 'navigator', saved.nav)
    }
  }

  return {
    root: root as unknown as HTMLElement,
    install,
    step: (ms: number): void => {
      clock += ms
      const due = pending
      pending = []
      for (const cb of due) cb(clock)
    },
    advance: (ms: number): void => {
      clock += ms
    },
    now: () => clock,
    made,
    draws: () => drawCalls,
    saves,
    press: (key: string): void => {
      // Capture order and `stopPropagation` are honoured, because that is the
      // whole mechanism by which the shared sheet keeps keys off the game: a
      // dispatcher that called every handler regardless would quietly make the
      // sheet look modal when it was not.
      let stopped = false
      const e = {
        key,
        type: 'keydown',
        preventDefault: () => undefined,
        stopPropagation: () => {
          stopped = true
        },
      }
      for (const fn of [...(globals.get('keydown') ?? [])]) {
        if (stopped) return
        fn(e)
      }
    },
  }
}

/** The shared sheet's controls, found the way a finger finds them. */
function control(h: Harness, cls: string): FakeEl {
  const found = h.made.filter((el) => el.className === cls)
  assert.equal(found.length, 1, `expected exactly one .${cls}, found ${found.length}`)
  return found[0] as FakeEl
}

function click(el: FakeEl): void {
  const list = el.listeners.get('click') ?? []
  assert.ok(list.length > 0, `.${el.className} has no click listener`)
  for (const fn of list) fn({ type: 'click', target: el })
}

/** Everything the reef persists that is SIMULATION — `lastSeen` is not. */
function reef(s: Save): unknown {
  return {
    essence: s.essence,
    magnitude: s.magnitude,
    cols: s.cols,
    rows: s.rows,
    cells: s.cells,
    vents: s.vents,
  }
}

const last = (h: Harness): Save => {
  assert.ok(h.saves.length > 0, 'the reef never saved — the observable proves nothing')
  return h.saves[h.saves.length - 1] as Save
}

/** Long enough for the autosave (every 4s) to have fired several times. */
const WARM = 1500

test('nothing on the reef advances while the manual is open', () => {
  const h = harness()
  const restore = h.install()
  const handle = new Game(h.root, makeStubHost({ seed: 0xab1e })).handle()
  try {
    for (let i = 0; i < WARM; i++) h.step(16)

    // The reef has to actually be blooming, or "nothing advanced" is vacuous.
    assert.ok(h.saves.length >= 3, `only ${h.saves.length} autosaves in the warm-up`)
    assert.ok(last(h).essence > 0, 'no essence ever accrued — the observable proves nothing')
    assert.ok(h.draws() > 0, 'nothing ever drew — the counter proves nothing')

    // Line the observable up with the sheet: pump until the reef autosaves, then
    // open the manual in the same breath. The last save is now the reef the
    // sheet went up over, to the polyp — not one up to four seconds stale.
    const settled = h.saves.length
    while (h.saves.length === settled) h.step(16)

    click(control(h, 'dwc-help'))

    const before = reef(last(h))
    const savesBefore = h.saves.length
    const drawsBefore = h.draws()

    // Two full minutes of a child reading. At this rate that is a visible pile
    // of essence and about twenty-four polyps coughed onto the shelf.
    for (let i = 0; i < 7500; i++) h.step(16)

    assert.equal(h.saves.length, savesBefore, 'the autosave ran behind the sheet')
    assert.equal(h.draws(), drawsBefore, `${h.draws() - drawsBefore} draw calls behind the sheet`)
    assert.deepEqual(reef(last(h)), before, 'the reef bloomed behind the sheet')

    click(control(h, 'dwc-close'))

    // The reef is handed back exactly as it was left — to the polyp, and to the
    // unit of essence. This is the "a read is outside of time" claim, stated.
    assert.deepEqual(reef(last(h)), before, 'closing the manual paid out the read')

    for (let i = 0; i < 400; i++) h.step(16)
    assert.notDeepEqual(reef(last(h)), before, 'the reef never restarted after the manual closed')
    assert.ok(h.draws() > drawsBefore, 'nothing drew again after the manual closed')
  } finally {
    handle.unmount()
    restore()
  }
})

test('a read costs the child nothing and gives them nothing — the resume does not jump', () => {
  // The strongest form of both claims at once: the same seed, the same number of
  // LIVE frames, one run interrupted by two minutes of reading and one not. If
  // anything accrued behind the sheet the interrupted reef is richer; if any
  // wall-clock mark leapt on resume it is richer by a different amount. Only an
  // exact freeze makes these equal.
  const play = (readAt: number | null): unknown => {
    const h = harness()
    const restore = h.install()
    const handle = new Game(h.root, makeStubHost({ seed: 0xab1e })).handle()
    try {
      for (let i = 0; i < 3000; i++) {
        if (readAt !== null && i === readAt) {
          click(control(h, 'dwc-help'))
          for (let k = 0; k < 7500; k++) h.step(16)
          click(control(h, 'dwc-close'))
        }
        h.step(16)
      }
      // Sampled from the save `unmount` writes, not from the last autosave: the
      // resume writes one of its own, so the two runs would otherwise be read at
      // different instants and disagree about a reef that is in fact identical.
      handle.unmount()
      return reef(last(h))
    } finally {
      restore()
    }
  }

  assert.deepEqual(play(1500), play(null))
})

test('the read is not banked as away-time the next launch pays out', () => {
  // `offlineHaul` measures from `lastSeen`, and it is the ONE surface that pays
  // for time the child was not playing — capped, discounted, and collected by
  // answering a tide gate. If a read left `lastSeen` two minutes stale, the
  // manual would become a way to farm that gate: open the rules, put the tablet
  // down, come back rich. The refusal has to hold from both ends.
  const h = harness()
  const restore = h.install()
  const handle = new Game(h.root, makeStubHost({ seed: 0xab1e })).handle()
  try {
    for (let i = 0; i < WARM; i++) h.step(16)

    click(control(h, 'dwc-help'))
    for (let i = 0; i < 7500; i++) h.step(16)
    click(control(h, 'dwc-close'))

    const stale = Date.now() - last(h).lastSeen
    assert.ok(stale < 2000, `the read left ${Math.round(stale / 1000)}s bankable as away-time`)
  } finally {
    handle.unmount()
    restore()
  }
})

test('the read is not charged to the child as thinking time', () => {
  // `askedAt` is a `performance.now()` mark and it is what ABYSSAL BLOOM reports
  // as how long a child took over a vent's sum. Left alone across a two-minute
  // read it turns a child who was shown a sheet into a child who could not
  // answer, and the learner model believes it.
  const h = harness()
  const restore = h.install()
  const reports: number[] = []
  const handle = new Game(
    h.root,
    makeStubHost({ seed: 0xab1e, onReport: (r) => reports.push(r.ms) }),
  ).handle()
  try {
    for (let i = 0; i < 600; i++) h.step(16) // 9.6s of genuine thinking

    click(control(h, 'dwc-help'))
    for (let i = 0; i < 7500; i++) h.step(16) // two minutes of reading
    click(control(h, 'dwc-close'))

    // Walk the cursor over the shelf posting whatever it finds into vent 1. The
    // shelf is seeded from the run's own RNG, so which cell holds a polyp is not
    // this test's business — only that something gets posted and reported.
    outer: for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 5; col++) {
        h.press(' ')
        h.press('1')
        if (reports.length > 0) break outer
        h.press('ArrowRight')
      }
      for (let col = 0; col < 5; col++) h.press('ArrowLeft')
      h.press('ArrowDown')
    }

    assert.ok(reports.length > 0, 'nothing was ever posted into a vent — the test proved nothing')
    const ms = reports[0] as number
    assert.ok(ms >= 0, `thinking time went negative: ${ms}ms`)
    assert.ok(ms < 20_000, `the sheet's two minutes were billed to the child: ${ms}ms`)
  } finally {
    handle.unmount()
    restore()
  }
})

test('reads taken through a backgrounded app never accumulate into free reef', () => {
  // The manual is up and the child switches apps. `requestAnimationFrame` stops
  // dead; `performance.now()` does not. Whatever `last` held is now stale, and
  // the first frame after the sheet closes carries all of it — capped at 50ms by
  // the loop, so one read is 34ms of reef nobody played. That is invisible; a
  // session's worth of reads is not, and a child who keeps checking the rules is
  // the child this whole surface exists for.
  const play = (reads: boolean): unknown => {
    const h = harness()
    const restore = h.install()
    const handle = new Game(h.root, makeStubHost({ seed: 0xab1e })).handle()
    try {
      for (let i = 0; i < 3000; i++) {
        if (reads && i > 0 && i % 100 === 0) {
          click(control(h, 'dwc-help'))
          h.advance(3000) // away, with no frames at all
          click(control(h, 'dwc-close'))
        }
        h.step(16)
      }
      // From `unmount`'s save, for the same reason as above.
      handle.unmount()
      return reef(last(h))
    } finally {
      restore()
    }
  }

  assert.deepEqual(play(true), play(false), 'coming back from the background bloomed the reef')
})

test('the manual only lifts a pause it put on itself', () => {
  // Nothing else pauses ABYSSAL BLOOM today. The day something does — a host
  // sheet over the frame, a parent gate — a child who opens and closes the rules
  // underneath it must not be handed back a running reef. Reaching past the type
  // is the only way to stand in for that second pause, and the guard is worth
  // proving before the second pause exists rather than after.
  const h = harness()
  const restore = h.install()
  const game = new Game(h.root, makeStubHost({ seed: 0xab1e }))
  const handle = game.handle()
  const priv = game as unknown as { paused: boolean; heldForManual: boolean }
  try {
    for (let i = 0; i < WARM; i++) h.step(16)

    // The control, so this test cannot pass by the whole feature being absent:
    // with nobody else holding the clock, the manual takes it and gives it back.
    click(control(h, 'dwc-help'))
    assert.equal(priv.paused, true, 'the manual did not stop the reef at all')
    assert.equal(priv.heldForManual, true, 'the manual did not record its own hold')
    click(control(h, 'dwc-close'))
    assert.equal(priv.paused, false, 'the manual did not start the reef again')

    priv.paused = true // somebody else stopped the clock
    click(control(h, 'dwc-help'))
    assert.equal(priv.heldForManual, false, 'the manual claimed a pause it did not put on')

    const before = reef(last(h))
    const drawsBefore = h.draws()
    click(control(h, 'dwc-close'))
    for (let i = 0; i < 600; i++) h.step(16)

    assert.deepEqual(reef(last(h)), before, "closing the rules resumed somebody else's pause")
    assert.equal(h.draws(), drawsBefore, 'closing the rules resumed drawing under another pause')
    priv.paused = false
  } finally {
    handle.unmount()
    restore()
  }
})

test('opening and closing the manual repeatedly never double-pauses or double-resumes', () => {
  const h = harness()
  const restore = h.install()
  const game = new Game(h.root, makeStubHost({ seed: 0xab1e }))
  const handle = game.handle()
  const priv = game as unknown as { paused: boolean; heldForManual: boolean }
  try {
    for (let i = 0; i < 400; i++) h.step(16)
    for (let n = 0; n < 8; n++) {
      click(control(h, 'dwc-help'))
      click(control(h, 'dwc-help')) // `open` is documented safe when already open
      assert.equal(priv.paused, true, 'the manual did not stop the reef')
      for (let i = 0; i < 30; i++) h.step(16)
      click(control(h, 'dwc-close'))
      click(control(h, 'dwc-close'))
      assert.equal(priv.paused, false, 'the manual did not start the reef again')
      assert.equal(priv.heldForManual, false, 'the hold outlived the sheet')
      for (let i = 0; i < 30; i++) h.step(16)
    }
  } finally {
    handle.unmount()
    restore()
  }
})
