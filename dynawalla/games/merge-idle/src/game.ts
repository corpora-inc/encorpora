/**
 * ABYSSAL BLOOM — a merge-and-idle reef.
 *
 * THE LOOP
 *   Vents cough polyps onto a shelf. Two polyps with the same number merge into
 *   their sum, which is exactly double. Each vent holds up a request — `96 + 96`
 *   — and the way you answer it is to *build the answer with your hands* and
 *   post it into the vent's mouth. The vent erupts, pays essence, deepens a
 *   tier, and asks something harder. Essence accrues while you are away and
 *   comes back as a tide you have to solve to collect.
 *
 * WHY THIS IS NOT A QUIZ
 *   The merge that makes the answer *is* the addition in the prompt. A child who
 *   works out that 96 + 96 is 192 then makes a 192 by shoving two 96s together.
 *   Nothing is multiple choice, nothing is guessable — feeding the wrong polyp
 *   chokes the vent cold for three seconds and drops the flow multiplier, which
 *   is a real cost with no red X and no lecture anywhere in the file.
 */

import {
  createInstructions,
  onInsetsChange,
  safeRect,
  type Instructions,
  type InstructionsSpec,
} from '../../../packs/shared/game-chrome/index.ts'
import type { Host, Question } from './contract.ts'
import {
  at,
  cull,
  distinctValues,
  emptyCells,
  grow,
  isCrowded,
  makeBoard,
  move,
  place,
  polyps,
  purgeLowest,
  reefMass,
  spawn,
  tryMerge,
} from './core/board.ts'
import {
  assayPayout,
  baseStepFor,
  bloomLevel,
  difficultyForStep,
  eruptionYield,
  flowAfter,
  growCost,
  offlineHaul,
  reefTrickle,
  SWELL_PERIOD_MS,
  targetStepFor,
  tideMultiplier,
  upwellCost,
  ventCost,
  ventPeriodMs,
  ventRate,
} from './core/economy.ts'
import { decompose, fmt, fmtCompact, magnitude, onLadder, rank, SEEDS, type Strain } from './core/ladder.ts'
import { hashSeed, makeRng, type Rng } from './core/rng.ts'
import { readSave, writeSave } from './core/save.ts'
import {
  BUDGET,
  detectTier,
  emptyDrag,
  emptyTide,
  type State,
  type Tier,
  type Vent,
} from './core/state.ts'
import { Audio } from './audio/audio.ts'
import { Floaters } from './fx/floaters.ts'
import { Particles, Shockwaves } from './fx/particles.ts'
import { approach, ease, Punch } from './fx/shake.ts'
import { CHALK, DANGER, hex, lift, rampAt, TIDE } from './render/palette.ts'
import { cellAtPoint, cellCentre, Renderer, shelfCap, ventCap, ventRects } from './render/renderer.ts'
import { chromeLayout, stageAreaFor } from './ui/chrome.ts'
import { actionList } from './ui/actions.ts'
import { Hud, type Action } from './ui/hud.ts'

const MAX_ROWS = 9
const START_COLS = 5
const START_ROWS = 6

type Cascade = { cell: number; value: number; at: number; chain: number }

/**
 * How to play, in a child's words.
 *
 * An idle game is the one genre that CANNOT be figured out by watching, because
 * the half of it that matters happens while nobody is looking. A child who is
 * not told that the reef keeps earning after they close it will read the away
 * time as the game doing nothing, and the tide gate on their return as a quiz
 * that came out of nowhere. So the manual says the quiet parts out loud: the
 * reef earns while you are gone, it saves itself, and coming back is a move.
 */
