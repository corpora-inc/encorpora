// CLAIM
//
// Cut the plane. Take exactly the fraction you were asked for.
//
// The math is not bolted on: the goal is a fraction of the arena, the arena is
// exactly 7200 cells, the progress bar is cut into the goal's denominator, and
// a cut that pushes you past the band does not show you a red X — it falls
// apart and gives the ground back to the hunters.

import type { Host, Question } from "../contract.ts"
import { Audio } from "./audio.ts"
import { cleanFraction, clamp } from "./exact.ts"
import {
  TRAIL,
  VOID,
  burnBack,
  commitClaim,
  idx,
  isFrontier,
  makeGrid,
  pickArena,
  previewClaim,
  resetGrid,
  type ClaimResult,
  type Grid,
} from "./grid.ts"
import {
  relocateCrawler,
  spawnCrawler,
  spawnDrifter,
  updateHunter,
  voidSeeds,
  type Hunter,
} from "./hunters.ts"
import { Hud } from "./hud.ts"
import { Input } from "./input.ts"
import { Juice } from "./juice.ts"
import { goalFromQuestion, levelAt, type Goal, type Level } from "./levels.ts"
import { css, INK, levelInk } from "./palette.ts"
import { Particles } from "./particles.ts"
import { Renderer } from "./render.ts"
import { hashSeed, makeRng, type Rng } from "./rng.ts"

type Phase = "intro" | "play" | "gate" | "clear" | "over"

type Flood = {
  res: ClaimResult
  batch: number
  /** How far the ink has spread, in BFS cells from the cut line. */
  wave: number
  /** Index into `res.cells` of the last cell painted. */
  painted: number
  /** Index of the first cell still inside the glowing edge. */
  edge: number
  duration: number
}

type Plate = { gx: number; gy: number; label: string; correct: boolean; taken: boolean; pop: number }

const START_LIVES = 3
/**
 * Below this, a claim is a nick rather than a decision: it still counts toward
 * the total, but it does not pay a combo and it does not get a toast. Without
 * it, dipping one cell off the rail and back is a combo engine.
 */
const MIN_MEANINGFUL_CLAIM = 15
const GATE_SECONDS = 7
const GHOSTS = 14

export function mount(el: HTMLElement, host: Host): { unmount(): void } {
  const game = new Claim(el, host)
  game.start()
  // QA seam: `document.querySelector("#stage").__claim.stats()` gives the
  // founder the frame times without a build flag or a debug overlay.
  ;(el as unknown as { __claim?: Claim }).__claim = game
  return { unmount: () => game.destroy() }
}

class Claim {
  private host: Host
  private root: HTMLDivElement
  private shakeBox: HTMLDivElement
  private stage: HTMLDivElement
  private hud: Hud
  private r: Renderer
  private g: Grid
  private input: Input
  private juice = new Juice()
  private fx = new Particles()
  private audio = new Audio()
  private rng: Rng
  private ro: ResizeObserver | null = null
  private raf = 0
  private lastT = 0
  private time = 0
  private alive = true

  private phase: Phase = "intro"
  private phaseT = 0
  private level!: Level
  private goal!: Goal
  private levelIndex = 1
  private lives = START_LIVES
  private score = 0
  private combo = 0
  private batch = 1
  private reduced = false

  // player
  private cx = 0
  private cy = 0
  private dx = 0
  private dy = 0
  private step = 0
  private cutting = false
  private anchor = -1
  private trail: number[] = []
  private fuse = 0
  private stall = 0
  private invuln = 0
  private ghosts = new Float32Array(GHOSTS * 2)
  private ghostN = 0
  private ghostAcc = 0

  private hunters: Hunter[] = []
  private extraHunters = 0
  private sinceClaim = 0
  private flood: Flood | null = null
  private preview = 0
  private previewAge = 0
  private previewKey = -1
  private danger = 0
  private hinting = true

  private gateQ: Question | null = null
  /**
   * A question the level goal could not use (too big a share of the plane for
   * this level, or not an area at all). It is not discarded — the next revive
   * gate asks it instead, so the curriculum still gets its rep.
   */
  private spare: Question | null = null
  private plates: Plate[] = []
  private gateLeft = 0
  private gateStart = 0
  private levelStart = 0
  private reported = false

  private frames = 0
  private totalFrames = 0
  private fpsAcc = 0
  private fps = 60
  private worstFrame = 0

