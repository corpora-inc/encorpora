/**
 * ABYSSAL BLOOM — one reef, one target, one mouth.
 *
 * THE LOOP
 *   A number sits at the top. The reef coughs glowing polyps onto a shelf. Two
 *   polyps with the same number merge into their sum, which is exactly double, and
 *   any polyp can be split back into two halves. You make the number out of one to
 *   three polyps and drop them into the mouth. `23`? Merge up to 16, split a 14
 *   for the 7, feed both. BOOM.
 *
 * WHAT THIS FILE IS
 *   A SHELL. Every rule lives in `core/engine.ts`, which has no canvas, no clock
 *   and no audio, so the bots in `bots.test.ts` drive exactly the game a child
 *   drives. What is here is input, layout, sound and light.
 *
 * WHY IT IS ONE GAME NOW
 *   It used to be two. Up to five vents each held a curriculum prompt verbatim —
 *   `58042 + 968` — and answered it with a row of four multiple-choice pills,
 *   while the polyps doubled away underneath in numbers that had nothing to do
 *   with the question. The founder played it for hours and said so exactly:
 *   "feeding the vents without the polyps and using the little pill numbers makes
 *   it 2 games on the same screen instead of a cohesive game", and "why do I even
 *   care about the vents actually?".
 *
 *   So: one target, chosen so that the board can build it (`core/ask.ts`), no
 *   pills, no second question stream, no essence, no rate, no flow multiplier and
 *   no tide-gate modal. The board is the answer surface, which means the board is
 *   what the maths is *for*.
 *
 * NO CLOCK ON THE ANSWER
 *   Nothing takes a target away. Polyps sit in the mouth as long as the child
 *   wants and can be pulled back out for free. The only timer in the game is the
 *   reef's own breathing, and a wrong answer costs work — the polyps come back
 *   halved — and nothing else.
 */

import {
  createInstructions,
  installSafeArea,
  safeRect,
  type Instructions,
  type InstructionsSpec,
} from '../../../packs/shared/game-chrome/index.ts'
import type { Host } from './contract.ts'
import { at, distinctValues, emptyCells, polyps } from './core/board.ts'
import { GROW_EVERY } from './core/economy.ts'
import { Engine, START_COLS, START_ROWS, type Event } from './core/engine.ts'
import { canSplit, fmt, rank } from './core/ladder.ts'
import { hashSeed, makeRng, type Rng } from './core/rng.ts'
import { readSave, writeSave } from './core/save.ts'
import { BUDGET, detectTier, emptyDrag, type State, type Tier } from './core/state.ts'
import { Audio } from './audio/audio.ts'
import { Floaters } from './fx/floaters.ts'
import { Particles, Shockwaves } from './fx/particles.ts'
import { approach, ease, Punch } from './fx/shake.ts'
import { CHALK, DANGER, hex, lift, rampAt, TIDE } from './render/palette.ts'
import { cellAtPoint, cellCentre, fedSlotRect, mouthRect, Renderer, shelfCap } from './render/renderer.ts'
import { chromeLayout, MOUTH_END_PAD, stageAreaFor } from './ui/chrome.ts'
import { Hud } from './ui/hud.ts'

const MAX_COLS = 9
const MAX_ROWS = 11

/** How long after a merge its adjacent twin folds in, ms. The cascade. */
const CASCADE_MS = 105
/** How long a press has to be held to split a polyp, ms. */
const SPLIT_HOLD_MS = 520

type Cascade = { cell: number; value: number; at: number; chain: number }

/**
 * How to play, in a child's words.
 *
 * Two things a child cannot figure out by watching, so both are said out loud: a
 * wrong answer hands the polyps back HALVED rather than punishing you, and the
 * reef keeps growing while the tablet is shut.
 */
