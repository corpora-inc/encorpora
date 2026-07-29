/**
 * TREBUCHET — the range dial is the answer.
 *
 * A keep stands at 56 metres. Your boulder is stamped `7 × 8`. Dial 56, let go,
 * watch it come apart. Dial 54 and the shot lands two metres short: the crater says
 * 54, the keep leans, and you can *see* how wrong you were. That is the whole idea —
 * arithmetic error expressed as distance, which no answer box can do.
 */

import type { Host } from './contract.ts'
import { Audio } from './audio/audio.ts'
import { Camera } from './core/camera.ts'
import { approach, clamp, clamp01, easeInQuad, easeOutBack, lerp } from './core/ease.ts'
import { makeRng, type Rng } from './core/rng.ts'
import { Flash } from './fx/flash.ts'
import {
  DEBRIS,
  DUST,
  EMBER,
  makeGlowSprite,
  makePuffSprite,
  Particles,
  SHARD,
  SPARK,
  type Palette,
} from './fx/particles.ts'
import { Rings } from './fx/rings.ts'
import { Trail } from './fx/trail.ts'
import { Backdrop } from './render/backdrop.ts'
import { safeRect } from '../../../packs/shared/game-chrome/index.ts'
import {
  dialNumeralBox,
  drawHud,
  hitBtn,
  hudLayout,
  rackLayout,
  type Btn,
  type HudLayout,
  type HudState,
} from './render/hud.ts'
import {
  ARMED_DEG,
  RELEASE_DEG,
  armTip,
  drawBoulder,
  drawCraterLabels,
  drawGhosts,
  drawGround,
  drawMilestones,
  drawRam,
  drawTower,
  drawTrebuchet,
  drawWall,
} from './render/pieces.ts'
import { C, font, type Frame } from './render/theme.ts'
import {
  G,
  LAUNCH_H,
  posAt,
  resolve,
  samplePath,
  shotScore,
  type Outcome,
  type Solved,
} from './sim/ballistics.ts'
import { aimShot, rollWind, verdictFor } from './sim/verdict.ts'
import {
  buildTower,
  DEFAULT_LOFT,
  FIELD_MAX,
  LAUNCH_X,
  LOFTS,
  layoutTowerValues,
  pullQuestions,
  ramAdvances,
  shatter,
  stepBlocks,
  wallFor,
  waveConfig,
  worldX,
  type Boulder,
  type Crater,
  type Ghost,
  type Phase,
  type Ram,
  type Tower,
  type WaveConfig,
} from './sim/world.ts'

const MIN_GAP = 8
const DIAL_MIN = 8
const DIAL_MAX = FIELD_MAX

/**
 * The window of answers this game can physically ask about.
 *
 * A keep stands at its own answer in METRES, on a field 122 metres long, and the
 * blast is wide enough that two keeps must be `MIN_GAP` apart to be distinct
 * targets. So the answer to every question TREBUCHET poses has to be an integer
 * in this window — that is not a tuning choice, it is what "the range dial is the
 * answer" costs.
 *
 * Nothing about the question stream guarantees it. The host hands out rungs off a
 * single cross-domain ladder addressed by a 0..1 difficulty, and a pack cannot
 * see what arithmetic sits on a rung before it asks. Measured against the shipped
 * 66-rung ladder, the difficulties this game used to ask for returned:
 *
 *     wave 1  d=0.040  dw.add.facts.subtract-within-ten   answers 0-4     0/12 placeable
 *     wave 2  d=0.112  dw.add.facts.subtract-within-ten   answers 1-9     0/12
 *     wave 3  d=0.184  dw.add.facts.subtract-across-ten   answers 2-9     0/12
 *     wave 5  d=0.328  dw.mul.facts.tables-to-twelve      answers 8-81    9/12
 *     wave 6  d=0.400  dw.add.column.subtract-no-regroup  answers to 5400 0/12
 *     wave 7  d=0.472  dw.mul.scale.times-power-of-ten    answers in the millions
 *
 * Waves 1-3 and 6 upward could not put a single keep on the field, so the rack
 * came back empty, the equation plaque had nothing to draw and the fire button
 * had no boulder to throw. That is the whole of the bug this window exists to
 * make impossible: the game now FINDS a rung it can place instead of assuming it
 * was handed one.
 */
const PLACEABLE_LO = DIAL_MIN + 6
const PLACEABLE_HI = DIAL_MAX - 4

const PAL: Palette = {
  dust: C.dust,
  debris: [C.stone, C.stoneLit, '#0d1222'],
  spark: [C.fire0, C.fire1, C.fire2],
}

export type DebugStats = {
  fps: number
  frameMsP95: number
  particles: number
  phase: string
  wave: number
  dial: number
  answer: number
  score: number
}

export class TrebuchetGame {
  private el: HTMLElement
  private host: Host
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private cam = new Camera()
  private parts = new Particles(1500)
  private trail = new Trail(46)
  private rings = new Rings(18)
  private flash = new Flash()
  private audio = new Audio()
  private backdrop: Backdrop
  private glow: HTMLCanvasElement
  private puff: HTMLCanvasElement
  private rng: Rng
  private cosmetic: Rng

  private raf = 0
  private last = 0
  private time = 0
  private wallTime = 0
  private running = true
  private dpr = 1
  private w = 0
  private h = 0
  private unit = 60
  private reduced = false

  // frame timing
  private frameTimes: number[] = []
  private fps = 60
  private fpsAccum = 0
  private fpsFrames = 0

  // wave state
  private wave = 1
  private cfg: WaveConfig = waveConfig(1)
  private towers: Tower[] = []
  private rack: Boulder[] = []
  private activeIdx = 0
  private wind = 0
  private ram: Ram | null = null
  private wall: { x: number; h: number } | null = null
  private scrub = new Float32Array(0)
  private craters: Crater[] = []
  private ghosts: Ghost[] = []

  // aim
  private dial = 30
  private loftIdx = DEFAULT_LOFT
  private dialPop = 1
  private aimEmphasis = 0

  /** The distractor pools that came with the rack, kept for the tower layout. */
  private pools: number[][] = []
  /**
   * The difficulty last known to return answers this field can hold, and the
   * bisection state used to find it. `stockD` survives the wave so the search
   * runs once a run; the bounds are re-opened per wave.
   */
  private stockD: number | null = null
  private probeD = 0
  private probeLo = 0
  private probeHi = 1
  /** The last difficulty actually stated to the host, so it is not re-stated. */
  private askedD: number | null = null
  /** Seconds waited in 'stocking' since the last probe. */
  private stockT = 0
  /** Seconds this wave has spent unable to stock, and whether that was said. */
  private stockStall = 0
  private toldAboutStocking = false

  // shot
  private phase: Phase = 'stocking'
  private phaseT = 0
  private shot: Solved | null = null
  private shotT = 0
  /**
   * Decided the moment the boulder leaves the sling, from integers alone. A keep
   * standing between you and your target is scenery the shot flies over — only the
   * metre it comes down on can be right or wrong. Anything else would punish
   * correct arithmetic, which is the one thing this game may never do.
   */
  private pending: Outcome<Tower> | null = null
  /**
   * What the child committed to, frozen at the instant the sling let go.
   *
   * Two to three seconds pass between the release and the impact, and the dial,
   * the loaded boulder and the answer clock are all live during them: the +/−
   * buttons, the wheel and the arrow keys are not phase-gated, and tapping a rack
   * stone changes which question is loaded. Reading any of that AT impact would
   * mark a child on a number she is no longer looking at — a bullseye scored
   * wrong because she nudged the dial while the boulder was in the air. The shot
   * carries its own answer, and impact reads nothing else.
   */
  private fired: { dial: number; boulder: Boulder; ms: number } | null = null
  private proj = { x: 0, y: 0 }
  private armDeg = ARMED_DEG
  private recoil = 0
  private freeze = 0
  private timeScale = 1
  private wantTimeScale = 1
  private questionShownAt = 0