  constructor(el: HTMLElement, host: Host) {
    this.host = host
    this.reduced = host.prefersReducedMotion()
    this.juice.reduced = this.reduced
    this.fx.budget = this.reduced ? 0.18 : 1
    // Re-seeded from the host's first question id in `startLevel`, so a
    // deterministic host means a bit-identical run — same hunters, same
    // spawns, same everything. This value only covers construction.
    this.rng = makeRng(hashSeed("claim"))

    const root = document.createElement("div")
    root.className = "cl-root"
    root.tabIndex = 0
    const shake = document.createElement("div")
    shake.className = "cl-shake"
    root.appendChild(shake)
    const stage = document.createElement("div")
    stage.className = "cl-stage"
    const canvas = document.createElement("canvas")
    stage.appendChild(canvas)
    const vig = document.createElement("div")
    vig.className = "cl-vig"
    stage.appendChild(vig)

    this.hud = new Hud(shake)
    shake.appendChild(stage)

    const mute = document.createElement("button")
    mute.className = "cl-mute"
    mute.type = "button"
    mute.textContent = "◼"
    mute.setAttribute("aria-label", "Toggle sound")
    root.appendChild(mute)
    mute.addEventListener("pointerdown", (e) => {
      e.stopPropagation()
      const on = !this.audio.enabled
      this.audio.setEnabled(on)
      mute.textContent = on ? "◼" : "◻"
      if (on) this.audio.unlock()
    })

    el.appendChild(root)
    this.root = root
    this.shakeBox = shake
    this.stage = stage

    this.g = makeGrid(pickArena(this.stageAspect()))
    this.r = new Renderer(canvas, this.g, levelInk(1))
    this.input = new Input(root, () => this.audio.unlock())

    this.ro = new ResizeObserver(() => this.layout())
    this.ro.observe(stage)
  }

  // ---- lifecycle --------------------------------------------------------

  start(): void {
    this.layout()
    this.startLevel(1)
    this.lastT = performance.now()
    this.raf = requestAnimationFrame(this.frame)
    this.root.focus({ preventScroll: true })
  }

  destroy(): void {
    this.alive = false
    cancelAnimationFrame(this.raf)
    this.ro?.disconnect()
    this.input.destroy()
    this.audio.dispose()
    this.hud.destroy()
    this.root.remove()
  }

  private layout(): void {
    const w = this.stage.clientWidth || 1
    const h = this.stage.clientHeight || 1
    this.r.resize(w, h)
  }

  private stageAspect(): number {
    return (this.stage.clientWidth || 4) / (this.stage.clientHeight || 3)
  }

  // ---- level setup ------------------------------------------------------

  private startLevel(i: number): void {
    this.levelIndex = i
    this.level = levelAt(i)
    const ink = levelInk(i)

    // The arena reshapes to the screen it is on and holds that shape for the
    // level. Every shape is exactly 7200 cells in exactly 40 blocks, so
    // rotating a tablet never changes what the goal means.
    const arena = pickArena(this.stageAspect())
    if (arena.iw !== this.g.iw || arena.ih !== this.g.ih) {
      this.g = makeGrid(arena)
      this.r.setGrid(this.g, ink)
      this.layout()
    } else {
      resetGrid(this.g)
      this.r.ink = ink
      this.r.clearTerritory()
    }
    this.r.repaintAll()

    let q: Question | null = null
    try {
      q = this.host.next()
    } catch {
      q = null
    }
    if (i === 1 && q) this.rng = makeRng(hashSeed(q.id))
    this.goal = goalFromQuestion(this.level, this.g.total, q)
    if (q && this.goal.questionId !== q.id) this.spare = q
    this.reported = false
    this.levelStart = performance.now()

    this.audio.key = ((i - 1) * 5) % 12 - 6
    this.hud.setLevel(i, ink, this.goal)
    this.hud.setBand(this.goal.lo, this.goal.hi, this.g.total)
    this.hud.setProgress(0, this.g.total, null)
    this.hud.setReadout(0, this.g.total, true)
    this.hud.setLives(this.lives)
    this.hud.setScore(this.score)

    this.hunters = []
    this.extraHunters = 0
    for (let n = 0; n < this.level.drifters; n++) {
      this.hunters.push(spawnDrifter(this.g, this.rng, this.level.hunterSpeed))
    }
    for (let n = 0; n < this.level.crawlers; n++) {
      this.hunters.push(spawnCrawler(this.g, this.rng, this.level.hunterSpeed))
    }
    for (let n = 0; n < this.level.chargers; n++) {
      this.hunters.push(spawnDrifter(this.g, this.rng, this.level.hunterSpeed, "charger"))
    }
    for (const h of this.hunters) h.born = 1

    this.resetPlayer()
    this.flood = null
    this.fx.clear()
    this.sinceClaim = 0
    this.combo = 0
    this.hinting = i === 1
    this.phase = "intro"
    this.phaseT = 0

    this.hud.showCard(
      `<div class="cl-bigfrac"><span>${this.goal.n}</span><i></i><span>${this.goal.d}</span></div>
       <p>${escapeHtml(this.goal.prompt)}</p>`,
      "cl-dim",
    )
  }