const INSTRUCTIONS = (reducedMotion: boolean): InstructionsSpec => ({
  title: 'ABYSSAL BLOOM',
  summary: [
    'A number glows at the top. Make that number out of polyps and drop them in the mouth.',
    'Two polyps with the same number join into one worth double. Drag one onto the other.',
  ],
  sections: [
    {
      heading: 'Joining polyps',
      lines: [
        'The glowing creatures on the reef are polyps. Each one has a number.',
        'Drag a polyp on top of another polyp with the same number.',
        'They join into one polyp. Its number is the two added together, so it is double.',
        '3 and 3 make 6. 6 and 6 make 12. 96 and 96 make 192.',
        'Tap a polyp once and every polyp with that same number lights up. That is how you find its partner.',
        'Drag a polyp onto an empty space to move it there.',
      ],
    },
    {
      heading: 'Splitting a polyp',
      lines: [
        'Press and hold a polyp. It splits into two halves.',
        '16 becomes 8 and 8. 30 becomes 15 and 15.',
        'Odd polyps like 3, 5, 7 and 15 cannot be split in half. Nothing bad happens if you try.',
        'Splitting is how you get the exact number you need.',
      ],
    },
    {
      heading: 'Making the number',
      lines: [
        'Look at the number at the top. Then look at your reef.',
        'To make 18 you could use 16 and 2. To make 35 you could use 20 and 10 and 5.',
        'Drag those polyps into the mouth at the bottom, one at a time.',
        'The mouth shows what you have made so far.',
        'When it matches the number at the top, the reef blooms.',
        'You can pull a polyp back out of the mouth whenever you like. Tap it. It costs nothing.',
        'Take as long as you want. Nothing is timed and the number never goes away.',
      ],
    },
    {
      heading: 'When it does not match',
      lines: [
        'If what you made is too big, or the mouth fills up and it is still too small, the mouth spills.',
        'Your polyps come straight back — but each one comes back as two halves.',
        'So a 16 comes back as 8 and 8, and you join them again.',
        'That is the only thing a wrong answer costs. There is no buzzer and you never lose.',
      ],
    },
    {
      heading: 'Blanks',
      lines: [
        'Later the number brings blanks with it, like 15 = ▢ ÷ ▢.',
        'Then you drop exactly two polyps and the mouth does that sum with them.',
        'For 15 = ▢ ÷ ▢ you could drop 30 and then 2, because 30 ÷ 2 is 15.',
        'The order matters for − and ÷. The bigger one usually goes first.',
      ],
    },
    {
      heading: 'CLEAR',
      lines: [
        'The CLEAR button is always ready, and it is free.',
        'Press it and every polyp goes. The reef starts again with eight small ones.',
        'Use it whenever you like — when the reef is full, or when you just want different numbers.',
        'When the reef runs out of room, CLEAR starts glowing to remind you.',
        'You can never get stuck. CLEAR always works.',
      ],
    },
    {
      heading: 'Every bloom shakes the reef',
      lines: [
        'When you make the number, the reef blooms — and it does not sit still.',
        'The biggest polyps are carried away, the rest are shaken into new places,',
        'and new small ones grow in the gaps.',
        'So the reef never fills up with huge numbers you cannot use.',
      ],
    },
    {
      heading: 'Going away and coming back',
      lines: [
        'This reef keeps going when you are not here. That is not a bug, it is the point.',
        'Leave, do something else, come back. New polyps grew the whole time you were gone, for up to eight hours.',
        'Your reef saves itself. It will be exactly where you left it.',
      ],
    },
  ],
  reducedMotion,
})

export function mountGame(el: HTMLElement, host: Host): { unmount(): void } {
  return new Game(el, host).handle()
}

/**
 * Exported for the mount-level test in `pause.test.ts`, and for nothing else.
 *
 * `mountGame` is the entry point every caller uses and the handle it returns is
 * `{ unmount }`, because the host contract has no slot for a pause and inventing a
 * public one to make a test easier would be inventing a public surface.
 */
export class Game {
  private engine: Engine
  private rng: Rng
  private rnd: () => number
  private renderer: Renderer
  private hud: Hud
  private guide: Instructions | null = null
  private audio = new Audio()
  private punch = new Punch()
  private particles: Particles
  private waves = new Shockwaves(28)
  private floaters = new Floaters(56)
  private cascades: Cascade[] = []
  private raf = 0
  private last = 0
  private running = true
  /** True while the reef is frozen: nothing steps, nothing draws. */
  private paused = false
  /**
   * The manual only lifts a pause it put on itself. Nothing else pauses this game
   * today, but the day something does — a host sheet, a parent gate — a child
   * closing the rules underneath it must not be handed back a running reef.
   */
  private heldForManual = false
  /** `performance.now()` when the freeze began, so resume can rebase off it. */
  private pausedAt = 0
  private ro: ResizeObserver | null = null
  private saveMs = 0
  private fpsSamples: number[] = []
  private fps = 60
  private debug = false
  private cursor = -1
  private held = -1
  private snowSeeded = false
  private pressTimer = 0
  private pressCell = -1
  private detach: Array<() => void> = []
  private lastFace = ''

  private el: HTMLElement
  private host: Host

  private get s(): State {
    return this.engine.s
  }

  constructor(el: HTMLElement, host: Host) {
    this.el = el
    this.host = host
    const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '')
    const seedParam = params.get('seed')
    this.debug = params.get('debug') === '1'
    this.rng = makeRng(seedParam ? hashSeed(seedParam) : (Date.now() & 0x7fffffff) >>> 0)
    this.rnd = () => this.rng.f()

    const forcedTier = params.get('tier') as Tier | null
    const tier: Tier = forcedTier === 'low' || forcedTier === 'mid' || forcedTier === 'ultra' ? forcedTier : detectTier()
    this.particles = new Particles(BUDGET[tier].particles)