  // score
  private score = 0
  private combo = 0
  private scorePop = 0
  private hitsThisWave = 0
  private platformDamage = 0
  private revealT = 0

  // hud
  private btns: Btn[] = []
  /**
   * True while something is over the game — today, the how-to-play panel.
   *
   * A sheet the host or the chrome raises is not a pause: the rAF loop is still
   * running and `window` still has this game's key handlers on it, so a child
   * reading the rules with a keyboard fires the loaded boulder with the space
   * bar. Worse, the answer clock keeps running behind the sheet and the time
   * spent READING gets reported as time spent THINKING, which is what feeds the
   * difficulty. Both stop here.
   */
  private blocked: () => boolean = () => false
  /** The HUD's geometry, re-derived from the SAFE rect on every resize. */
  private hud: HudLayout = hudLayout(320, 240, { x: 0, y: 0, w: 320, h: 240 }, false)
  private clearT = -1
  private introT = 0
  private muted = false

  // input
  private dragging = false
  private dragAnchorPx = 0
  private dragAnchorDial = 0
  private pointerDownOnField = false
  private tickAccum = 0
  private held: { id: string; t: number; accum: number } | null = null

  // counter-fire is scheduled on the game clock, never on a wall-clock timer:
  // a background tab must not be able to strand an explosion in the future
  private counterIn = -1
  private manual = false
  private lastFrameMs = 0

  private onKeyDown: (e: KeyboardEvent) => void
  private onKeyUp: (e: KeyboardEvent) => void
  private onResize: () => void
  private ro: ResizeObserver | null = null