  private resetPlayer(): void {
    // Farthest rail cell from the nearest hunter, so a respawn is never a trap.
    let best = { x: 1, y: 0, d: -1 }
    const ring: Array<[number, number]> = []
    for (let x = 0; x < this.g.w; x += 2) {
      ring.push([x, 0], [x, this.g.h - 1])
    }
    for (let y = 0; y < this.g.h; y += 2) {
      ring.push([0, y], [this.g.w - 1, y])
    }
    for (const [x, y] of ring) {
      let d = 1e9
      for (const h of this.hunters) d = Math.min(d, Math.hypot(h.x - x, h.y - y))
      if (d > best.d) best = { x, y, d }
    }
    this.cx = best.x
    this.cy = best.y
    this.dx = 0
    this.dy = 0
    this.step = 0
    this.cutting = false
    this.trail = []
    this.anchor = -1
    this.fuse = 0
    this.stall = 0
    this.ghostN = 0
    this.preview = 0
    this.previewKey = -1
    this.r.clearGhost()
  }

  // ---- frame ------------------------------------------------------------

  private frame = (now: number): void => {
    if (!this.alive) return
    this.raf = requestAnimationFrame(this.frame)
    const realDt = Math.min(0.05, (now - this.lastT) / 1000)
    this.lastT = now
    this.advance(realDt)
  }

  /**
   * One step of the world. The rAF loop and the playtest harness both go
   * through here — there is no second code path and nothing to bypass.
   */
  private advance(realDt: number): void {
    this.time += realDt
    this.frames++
    this.totalFrames++
    this.fpsAcc += realDt
    // Ignore the first second: module evaluation, font load and the first
    // paint are not frames anyone plays through.
    if (realDt > this.worstFrame && this.totalFrames > 60) this.worstFrame = realDt
    if (this.fpsAcc >= 0.5) {
      this.fps = Math.round(this.frames / this.fpsAcc)
      this.frames = 0
      this.fpsAcc = 0
    }

    const dt = this.juice.step(realDt)
    if (dt > 0) this.update(dt)
    this.fx.update(realDt * (this.juice.timeScale * 0.5 + 0.5))
    this.hud.tickScore(this.score)
    this.draw()
  }

  /**
   * Playtest seam. Steps the real loop on a supplied clock so a run can be
   * replayed exactly, and so QA does not depend on a foreground tab. It
   * bypasses nothing: same update, same collision, same claim rule.
   */
  tick(dtSec: number): void {
    this.advance(Math.min(0.05, dtSec))
  }

  /** Playtest seam: hold a direction, exactly as a key or a thumb would. */
  hold(x: number, y: number): void {
    this.input.setDir(x, y)
  }

  private update(dt: number): void {
    this.phaseT += dt
    this.invuln = Math.max(0, this.invuln - dt)

    switch (this.phase) {
      case "intro":
        if (this.phaseT > 1.5 || (this.phaseT > 0.45 && this.input.consumePress())) {
          this.hud.hideCard()
          this.phase = "play"
          this.phaseT = 0
        }
        break
      case "play":
        this.updatePlay(dt)
        break
      case "gate":
        this.updateGate(dt)
        break
      case "clear":
        if (this.phaseT > 1.0 && this.card !== "shown") this.showClearCard()
        if (this.phaseT > 3.1 || (this.phaseT > 1.6 && this.input.consumePress())) {
          this.hud.hideCard()
          this.card = ""
          this.startLevel(this.levelIndex + 1)
        }
        break
      case "over":
        if (this.phaseT > 1.0 && this.input.consumePress()) this.restart()
        break
    }

    this.updateFlood(dt)
  }

  private card = ""

  // ---- play -------------------------------------------------------------

  private updatePlay(dt: number): void {
    this.movePlayer(dt)
    this.moveHunters(dt)
    this.updatePreview()
    this.updateFuse(dt)
    this.checkHunterHits()

    this.sinceClaim += dt
    if (this.sinceClaim > this.level.pressure && this.extraHunters < 2) {
      // Grinding out tiny cuts is a strategy the arena answers, without a clock
      // on screen and without taking anything away from you.
      this.extraHunters++
      this.sinceClaim = 0
      const h = spawnDrifter(this.g, this.rng, this.level.hunterSpeed * 1.05)
      h.born = 0
      this.hunters.push(h)
      this.juice.addTrauma(0.24)
      this.audio.spawn()
      this.fx.burst(
        this.r.gridToPx(h.x, h.y).x,
        this.r.gridToPx(h.x, h.y).y,
        26,
        220,
        0.5,
        this.r.cs,
        css(INK.red),
        () => this.rng.next(),
      )
    }

    // Tension: how close the nearest hunter is to the line you have out.
    let near = 1e9
    if (this.cutting) {
      for (const h of this.hunters) {
        if (h.kind === "crawler") continue
        for (let i = 0; i < this.trail.length; i += 4) {
          const c = this.trail[i] as number
          const d = Math.hypot(h.x - (c % this.g.w), h.y - ((c / this.g.w) | 0))
          if (d < near) near = d
        }
      }
    }
    const trailPressure = this.cutting ? clamp(this.trail.length / 90, 0, 1) : 0
    const proximity = this.cutting ? clamp(1 - near / 22, 0, 1) : 0
    this.danger = Math.max(trailPressure * 0.55, proximity)
    this.audio.tension(this.cutting ? clamp(this.danger * 0.85 + 0.15, 0, 1) : 0)
    this.root.classList.toggle("cl-tense", this.danger > 0.55)
  }