    this.hud = new Hud({
      onDissolve: () => this.dissolve(),
      onMute: (m) => {
        this.audio.enabled = !m
        if (!m) this.audio.resume()
      },
    })
    this.hud.mount(el)
    this.renderer = new Renderer(this.hud.stage)

    this.engine = new Engine({
      host: {
        next: (o) => this.host.next(o),
        skip: (id) => this.host.skip?.(id),
        focus: (spec) => this.host.focus?.(spec),
        report: (r) => this.host.report(r),
      },
      rng: this.rng,
      now: () => performance.now(),
      limit: () => this.shelfLimit,
      reduceMotion: host.prefersReducedMotion(),
      tier,
      cols: START_COLS,
      rows: START_ROWS,
    })
    this.punch.reduceMotion = this.s.reduceMotion

    // The stage has to be measured before the shelf can be capped, and the shelf
    // has to be capped before a save can be clamped to this glass.
    this.layout()
    this.restore()
    if (polyps(this.s.board).length === 0) this.engine.seed()
    this.consume(this.engine.ask())
    this.layout()

    this.guide = createInstructions(el, {
      ...INSTRUCTIONS(this.s.reduceMotion),
      // The reef coughs polyps onto the shelf on a timer, and `askedAt` is the
      // thinking time this game reports to the learner model. Both move with
      // nobody's hands on the glass, so both have to stop.
      onOpen: () => {
        if (this.paused) return
        this.heldForManual = true
        this.setPaused(true)
      },
      onClose: () => {
        if (!this.heldForManual) return
        this.heldForManual = false
        this.setPaused(false)
      },
    })

    this.bindInput()
    this.observeSize()
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  handle(): { unmount(): void } {
    return { unmount: () => this.unmount() }
  }

  /* ------------------------------------------------------------ life cycle */

  private unmount(): void {
    this.running = false
    this.guide?.destroy()
    this.guide = null
    cancelAnimationFrame(this.raf)
    for (const off of this.detach) off()
    this.detach = []
    this.ro?.disconnect()
    this.save()
    this.audio.close()
    this.renderer.destroy()
    this.hud.destroy()
  }

  /**
   * Stop the reef dead, or start it again.
   *
   * **Frozen means frozen.** The frame callback keeps being scheduled — it has to,
   * or there would be nothing left to resume with — but it steps nothing and draws
   * nothing. Every moving part lives inside `update()` and `drawFrame()`: the
   * reef's emit timer, polyp ages, the merge cascade queue, the sonar ping, the
   * long-press split timer, the drag spring, particles, shockwaves, floaters and
   * the autosave. One `return` above them takes all of them, and the canvas holds
   * its last painted frame underneath the sheet.
   *
   * **What must NOT be left alone is a wall-clock mark**, because every one of
   * them leaps forward the instant the clock is looked at again. `askedAt` is the
   * thinking time reported to the learner model, so a manual left open for an hour
   * would be filed as an hour of thinking.
   */
  private setPaused(on: boolean): void {
    if (on === this.paused) return
    this.paused = on
    if (on) {
      this.pausedAt = performance.now()
      // A drag in flight never gets its release: the shared sheet swallows
      // `pointerup` along with every other pointer event. Left standing, the
      // long-press split timer would carry on counting from behind the manual and
      // take the polyp apart under a finger that is no longer there.
      if (this.s.drag.active) this.cancelDrag()
      return
    }
    const now = performance.now()
    const held = now - this.pausedAt
    const t = this.s.target
    // `Math.min(now, ...)` covers a mark set DURING the hold, which must not be
    // shifted into the future and reported as negative thinking time.
    if (t) t.askedAt = Math.min(now, t.askedAt + held)
    for (const c of this.cascades) c.at += held
    // `last` is the frame delta's other end. Without this the resumed frame
    // computes a delta the length of the read.
    this.last = now
    // Re-stamp `lastSeen`, so a read is not banked as away-time on the next
    // launch and the manual does not become a way to farm free polyps.
    this.save()
  }

  private observeSize(): void {
    // Insets change more often than "never": a rotation swaps top and bottom with
    // left and right, and iPadOS changes them when a pack is resized in Split View.
    // `installSafeArea` rather than a bare `onInsetsChange`: it also PUBLISHES
    // the four insets onto the HUD root as `--dw-safe-*`, which `.ab-badge`
    // reads. Subscribing without publishing is how the badge came to sit in the
    // navigation bar — the canvas half knew where the safe rectangle was and
    // the one DOM rule that needed it had no way to ask.
    const safeArea = installSafeArea(this.hud.root, () => this.layout())
    this.detach.push(() => safeArea.dispose())
    if (typeof ResizeObserver === 'undefined') {
      const onResize = (): void => this.layout()
      window.addEventListener('resize', onResize)
      this.detach.push(() => window.removeEventListener('resize', onResize))
      return
    }
    this.ro = new ResizeObserver(() => this.layout())
    this.ro.observe(this.hud.stage)
  }