  constructor(el: HTMLElement, host: Host, seed = 0xb01de) {
    this.el = el
    this.host = host
    this.rng = makeRng(seed)
    this.cosmetic = makeRng(seed ^ 0x51e6e)
    this.reduced = host.prefersReducedMotion()

    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:crosshair'
    el.appendChild(canvas)
    this.canvas = canvas
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('2d context unavailable')
    this.ctx = ctx
    this.glow = makeGlowSprite(96, '#fff8e2', '#ff7a24')
    this.puff = makePuffSprite(96)
    this.backdrop = new Backdrop(seed ^ 0xbeef)

    this.cam.motion = this.reduced ? 0.18 : 1
    this.flash.motion = this.reduced ? 0.25 : 1

    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
    this.onKeyDown = (e) => this.key(e, true)
    this.onKeyUp = (e) => this.key(e, false)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    this.onResize = () => this.resize()
    window.addEventListener('resize', this.onResize)
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.resize())
      this.ro.observe(el)
    }

    this.resize()
    this.startWave(1)
    this.cam.snap()
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  /* ------------------------------------------------------------ lifecycle */

  /**
   * Tell the game when something is covering it, and start the answer clock
   * again when it goes away.
   */
  setInputGuard(blocked: () => boolean): void {
    this.blocked = blocked
  }

  /** The sheet is gone: the child is looking at the question again, now. */
  restartAnswerClock(): void {
    this.questionShownAt = performance.now()
  }

  unmount(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('wheel', this.onWheel)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('resize', this.onResize)
    this.ro?.disconnect()
    this.audio.dispose()
    this.canvas.remove()
  }

  private resize(): void {
    const r = this.el.getBoundingClientRect()
    const w = Math.max(320, Math.round(r.width))
    const h = Math.max(240, Math.round(r.height))
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.w = w
    this.h = h
    this.canvas.width = Math.round(w * this.dpr)
    this.canvas.height = Math.round(h * this.dpr)
    // The notch, the home indicator and the rounded corners are re-measured
    // here, not once at mount: a rotation swaps top/bottom for left/right, and
    // Split View changes them without the game ever unmounting.
    this.hud = hudLayout(w, h, safeRect(w, h), this.cfg.loft)
    this.unit = this.hud.unit
    this.backdrop.resize(w, h, this.dpr)
    this.btns = this.hud.buttons
  }

  /* ---------------------------------------------------------------- waves */

  private startWave(n: number): void {
    this.wave = n
    const cfg = waveConfig(n)
    this.cfg = cfg
    const anyHost = this.host as Host & {
      setDifficulty?: (d: number) => void
      setDistractorCount?: (k: number) => void
    }
    anyHost.setDistractorCount?.(Math.max(2, cfg.extraTowers + 1))

    // The wave is not laid out until there is something to shoot at. `stock()`
    // asks for a rung and reports whether what came back will fit on the field;
    // when it will not, the wave waits in 'stocking' and tries again on a later
    // frame, because the pool behind `host.next()` refills asynchronously and a
    // synchronous retry can only ever re-read the same drained pool.
    this.rack = []
    this.activeIdx = 0
    this.towers = []
    this.phase = 'stocking'
    this.phaseT = 0
    this.stockT = 0
    this.stockStall = 0
    this.probeD = this.stockD ?? cfg.difficulty
    // A fresh bisection per wave, but seeded from the band already found, so the
    // search happens once a run and not once a wave.
    this.probeLo = 0
    this.probeHi = 1
    if (!this.stock()) return
    this.layOutWave()
  }

  /**
   * Ask for a rung, and say whether the answers can stand on the field.
   *
   * Everything about the request is a request: `setDifficulty` is a 0..1 position
   * on a ladder whose arithmetic the pack cannot see, so the only way to find out
   * whether a rung's answers fit in `PLACEABLE_LO..PLACEABLE_HI` is to ask and
   * look. When they do not, the answers that came back say which way to move —
   * all too small means ask harder, all too large means ask easier — and answer
   * magnitude rises with the ladder, so a bisection converges on the band in a
   * handful of probes instead of sweeping 66 rungs blind.
   *
   * The difficulty that worked is remembered in `stockD` for every later wave.
   * The arithmetic therefore stops climbing at the width of the field, which is
   * honest: a 122-metre field cannot pose a question whose answer is 5400. The
   * wave's own escalation — wind, the wall, the ram, more keeps, less ammunition,
   * the loft lever — is untouched and is where TREBUCHET gets harder.
   */
  private stock(): boolean {
    const cfg = this.cfg
    const anyHost = this.host as Host & { setDifficulty?: (d: number) => void }
    // Only when it has actually moved. Re-stating a difficulty makes the host
    // flush and refill its pool, so asking again for what was already asked keeps
    // the pool permanently empty — the search would outrun the questions.
    if (this.askedD !== this.probeD) {
      this.askedD = this.probeD
      anyHost.setDifficulty?.(this.probeD)
    }

    // A small draw, not a drained pool: this may be one probe of several, and
    // every question pulled is a curriculum item spent.
    const { boulders, pools, seen } = pullQuestions(
      () => this.host.next(),
      cfg.ammo,
      MIN_GAP,
      PLACEABLE_LO,
      PLACEABLE_HI,
      32,
    )
    if (boulders.length > 0) {
      this.rack = boulders
      this.pools = pools
      this.stockD = this.probeD
      return true
    }

    // Nothing placeable. Steer — but only on questions that came from the rung
    // that was asked for. Anything else is the pool's previous contents, and
    // reading it would move the search on evidence about a rung already left.
    const fresh = seen.filter((s) => Math.abs(s.difficulty - this.probeD) <= 0.08)
    if (fresh.length === 0) return false

    const tooSmall = fresh.filter((s) => s.answer < PLACEABLE_LO).length
    const tooBig = fresh.filter((s) => s.answer > PLACEABLE_HI).length
    if (tooSmall === 0 && tooBig === 0) return false
    if (tooSmall >= tooBig) {
      this.probeLo = Math.max(this.probeLo, this.probeD)
      this.probeD = Math.min(1, (this.probeD + this.probeHi) / 2)
    } else {
      this.probeHi = Math.min(this.probeHi, this.probeD)
      this.probeD = Math.max(0, (this.probeLo + this.probeD) / 2)
    }
    return false
  }

  /** Build the field around the rack `stock()` filled. */
  private layOutWave(): void {
    const cfg = this.cfg
    const boulders = this.rack
    const pools = this.pools
    const n = this.wave

    const values = layoutTowerValues(
      boulders.map((b) => b.answer),
      pools,
      cfg.extraTowers,
      MIN_GAP,
      PLACEABLE_LO,
      PLACEABLE_HI,
      this.rng,
    )
    this.towers = values.map((v, i) => buildTower(i, v, this.rng, cfg.volley && i % 2 === 0))
    this.markWanted()

    this.wind = rollWind(cfg.wind, this.rng)
    this.wall = null
    if (cfg.wall) {
      const w = wallFor(Math.min(...values), cfg.wind)
      this.wall = { x: worldX(w.x), h: w.h }
    }
    this.ram = cfg.ram
      ? // Faster than it was, because it now only rolls while the world is moving:
        // about 4 s of every shot instead of however long the sum took. Four to six
        // boulders and it is at the walls — the same threat, off the thinking clock.
        { range: FIELD_MAX - 4, speed: 4.2 + cfg.difficulty * 3, alive: true, wheel: 0, hp: 1, bob: 0 }
      : null

    this.craters = []
    this.ghosts = []
    this.parts.clear()
    this.rings.clear()
    this.hitsThisWave = 0
    this.dial = clamp(Math.round(values[0] * 0.8), DIAL_MIN, DIAL_MAX)
    this.loftIdx = DEFAULT_LOFT
    this.phase = 'intro'
    this.phaseT = 0
    this.introT = 0
    this.clearT = -1
    this.armDeg = ARMED_DEG
    this.questionShownAt = performance.now()

    const sc: number[] = []
    for (let i = 0; i < 170; i++) {
      sc.push(this.cosmetic.range(-20, worldX(FIELD_MAX) + 20), this.cosmetic.range(0.3, 1.1))
    }
    this.scrub = new Float32Array(sc)
    // The loft lever appears mid-run, and it changes where mute sits.
    this.hud = hudLayout(this.w, this.h, this.hud.area, cfg.loft)
    this.btns = this.hud.buttons
    this.audio.horn(true)
    if (!this.reduced && n % 3 === 0 && this.flash.add(0.16, 0.22, 0.5, 0.2, 1.2)) {
      this.backdrop.strike(this.cosmetic)
    }
  }

  private markWanted(): void {
    const wanted = new Set(this.rack.filter((b) => !b.spent).map((b) => b.answer))
    for (const t of this.towers) t.wanted = wanted.has(t.value)
  }

  private get activeBoulder(): Boulder | null {
    return this.rack[this.activeIdx] ?? null
  }

  /* ---------------------------------------------------------------- input */

  private pointerPos(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (this.blocked()) return
    this.audio.resume()
    const p = this.pointerPos(e)
    const b = hitBtn(this.btns, p.x, p.y)
    if (b) {
      this.canvas.setPointerCapture?.(e.pointerId)
      this.held = { id: b.id, t: 0, accum: 0 }
      this.pressBtn(b, p)
      return
    }
    // tapping a rack stone loads that boulder
    const ri = this.rackHit(p.x, p.y)
    if (ri >= 0 && !this.rack[ri].spent) {
      this.activeIdx = ri
      this.audio.detent()
      this.host.haptic('light')
      this.questionShownAt = performance.now()
      return
    }
    if (this.phase !== 'aim' && this.phase !== 'intro') return
    this.canvas.setPointerCapture?.(e.pointerId)
    this.dragging = true
    this.pointerDownOnField = true
    // coarse: the dial jumps to the metre under the finger
    const wx = this.screenToWorldX(p.x, p.y)
    this.setDial(Math.round(wx - LAUNCH_X))
    this.dragAnchorPx = p.x
    this.dragAnchorDial = this.dial
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging || !this.pointerDownOnField) return
    const p = this.pointerPos(e)
    // fine: 0.42 gain, so a fingertip sweep is worth a couple of dozen metres
    const dm = ((p.x - this.dragAnchorPx) / (this.cam.ppm * this.cam.zoom)) * 0.42
    this.setDial(Math.round(this.dragAnchorDial + dm))
  }

  private onPointerUp = (): void => {
    this.dragging = false
    this.pointerDownOnField = false
    this.held = null
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    if (this.blocked()) return
    this.setDial(this.dial + (e.deltaY > 0 ? -1 : 1))
  }

  private key(e: KeyboardEvent, down: boolean): void {
    if (!down || this.blocked()) return
    const big = e.shiftKey ? 10 : 1
    switch (e.key) {
      case 'ArrowLeft':
        this.setDial(this.dial - big)
        e.preventDefault()
        break
      case 'ArrowRight':
        this.setDial(this.dial + big)
        e.preventDefault()
        break
      case 'ArrowUp':
        this.setLoft(this.loftIdx + 1)
        e.preventDefault()
        break
      case 'ArrowDown':
        this.setLoft(this.loftIdx - 1)
        e.preventDefault()
        break
      case ' ':
      case 'Enter':
        this.audio.resume()
        this.fire()
        e.preventDefault()
        break
      case 'm':
      case 'M':
        this.toggleMute()
        break
      default:
        if (/^[1-5]$/.test(e.key)) {
          const i = Number(e.key) - 1
          if (this.rack[i] && !this.rack[i].spent) {
            this.activeIdx = i
            this.audio.detent()
          }
        }
    }
  }

  private pressBtn(b: Btn, p: { x: number; y: number }): void {
    switch (b.id) {
      case 'fire':
        this.fire()
        break
      case 'plus':
        this.setDial(this.dial + 1)
        break
      case 'minus':
        this.setDial(this.dial - 1)
        break
      case 'mute':
        this.toggleMute()
        break
      case 'loft': {
        const rel = 1 - clamp01((p.y - b.y) / b.h)
        this.setLoft(Math.round(rel * (LOFTS.length - 1)))
        break
      }
    }
  }

  private toggleMute(): void {
    this.muted = !this.muted
    this.audio.enabled = !this.muted
  }

  /** @returns the index into `this.rack`, or -1 */
  private rackHit(x: number, y: number): number {
    const st = this.hudState()
    const slots = rackLayout(st)
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]
      if (x >= s.x - 6 && x <= s.x + s.w + 6 && y >= s.y - 8 && y <= s.y + s.h + 8) {
        return this.liveIdx[i] ?? -1
      }
    }
    return -1
  }

  private liveIdx: number[] = []

  private hudState(): HudState {
    const live = this.rack.map((r, i) => ({ r, i })).filter((x) => !x.r.spent)
    this.liveIdx = live.map((x) => x.i)
    const b = this.activeBoulder
    return {
      layout: this.hud,
      equation: b ? b.q.prompt : '',
      rack: live.map((x) => x.r.q.prompt),
      rackActive: live.findIndex((x) => x.i === this.activeIdx),
      wave: this.wave,
      score: this.score,
      scorePop: this.scorePop,
      combo: this.combo,
      wind: this.wind,
      showWind: this.wind !== 0,
      loftUnlocked: this.cfg.loft,
      loftIndex: this.loftIdx,
      loftCount: LOFTS.length,
      muted: this.muted,
      introT: this.introT,
      clearT: this.clearT,
      clearHits: this.hitsThisWave,
      clearOf: this.rack.length,
      dialPop: this.dialPop,
      // A lit, pulsing fire button over an empty rack was half of the bug: the
      // control advertised itself as ready and `fire()` returned on the very next
      // line for want of a boulder. The phase fix is what actually closes that —
      // 'aim' is now unreachable without ammunition — so these two clauses are
      // belt-and-braces and NO test reaches them: removing them leaves the suite
      // green, which is stated here rather than dressed up as coverage. They stay
      // because the exact failure was a control that lied about being ready, and
      // `fire()`'s own guard should not be the only thing that knows.
      canFire: (this.phase === 'aim' || this.phase === 'intro') && b !== null && !b.spent,
    }
  }

  private screenToWorldX(px: number, py: number): number {
    const s = this.cam.ppm * this.cam.zoom
    void py
    return this.cam.x + (px - this.w / 2 - this.cam.shakeX) / s
  }

  private setDial(v: number): void {
    const nv = clamp(Math.round(v), DIAL_MIN, DIAL_MAX)
    if (nv === this.dial) return
    const delta = Math.abs(nv - this.dial)
    this.dial = nv
    this.dialPop = 0
    this.aimEmphasis = 1
    this.tickAccum += delta
    if (this.tickAccum >= 1) {
      this.tickAccum = 0
      this.audio.tick(clamp01((this.dial - DIAL_MIN) / (DIAL_MAX - DIAL_MIN)))
      if (delta >= 1) this.host.haptic('light')
    }
  }

  private setLoft(i: number): void {
    const ni = clamp(Math.round(i), 0, LOFTS.length - 1)
    if (ni === this.loftIdx || !this.cfg.loft) return
    this.loftIdx = ni
    this.audio.detent()
    this.host.haptic('light')
  }

  /* ----------------------------------------------------------------- fire */

  private fire(): void {
    if (this.phase !== 'aim' && this.phase !== 'intro') return
    const b = this.activeBoulder
    if (!b || b.spent) return
    this.phase = 'windup'
    this.phaseT = 0
    this.audio.resume()
    this.host.haptic('medium')
  }

  private release(): void {
    const b = this.activeBoulder
    if (!b) return
    // Aimed at the dial, not displaced by the wind: `aimShot` lays the machine
    // off into the crosswind so the boulder comes down on the metre she named.
    const shot = aimShot(this.dial, LOFTS[this.loftIdx], this.wind, LAUNCH_H)
    // Her answer, and how long it took her — both as they stood when she fired.
    // The flight is the game's time, not hers, so it is not in the latency.
    this.fired = {
      dial: this.dial,
      boulder: b,
      ms: Math.max(1, Math.round(performance.now() - this.questionShownAt)),
    }
    this.shot = shot
    this.pending = resolve(shot.landing, this.towers)
    this.shotT = 0
    this.proj = posAt(shot, 0)
    this.proj.x += LAUNCH_X
    this.trail.clear()
    this.phase = 'flight'
    this.phaseT = 0
    this.recoil = 1
    this.cam.addTrauma(0.22)
    this.cam.punch(0.05)
    this.audio.launch(clamp01(this.dial / DIAL_MAX))
    this.audio.flightStart()
    this.host.haptic('heavy')
    // launch smoke + sparks at the sling
    const tip = armTip(RELEASE_DEG)
    for (let i = 0; i < (this.reduced ? 8 : 26); i++) {
      const a = this.cosmetic.range(-0.6, 1.4)
      const sp = this.cosmetic.range(4, 16)
      this.parts.emit(SPARK, tip.x, tip.y, Math.cos(a) * sp, Math.sin(a) * sp, {
        maxLife: this.cosmetic.range(0.2, 0.5),
        tone: this.cosmetic.int(0, 2),
        drag: 2.2,
        grav: 8,
      })
    }
    for (let i = 0; i < (this.reduced ? 4 : 12); i++) {
      this.parts.emit(
        DUST,
        tip.x + this.cosmetic.range(-1, 1),
        tip.y + this.cosmetic.range(-1, 1),
        this.cosmetic.range(-3, 3),
        this.cosmetic.range(0, 4),
        { maxLife: this.cosmetic.range(0.5, 1.1), size: this.cosmetic.range(0.6, 1.4), drag: 1.4 },
      )
    }
  }

  /* -------------------------------------------------------------- impact */

  private impact(x: number, y: number, hit: Tower | null, kind: 'ground' | 'tower' | 'wall' | 'ram'): void {
    const fired = this.fired
    if (!fired || !this.shot) return
    // The boulder that was thrown, not whichever one is loaded now.
    const b = fired.boulder
    this.fired = null
    const landing = this.shot.landing
    const out = this.pending ?? resolve(landing, this.towers)
    // The verdict is the child's number against the number she was asked for, and
    // nothing else — not the keep the blast happened to reach, not the metre the
    // ground recorded, not where the dial has drifted to since. A boulder spent on
    // the ram is not an answer at all.
    const v = verdictFor({ dial: fired.dial, landing, answer: b.answer, kind })
    const correct = v.correct
    // The ram swallows the boulder where it stands: no keep is touched by a shot
    // that never got past the siege engine.
    const struck = kind === 'ram' ? null : kind === 'tower' ? hit : out.target
    // The garrison only answers when the shot came down ON another keep — naming
    // the wrong number. Landing a metre short of the right one is not that.
    const struckWrongKeep = !!struck && struck.value !== b.answer && out.errorM <= 1

    this.audio.flightStop()
    this.phase = 'impact'
    this.phaseT = 0

    const big = correct || kind === 'ram'
    // hitstop: the single cheapest way to make a hit feel like it weighs something
    this.freeze = this.reduced ? 0 : correct ? 0.1 : kind === 'ground' ? 0.035 : 0.06
    this.wantTimeScale = this.reduced ? 1 : correct ? 0.26 : 1
    this.cam.addTrauma(correct ? 0.86 : kind === 'ground' ? 0.34 : 0.55)
    this.cam.punch(correct ? 0.1 : 0.04)
    this.flash.add(correct ? 0.3 : 0.12, correct ? 0.34 : 0.18, x / Math.max(1, worldX(FIELD_MAX)), 0.62, 0.55)

    // shockwave: one fast bright ring, one slow ground-hugging dust wave
    const ry = Math.max(0.6, y)
    this.rings.add(x, ry, 0.5, correct ? 11 : 7, correct ? 0.4 : 0.3, C.fire0, correct ? 5 : 3.2, 1)
    this.rings.add(x, 0.5, 1.2, correct ? 19 : 12, correct ? 0.6 : 0.45, C.fire2, 3, 0.16)
    if (correct) this.rings.add(x, ry, 0.4, 17, 0.62, C.stoneRim, 2, 0.7)

    // --- particles ----------------------------------------------------
    const n = this.reduced ? 0.28 : 1
    const heavy = big ? 1.7 : 1
    for (let i = 0; i < Math.round(58 * n * heavy); i++) {
      const a = this.cosmetic.range(-0.2, Math.PI + 0.2)
      const sp = this.cosmetic.range(6, 40) * heavy
      this.parts.emit(SPARK, x, Math.max(0.3, y), Math.cos(a) * sp, Math.sin(a) * sp, {
        maxLife: this.cosmetic.range(0.18, 0.6),
        tone: this.cosmetic.int(0, 2),
        drag: 1.6,
        grav: 14,
      })
    }
    for (let i = 0; i < Math.round(16 * n * heavy); i++) {
      const a = this.cosmetic.range(-0.35, Math.PI + 0.35)
      const sp = this.cosmetic.range(9, 34) * heavy
      this.parts.emit(EMBER, x, Math.max(0.3, y), Math.cos(a) * sp, Math.sin(a) * sp, {
        maxLife: this.cosmetic.range(0.35, 1.1),
        size: this.cosmetic.range(0.3, 1.1),
        drag: 2.1,
        grav: 7,
      })
    }
    for (let i = 0; i < Math.round(30 * n * heavy); i++) {
      const a = this.cosmetic.range(-0.1, Math.PI + 0.1)
      const sp = this.cosmetic.range(1, 11)
      this.parts.emit(DUST, x, Math.max(0.4, y), Math.cos(a) * sp, Math.sin(a) * sp * 0.7, {
        maxLife: this.cosmetic.range(0.8, 2.2),
        size: this.cosmetic.range(0.7, 2.3),
        drag: 1.1,
      })
    }
    for (let i = 0; i < Math.round(14 * n * heavy); i++) {
      const a = this.cosmetic.range(-0.3, Math.PI + 0.3)
      const sp = this.cosmetic.range(5, 22)
      this.parts.emit(DEBRIS, x, Math.max(0.4, y), Math.cos(a) * sp, Math.sin(a) * sp, {
        maxLife: this.cosmetic.range(1.2, 2.6),
        w: this.cosmetic.range(0.3, 0.9),
        h: this.cosmetic.range(0.25, 0.7),
        tone: this.cosmetic.int(0, 2),
        spin: this.cosmetic.range(-9, 9),
        grav: 24,
        drag: 0.1,
        bounce: 0.32,
      })
    }

    // --- sound --------------------------------------------------------
    if (kind === 'ground') this.audio.impactDirt(clamp01(this.dial / 120))
    else this.audio.impactStone(0.8)

    // --- structural ---------------------------------------------------
    let destroyed = false
    if (struck) {
      struck.flash = 1
      if (correct) {
        const freed = shatter(struck, x, y, 2.6, this.cosmetic, true)
        void freed
        struck.alive = false
        destroyed = true
        this.audio.collapse()
        this.audio.fanfare(this.combo)
        this.host.haptic('success')
        this.cam.addTrauma(0.4)
        this.flash.add(0.24, 0.4, x / Math.max(1, worldX(FIELD_MAX)), 0.55, 0.8)
        // the number itself comes apart
        this.burstNumber(struck)
      } else {
        struck.damage = clamp01(struck.damage + (struckWrongKeep ? 0.6 : 0.34))
        struck.lean = (x < worldX(struck.range) ? 1 : -1) * 0.07
        struck.leanV = 0
        // a rival keep is cracked, never levelled: being wrong must stay quieter
        // than being right, and a keep with no masonry left reads as destroyed
        shatter(struck, x, y, struckWrongKeep ? 0.34 : 0.2, this.cosmetic, false, struckWrongKeep ? 5 : 2)
        if (struckWrongKeep) {
          this.audio.wrongHorn()
          this.host.haptic('failure')
          this.counterFire(struck)
        }
      }
    } else if (kind === 'ground' || kind === 'wall') {
      this.host.haptic('light')
    }

    // --- record -------------------------------------------------------
    this.craters.push({
      x,
      r: correct ? 3.4 : 2.4,
      depth: 1,
      age: 0,
      label: landing,
      correct,
    })
    if (this.craters.length > 14) this.craters.shift()
    if (this.shot) {
      this.ghosts.push({
        pts: samplePath(this.shot, 30).map((p) => ({ x: p.x + LAUNCH_X, y: p.y })),
        landing,
        age: 0,
        hit: correct,
      })
      if (this.ghosts.length > 4) this.ghosts.shift()
    }

    // --- score & host report -------------------------------------------
    if (v.report) {
      this.host.report({ questionId: b.q.id, correct, ms: fired.ms, answered: v.answered })
    }
    if (correct) {
      this.combo += 1
      const gained = shotScore(out.quality, this.combo, this.cfg.difficulty)
      this.score += gained
      this.scorePop = 0
      this.hitsThisWave += 1
      b.hit = true
    } else if (v.report) {
      // Only a wrong ANSWER breaks the chain. Spending a boulder on the ram is a
      // choice about the siege, and the game does not punish it as arithmetic.
      this.combo = 0
      this.revealT = 1.6
    }
    // The boulder is gone either way: it was thrown.
    b.spent = true
    void destroyed
    this.markWanted()
  }

  /** The struck keep's number blows apart into shards. */
  private burstNumber(t: Tower): void {
    const bx = worldX(t.range)
    const top = t.heightM + 2.6
    const digits = String(t.value).length
    for (let i = 0; i < (this.reduced ? 6 : 22); i++) {
      const a = this.cosmetic.range(0, Math.PI * 2)
      const sp = this.cosmetic.range(3, 18)
      this.parts.emit(
        SHARD,
        bx + this.cosmetic.range(-1, 1) * digits,
        top + this.cosmetic.range(-1, 1),
        Math.cos(a) * sp,
        Math.abs(Math.sin(a)) * sp + 4,
        {
          maxLife: this.cosmetic.range(0.9, 2),
          w: this.cosmetic.range(0.4, 1.3),
          h: this.cosmetic.range(0.3, 0.8),
          tone: 1,
          spin: this.cosmetic.range(-12, 12),
          grav: 22,
          drag: 0.2,
          bounce: 0.3,
        },
      )
    }
  }

  /** Struck the wrong keep: its garrison answers. Costly, never fatal. */
  private counterFire(from: Tower): void {
    this.audio.incoming(1.1)
    this.counterIn = 1.05
    void from
  }

  private counterLand(): void {
    {
      this.cam.addTrauma(0.62)
      this.cam.punch(0.05)
      this.platformDamage = clamp01(this.platformDamage + 0.16)
      this.audio.impactStone(0.6)
      this.host.haptic('heavy')
      this.flash.add(0.14, 0.2, 0.08, 0.6, 0.4)
      for (let i = 0; i < (this.reduced ? 8 : 34); i++) {
        const a = this.cosmetic.range(-0.4, Math.PI + 0.4)
        const sp = this.cosmetic.range(4, 26)
        this.parts.emit(SPARK, LAUNCH_X - 2, 6, Math.cos(a) * sp, Math.sin(a) * sp, {
          maxLife: this.cosmetic.range(0.2, 0.6),
          tone: this.cosmetic.int(0, 2),
          drag: 1.7,
          grav: 16,
        })
      }
      for (let i = 0; i < (this.reduced ? 4 : 16); i++) {
        this.parts.emit(DUST, LAUNCH_X - 2, 6, this.cosmetic.range(-6, 6), this.cosmetic.range(0, 7), {
          maxLife: this.cosmetic.range(0.6, 1.6),
          size: this.cosmetic.range(0.6, 1.8),
          drag: 1.2,
        })
      }
    }
  }

  /* ------------------------------------------------------------ the loop */

  private frame = (now: number): void => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.frame)
    if (this.manual) return
    this.tick(now)
  }

  private tick(now: number): void {
    const t0 = performance.now()
    let dt = (now - this.last) / 1000
    this.last = now
    if (!Number.isFinite(dt)) dt = 1 / 60
    dt = Math.min(dt, 1 / 20)
    this.wallTime += dt

    // fps window
    this.fpsAccum += dt
    this.fpsFrames++
    if (this.fpsAccum >= 0.5) {
      this.fps = this.fpsFrames / this.fpsAccum
      this.fpsAccum = 0
      this.fpsFrames = 0
    }

    // hitstop then slow-mo, easing back with cubic
    let simDt = dt
    if (this.freeze > 0) {
      this.freeze -= dt
      simDt = 0
    }
    this.timeScale = approach(this.timeScale, this.wantTimeScale, 6, dt)
    simDt *= this.timeScale
    this.time += simDt

    this.update(simDt, dt)
    this.render()

    const ms = performance.now() - t0
    this.frameTimes.push(ms)
    this.lastFrameMs = ms
    if (this.frameTimes.length > 240) this.frameTimes.shift()
  }

  private update(dt: number, rawDt: number): void {
    this.phaseT += rawDt
    this.dialPop = Math.min(1, this.dialPop + rawDt / 0.16)
    this.scorePop = Math.min(1, this.scorePop + rawDt / 0.5)
    this.aimEmphasis = approach(this.aimEmphasis, this.phase === 'aim' || this.phase === 'intro' ? 1 : 0, 4, rawDt)
    this.introT = Math.min(1, this.introT + rawDt / 0.5)
    this.recoil = approach(this.recoil, 0, 6, rawDt)
    this.revealT = Math.max(0, this.revealT - rawDt)
    this.flash.update(rawDt)
    this.backdrop.update(rawDt)
    this.parts.update(dt, 0)
    this.rings.update(dt)
    this.cam.update(rawDt)

    for (const cr of this.craters) cr.age += rawDt
    for (const g of this.ghosts) g.age += rawDt
    for (const t of this.towers) {
      t.flash = Math.max(0, t.flash - rawDt * 3)
      if (t.wanted && this.revealT > 0) t.reveal = Math.min(1, t.reveal + rawDt * 4)
      else t.reveal = Math.max(0, t.reveal - rawDt * 3)
      stepBlocks(t, dt)
    }

    // Held +/- repeat. The accumulator matters: the dial is an integer, so adding
    // a fraction of a metre per frame and rounding would move nothing at all.
    if (this.held && (this.held.id === 'plus' || this.held.id === 'minus')) {
      this.held.t += rawDt
      if (this.held.t > 0.32) {
        this.held.accum += rawDt * (this.held.t > 1.3 ? 26 : 9)
        const whole = Math.floor(this.held.accum)
        if (whole >= 1) {
          this.held.accum -= whole
          this.setDial(this.dial + (this.held.id === 'plus' ? whole : -whole))
        }
      }
    }

    switch (this.phase) {
      case 'stocking': {
        // Probe about six times a second. Each attempt asks for a different rung
        // and gives the pool behind `host.next()` a frame or two to refill, which
        // is the whole reason this is a phase and not a loop.
        this.stockT += rawDt
        if (this.stockT >= 0.16) {
          this.stockT = 0
          if (this.stock()) this.layOutWave()
        }
        // Said out loud, once. A wave that cannot be stocked shows a field with no
        // keeps and no equation, which is precisely the screen that was reported
        // as "I can't see the problem and I can't fire" — so if it ever comes back
        // it says so in the console instead of looking like a game that is merely
        // slow. Five seconds is many times the handful of probes a search needs.
        this.stockStall += rawDt
        if (this.stockStall > 5 && !this.toldAboutStocking) {
          this.toldAboutStocking = true
          console.error(
            `[trebuchet] wave ${String(this.wave)} cannot be stocked: no rung between ` +
              `${String(this.probeLo)} and ${String(this.probeHi)} returns an answer in ` +
              `${String(PLACEABLE_LO)}..${String(PLACEABLE_HI)}, which is the only window a ` +
              `${String(FIELD_MAX)}-metre field can stand a keep on. The child is looking at an ` +
              `empty field.`,
          )
        }
        break
      }
      case 'intro':
        if (this.phaseT > 0.9) {
          this.phase = 'aim'
          this.phaseT = 0
          this.questionShownAt = performance.now()
        }
        break
      case 'aim':
        this.armDeg = approach(this.armDeg, ARMED_DEG, 6, rawDt)
        break
      case 'windup': {
        const k = clamp01(this.phaseT / 0.42)
        // draw back a touch further, then whip through — anticipation, then release
        const back = ARMED_DEG + 14 * Math.sin(k * Math.PI)
        this.armDeg = lerp(back, RELEASE_DEG, easeInQuad(clamp01((k - 0.55) / 0.45)))
        if (k >= 1) this.release()
        break
      }
      case 'flight': {
        if (!this.shot) break
        const sub = 1 / 240
        let acc = dt
        while (acc > 0 && this.phase === 'flight') {
          const step = Math.min(sub, acc)
          acc -= step
          this.shotT += step
          const p = posAt(this.shot, this.shotT)
          this.proj.x = p.x + LAUNCH_X
          this.proj.y = p.y
          if (!this.reduced && this.cosmetic.chance(0.22)) {
            this.parts.emit(
              EMBER,
              this.proj.x,
              this.proj.y,
              this.cosmetic.range(-3, 3),
              this.cosmetic.range(-2, 2),
              { maxLife: this.cosmetic.range(0.25, 0.7), size: this.cosmetic.range(0.3, 0.9), drag: 1.6 },
            )
          }
          // wall
          if (this.wall && Math.abs(this.proj.x - this.wall.x) < 1.3 && this.proj.y < this.wall.h) {
            this.impact(this.proj.x, this.proj.y, null, 'wall')
            break
          }
          // ram
          if (this.ram?.alive && Math.abs(this.proj.x - worldX(this.ram.range)) < 3.4 && this.proj.y < 3.6) {
            this.ram.alive = false
            this.score += 90
            this.scorePop = 0
            this.impact(this.proj.x, Math.max(1, this.proj.y), null, 'ram')
            break
          }
          // Only the keep the shot is actually coming down on can catch it.
          const tgt = this.pending && this.pending.errorM <= 2 ? this.pending.target : null
          if (tgt && tgt.alive) {
            const bx = worldX(tgt.range)
            if (Math.abs(this.proj.x - bx) < tgt.widthM / 2 + 0.55 && this.proj.y < tgt.heightM) {
              this.impact(this.proj.x, this.proj.y, tgt, 'tower')
              break
            }
          }
          if (this.proj.y <= 0.2 || this.shotT >= this.shot.T) {
            this.impact(worldX(this.shot.landing), 0.2, null, 'ground')
            break
          }
        }
        if (this.phase === 'flight' && this.shot) {
          this.trail.push(this.proj.x, this.proj.y)
          const v = Math.hypot(this.shot.vx, this.shot.vy - G * this.shotT)
          this.audio.flightUpdate(clamp01(v / 70), clamp01(this.proj.y / 45))
        }
        break
      }
      case 'impact':
        if (this.phaseT > 0.42) {
          this.wantTimeScale = 1
          this.phase = 'settle'
          this.phaseT = 0
        }
        break
      case 'settle': {
        this.armDeg = approach(this.armDeg, ARMED_DEG, 4.2, rawDt)
        const stillMoving = this.towers.some((t) => t.blocks.some((b) => b.loose && !b.settled))
        if (this.phaseT > (stillMoving ? 1.3 : 0.72)) {
          const nextIdx = this.rack.findIndex((b) => !b.spent)
          if (nextIdx < 0) {
            this.phase = 'clear'
            this.phaseT = 0
            this.clearT = 0
            this.audio.horn(this.hitsThisWave === this.rack.length)
          } else {
            this.activeIdx = nextIdx
            this.phase = 'aim'
            this.phaseT = 0
            this.questionShownAt = performance.now()
            if (this.cfg.gusty) this.wind = rollWind(this.cfg.wind, this.rng)
          }
        }
        break
      }
      case 'clear':
        this.clearT = clamp01(this.phaseT / 2.1)
        if (this.phaseT > 2.1) {
          this.startWave(this.wave + 1)
        }
        break
    }

    if (this.counterIn > 0) {
      this.counterIn -= rawDt
      if (this.counterIn <= 0) this.counterLand()
    }

    // the ram never stops — except while the child is working the sum out
    if (this.ram?.alive && ramAdvances(this.phase)) {
      this.ram.range -= this.ram.speed * dt
      this.ram.wheel += dt * 4
      if (this.ram.range <= 6) {
        this.ram.alive = false
        this.cam.addTrauma(0.7)
        this.cam.punch(0.06)
        this.platformDamage = clamp01(this.platformDamage + 0.2)
        this.combo = 0
        this.audio.impactStone(1)
        this.host.haptic('heavy')
        for (let i = 0; i < (this.reduced ? 8 : 36); i++) {
          const a = this.cosmetic.range(-0.4, Math.PI + 0.4)
          const sp = this.cosmetic.range(4, 24)
          this.parts.emit(SPARK, LAUNCH_X + 2, 5, Math.cos(a) * sp, Math.sin(a) * sp, {
            maxLife: this.cosmetic.range(0.2, 0.6),
            tone: this.cosmetic.int(0, 2),
            drag: 1.8,
            grav: 16,
          })
        }
      }
    }

    this.updateCamera(rawDt)
  }

  private updateCamera(dt: number): void {
    void dt
    const vp = { w: this.w, h: this.h }
    const wide = this.w / this.h >= 1.25
    const pts: Array<{ x: number; y: number }> = []
    // Keep the field clear of the two things pinned to the glass: the equation
    // at the top and the firing controls at the bottom right. Both are measured
    // from the safe rect now, so both pads carry the inset that pushed them in,
    // and the top pad also carries however far the stack had to drop to clear
    // the host's corners — otherwise the tallest keep in the wave is framed
    // straight into the rack row. Where the stack did not move (tablets, and
    // phones held sideways) `stackShift` is zero and this is byte-for-byte the
    // framing the game shipped with.
    const padTop = this.unit * 2.5 + this.hud.area.y + this.hud.stackShift
    const strip = this.h - (this.hud.area.y + this.hud.area.h) + this.unit * 2.5
    const gf = clamp(1 - strip / this.h - 0.02, 0.58, 0.84)
    if (this.phase === 'flight' && this.shot) {
      // follow with lead: look where the shot is going, not where it is
      const lead = 0.18
      const p = posAt(this.shot, Math.min(this.shot.T, this.shotT + lead))
      pts.push({ x: p.x + LAUNCH_X, y: Math.max(14, p.y + 6) })
      pts.push({ x: this.proj.x, y: this.proj.y })
      pts.push({ x: worldX(this.shot.landing), y: 0 })
      this.cam.frame(pts, vp, {
        minSpanX: wide ? 52 : 38,
        padPx: this.unit * 1.0,
        padTopPx: padTop,
        groundFrac: gf,
      })
    } else if (this.phase === 'impact') {
      pts.push({ x: this.proj.x - 15, y: 0 })
      pts.push({ x: this.proj.x + 15, y: 22 })
      this.cam.frame(pts, vp, {
        minSpanX: wide ? 44 : 32,
        padPx: this.unit * 0.7,
        padTopPx: padTop,
        groundFrac: gf,
      })
    } else {
      pts.push({ x: -9, y: 20 })
      pts.push({ x: worldX(this.dial) + 5, y: 0 })
      for (const t of this.towers) {
        if (!wide && Math.abs(t.range - this.dial) > 40) continue
        pts.push({ x: worldX(t.range), y: t.heightM + 7 })
      }
      if (this.ram?.alive) pts.push({ x: worldX(this.ram.range), y: 6 })
      this.cam.frame(pts, vp, {
        minSpanX: wide ? 46 : 40,
        padPx: this.unit * 0.9,
        padTopPx: padTop,
        groundFrac: gf,
      })
    }
  }

  /* --------------------------------------------------------------- render */

  private render(): void {
    const ctx = this.ctx
    const { w, h } = this
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const horizon = this.cam.toScreen(0, 0, { w, h }).y
    this.backdrop.draw(
      ctx,
      this.wallTime,
      this.cam.x,
      horizon,
      Math.sign(this.wind) || 1,
      this.reduced ? 0.25 : clamp01(0.25 + this.cfg.difficulty * 0.75),
    )

    ctx.save()
    this.cam.applyTransform(ctx, { w, h })
    const s = this.cam.ppm * this.cam.zoom
    const f: Frame = { ctx, w, h, s, t: this.time, dt: 0, reduced: this.reduced }

    drawGround(ctx, s, FIELD_MAX, this.craters, this.scrub)
    drawMilestones(ctx, s, FIELD_MAX, this.aimEmphasis * 0.6 + 0.4)
    drawGhosts(ctx, s, this.ghosts)
    // The boulder is drawn BEFORE the keeps: at eight metres apart no arc can
    // clear the far shoulder of the keep in front of its target, so instead of
    // fighting the geometry the shot passes *behind* it — which reads as depth,
    // and the blast still blooms in front because particles are drawn last.
    if (this.phase === 'flight' && this.shot) {
      this.trail.draw(ctx, s, 18, 'rgba(255,116,26,0.26)', C.fire1)
      const spd = Math.hypot(this.shot.vx, this.shot.vy - G * this.shotT)
      const stretch = 1 + clamp01(spd / 90) * 0.55
      ctx.save()
      ctx.translate(this.proj.x, this.proj.y)
      const ang = Math.atan2(this.shot.vy - G * this.shotT, this.shot.vx + this.shot.ax * this.shotT)
      ctx.rotate(ang)
      ctx.scale(stretch, 1 / Math.sqrt(stretch))
      ctx.globalCompositeOperation = 'lighter'
      ctx.drawImage(this.glow, -3.2, -3.2, 6.4, 6.4)
      ctx.globalCompositeOperation = 'source-over'
      drawBoulder(ctx, 0, 0, 1.05, 1)
      ctx.restore()
      // light pool on the ground under the shot
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = clamp01(1 - this.proj.y / 60) * 0.5
      ctx.drawImage(this.glow, this.proj.x - 7, -2.6, 14, 5.2)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }

    if (this.wall) drawWall(ctx, s, this.wall.x, this.wall.h)
    for (const t of this.towers) {
      drawTower(ctx, s, t, this.cfg.banners, t.wanted && this.revealT > 0, this.time)
    }
    if (this.ram?.alive) drawRam(ctx, s, this.ram, this.time)
    drawCraterLabels(ctx, s, this.craters)

    // aim marker + the dial numeral, right where the eye already is
    if (this.phase === 'aim' || this.phase === 'intro' || this.phase === 'windup') {
      this.drawAim(ctx, s)
    }

    drawTrebuchet(
      ctx,
      s,
      this.armDeg,
      this.recoil,
      this.platformDamage,
      this.phase === 'aim' || this.phase === 'intro' || this.phase === 'windup',
      1.05,
    )

    this.rings.draw(ctx, s)
    this.parts.draw(ctx, s, this.glow, this.puff, PAL)
    ctx.restore()
    void f

    this.flash.draw(ctx, w, h, 'rgba(255,196,130,1)')

    // vignette — one gradient, cached would be nicer but it is 1 fill
    ctx.save()
    const vg = ctx.createRadialGradient(w / 2, h * 0.52, Math.min(w, h) * 0.32, w / 2, h * 0.52, Math.max(w, h) * 0.78)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, w, h)
    ctx.restore()

    if (this.phase === 'aim' || this.phase === 'intro' || this.phase === 'windup') {
      this.drawDialNumeral(ctx)
    }
    drawHud(ctx, this.hudState(), this.btns, this.wallTime)
  }

  private drawAim(ctx: CanvasRenderingContext2D, s: number): void {
    const x = worldX(this.dial)
    const a = this.aimEmphasis
    if (a < 0.02) return
    ctx.save()
    ctx.globalAlpha = a
    // a column of light standing on the metre you have dialled
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, 9)
    ctx.strokeStyle = C.steel
    ctx.globalAlpha = a * 0.5
    ctx.lineWidth = 2 / s
    ctx.stroke()
    ctx.globalAlpha = a
    // caret
    ctx.beginPath()
    ctx.moveTo(x, 0.2)
    ctx.lineTo(x - 1.1, 2.2)
    ctx.lineTo(x + 1.1, 2.2)
    ctx.closePath()
    ctx.fillStyle = C.steel
    ctx.fill()

    // The loft stub — the first slice of the arc — only once the lever exists to
    // change it. Before that it would be decoration teaching nothing.
    if (this.cfg.loft) {
      const st = aimShot(this.dial, LOFTS[this.loftIdx], this.wind, LAUNCH_H)
      ctx.beginPath()
      const pts = samplePath(st, 14, st.T * 0.34)
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]
        if (i === 0) ctx.moveTo(p.x + LAUNCH_X, p.y)
        else ctx.lineTo(p.x + LAUNCH_X, p.y)
      }
      ctx.strokeStyle = C.steel
      ctx.globalAlpha = a * 0.45
      ctx.lineWidth = 2 / s
      ctx.setLineDash([1.4, 1.4])
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = a
    }

    ctx.restore()
  }

  /**
   * The dialled number, drawn on the glass rather than in the world.
   *
   * It rides the aim marker, so its position comes from the camera — but the
   * camera does not know about the notch or the host's two corners, and this is
   * the one number the whole game is about. `dialNumeralBox` puts it where the
   * marker is and keeps it where it can be read.
   */
  private drawDialNumeral(ctx: CanvasRenderingContext2D): void {
    const a = this.aimEmphasis
    if (a < 0.02) return
    const s = this.cam.ppm * this.cam.zoom
    const anchor = this.cam.toScreen(worldX(this.dial), 3.2, { w: this.w, h: this.h })
    const text = String(this.dial)
    const box = dialNumeralBox(anchor.x, anchor.y, s, text.length, this.hud)
    const pop = 1 + (1 - easeOutBack(clamp01(this.dialPop))) * 0.24
    ctx.save()
    ctx.globalAlpha = a
    ctx.translate(box.cx, box.baseline)
    ctx.scale(pop, pop)
    ctx.font = font(box.size, 900)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgba(3,5,13,0.85)'
    ctx.strokeText(text, 0, 0)
    ctx.fillStyle = C.steel
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }

  /* ---------------------------------------------------------------- debug */

  stats(): DebugStats {
    const sorted = this.frameTimes.slice().sort((a, b) => a - b)
    const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0
    return {
      fps: Math.round(this.fps * 10) / 10,
      frameMsP95: Math.round(p95 * 100) / 100,
      particles: this.parts.count,
      phase: this.phase,
      wave: this.wave,
      dial: this.dial,
      answer: this.activeBoulder?.answer ?? -1,
      score: this.score,
    }
  }

  /**
   * Harness driving. `manualDrive()` stops the rAF loop and lets a caller advance
   * the clock by hand; `stepFrames` then runs the EXACT same `tick` the browser
   * runs, so nothing about the game is bypassed — only the clock is. This is how
   * the QA capture measures frame cost and takes screenshots at chosen moments in
   * a tab that Chrome has throttled to zero.
   */
  manualDrive(on = true): void {
    this.manual = on
    this.last = performance.now()
  }

  /** @returns { meanMs, p95Ms, maxMs } for the frames it just ran */
  stepFrames(n: number, dtMs = 1000 / 60): { meanMs: number; p95Ms: number; maxMs: number } {
    const times: number[] = []
    for (let i = 0; i < n; i++) {
      this.last = this.syntheticClock
      this.syntheticClock += dtMs
      this.tick(this.syntheticClock)
      times.push(this.lastFrameMs)
    }
    times.sort((a, b) => a - b)
    const mean = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length)
    return {
      meanMs: Math.round(mean * 100) / 100,
      p95Ms: Math.round(times[Math.floor(times.length * 0.95)] * 100) / 100,
      maxMs: Math.round(times[times.length - 1] * 100) / 100,
    }
  }

  private syntheticClock = 0

  /** Used by the harness to reach late waves without playing twenty minutes. */
  jumpToWave(n: number): void {
    this.startWave(n)
  }

  get currentPhase(): string {
    return this.phase
  }

  towerRanges(): number[] {
    return this.towers.filter((t) => t.alive).map((t) => t.range)
  }

  aimAt(v: number): void {
    this.setDial(v)
  }

  fireNow(): void {
    this.fire()
  }

  currentAnswer(): number {
    return this.activeBoulder?.answer ?? -1
  }

  currentWind(): number {
    return this.wind
  }

  /**
   * Exactly the `canFire` the renderer is handed — read off the real `hudState()`
   * rather than recomputed, so a test asserting the button is dark is asserting
   * about the button a child is looking at.
   */
  fireArmed(): boolean {
    return this.hudState().canFire
  }

  /** The difficulty the game last found it could place answers from. */
  stockedDifficulty(): number | null {
    return this.stockD
  }
}
