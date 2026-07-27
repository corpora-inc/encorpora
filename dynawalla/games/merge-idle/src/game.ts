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
import { cellAtPoint, cellCentre, Renderer } from './render/renderer.ts'
import { Hud, type Action } from './ui/hud.ts'

const MAX_ROWS = 9
const START_COLS = 5
const START_ROWS = 6

type Cascade = { cell: number; value: number; at: number; chain: number }

export function mountGame(el: HTMLElement, host: Host): { unmount(): void } {
  return new Game(el, host).handle()
}

class Game {
  private s: State
  private rng: Rng
  private rnd: () => number
  private renderer: Renderer
  private hud: Hud
  private audio = new Audio()
  private punch = new Punch()
  private particles: Particles
  private waves = new Shockwaves(28)
  private floaters = new Floaters(56)
  private cascades: Cascade[] = []
  private raf = 0
  private last = 0
  private running = true
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
    cancelAnimationFrame(this.raf)
    for (const off of this.detach) off()
    this.detach = []
    this.ro?.disconnect()
    this.save()
    this.audio.close()
    this.renderer.destroy()
    this.hud.destroy()
  }

  private observeSize(): void {
    if (typeof ResizeObserver === 'undefined') {
      const onResize = (): void => this.layout()
      window.addEventListener('resize', onResize)
      this.detach.push(() => window.removeEventListener('resize', onResize))
      return
    }
    this.ro = new ResizeObserver(() => this.layout())
    this.ro.observe(this.hud.stage)
  }

  private layout(): void {
    const w = this.hud.stage.clientWidth || this.el.clientWidth || 360
    const h = this.hud.stage.clientHeight || 480
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    this.renderer.resize(w, h, dpr, this.s.board, this.s.tier)
    this.layoutVents()
    this.snowSeeded = false
  }

  private layoutVents(): void {
    const l = this.renderer.layout
    const strip = l.ventStrip
    const n = Math.max(1, this.s.vents.length)
    if (l.ventColumn) {
      const gap = Math.max(8, Math.min(16, strip.h * 0.02))
      const h = Math.min((strip.h - gap * (n - 1)) / n, 190)
      const top = strip.y + (strip.h - (h * n + gap * (n - 1))) / 2
      this.s.vents.forEach((v, i) => {
        v.rect = { x: strip.x, y: top + i * (h + gap), w: strip.w, h }
      })
      return
    }
    const gap = Math.max(6, Math.min(12, strip.w * 0.02))
    const w = (strip.w - gap * (n - 1)) / n
    this.s.vents.forEach((v, i) => {
      v.rect = { x: strip.x + i * (w + gap), y: strip.y, w, h: strip.h }
    })
  }

  private get ventCap(): number {
    const l = this.renderer.layout
    if (l.ventColumn) return Math.max(2, Math.min(5, Math.floor(l.ventStrip.h / 150)))
    return l.w < 480 ? 2 : l.w < 760 ? 3 : l.w < 1100 ? 4 : 5
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
      const maxCols = this.renderer.layout.w < 380 ? 6 : 7
      if (s.essence < cost) return
      const nextCols = s.board.cols < maxCols ? s.board.cols + 1 : s.board.cols
      const nextRows = nextCols === s.board.cols ? Math.min(MAX_ROWS, s.board.rows + 1) : s.board.rows
      if (nextCols === s.board.cols && nextRows === s.board.rows) return
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
    const up = upwellCost(s.upwells)
    const aw = ventCost(s.vents.length + 1)
    const dp = growCost(s.grows + 1)
    const oc = 10 ** (3 + s.overcharges) * 2
    const maxCols = this.renderer.layout.w < 380 ? 6 : 7
    const canGrow = s.board.cols < maxCols || s.board.rows < MAX_ROWS
    const full = emptyCells(s.board).length === 0
    return [
      {
        id: 'upwell',
        label: 'UPWELL',
        cost: up,
        hint: fmtCompact(up),
        enabled: s.essence >= up && !full,
        visible: true,
      },
      {
        id: 'awaken',
        label: 'AWAKEN',
        cost: aw,
        hint: s.vents.length >= this.ventCap ? 'max' : fmtCompact(aw),
        enabled: s.essence >= aw && s.vents.length < this.ventCap,
        visible: true,
      },
      {
        id: 'deepen',
        label: 'DEEPEN',
        cost: dp,
        hint: canGrow ? fmtCompact(dp) : 'max',
        enabled: s.essence >= dp && canGrow,
        visible: true,
      },
      {
        id: 'overcharge',
        label: 'OVERCHARGE',
        cost: oc,
        hint: fmtCompact(oc),
        enabled: s.essence >= oc,
        visible: true,
      },
      {
        id: 'purge',
        label: 'DISSOLVE',
        cost: 0,
        hint: 'free',
        enabled: true,
        visible: full || s.crowded,
        urgent: s.crowded,
      },
    ]
  }
}