  /**
   * One pass: the DOM chrome first, because the band's height decides where the
   * stage starts, then the canvas inside whatever the stage turned out to be.
   *
   * The stage is measured rather than predicted, but its safe area comes from the
   * same `chromeLayout` the band used, so the two can never disagree about where
   * the notch is.
   */
  private layout(): void {
    const rw = this.el.clientWidth || 360
    const rh = this.el.clientHeight || 640
    const chrome = chromeLayout(rw, rh, safeRect(rw, rh))
    this.hud.applyChrome(chrome)

    const w = this.hud.stage.clientWidth || rw
    const h = this.hud.stage.clientHeight || chrome.stage.h
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    this.renderer.resize(
      w,
      h,
      dpr,
      this.s.board,
      this.s.tier,
      stageAreaFor(chrome, w, h),
      MOUTH_END_PAD,
    )
    this.s.mouthRect = mouthRect(this.renderer.layout)
    this.snowSeeded = false
  }

  /**
   * How far the reef may grow the shelf.
   *
   * The designed ceiling, narrowed by what this particular glass can draw legibly
   * beside the mouth. Capping growth is the reflow nobody notices; the collision
   * was one the founder photographed.
   */
  private get shelfLimit(): { maxCols: number; maxRows: number } {
    const cap = shelfCap(this.renderer.layout)
    return {
      maxCols: Math.max(START_COLS, Math.min(MAX_COLS, cap.cols)),
      maxRows: Math.max(START_ROWS, Math.min(MAX_ROWS, cap.rows)),
    }
  }

  /* --------------------------------------------------------------- persist */

  private restore(): void {
    const raw = readSave()
    if (!raw) return
    try {
      const away = this.engine.restore(raw)
      this.renderer.relayout(this.s.board)
      this.consume(this.engine.returnAfter(away))
    } catch (e) {
      console.warn('[abyssal-bloom] save was unreadable; starting fresh', e)
    }
  }

  private save(): void {
    writeSave(this.engine.snapshot())
  }

  /* ----------------------------------------------------------------- input */