  private movePlayer(dt: number): void {
    const want = this.input.dir
    if (want.x !== 0 || want.y !== 0) this.hinting = false

    // Direction only ever changes at a cell boundary — either standing still,
    // or in the instant after stepping into a new cell. That is what keeps
    // every enclosed region an exact whole number of cells, and it is also
    // what makes cornering feel like Pac-Man rather than like ice.
    if (this.step === 0) this.tryTurn(want)
    if (this.dx === 0 && this.dy === 0) {
      this.step = 0
      return
    }

    const speed = this.cutting ? this.level.cutSpeed : this.level.railSpeed
    this.step += speed * dt
    let guard = 0
    while (this.step >= 1 && guard++ < 8) {
      this.step -= 1
      const nx = this.cx + this.dx
      const ny = this.cy + this.dy
      if (nx < 0 || ny < 0 || nx >= this.g.w || ny >= this.g.h) {
        this.step = 0
        this.dx = 0
        this.dy = 0
        break
      }
      this.cx = nx
      this.cy = ny
      if (this.onEnterCell(idx(this.g, nx, ny))) return
      this.tryTurn(this.input.dir)
      if (this.dx === 0 && this.dy === 0) {
        this.step = 0
        break
      }
    }

    this.ghostAcc += dt
    if (this.ghostAcc > 1 / 90) {
      this.ghostAcc = 0
      this.ghosts.copyWithin(2, 0, (GHOSTS - 1) * 2)
      this.ghosts[0] = this.px()
      this.ghosts[1] = this.py()
      this.ghostN = Math.min(GHOSTS, this.ghostN + 1)
    }
  }

  private tryTurn(want: { x: number; y: number }): void {
    if (want.x === 0 && want.y === 0) {
      this.dx = 0
      this.dy = 0
      return
    }
    // A 180 while cutting would walk straight onto your own line. Treat it as
    // a mis-swipe and ignore it rather than killing for it.
    if (this.cutting && want.x === -this.dx && want.y === -this.dy) return
    const nx = this.cx + want.x
    const ny = this.cy + want.y
    if (nx < 0 || ny < 0 || nx >= this.g.w || ny >= this.g.h) return
    this.dx = want.x
    this.dy = want.y
  }

  /** Returns true if the frame's movement must stop (death or a closed cut). */
  private onEnterCell(c: number): boolean {
    // During the revive gate you drift through the plane freely: no line, no
    // hazard, nothing to lose while you are doing arithmetic.
    if (this.phase === "gate") return false
    const own = this.g.own[c]
    if (own === TRAIL) {
      this.die("trail")
      return true
    }
    if (own === VOID) {
      if (!this.cutting) {
        this.cutting = true
        this.anchor = idx(this.g, this.cx - this.dx, this.cy - this.dy)
        this.fuse = 0
        this.stall = 0
        this.audio.cutStart()
        this.host.haptic("light")
      }
      this.g.own[c] = TRAIL
      this.trail.push(c)
      this.fuse = Math.max(0, this.fuse - 0.6)
      if (this.trail.length % 6 === 0) this.audio.step()
      return false
    }
    if (this.cutting) {
      this.closeCut()
      return true
    }
    return false
  }

  private updateFuse(dt: number): void {
    if (!this.cutting) {
      this.stall = 0
      return
    }
    const moving = this.dx !== 0 || this.dy !== 0
    if (moving) {
      this.stall = 0
      this.fuse = Math.max(0, this.fuse - dt * 6)
      return
    }
    this.stall += dt
    if (this.stall < this.level.fuseGrace) return
    this.fuse += dt * 11
    if (this.fuse >= 1) {
      const eat = Math.floor(this.fuse)
      for (let i = 0; i < eat && this.trail.length > 0; i++) {
        const c = this.trail.shift() as number
        this.g.own[c] = VOID
        const p = this.r.cellToPx(c)
        this.fx.burst(p.x, p.y, 4, 90, 0.4, this.r.cs * 0.8, css(INK.orange), () => this.rng.next())
      }
      this.fuse -= eat
      if (this.trail.length === 0) this.die("fuse")
    }
  }