const INSTRUCTIONS = (reducedMotion: boolean): InstructionsSpec => ({
  title: 'ABYSSAL BLOOM',
  summary: [
    'Two polyps with the same number join into one polyp worth double. Drag one onto the other.',
    'The tall vents hold up a sum. Build the answer out of polyps and drop it in the vent’s mouth.',
  ],
  sections: [
    {
      heading: 'Joining polyps',
      lines: [
        'The glowing creatures on the reef are polyps. Each one has a number.',
        'Drag a polyp on top of another polyp with the same number.',
        'They join into one polyp. Its number is the two numbers added together, so it is double.',
        '3 and 3 make 6. 6 and 6 make 12. 96 and 96 make 192.',
        'Tap a polyp once and every polyp with that same number lights up. That is how you find its partner.',
        'Drag a polyp onto an empty space to move it there.',
      ],
    },
    {
      heading: 'Feeding a vent',
      lines: [
        'The tall towers are vents. Each vent holds up a sum, like 96 + 96.',
        'Work out the answer. Then join polyps until you have a polyp with that number.',
        'Drag that polyp into the round mouth at the bottom of the vent.',
        'If it is right the vent erupts. It pays you essence, gets stronger, and asks a harder sum.',
        'If it is wrong the vent goes cold for about three seconds. Wait for it to warm up, then try again.',
        'Get several right in a row and your FLOW goes up, and every vent pays more.',
        'Some answers are not numbers a polyp can have. Then four tiles appear above the vent. Drag the right tile into the mouth instead.',
      ],
    },
    {
      heading: 'Essence and the buttons',
      lines: [
        'Essence is the big number at the top. Vents make essence every second, all on their own.',
        'Spend it on the buttons along the bottom.',
        'UPWELL buys a handful of new polyps right now.',
        'AWAKEN wakes up one more vent, so there are more sums and more essence.',
        'DEEPEN makes the reef bigger, so you have more room.',
        'OVERCHARGE makes every vent stronger at the same time.',
      ],
    },
    {
      heading: 'When the reef is full',
      lines: [
        'If every space is full and no two numbers match, a red bar says SHELF CROWDED.',
        'Press DISSOLVE. It is free.',
        'It clears away all the smallest polyps and pays you their numbers.',
        'You can never get stuck. DISSOLVE always works.',
      ],
    },
    {
      heading: 'Going away and coming back',
      lines: [
        'This game keeps going when you are not here. That is not a bug, it is the point.',
        'Leave, do something else, come back. The reef made essence the whole time you were gone, for up to eight hours.',
        'When you come back a tide is waiting, with one question. Answer it and the tide is yours.',
        'Get it right on the first try and you keep three times as much.',
        'While you play, a glowing ball marked TIDE floats up now and then. Tap it for another one.',
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
 * `{ unmount }`, because the host contract has no slot for a pause and inventing
 * a public one to make a test easier would be inventing a public surface. A test
 * that has to read the pause flag therefore needs the instance, and the instance
 * is only reachable if the class has a name outside this module.
 */
export class Game {
  private s: State
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
   * The manual only lifts a pause it put on itself. Nothing else pauses this
   * game today, but the day something does — a host sheet, a parent gate — a
   * child closing the rules underneath it must not be handed back a running reef.
   */
  private heldForManual = false
  /** `performance.now()` when the freeze began, so resume can rebase off it. */
  private pausedAt = 0
  private ro: ResizeObserver | null = null
  private saveMs = 0
  private fpsSamples: number[] = []
  private fps = 60
  private lastLatency = 0
  private debug = false
  private cursor = -1
  private held = -1
  private snowSeeded = false
  private pressTimer = 0
  private pressCell = -1
  private detach: Array<() => void> = []

  private el: HTMLElement
  private host: Host

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

    this.s = {
      board: makeBoard(START_COLS, START_ROWS),
      vents: [],
      nextVentId: 1,
      essence: 0,
      shown: 0,
      magnitude: 0,
      correctRun: 0,
      flow: 1,
      ratePerSec: 0,
      baseStep: 0,
      bloom: 0,
      grows: 0,
      upwells: 0,
      overcharges: 0,
      crowded: false,
      crowdedSince: 0,
      swellMs: SWELL_PERIOD_MS,
      swell: null,
      tide: emptyTide(),
      toasts: [],
      elapsed: 0,
      assays: 0,
      merges: 0,
      bestValue: 0,
      drag: emptyDrag(),
      pinged: -1,
      pingMs: 0,
      tier,
      reduceMotion: host.prefersReducedMotion(),
    }
    this.punch.reduceMotion = this.s.reduceMotion
    this.particles = new Particles(BUDGET[tier].particles)

    this.hud = new Hud({
      onAction: (id) => this.action(id),
      onChip: (i) => this.answerGate(i),
      onMute: (m) => {
        this.audio.enabled = !m
        if (!m) this.audio.resume()
      },
    })
    this.hud.mount(el)
    this.renderer = new Renderer(this.hud.stage)

    this.restore()
    if (this.s.vents.length === 0) this.addVent()
    if (polyps(this.s.board).length === 0) this.seedShelf()

    this.guide = createInstructions(el, {
      ...INSTRUCTIONS(this.s.reduceMotion),
      // The reef is the one genre where "it kept running while I read" is not
      // only noise: vents cough polyps onto the shelf on a timer, a cold vent
      // warms back up on a timer, a swell rises on a timer, and `askedAt` is the
      // thinking time this game reports to the learner model. All of it moves
      // with nobody's hands on the glass, so all of it has to stop.
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
    this.layout()
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
   * **Frozen means frozen.** The frame callback keeps being scheduled — it has
   * to, or there would be nothing left to resume with — but it steps nothing and
   * draws nothing. Every moving part of this game lives inside `update()` and
   * `drawFrame()`: essence accrual, polyp ages, the merge cascade queue, each
   * vent's emit timer and cold timer, the swell, the sonar ping, the long-press
   * dissolve timer, the drag spring, particles, shockwaves, floaters and the
   * autosave. One `return` above them takes all of them, and the canvas holds
   * its last painted frame underneath the sheet.
   *
   * **The idle question, decided.** An idle game banks wall-clock time, so
   * "reading is free production" and "reading costs you two minutes" are both
   * live possibilities and it would be negligent to pick one by accident. This
   * game credits away-time through exactly one surface: `offlineHaul`, capped at
   * eight hours, discounted to 55%, and collected by answering a tide gate. That
   * is deliberate — essence in ABYSSAL BLOOM is never handed over without either
   * a merge or a question. Silently topping up `essence` for the seconds a sheet
   * was up would be the only path in the game that pays for neither, and because
   * the hold is measured with `performance.now()` it would also pay out real
   * *backgrounded* time — a child who opens the manual and puts the tablet down
   * for an hour would come back an hour richer with the tide gate bypassed. So
   * the read is outside of time: nothing accrues, and nothing decays either. No
   * vent cools down for free, no swell arrives, no timer runs out. A child is
   * returned the reef they left, to the polyp.
   *
   * The one thing that must NOT be left alone is a wall-clock mark, because
   * every one of them leaps forward the instant the clock is looked at again.
   */
  private setPaused(on: boolean): void {
    if (on === this.paused) return
    this.paused = on
    if (on) {
      this.pausedAt = performance.now()
      // A drag in flight never gets its release: the shared sheet swallows
      // `pointerup` along with every other pointer event. Left standing, the
      // long-press dissolve timer would carry on counting from behind the
      // manual and take the polyp out from under a finger that is no longer
      // there. Sound is already held by the sheet, so this is silent.
      if (this.s.drag.active) this.cancelDrag()
      return
    }
    // Every wall-clock mark moves forward by exactly the time the sheet was up.
    // `Math.min(now, ...)` covers a mark that was set DURING the hold — the tide
    // gate re-asks on a 520ms `setTimeout` — which must not be shifted into the
    // future and reported as negative thinking time.
    const now = performance.now()
    const held = now - this.pausedAt
    for (const v of this.s.vents) {
      v.askedAt = Math.min(now, v.askedAt + held)
      v.hintAt += held
      if (v.coldUntil > 0) v.coldUntil += held
    }
    const t = this.s.tide
    if (t.askedAt > 0) t.askedAt = Math.min(now, t.askedAt + held)
    for (const c of this.cascades) c.at += held
    // `last` is the frame delta's other end. Without this the resumed frame
    // computes a delta the length of the read; it would be clamped to 50ms, but
    // 50ms of free reef is still 50ms nobody played.
    this.last = now
    // Re-stamp `lastSeen`. `offlineHaul` measures from the last write, so
    // without this a read would be banked as away-time on the next launch and
    // the manual would become a way to farm the tide — the exact leak the
    // paragraph above refuses to open from the other end.
    this.save()
  }

  private observeSize(): void {
    // Insets change more often than "never": a rotation swaps top and bottom
    // with left and right, and iPadOS changes them when a pack is resized in
    // Split View. A game that measures them once at mount is correct until the
    // first rotation and wrong after it.
    this.detach.push(onInsetsChange(() => this.layout()))
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
   * The stage is measured rather than predicted — the rail grows a row when
   * DISSOLVE appears — but its safe area comes from the same `chromeLayout`
   * the band used, so the two can never disagree about where the notch is.
   */
  private layout(): void {
    const rw = this.el.clientWidth || 360
    const rh = this.el.clientHeight || 640
    const chrome = chromeLayout(rw, rh, safeRect(rw, rh))
    this.hud.applyChrome(chrome)

    const w = this.hud.stage.clientWidth || rw
    const h = this.hud.stage.clientHeight || chrome.stage.h
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    this.renderer.resize(w, h, dpr, this.s.board, this.s.tier, stageAreaFor(chrome, w, h))
    this.layoutVents()
    this.snowSeeded = false
  }

  private layoutVents(): void {
    const rects = ventRects(this.renderer.layout, this.s.vents.length)
    this.s.vents.forEach((v, i) => {
      const r = rects[i]
      if (r) v.rect = r
    })
  }

  private get ventCap(): number {
    return ventCap(this.renderer.layout)
  }

  /**
   * How far DEEPEN may grow the shelf.
   *
   * The designed ceiling, narrowed by what this particular glass can actually
   * draw legibly above the vent band — a 9-row shelf does not fit a small
   * notched phone, and growing into one used to mean the bottom row was drawn
   * over the vents. Capping growth is the reflow nobody notices; the collision
   * was one the founder photographed.
   */
  private get shelfLimit(): { maxCols: number; maxRows: number } {
    const cap = shelfCap(this.renderer.layout)
    return {
      maxCols: Math.max(START_COLS, Math.min(this.renderer.layout.w < 380 ? 6 : 7, cap.cols)),
      maxRows: Math.max(START_ROWS, Math.min(MAX_ROWS, cap.rows)),
    }
  }

  /* --------------------------------------------------------------- persist */

  private restore(): void {
    const raw = readSave()
    if (!raw) return
    try {
      const d = JSON.parse(raw) as {
        essence?: number
        magnitude?: number
        grows?: number
        upwells?: number
        overcharges?: number
        cols?: number
        rows?: number
        cells?: Array<[number, number]>
        vents?: Array<{ tier: number }>
        lastSeen?: number
      }
      this.s.essence = Math.max(0, Number(d.essence) || 0)
      this.s.shown = this.s.essence
      this.s.magnitude = magnitude(this.s.essence)
      this.s.grows = Number(d.grows) || 0
      this.s.upwells = Number(d.upwells) || 0
      this.s.overcharges = Number(d.overcharges) || 0
      const cols = Math.max(START_COLS, Math.min(8, Number(d.cols) || START_COLS))
      const rows = Math.max(START_ROWS, Math.min(MAX_ROWS, Number(d.rows) || START_ROWS))
      this.s.board = makeBoard(cols, rows)
      for (const [cell, value] of d.cells ?? []) {
        if (onLadder(value)) place(this.s.board, cell, value, this.rng.int(0, 999) / 1000)
      }
      for (const p of polyps(this.s.board)) p.born = 1
      for (const v of d.vents ?? []) this.addVent(Math.max(1, Number(v.tier) || 1))
      this.recomputeDerived()

      const elapsed = Date.now() - (Number(d.lastSeen) || Date.now())
      const haul = offlineHaul(this.s.ratePerSec, elapsed)
      if (haul > 0) this.openGate('offline', haul)
    } catch (e) {
      console.warn('[abyssal-bloom] save was unreadable; starting fresh', e)
      this.s.board = makeBoard(START_COLS, START_ROWS)
      this.s.vents = []
    }
  }

  private save(): void {
    const cells: Array<[number, number]> = []
    for (let i = 0; i < this.s.board.cells.length; i++) {
      const p = this.s.board.cells[i]
      if (p) cells.push([i, p.value])
    }
    const d = {
      essence: Math.floor(this.s.essence),
      magnitude: this.s.magnitude,
      grows: this.s.grows,
      upwells: this.s.upwells,
      overcharges: this.s.overcharges,
      cols: this.s.board.cols,
      rows: this.s.board.rows,
      cells,
      vents: this.s.vents.map((v) => ({ tier: v.tier })),
      lastSeen: Date.now(),
    }
    writeSave(JSON.stringify(d))
  }

  /* ----------------------------------------------------------------- vents */

  private addVent(tier = 1): void {
    const v: Vent = {
      id: this.s.nextVentId++,
      tier,
      q: null,
      answerValue: null,
      strain: (this.s.vents.length % SEEDS.length) as Strain,
      emitValue: 1,
      askedAt: 0,
      chips: null,
      emitMs: 900,
      coldUntil: 0,
      hintAt: 0,
      flash: 0,
      shake: 0,
      glow: 0,
      rect: { x: 0, y: 0, w: 0, h: 0 },
    }
    this.s.vents.push(v)
    this.ask(v)
    this.layoutVents()
  }

  /** Put a fresh request on a vent, and align what it emits so it is buildable. */
  private ask(v: Vent): void {
    const targetStep = targetStepFor(this.s.baseStep, v.tier)
    const q: Question = this.host.next({ difficulty: difficultyForStep(targetStep) })
    v.q = q
    v.askedAt = performance.now()
    v.hintAt = v.askedAt + 16000
    const a = Number(q.answer)
    if (Number.isSafeInteger(a) && a > 0 && onLadder(a)) {
      const id = decompose(a)
      v.answerValue = a
      v.chips = null
      if (id) {
        v.strain = id.strain
        v.emitValue = (SEEDS[id.strain] ?? 1) * 2 ** Math.max(0, id.step - 2)
      }
    } else {
      // The host handed us something that is not a polyp value — a fraction, a
      // decimal, a word. Fall back to sigils you drag in. Same gesture, same
      // stakes; the native path just is not available for this question.
      v.answerValue = null
      v.chips = this.rng.shuffle([q.answer, ...q.distractors.slice(0, 3)])
      v.emitValue = (SEEDS[v.strain] ?? 1) * 2 ** this.s.baseStep
    }
  }

  private seedShelf(): void {
    const v = this.s.vents[0]
    const base = v ? v.emitValue : 1
    for (let i = 0; i < 6; i++) {
      const p = spawn(this.s.board, base, this.rng)
      if (p) p.born = 1
    }
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

  private onDown(e: PointerEvent): void {
    if (this.hud.gateOpen) return
    this.audio.resume()
    const { x, y } = this.local(e)
    const s = this.s
    const l = this.renderer.layout

    // a waiting tide, tapped
    const sw = s.swell
    if (sw && Math.hypot(x - sw.x, y - sw.y) < 44) {
      this.openGate('swell', sw.haul)
      s.swell = null
      this.audio.tick()
      return
    }

    // a sigil chip
    for (const v of s.vents) {
      if (!v.chips) continue
      const n = v.chips.length
      const cw = Math.min(v.rect.w / n - 6, 72)
      const ch = Math.min(cw * 0.62, 38)
      const cy = v.rect.y - ch - 10
      for (let i = 0; i < n; i++) {
        const cx = v.rect.x + (v.rect.w / n) * i + (v.rect.w / n - cw) / 2
        if (x >= cx && x <= cx + cw && y >= cy - 8 && y <= cy + ch + 8) {
          s.drag = {
            ...emptyDrag(),
            active: true,
            cell: -1,
            chipVent: v.id,
            chipIdx: i,
            chipText: v.chips[i] ?? '',
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
      }
    }

    const cell = cellAtPoint(l, s.board, x, y)
    const p = cell >= 0 ? at(s.board, cell) : null
    if (!p) return
    const c = cellCentre(l, s.board, cell)
    s.drag = {
      ...emptyDrag(),
      active: true,
      cell,
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
    d.overVent = -1
    d.overCell = -1
    d.wouldMerge = false
    for (const v of s.vents) {
      const r = v.rect
      if (d.x >= r.x && d.x <= r.x + r.w && d.y >= r.y - 10 && d.y <= r.y + r.h) {
        d.overVent = v.id
        return
      }
    }
    if (d.cell < 0) return
    const cell = cellAtPoint(this.renderer.layout, s.board, d.x, d.y)
    if (cell < 0 || cell === d.cell) return
    d.overCell = cell
    const target = at(s.board, cell)
    const me = at(s.board, d.cell)
    d.wouldMerge = !!target && !!me && target.value === me.value
  }

  private onUp(e: PointerEvent): void {
    const d = this.s.drag
    if (!d.active || e.pointerId !== d.pointerId) return
    const t0 = performance.now()
    const s = this.s

    if (d.overVent >= 0) {
      const v = s.vents.find((x) => x.id === d.overVent)
      if (v) {
        if (d.cell >= 0) this.assayPolyp(v, d.cell)
        else if (d.chipVent === v.id) this.assayChip(v, d.chipIdx)
        else this.snapBack()
      }
    } else if (d.cell >= 0 && d.overCell >= 0) {
      if (d.wouldMerge) this.doMerge(d.cell, d.overCell)
      else if (!at(s.board, d.overCell)) {
        move(s.board, d.cell, d.overCell)
        this.audio.drop()
        const p = at(s.board, d.overCell)
        if (p) p.squash = 0.5
      }
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

    this.lastLatency = performance.now() - t0
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
    if (this.hud.gateOpen) return
    const s = this.s
    const b = s.board
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter']
    if (!keys.includes(e.key) && !/^[1-5]$/.test(e.key)) return
    e.preventDefault()
    this.audio.resume()
    if (this.cursor < 0) this.cursor = 0
    const cx = this.cursor % b.cols
    const cy = Math.floor(this.cursor / b.cols)
    if (e.key === 'ArrowLeft') this.cursor = cy * b.cols + Math.max(0, cx - 1)
    else if (e.key === 'ArrowRight') this.cursor = cy * b.cols + Math.min(b.cols - 1, cx + 1)
    else if (e.key === 'ArrowUp') this.cursor = Math.max(0, cy - 1) * b.cols + cx
    else if (e.key === 'ArrowDown') this.cursor = Math.min(b.rows - 1, cy + 1) * b.cols + cx
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
        else if (a && !t) {
          move(b, this.held, this.cursor)
          this.audio.drop()
        }
        this.held = -1
      }
    } else {
      const n = Number(e.key)
      const v = s.vents[n - 1]
      if (v && this.held >= 0) {
        this.assayPolyp(v, this.held)
        this.held = -1
      }
    }
    s.pinged = at(b, this.cursor)?.value ?? -1
    s.pingMs = 1400
  }

  /* ---------------------------------------------------------------- merges */

  private doMerge(from: number, to: number, chain = 0): void {
    const s = this.s
    const res = tryMerge(s.board, from, to)
    if (!res) return
    s.merges++
    if (res.value > s.bestValue) s.bestValue = res.value
    const l = this.renderer.layout
    const c = cellCentre(l, s.board, to)
    const hue = rampAt(res.rank)
    const strength = Math.min(1, 0.16 + res.rank / 34)

    this.audio.merge(Math.min(28, res.rank), chain)
    this.host.haptic(chain > 1 ? 'medium' : 'light')

    if (!s.reduceMotion) {
      const b = BUDGET[s.tier]
      this.particles.burst(
        c.x,
        c.y,
        Math.round((10 + res.rank * 1.5) * b.burstScale) + chain * 5,
        hue,
        150 + res.rank * 12,
        this.rnd,
      )
      this.waves.add(c.x, c.y, l.cell * 0.34, l.cell * (1.5 + strength * 1.9), 0.42, 5 + strength * 6, hue)
      this.punch.add(0.1 + strength * 0.26 + chain * 0.06)
      if (res.rank > 12 || chain > 0) this.punch.freeze(22 + strength * 46 + chain * 14)
      if (res.rank > 21) this.punch.slow(0.4, 130)
    }

    const size = Math.min(46, 17 + res.rank * 0.85 + chain * 4)
    this.floaters.add(c.x, c.y - l.cell * 0.5, fmt(res.value), size, lift(hue, 0.4))
    if (chain > 0) {
      this.floaters.add(c.x, c.y - l.cell * 1.1, `CHAIN ×${chain + 1}`, 15 + chain * 3, CHALK, 0.95)
    }

    // Cascade: if the new value has an ADJACENT twin, it folds in too. This is
    // where the genre's peak moment lives — a single drag that keeps going.
    this.queueCascade(to, res.value, chain + 1)
    this.refreshCrowd()
  }

  private queueCascade(cell: number, value: number, chain: number): void {
    const b = this.s.board
    const cx = cell % b.cols
    const cy = Math.floor(cell / b.cols)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= b.cols || ny >= b.rows) continue
      const n = at(b, ny * b.cols + nx)
      if (n && n.value === value) {
        this.cascades.push({ cell, value, at: performance.now() + 105, chain })
        return
      }
    }
  }

  private runCascades(now: number): void {
    if (this.cascades.length === 0) return
    const b = this.s.board
    for (let i = this.cascades.length - 1; i >= 0; i--) {
      const c = this.cascades[i]
      if (!c || now < c.at) continue
      this.cascades.splice(i, 1)
      const target = at(b, c.cell)
      if (!target || target.value !== c.value) continue
      const cx = c.cell % b.cols
      const cy = Math.floor(c.cell / b.cols)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= b.cols || ny >= b.rows) continue
        const j = ny * b.cols + nx
        const n = at(b, j)
        if (n && n.value === c.value) {
          this.doMerge(j, c.cell, c.chain)
          break
        }
      }
    }
  }

  /* ----------------------------------------------------------------- assay */

  private assayPolyp(v: Vent, cell: number): void {
    const p = at(this.s.board, cell)
    if (!p) return
    if (performance.now() < v.coldUntil) {
      this.snapBack()
      this.hud.toast('vent is cold', true)
      return
    }
    if (v.answerValue === null) {
      this.snapBack()
      this.hud.toast('this vent wants a sigil')
      return
    }
    const correct = p.value === v.answerValue
    this.report(v, correct, String(p.value))
    if (correct) {
      cull(this.s.board, cell)
      this.erupt(v, p.value)
    } else {
      this.choke(v)
      this.snapBack()
    }
  }

  private assayChip(v: Vent, idx: number): void {
    const chips = v.chips
    const q = v.q
    if (!chips || !q) return
    if (performance.now() < v.coldUntil) {
      this.hud.toast('vent is cold', true)
      return
    }
    const answered = chips[idx] ?? ''
    const correct = answered === q.answer
    this.report(v, correct, answered)
    if (correct) this.erupt(v, Math.max(1, Number(q.answer) || v.emitValue))
    else this.choke(v)
  }

  private report(v: Vent, correct: boolean, answered: string): void {
    const q = v.q
    if (!q) return
    try {
      this.host.report({
        questionId: q.id,
        correct,
        ms: Math.round(performance.now() - v.askedAt),
        answered,
      })
    } catch (e) {
      console.warn('[abyssal-bloom] host.report threw', e)
    }
  }

  private erupt(v: Vent, value: number): void {
    const s = this.s
    const l = this.renderer.layout
    const payout = assayPayout(value, v.tier, s.flow)
    s.essence += payout
    s.assays++
    s.correctRun++
    s.flow = flowAfter(s.correctRun)
    v.tier++
    v.flash = 1
    v.coldUntil = 0

    const mouthX = v.rect.x + v.rect.w / 2
    const mouthY = v.rect.y + v.rect.h * 0.66
    const hue = rampAt(rank(value))

    this.audio.erupt(v.tier)
    this.host.haptic('success')
    if (!s.reduceMotion) {
      const b = BUDGET[s.tier]
      this.particles.plume(mouthX, mouthY, Math.round(26 * b.burstScale), hue, this.rnd)
      this.particles.burst(mouthX, mouthY, Math.round(30 * b.burstScale), lift(hue, 0.4), 340, this.rnd)
      this.waves.add(mouthX, mouthY, 10, l.w * 0.62, 0.6, 12, lift(hue, 0.3))
      this.waves.add(mouthX, mouthY, 10, l.w * 0.34, 0.42, 7, CHALK)
      this.punch.add(0.62)
      this.punch.freeze(92)
      this.punch.slow(0.34, 150)
    }
    this.floaters.add(mouthX, mouthY - 40, `+${fmtCompact(payout)}`, 40, lift(hue, 0.45), 1.4)
    this.hud.toast(`VENT DEEPENED — TIER ${v.tier}`)

    // the eruption throws new life onto the shelf
    const yield_ = eruptionYield(v.tier)
    let wasted = 0
    for (let i = 0; i < yield_; i++) {
      const p = spawn(s.board, v.emitValue, this.rng)
      if (!p) wasted += v.emitValue
    }
    if (wasted > 0) {
      s.essence += wasted
      this.floaters.add(mouthX, mouthY - 76, `shelf full +${fmtCompact(wasted)}`, 15, TIDE, 1.1)
    }

    this.ask(v)
    this.recomputeDerived()
    this.refreshCrowd()
  }

  private choke(v: Vent): void {
    const s = this.s
    v.coldUntil = performance.now() + 3200
    v.shake = 1
    s.correctRun = 0
    s.flow = 1
    this.audio.choke()
    this.host.haptic('failure')
    const mouthX = v.rect.x + v.rect.w / 2
    const mouthY = v.rect.y + v.rect.h * 0.66
    if (!s.reduceMotion) {
      this.particles.ink(mouthX, mouthY, Math.round(18 * BUDGET[s.tier].burstScale), this.rnd)
      this.punch.add(0.3)
    }
    this.floaters.add(mouthX, mouthY - 34, 'COLD', 24, DANGER, 1.0)
  }

  /* ------------------------------------------------------------- tide gate */

  private openGate(kind: 'offline' | 'swell', haul: number): void {
    const t = this.s.tide
    t.open = true
    t.kind = kind
    t.haul = haul
    t.attempt = 0
    t.wrongIdx = -1
    this.nextGateQuestion()
  }

  private nextGateQuestion(): void {
    const t = this.s.tide
    const q = this.host.next({ difficulty: difficultyForStep(this.s.baseStep + 2) })
    t.q = q
    t.askedAt = performance.now()
    t.chips = this.rng.shuffle([q.answer, ...q.distractors.slice(0, 3)])
    const mult = tideMultiplier(t.attempt)
    this.hud.showGate({
      kicker: t.kind === 'offline' ? 'The tide came in while you were away' : 'A swell has broken',
      haul: fmtCompact(t.haul * mult),
      sub: t.kind === 'offline' ? 'the reef kept blooming without you' : 'the reef surged',
      prompt: q.prompt,
      chips: t.chips,
      mult: mult > 1 ? `CLEAN CLAIM ×${mult}` : 'CLAIM',
    })
  }

  private answerGate(index: number): void {
    const t = this.s.tide
    const q = t.q
    if (!q || !t.open) return
    const answered = t.chips[index] ?? ''
    const correct = answered === q.answer
    try {
      this.host.report({
        questionId: q.id,
        correct,
        ms: Math.round(performance.now() - t.askedAt),
        answered,
      })
    } catch (e) {
      console.warn('[abyssal-bloom] host.report threw', e)
    }
    this.hud.markChip(index, correct)
    if (correct) {
      const mult = tideMultiplier(t.attempt)
      const gained = t.haul * mult
      this.s.essence += gained
      this.audio.tide()
      this.host.haptic('success')
      t.open = false
      const l = this.renderer.layout
      if (!this.s.reduceMotion) {
        this.particles.burst(l.w / 2, l.h * 0.42, Math.round(70 * BUDGET[this.s.tier].burstScale), TIDE, 420, this.rnd)
        this.waves.add(l.w / 2, l.h * 0.42, 10, l.w, 0.8, 14, TIDE)
        this.punch.add(0.7)
        this.punch.freeze(80)
      }
      this.floaters.add(l.w / 2, l.h * 0.42, `+${fmtCompact(gained)}`, 48, TIDE, 1.6)
      setTimeout(() => this.hud.hideGate(), 340)
      this.recomputeDerived()
    } else {
      this.audio.choke()
      this.host.haptic('failure')
      t.attempt++
      this.hud.setGateMult(
        tideMultiplier(t.attempt) > 1 ? `CLAIM ×${tideMultiplier(t.attempt)}` : 'CLAIM',
      )
      setTimeout(() => {
        if (this.running && this.s.tide.open) this.nextGateQuestion()
      }, 520)
    }
  }

  /* --------------------------------------------------------------- actions */

  private action(id: string): void {
    const s = this.s
    this.audio.resume()
    this.audio.tick()
    if (id === 'upwell') {
      const cost = upwellCost(s.upwells)
      if (s.essence < cost) return
      s.essence -= cost
      s.upwells++
      const v = this.rng.pick(s.vents)
      let n = 0
      for (let i = 0; i < 6; i++) if (spawn(s.board, v.emitValue, this.rng)) n++
      this.host.haptic('medium')
      if (!s.reduceMotion) this.punch.add(0.24)
      this.hud.toast(n > 0 ? `UPWELL — ${n} polyps` : 'no room on the shelf', n === 0)
    } else if (id === 'awaken') {
      const cost = ventCost(s.vents.length + 1)
      if (s.essence < cost || s.vents.length >= this.ventCap) return
      s.essence -= cost
      this.addVent()
      this.host.haptic('heavy')
      if (!s.reduceMotion) this.punch.add(0.5)
      this.hud.toast('A NEW VENT WAKES')
      this.audio.erupt(2)
    } else if (id === 'deepen') {
      const cost = growCost(s.grows + 1)
      const { maxCols, maxRows } = this.shelfLimit
      if (s.essence < cost) return
      const nextCols = s.board.cols < maxCols ? s.board.cols + 1 : s.board.cols
      const nextRows = nextCols === s.board.cols ? Math.min(maxRows, s.board.rows + 1) : s.board.rows
      // `maxRows` is now what this glass can DRAW, so it can sit below the
      // shelf a child already has — a save carried over from a tablet, or a
      // rotation. `grow` refuses to shrink, so without this the cost would be
      // taken, `grows` would rise and nothing would happen.
      if (nextCols <= s.board.cols && nextRows <= s.board.rows) return
      s.essence -= cost
      s.grows++
      grow(s.board, nextCols, nextRows)
      this.renderer.relayout(s.board)
      this.layoutVents()
      this.host.haptic('heavy')
      if (!s.reduceMotion) this.punch.add(0.45)
      this.hud.toast(`SHELF ${s.board.cols}×${s.board.rows}`)
    } else if (id === 'overcharge') {
      const cost = 10 ** (3 + s.overcharges) * 2
      if (s.essence < cost) return
      s.essence -= cost
      s.overcharges++
      for (const v of s.vents) {
        v.tier++
        v.flash = 1
      }
      this.audio.magnitude(4)
      this.host.haptic('heavy')
      if (!s.reduceMotion) {
        this.punch.add(0.8)
        this.punch.freeze(70)
      }
      this.hud.toast('EVERY VENT DEEPENS')
      this.recomputeDerived()
    } else if (id === 'purge') {
      const { gained, cells } = purgeLowest(s.board)
      if (cells.length === 0) return
      s.essence += gained
      const l = this.renderer.layout
      for (const c of cells) {
        const p = cellCentre(l, s.board, c)
        if (!s.reduceMotion) this.particles.burst(p.x, p.y, 8, TIDE, 130, this.rnd)
      }
      this.audio.cull()
      this.host.haptic('medium')
      this.hud.toast(`DISSOLVED ${cells.length} — +${fmtCompact(gained)}`)
      this.refreshCrowd()
    }
    this.recomputeDerived()
  }

  /* ---------------------------------------------------------------- update */

  private recomputeDerived(): void {
    const s = this.s
    let rate = 0
    const now = performance.now()
    for (const v of s.vents) if (now >= v.coldUntil) rate += ventRate(v.tier)
    rate += reefTrickle(reefMass(s.board))
    s.ratePerSec = rate
    s.baseStep = baseStepFor(s.magnitude)
    s.bloom = bloomLevel(s.magnitude)
  }

  private refreshCrowd(): void {
    const c = isCrowded(this.s.board)
    if (c && !this.s.crowded) {
      this.audio.crowd()
      this.host.haptic('heavy')
      this.hud.toast('SHELF CROWDED', true)
    }
    this.s.crowded = c
  }

  private frame = (now: number): void => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.frame)
    if (this.paused) {
      // Nothing steps and nothing is drawn. `last` still tracks so that a
      // resume — or a rotation that relayouts underneath the sheet — cannot
      // land one enormous frame.
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
    s.elapsed += dt

    if (!this.snowSeeded) {
      const l = this.renderer.layout
      this.particles.clear()
      this.particles.seedSnow(BUDGET[s.tier].snow, l.w, l.h, this.rnd)
      this.snowSeeded = true
    }

    // essence accrual — the idle half, ticking whether or not you touch anything
    s.essence += s.ratePerSec * dt
    const m = magnitude(s.essence)
    if (m > s.magnitude) this.crossMagnitude(m)
    s.shown = s.shown + (s.essence - s.shown) * (1 - Math.exp(-7 * dt))

    for (const p of polyps(s.board)) {
      p.age += dt
      p.born = Math.min(1, p.born + dt * 4.4)
      p.squash = approach(p.squash, 0, 9, dt)
    }

    this.runCascades(now)

    // vents
    const full = emptyCells(s.board).length === 0
    for (const v of s.vents) {
      v.flash = approach(v.flash, 0, 6, dt)
      v.shake = approach(v.shake, 0, 7, dt)
      const cold = now < v.coldUntil
      const period = ventPeriodMs(v.tier)
      if (!cold && !full) {
        v.emitMs -= dt * 1000
        if (v.emitMs <= 0) {
          v.emitMs = period
          const p = spawn(s.board, v.emitValue, this.rng)
          if (p) {
            this.audio.emit()
            const l = this.renderer.layout
            const c = cellCentre(l, s.board, p.cell)
            if (!s.reduceMotion) {
              this.particles.burst(c.x, c.y, 5, rampAt(rank(p.value)), 90, this.rnd)
            }
          }
        }
      }
      v.glow = cold ? 0 : Math.max(0, Math.min(1, 1 - v.emitMs / period))
    }

    // swell — the in-session tide
    if (!s.swell && !s.tide.open) {
      s.swellMs -= dt * 1000
      if (s.swellMs <= 0) {
        s.swellMs = SWELL_PERIOD_MS
        const l = this.renderer.layout
        s.swell = {
          x: l.board.x + 44 + this.rng.f() * Math.max(1, l.board.w - 88),
          y: l.board.y + l.board.h * 0.8,
          vy: -10,
          haul: Math.max(20, Math.round((s.ratePerSec * SWELL_PERIOD_MS) / 1000)),
          life: 1e9,
        }
        this.audio.tick()
        this.hud.toast('A SWELL IS RISING')
      }
    }
    if (s.swell) {
      s.swell.y += s.swell.vy * dt
      const top = this.renderer.layout.board.y + 46
      if (s.swell.y < top) {
        s.swell.y = top
        s.swell.vy = 0
      }
    }

    if (s.pingMs > 0) {
      s.pingMs -= dt * 1000
      if (s.pingMs <= 0) s.pinged = -1
    }

    if (this.pressCell >= 0 && s.drag.active && !s.drag.moved) {
      this.pressTimer += dt * 1000
      if (this.pressTimer > 620) {
        const gained = cull(s.board, this.pressCell)
        if (gained > 0) {
          s.essence += gained
          const l = this.renderer.layout
          const c = cellCentre(l, s.board, this.pressCell)
          this.floaters.add(c.x, c.y, `+${fmtCompact(gained)}`, 20, TIDE)
          if (!s.reduceMotion) this.particles.burst(c.x, c.y, 12, TIDE, 160, this.rnd)
          this.audio.cull()
          this.host.haptic('medium')
        }
        this.pressCell = -1
        s.drag = emptyDrag()
        this.refreshCrowd()
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
      this.recomputeDerived()
    }
  }

  private crossMagnitude(m: number): void {
    const s = this.s
    const jumped = m - s.magnitude
    s.magnitude = m
    this.recomputeDerived()
    const l = this.renderer.layout
    const hue = rampAt(Math.min(40, m * 4))
    this.audio.magnitude(m)
    this.host.haptic('heavy')
    if (!s.reduceMotion) {
      const b = BUDGET[s.tier]
      this.particles.burst(l.w / 2, l.h * 0.4, Math.round(90 * b.burstScale), hue, 520, this.rnd)
      this.waves.add(l.w / 2, l.h * 0.4, 8, Math.max(l.w, l.h) * 1.2, 0.95, 18, lift(hue, 0.4))
      this.waves.add(l.w / 2, l.h * 0.4, 8, Math.max(l.w, l.h) * 0.7, 0.7, 10, CHALK)
      this.punch.add(0.95)
      this.punch.freeze(108)
      this.punch.slow(0.28, 260)
    }
    this.floaters.add(l.w / 2, l.h * 0.4, `10^${m}`, 58, lift(hue, 0.5), 1.9)
    this.hud.toast(jumped > 1 ? `${jumped} ORDERS OF MAGNITUDE` : 'AN ORDER OF MAGNITUDE')
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

    const hue = rampAt(Math.min(40, s.magnitude * 4))
    this.hud.setEssence(Math.floor(s.shown), `rgba(${hue[0]},${hue[1]},${hue[2]},.55)`)
    this.hud.setRate(s.ratePerSec)
    this.hud.setFlow(s.flow)
    this.hud.setMagnitude(s.magnitude, hex(hue))
    this.hud.setActions(this.actions())

    if (this.debug) {
      const n = this.fpsSamples.length
      this.fps = n === 0 ? 60 : this.fpsSamples.reduce((a, b) => a + b, 0) / n
      this.hud.setBadge(
        `${this.fps.toFixed(0)}fps · ${s.tier} · p${this.particles.live} · ${this.lastLatency.toFixed(1)}ms · ${distinctValues(s.board).length}v`,
      )
    } else {
      this.hud.setBadge(`${fmt(s.merges)} merges · ${fmt(s.assays)} vents fed`)
    }
    void ease
  }

  private actions(): Action[] {
    const s = this.s
    return actionList({
      essence: s.essence,
      upwells: s.upwells,
      grows: s.grows,
      overcharges: s.overcharges,
      vents: s.vents.length,
      ventCap: this.ventCap,
      cols: s.board.cols,
      rows: s.board.rows,
      maxCols: this.shelfLimit.maxCols,
      maxRows: this.shelfLimit.maxRows,
      full: emptyCells(s.board).length === 0,
      crowded: s.crowded,
    })
  }
}