  private bindInput(): void {
    const stage = this.hud.stage
    const on = <K extends keyof HTMLElementEventMap>(
      t: HTMLElement | Window,
      k: K,
      fn: (e: HTMLElementEventMap[K]) => void,
      opts?: AddEventListenerOptions,
    ): void => {
      const h = fn as EventListener
      t.addEventListener(k, h, opts)
      this.detach.push(() => t.removeEventListener(k, h, opts))
    }

    on(stage, 'pointerdown', (e) => this.onDown(e as PointerEvent))
    on(stage, 'pointermove', (e) => this.onMove(e as PointerEvent))
    on(stage, 'pointerup', (e) => this.onUp(e as PointerEvent))
    on(stage, 'pointercancel', () => this.cancelDrag())
    on(stage, 'contextmenu', (e) => e.preventDefault())

    const onKey = (e: KeyboardEvent): void => this.onKey(e)
    window.addEventListener('keydown', onKey)
    this.detach.push(() => window.removeEventListener('keydown', onKey))

    const onVis = (): void => {
      if (document.hidden) this.save()
    }
    document.addEventListener('visibilitychange', onVis)
    this.detach.push(() => document.removeEventListener('visibilitychange', onVis))
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const r = this.hud.stage.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  /** The two stage buttons are DOM children of the stage, so their taps bubble here. */
  private onButton(e: PointerEvent): boolean {
    const t = e.target
    return t instanceof Element && t.closest('.ab-sbtn') !== null
  }

  private fedAtPoint(x: number, y: number): number {
    const r = this.s.mouthRect
    if (r.w <= 0) return -1
    const slots = Math.max(1, this.s.mouth.slots)
    for (let i = 0; i < this.s.mouth.fed.length; i++) {
      const box = fedSlotRect(r, i, slots)
      if (x >= box.x && x <= box.x + box.w && y >= box.y - 6 && y <= box.y + box.h + 6) return i
    }
    return -1
  }

  private overMouth(x: number, y: number): boolean {
    const r = this.s.mouthRect
    return r.w > 0 && x >= r.x && x <= r.x + r.w && y >= r.y - 10 && y <= r.y + r.h
  }

  private onDown(e: PointerEvent): void {
    if (this.onButton(e)) return
    this.audio.resume()
    const { x, y } = this.local(e)
    const s = this.s

    // a polyp already in the mouth: pick it back up
    const fed = this.fedAtPoint(x, y)
    if (fed >= 0) {
      const value = s.mouth.fed[fed]?.value ?? 0
      s.drag = {
        ...emptyDrag(),
        active: true,
        cell: -1,
        fedIdx: fed,
        value,
        pointerId: e.pointerId,
        x,
        y,
        sx: x,
        sy: y,
        startedAt: performance.now(),
      }
      this.hud.stage.setPointerCapture?.(e.pointerId)
      this.audio.pick()
      this.host.haptic('light')
      return
    }

    const cell = cellAtPoint(this.renderer.layout, s.board, x, y)
    const p = cell >= 0 ? at(s.board, cell) : null
    if (!p) return
    const c = cellCentre(this.renderer.layout, s.board, cell)
    s.drag = {
      ...emptyDrag(),
      active: true,
      cell,
      value: p.value,
      pointerId: e.pointerId,
      x,
      y,
      sx: c.x,
      sy: c.y,
      grabDx: c.x - x,
      grabDy: c.y - y,
      startedAt: performance.now(),
    }
    this.pressCell = cell
    this.pressTimer = 0
    this.hud.stage.setPointerCapture?.(e.pointerId)
    this.audio.pick()
    this.host.haptic('light')
  }

  private onMove(e: PointerEvent): void {
    const d = this.s.drag
    if (!d.active || e.pointerId !== d.pointerId) return
    const { x, y } = this.local(e)
    if (Math.hypot(x - d.x, y - d.y) > 3) d.moved = true
    d.x = x
    d.y = y
    this.updateDragTarget()
  }

  private updateDragTarget(): void {
    const d = this.s.drag
    const s = this.s
    d.overMouth = this.overMouth(d.x, d.y)
    d.overCell = -1
    d.wouldMerge = false
    if (d.overMouth) return
    const cell = cellAtPoint(this.renderer.layout, s.board, d.x, d.y)
    if (cell < 0 || cell === d.cell) return
    d.overCell = cell
    if (d.cell < 0) return
    const target = at(s.board, cell)
    const me = at(s.board, d.cell)
    d.wouldMerge = !!target && !!me && target.value === me.value
  }

  private onUp(e: PointerEvent): void {
    const d = this.s.drag
    if (!d.active || e.pointerId !== d.pointerId) return
    const s = this.s

    if (d.fedIdx >= 0) {
      // Dragged out of the mouth, or tapped in it. Either way it goes back on the
      // shelf, for nothing — this is the retraction that keeps the clock off the
      // answer.
      if (!d.overMouth || !d.moved) this.consume(this.engine.retract(d.fedIdx))
      else this.audio.drop()
    } else if (d.overMouth && d.cell >= 0) {
      this.consume(this.engine.feed(d.cell))
    } else if (d.cell >= 0 && d.overCell >= 0) {
      if (d.wouldMerge) this.doMerge(d.cell, d.overCell)
      else if (!at(s.board, d.overCell)) {
        this.consume(this.engine.moveTo(d.cell, d.overCell))
        this.audio.drop()
      } else this.snapBack()
    } else if (d.cell >= 0 && !d.moved) {
      // a tap: sonar. Lights every polyp sharing this value, which is the one
      // affordance every merge board needs and most of them lack.
      const p = at(s.board, d.cell)
      if (p) {
        s.pinged = s.pinged === p.value ? -1 : p.value
        s.pingMs = 2600
        this.audio.tick()
      }
    }

    s.drag = emptyDrag()
    this.pressCell = -1
  }

  private snapBack(): void {
    const d = this.s.drag
    if (d.cell >= 0) {
      const p = at(this.s.board, d.cell)
      if (p) p.squash = 0.35
    }
    this.audio.drop()
  }

  private cancelDrag(): void {
    this.snapBack()
    this.s.drag = emptyDrag()
    this.pressCell = -1
  }

  private onKey(e: KeyboardEvent): void {
    const s = this.s
    const b = s.board
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter', 'f', 'F', 's', 'S']
    if (!keys.includes(e.key)) return
    e.preventDefault()
    this.audio.resume()
    if (this.cursor < 0) this.cursor = 0
    const cx = this.cursor % b.cols
    const cy = Math.floor(this.cursor / b.cols)
    if (e.key === 'ArrowLeft') this.cursor = cy * b.cols + Math.max(0, cx - 1)
    else if (e.key === 'ArrowRight') this.cursor = cy * b.cols + Math.min(b.cols - 1, cx + 1)
    else if (e.key === 'ArrowUp') this.cursor = Math.max(0, cy - 1) * b.cols + cx
    else if (e.key === 'ArrowDown') this.cursor = Math.min(b.rows - 1, cy + 1) * b.cols + cx
    else if (e.key === 'f' || e.key === 'F') this.consume(this.engine.feed(this.cursor))
    else if (e.key === 's' || e.key === 'S') this.consume(this.engine.split(this.cursor))
    else if (e.key === ' ' || e.key === 'Enter') {
      if (this.held < 0) {
        if (at(b, this.cursor)) {
          this.held = this.cursor
          this.audio.pick()
        }
      } else if (this.held === this.cursor) {
        this.held = -1
        this.audio.drop()
      } else {
        const a = at(b, this.held)
        const t = at(b, this.cursor)
        if (a && t && a.value === t.value) this.doMerge(this.held, this.cursor)
        else if (a && !t) this.consume(this.engine.moveTo(this.held, this.cursor))
        this.held = -1
      }
    }
    s.pinged = at(b, this.cursor)?.value ?? -1
    s.pingMs = 1400
  }

  /* ---------------------------------------------------------------- merges */

  private doMerge(from: number, to: number, chain = 0): void {
    const out = this.engine.merge(from, to)
    if (!out) return
    this.consume(out.events, chain)
    // Cascade: if the new value has an ADJACENT twin, it folds in too. This is
    // where the genre's peak moment lives — a single drag that keeps going.
    if (this.engine.adjacentTwin(to) >= 0) {
      this.cascades.push({ cell: to, value: out.res.value, at: performance.now() + CASCADE_MS, chain: chain + 1 })
    }
  }

  private runCascades(now: number): void {
    if (this.cascades.length === 0) return
    for (let i = this.cascades.length - 1; i >= 0; i--) {
      const c = this.cascades[i]
      if (!c || now < c.at) continue
      this.cascades.splice(i, 1)
      const target = at(this.s.board, c.cell)
      if (!target || target.value !== c.value) continue
      const twin = this.engine.adjacentTwin(c.cell)
      if (twin >= 0) this.doMerge(twin, c.cell, c.chain)
    }
  }

  private dissolve(): void {
    this.audio.resume()
    this.consume(this.engine.dissolve())
  }

  /* ------------------------------------------------------------------ juice */

  /**
   * Turn the engine's events into sound, shake and light.
   *
   * The single seam between the rules and the show. Everything above this line
   * runs in node with no canvas; everything below it is decoration and may be
   * deleted without changing what a child can and cannot do.
   */
  private consume(events: readonly Event[], chain = 0): void {
    const s = this.s
    const l = this.renderer.layout
    const b = BUDGET[s.tier]
    for (const ev of events) {
      switch (ev.kind) {
        case 'merge': {
          const c = cellCentre(l, s.board, ev.cell)
          const hue = rampAt(ev.rank)
          const strength = Math.min(1, 0.16 + ev.rank / 34)
          this.audio.merge(Math.min(28, ev.rank), chain)
          this.host.haptic(chain > 1 ? 'medium' : 'light')
          if (!s.reduceMotion) {
            this.particles.burst(c.x, c.y, Math.round((10 + ev.rank * 1.5) * b.burstScale) + chain * 5, hue, 150 + ev.rank * 12, this.rnd)
            this.waves.add(c.x, c.y, l.cell * 0.34, l.cell * (1.5 + strength * 1.9), 0.42, 5 + strength * 6, hue)
            this.punch.add(0.1 + strength * 0.26 + chain * 0.06)
            if (ev.rank > 12 || chain > 0) this.punch.freeze(22 + strength * 46 + chain * 14)
            if (ev.rank > 21) this.punch.slow(0.4, 130)
          }
          this.floaters.add(c.x, c.y - l.cell * 0.5, fmt(ev.value), Math.min(46, 17 + ev.rank * 0.85 + chain * 4), lift(hue, 0.4))
          if (chain > 0) this.floaters.add(c.x, c.y - l.cell * 1.1, `CHAIN ×${chain + 1}`, 15 + chain * 3, CHALK, 0.95)
          break
        }
        case 'split': {
          const c = cellCentre(l, s.board, ev.cell)
          const hue = rampAt(rank(ev.value))
          this.audio.cull()
          this.host.haptic('medium')
          if (!s.reduceMotion) {
            this.particles.burst(c.x, c.y, Math.round(12 * b.burstScale), hue, 170, this.rnd)
            this.punch.add(0.2)
          }
          this.floaters.add(c.x, c.y - l.cell * 0.5, `${fmt(ev.value)} + ${fmt(ev.value)}`, 18, lift(hue, 0.4))
          break
        }
        case 'move':
          break
        case 'fed': {
          const box = fedSlotRect(s.mouthRect, ev.index, Math.max(1, s.mouth.slots))
          this.audio.drop()
          this.host.haptic('light')
          s.mouthFlash = Math.max(s.mouthFlash, 0.35)
          if (!s.reduceMotion) {
            this.particles.burst(box.x + box.w / 2, box.y + box.h / 2, Math.round(8 * b.burstScale), rampAt(rank(ev.value)), 120, this.rnd)
          }
          break
        }
        case 'retract': {
          const c = cellCentre(l, s.board, ev.cell)
          this.audio.pick()
          this.host.haptic('light')
          if (!s.reduceMotion) this.particles.burst(c.x, c.y, 6, TIDE, 100, this.rnd)
          break
        }
        case 'bloom': {
          const r = s.mouthRect
          const mx = r.x + r.w / 2
          const my = r.y + r.h / 2
          const hue = rampAt(rank(ev.value))
          s.mouthFlash = 1
          this.audio.erupt(Math.min(12, 2 + Math.floor(ev.depth / 3)))
          this.host.haptic('success')
          if (!s.reduceMotion) {
            this.particles.plume(mx, my, Math.round(30 * b.burstScale), hue, this.rnd)
            this.particles.burst(mx, my, Math.round(46 * b.burstScale), lift(hue, 0.4), 380, this.rnd)
            this.waves.add(mx, my, 10, l.w * 0.8, 0.62, 13, lift(hue, 0.3))
            this.waves.add(mx, my, 10, l.w * 0.4, 0.44, 8, CHALK)
            this.punch.add(0.7)
            this.punch.freeze(96)
            this.punch.slow(0.32, 160)
          }
          this.floaters.add(mx, my - 46, fmt(ev.value), 52, lift(hue, 0.5), 1.6)
          break
        }
        case 'spill': {
          const r = s.mouthRect
          const mx = r.x + r.w / 2
          const my = r.y + r.h / 2
          s.mouthShake = 1
          this.audio.choke()
          this.host.haptic('failure')
          if (!s.reduceMotion) {
            this.particles.ink(mx, my, Math.round(18 * b.burstScale), this.rnd)
            this.punch.add(0.3)
          }
          // Countable, on purpose: the child sees exactly how much extra work
          // this cost, in polyps, and nothing else happens to them.
          this.floaters.add(mx, my - 38, `${ev.back.length} BACK`, 24, DANGER, 1.1)
          break
        }
        case 'grow': {
          this.renderer.relayout(s.board)
          s.mouthRect = mouthRect(this.renderer.layout)
          this.audio.magnitude(4)
          this.host.haptic('heavy')
          if (!s.reduceMotion) {
            this.punch.add(0.6)
            this.punch.freeze(80)
            this.waves.add(l.w / 2, l.h * 0.45, 8, Math.max(l.w, l.h), 0.9, 16, TIDE)
          }
          this.hud.pulseMeter()
          this.hud.toast(`THE REEF SPREADS — ${s.board.cols}×${s.board.rows}`)
          break
        }
        case 'emit': {
          const c = cellCentre(l, s.board, ev.cell)
          this.audio.emit()
          if (!s.reduceMotion) this.particles.burst(c.x, c.y, 5, rampAt(rank(ev.value)), 90, this.rnd)
          break
        }
        case 'dissolve': {
          for (const cell of ev.cells) {
            const c = cellCentre(l, s.board, cell)
            if (!s.reduceMotion) this.particles.burst(c.x, c.y, 8, TIDE, 130, this.rnd)
          }
          this.audio.cull()
          this.host.haptic('medium')
          this.hud.toast(`CLEARED ${ev.cells.length}`)
          break
        }
        case 'crowded': {
          this.audio.crowd()
          this.host.haptic('heavy')
          this.hud.toast('REEF FULL — join or clear', true)
          break
        }
        case 'target':
          this.lastFace = ''
          break
        case 'refuse': {
          this.audio.tick()
          if (ev.why === 'no-halves') {
            const d = this.s.drag
            const p = d.cell >= 0 ? at(s.board, d.cell) : null
            if (p) p.squash = 0.5
            this.hud.toast('that one cannot be halved')
          }
          break
        }
        case 'undertow': {
          // The smash half of "it shuffles and smashes and clears". It arrives in
          // the same batch as the bloom, so it reads as one event with the maths
          // moment rather than as a separate thing happening TO the child.
          for (const cell of ev.cells) {
            const c = cellCentre(l, s.board, cell)
            if (!s.reduceMotion) this.particles.burst(c.x, c.y, 10, TIDE, 200, this.rnd)
          }
          this.audio.cull()
          break
        }
        case 'shuffle': {
          if (!s.reduceMotion) {
            this.waves.add(l.w / 2, l.h * 0.45, 6, Math.max(l.w, l.h) * 0.7, 0.5, 11, TIDE)
            this.punch.add(0.35)
          }
          break
        }
        case 'grew-away':
          this.hud.toast(`${ev.polyps} NEW POLYPS GREW WHILE YOU WERE GONE`)
          break
      }
    }
  }

  /* ---------------------------------------------------------------- update */

  private frame = (now: number): void => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.frame)
    if (this.paused) {
      // Nothing steps and nothing is drawn. `last` still tracks so that a resume —
      // or a rotation that relayouts underneath the sheet — cannot land one
      // enormous frame.
      this.last = now
      return
    }
    const realDt = Math.min(0.05, Math.max(0.0001, (now - this.last) / 1000))
    this.last = now