  private moveHunters(dt: number): void {
    for (const h of this.hunters) {
      updateHunter(this.g, h, dt, this.rng, this.px(), this.py())
      if (h.kind === "crawler" && !isFrontier(this.g, h.cx, h.cy)) relocateCrawler(this.g, h, this.rng)
    }
  }

  private checkHunterHits(): void {
    if (this.invuln > 0) return
    const px = this.px()
    const py = this.py()
    for (const h of this.hunters) {
      const reach = h.kind === "crawler" ? 1.15 : h.kind === "charger" ? 1.7 : 1.45
      if (Math.hypot(h.x - px, h.y - py) < reach * (0.4 + 0.6 * h.born)) {
        this.die("hunter")
        return
      }
      if (h.kind === "crawler" || h.born < 0.6) continue
      const hx = Math.floor(h.x)
      const hy = Math.floor(h.y)
      if (hx < 0 || hy < 0 || hx >= this.g.w || hy >= this.g.h) continue
      if (this.g.own[idx(this.g, hx, hy)] === TRAIL) {
        this.die("cut")
        return
      }
    }
  }

  /**
   * "If I close here, how much do I take?"
   *
   * Runs a full cut-off flood against a scratch copy of the arena — about
   * 7.5k cells, well under a frame — and only when the head cell or the
   * heading has actually changed. What it *shows* you is the escalation:
   *
   *   help 2 — the ghost region, a marker on the fraction bar, and the number
   *   help 1 — the ghost region and the marker
   *   help 0 — the region. Estimate it yourself.
   */
  private updatePreview(): void {
    if (!this.cutting || this.trail.length === 0) {
      if (this.preview !== 0) {
        this.preview = 0
        this.r.clearGhost()
        this.hud.setProgress(this.g.claimed, this.g.total, null)
      }
      return
    }
    this.previewAge++
    const key = this.cx * 4096 + this.cy * 8 + (this.dx + 1) * 3 + (this.dy + 1)
    if (key === this.previewKey && this.previewAge < 8) return
    this.previewKey = key
    this.previewAge = 0
    this.preview = previewClaim(
      this.g,
      this.trail,
      this.cx,
      this.cy,
      this.dx,
      this.dy,
      voidSeeds(this.g, this.hunters),
    )
    this.r.buildGhost()
    this.hud.setProgress(
      this.g.claimed,
      this.g.total,
      this.level.help >= 1 ? this.g.claimed + this.preview : null,
    )
  }

  // ---- claiming ---------------------------------------------------------

  private closeCut(): void {
    const seeds = voidSeeds(this.g, this.hunters)
    const before = this.g.claimed
    const res = commitClaim(this.g, this.trail, seeds, this.batch)
    const gained = this.g.claimed - before
    this.cutting = false
    this.trail = []
    this.anchor = -1
    this.fuse = 0
    this.preview = 0
    this.r.clearGhost()
    this.sinceClaim = 0
    this.audio.tension(0)
    this.root.classList.remove("cl-tense")

    if (gained <= 0) return

    const p = this.r.cellToPx(res.cells[0] ?? 0)

    // Too much. The ground you just took cracks and goes back — the natural
    // punishment for not looking before you cut. No red X, no lecture, and no
    // life lost: what it costs is the territory and the combo.
    if (this.g.claimed > this.goal.hi) {
      const burned = burnBack(this.g, res.cells)
      for (const c of burned) this.r.clearCell(c)
      this.combo = 0
      this.juice.addTrauma(0.85)
      this.juice.hitstop(90)
      this.juice.punch(0.04, 0.02)
      this.audio.bust()
      this.host.haptic("heavy")
      this.hud.toast("TOO MUCH", "bad")
      this.hud.punch()
      const stepN = Math.max(1, Math.floor(burned.length / 60))
      for (let i = 0; i < burned.length; i += stepN) {
        const q = this.r.cellToPx(burned[i] as number)
        this.fx.spawn(
          q.x,
          q.y,
          (this.rng.next() - 0.5) * 260,
          (this.rng.next() - 0.5) * 260 - 60,
          0.55 + this.rng.next() * 0.4,
          this.r.cs * 1.4,
          css(INK.red),
          { spin: (this.rng.next() - 0.5) * 12, grav: 420, drag: 1.1 },
        )
      }
      if (this.extraHunters < 2) {
        this.extraHunters++
        const h = spawnDrifter(this.g, this.rng, this.level.hunterSpeed)
        h.born = 0
        this.hunters.push(h)
      }
      this.syncMeter()
      return
    }

    // A good cut.
    const meaningful = gained >= MIN_MEANINGFUL_CLAIM
    if (meaningful) this.combo = Math.min(9, this.combo + 1)
    const mult = 1 + this.combo * 0.25
    const gain = Math.floor(gained * (1 + gained / 400) * mult)
    this.score += gain
    this.flood = {
      res,
      batch: this.batch,
      wave: 0,
      painted: 0,
      edge: 0,
      duration: clamp(0.22 + Math.sqrt(gained) * 0.012, 0.22, 0.75),
    }
    this.batch++

    const frac = gained / this.g.total
    this.audio.claim(frac, this.combo)
    this.host.haptic(gained > this.g.total / 8 ? "heavy" : "medium")
    this.juice.addTrauma(clamp(0.18 + frac * 2.4, 0.18, 0.8))
    this.juice.hitstop(clamp(30 + frac * 420, 30, 130))
    this.juice.punch(clamp(frac * 0.4, 0.008, 0.05), (this.rng.next() - 0.5) * 0.014)
    if (meaningful) {
      this.hud.punch()
      this.hud.toast(`+${gain}`, "good", p.x, p.y)
    }

    // Landing on a fraction a child recognises is worth saying out loud.
    const clean = meaningful ? cleanFraction(this.g.claimed, this.g.total) : null
    if (clean && clean.d > 1) {
      const bonus = 120 * clean.d
      this.score += bonus
      this.audio.cleanFraction(clean.d)
      this.hud.toast(`${clean.n}/${clean.d}`, "clean")
    }

    this.syncMeter()

    if (this.g.claimed >= this.goal.lo) this.levelClear()
  }

  private syncMeter(): void {
    this.hud.setProgress(this.g.claimed, this.g.total, null)
    this.hud.setReadout(this.g.claimed, this.g.total, true)
  }

  private updateFlood(dt: number): void {
    const f = this.flood
    if (!f) return
    f.wave += ((f.res.maxDist + 1) / f.duration) * dt
    const before = f.painted
    while (f.painted < f.res.cells.length && (f.res.dists[f.painted] as number) <= f.wave) {
      this.r.paintCell(f.res.cells[f.painted] as number, f.batch)
      f.painted++
    }
    // The glowing edge is the last ~2 rings of the flood, not a fixed count of
    // cells: on a big claim a fixed count paints the whole region white.
    while (f.edge < f.painted && (f.res.dists[f.edge] as number) < f.wave - 2.2) f.edge++
    if (f.painted > before && this.fx.live < 320) {
      const c = f.res.cells[f.painted - 1] as number
      const p = this.r.cellToPx(c)
      this.fx.burst(p.x, p.y, 2, 130, 0.32, this.r.cs * 0.9, css(INK.bone), () => this.rng.next())
    }
    if (f.painted >= f.res.cells.length) this.flood = null
  }

  // ---- level clear ------------------------------------------------------

  private levelClear(): void {
    this.phase = "clear"
    this.phaseT = 0
    this.card = ""
    this.audio.perfect()
    this.audio.levelClear()
    this.audio.tension(0)
    this.host.haptic("success")
    this.juice.hitstop(150)
    this.juice.slowmo(0.24, 0.95)
    this.juice.addTrauma(0.95)
    this.juice.punch(0.07, 0)
    this.juice.doFlash(0.2, "#ffe800")
    this.report(true)

    const bonus = 900 * this.levelIndex * (1 + this.combo * 0.25)
    this.score += Math.floor(bonus)

    // Blow the remaining void apart. Budgeted — never more than 120 shards.
    let spawned = 0
    for (let y = 1; y <= this.g.h - 2 && spawned < 120; y += 3) {
      for (let x = 1; x <= this.g.w - 2 && spawned < 120; x += 3) {
        if (this.g.own[idx(this.g, x, y)] !== VOID) continue
        if (this.rng.next() > 0.5) continue
        const p = this.r.gridToPx(x + 0.5, y + 0.5)
        this.fx.spawn(
          p.x,
          p.y,
          (this.rng.next() - 0.5) * 300,
          (this.rng.next() - 0.5) * 300,
          0.7 + this.rng.next() * 0.6,
          this.r.cs * 1.6,
          css(this.rng.next() > 0.5 ? INK.yellow : INK.bone),
          { spin: (this.rng.next() - 0.5) * 10, drag: 1.4 },
        )
        spawned++
      }
    }
  }