    this.fpsSamples.push(1 / realDt)
    if (this.fpsSamples.length > 60) this.fpsSamples.shift()

    this.punch.update(realDt)
    const dt = realDt * this.punch.timeScale
    if (dt > 0) this.update(dt, now)
    this.drawFrame(now)
  }

  private update(dt: number, now: number): void {
    const s = this.s

    if (!this.snowSeeded) {
      const l = this.renderer.layout
      this.particles.clear()
      this.particles.seedSnow(BUDGET[s.tier].snow, l.w, l.h, this.rnd)
      this.snowSeeded = true
    }

    this.consume(this.engine.tick(dt * 1000))
    for (const p of polyps(s.board)) p.squash = approach(p.squash, 0, 9, dt)
    s.mouthFlash = approach(s.mouthFlash, 0, 5, dt)
    s.mouthShake = approach(s.mouthShake, 0, 6, dt)

    this.runCascades(now)

    if (s.pingMs > 0) {
      s.pingMs -= dt * 1000
      if (s.pingMs <= 0) s.pinged = -1
    }

    // A long press splits a polyp — the merge run backwards, and the way an exact
    // target gets its odd term.
    if (this.pressCell >= 0 && s.drag.active && !s.drag.moved) {
      this.pressTimer += dt * 1000
      if (this.pressTimer > SPLIT_HOLD_MS) {
        const p = at(s.board, this.pressCell)
        if (p && canSplit(p.value) && emptyCells(s.board).length > 0) {
          this.consume(this.engine.split(this.pressCell))
          this.pressCell = -1
          s.drag = emptyDrag()
        } else {
          // Not splittable. Say so once and let the press go on being a press —
          // the child is not punished for asking.
          this.pressTimer = -1e9
          this.consume([{ kind: 'refuse', why: 'no-halves' }])
        }
      }
    }

    // drag spring — the polyp trails the finger, which reads as weight
    const d = s.drag
    if (d.active) {
      const tx = d.x + d.grabDx * 0.35
      const ty = d.y + d.grabDy * 0.35 - 12
      d.sx = approach(d.sx, tx, 26, dt)
      d.sy = approach(d.sy, ty, 26, dt)
      this.updateDragTarget()
    }

    const l = this.renderer.layout
    this.particles.update(dt, l.w, l.h)
    this.waves.update(dt)
    this.floaters.update(dt)

    this.saveMs += dt * 1000
    if (this.saveMs > 4000) {
      this.saveMs = 0
      this.save()
    }
  }

  /* ------------------------------------------------------------------ draw */

  private drawFrame(now: number): void {
    const s = this.s
    const t = now / 1000
    this.renderer.draw(
      s,
      t,
      { ox: this.punch.ox, oy: this.punch.oy, rot: this.punch.rot, level: this.punch.level },
      this.particles,
      this.waves,
      this.floaters,
    )

    const face = this.engine.face
    const hue = rampAt(s.target ? rank(s.target.value) : 0)
    if (face !== this.lastFace) {
      this.lastFace = face
      this.hud.setFace(face, `rgba(${hue[0]},${hue[1]},${hue[2]},.55)`)
    }
    this.hud.setMeter(s.depth % GROW_EVERY, GROW_EVERY, hex(hue))
    // Live whenever there is a polyp to clear — a child who does not like the
    // shelf they are looking at may say so at any moment, and CLEAR takes the reef
    // with it, so it is a price rather than an exploit. `needsRoom` and `crowded`
    // only make it GLOW, which is the job the gate should always have had.
    this.hud.setDissolve(this.engine.canClear, this.engine.needsRoom || s.crowded)

    if (this.debug) {
      const n = this.fpsSamples.length
      this.fps = n === 0 ? 60 : this.fpsSamples.reduce((a, b) => a + b, 0) / n
      const st = this.engine.stats
      this.hud.setBadge(
        `${this.fps.toFixed(0)}fps · ${s.tier} · d${st.depth} · ${distinctValues(s.board).length}v · ` +
          `${this.engine.reachable() ? 'reachable' : 'STOCKING'} · ${s.target?.hostPrompt || 'no item'}`,
      )
    } else {
      const st = this.engine.stats
      this.hud.setBadge(`${fmt(st.depth)} blooms · ${fmt(st.merges)} joins`)
    }
    void ease
  }
}