  private showClearCard(): void {
    this.card = "shown"
    const pct = Math.round((this.g.claimed * 100) / this.g.total)
    this.hud.showCard(
      `<div class="cl-bigfrac"><span>${this.goal.n}</span><i></i><span>${this.goal.d}</span></div>
       <h2>${this.g.claimed} · ${pct}%</h2>
       <p>${this.score}</p>`,
      "cl-dim",
    )
  }

  // ---- death and the gate ----------------------------------------------

  private die(cause: "hunter" | "trail" | "cut" | "fuse"): void {
    if (this.phase !== "play" || this.invuln > 0) return
    const p = this.r.gridToPx(this.px(), this.py())
    this.audio.death()
    this.audio.tension(0)
    this.host.haptic("failure")
    this.juice.hitstop(120)
    this.juice.addTrauma(1)
    this.juice.slowmo(0.3, 0.55)
    this.juice.punch(0.05, (this.rng.next() - 0.5) * 0.05)
    this.juice.doFlash(0.16, "#f15060")
    this.root.classList.remove("cl-tense")
    this.fx.burst(p.x, p.y, 46, 340, 0.75, this.r.cs * 1.5, css(INK.bone), () => this.rng.next(), {
      grav: 300,
      drag: 1.2,
    })
    this.fx.burst(p.x, p.y, 26, 210, 0.9, this.r.cs * 1.2, css(INK.pink), () => this.rng.next(), {
      grav: 260,
      drag: 1.1,
    })

    for (const c of this.trail) {
      this.g.own[c] = VOID
      if (this.rng.next() < 0.12) {
        const q = this.r.cellToPx(c)
        this.fx.spawn(
          q.x,
          q.y,
          (this.rng.next() - 0.5) * 150,
          (this.rng.next() - 0.5) * 150,
          0.5,
          this.r.cs,
          css(INK.pink),
          { grav: 260 },
        )
      }
    }
    this.trail = []
    this.cutting = false
    this.preview = 0
    this.r.clearGhost()
    this.combo = 0
    this.lives--
    this.hud.setLives(this.lives)
    this.hud.toast(cause === "fuse" ? "BURNT" : "CUT", "bad")
    this.openGate()
  }

  /**
   * Where a free-to-play game would show an ad, this asks for arithmetic.
   *
   * Three plates, one right. Drive into the right one and you get the life
   * back and three seconds of shield. Get it wrong, or dither past the ring,
   * and the life stays spent. Nothing is ever taken for being wrong twice.
   */
  private openGate(): void {
    let q: Question | null = this.spare
    this.spare = null
    if (!q) {
      try {
        q = this.host.next()
      } catch {
        q = null
      }
    }
    this.gateQ = q
    this.resetPlayer()
    this.invuln = 99
    if (!q) {
      this.finishGate(false)
      return
    }
    const labels = this.rng.shuffle([
      { label: q.answer, correct: true },
      ...q.distractors.slice(0, 2).map((d) => ({ label: d, correct: false })),
    ])
    const n = labels.length
    this.plates = labels.map((l, i) => ({
      gx: this.g.w * ((i + 1) / (n + 1)),
      gy: this.g.h * 0.5,
      label: l.label,
      correct: l.correct,
      taken: false,
      pop: 0,
    }))
    this.gateLeft = GATE_SECONDS
    this.gateStart = performance.now()
    this.phase = "gate"
    this.phaseT = 0
    this.hud.showCard(`<h2>${escapeHtml(q.prompt)}</h2>`, "")
  }

  private updateGate(dt: number): void {
    this.gateLeft -= dt
    for (const p of this.plates) p.pop = Math.min(1, p.pop + dt * 3.2)
    this.movePlayer(dt)
    const px = this.px()
    const py = this.py()
    for (const p of this.plates) {
      if (p.taken) continue
      if (Math.abs(p.gx - px) < 4.2 && Math.abs(p.gy - py) < 3.4) {
        p.taken = true
        this.finishGate(p.correct, p.label)
        return
      }
    }
    if (this.gateLeft <= 0) this.finishGate(false)
  }

  private finishGate(correct: boolean, answered = ""): void {
    if (this.gateQ) {
      this.host.report({
        questionId: this.gateQ.id,
        correct,
        ms: Math.round(performance.now() - this.gateStart),
        answered,
      })
    }
    this.plates = []
    this.gateQ = null
    this.hud.hideCard()
    if (correct) {
      this.lives++
      this.hud.setLives(this.lives)
      this.audio.gateRight()
      this.host.haptic("success")
      this.juice.addTrauma(0.4)
      this.juice.punch(0.045, 0)
      this.juice.doFlash(0.15, "#ffe800")
      this.hud.toast("+1", "big")
      const p = this.r.gridToPx(this.px(), this.py())
      this.fx.burst(p.x, p.y, 40, 300, 0.8, this.r.cs * 1.3, css(INK.yellow), () => this.rng.next())
    } else {
      this.audio.gateWrong()
      this.juice.addTrauma(0.3)
    }
    if (this.lives <= 0) {
      this.gameOver()
      return
    }
    this.invuln = correct ? 3 : 1.6
    this.phase = "play"
    this.phaseT = 0
    this.sinceClaim = 0
  }

  private gameOver(): void {
    this.report(false)
    this.phase = "over"
    this.phaseT = 0
    this.audio.tension(0)
    this.juice.slowmo(0.35, 1.2)
    this.hud.showCard(
      `<h1>${this.score}</h1><h2>LVL ${this.levelIndex} · ${Math.round((this.g.claimed * 100) / this.g.total)}%</h2><p>PRESS ANY KEY</p>`,
      "cl-dim",
    )
  }

  private restart(): void {
    this.score = 0
    this.lives = START_LIVES
    this.combo = 0
    this.batch = 1
    this.hud.hideCard()
    this.card = ""
    this.juice.reset()
    this.startLevel(1)
  }

  private report(correct: boolean): void {
    if (this.reported || !this.goal.questionId) return
    this.reported = true
    this.host.report({
      questionId: this.goal.questionId,
      correct,
      ms: Math.round(performance.now() - this.levelStart),
      answered: String(this.g.claimed),
    })
  }

  // ---- draw -------------------------------------------------------------

  private px(): number {
    return this.cx + 0.5 + this.dx * this.step
  }
  private py(): number {
    return this.cy + 0.5 + this.dy * this.step
  }

  private draw(): void {
    // Shake moves the whole composition — arena AND HUD — on the compositor,
    // so nothing is ever left standing still while the world is being hit.
    // Rotation and zoom stay inside the canvas transform, where they cost
    // nothing and cannot bleed into DOM layout.
    const sx = this.juice.shakeX
    const sy = this.juice.shakeY
    this.shakeBox.style.transform =
      sx === 0 && sy === 0 ? "" : `translate3d(${sx.toFixed(2)}px,${sy.toFixed(2)}px,0)`
    const cam = {
      shakeX: 0,
      shakeY: 0,
      rot: this.juice.rot,
      zoom: this.juice.zoom,
      flash: this.juice.flash,
      flashStyle: this.juice.flashStyle,
    }
    this.r.begin(cam)
    this.r.drawField(this.time)
    this.r.drawTerritory()

    if (this.cutting && this.preview > 0) {
      const pulse = 0.55 + Math.sin(this.time * 6) * 0.16
      this.r.drawGhost(this.reduced ? 0.5 : pulse)
      if (this.level.help >= 2) {
        const over = this.g.claimed + this.preview > this.goal.hi
        this.r.drawPredict(this.px(), this.py(), `+${this.preview}`, over)
      }
    }

    const f = this.flood
    if (f) this.r.drawWavefront(f.res.cells, f.edge, f.painted)

    if (this.trail.length > 0) {
      const line = this.anchor >= 0 && this.fuse === 0 ? [this.anchor, ...this.trail] : this.trail
      this.r.drawTrail(line, this.danger, this.time)
      this.r.drawFuse(this.trail, this.fuse > 0, this.time)
    }

    const pp = this.r.gridToPx(this.px(), this.py())
    for (const h of this.hunters) this.r.drawHunter(h, this.time, pp)

    if (this.phase !== "over") {
      const stretch = this.reduced ? 0 : (this.dx !== 0 || this.dy !== 0 ? 0.22 : 0)
      this.r.drawPlayer(
        this.px(),
        this.py(),
        this.dx,
        this.dy,
        stretch,
        this.invuln,
        this.time,
        this.ghosts,
        this.ghostN,
      )
    }

    if (this.phase === "gate") {
      for (const p of this.plates) {
        this.r.drawPlate(p.gx, p.gy, p.label, p.pop, this.time)
      }
      this.r.drawGateRing(this.gateLeft / GATE_SECONDS)
    }

    if (this.hinting && this.phase === "play") this.r.drawHint(this.px(), this.py(), this.time)

    this.r.drawParticles(this.fx)
    this.r.drawStick(this.input.stick)
    this.r.end(cam)
  }

  /** Test/QA seam: the numbers the founder is going to ask for. */
  stats(): Record<string, number | string> {
    return {
      fps: this.fps,
      worstFrameMs: Math.round(this.worstFrame * 1000),
      level: this.levelIndex,
      claimed: this.g.claimed,
      total: this.g.total,
      target: this.goal.target,
      lo: this.goal.lo,
      hi: this.goal.hi,
      score: this.score,
      lives: this.lives,
      particles: this.fx.live,
      hunters: this.hunters.length,
      phase: this.phase,
      cells: this.r.cs,
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  )
}

export type { Claim }
