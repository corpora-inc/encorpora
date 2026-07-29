/**
 * DEEPSWARM. One verb — move. The weapons fire themselves, the swarm never
 * stops, and every thirty seconds you get stronger than the maths says you
 * should be.
 *
 * The arithmetic lives in three places, none of which is a quiz:
 *   CORE   — swim into it, time crawls, three numbered orbs circle you, and
 *            the one you touch decides whether the next nine seconds are an
 *            apocalypse or an ambush. You answer with the same verb you play
 *            with.
 *   CACHE  — a sealed fourth card at level-up. Open it or ignore it.
 *   RIFT   — you died. Charge it with answers and come back.
 * And underneath all of it, every upgrade card states its own arithmetic, so
 * choosing well is comparing products under pressure.
 */
import { createInstructions, type Instructions } from "../../../../packs/shared/game-chrome/index.ts"
import type { Host, Question } from "../contract.ts"
import { Audio } from "../core/audio.ts"
import { Input } from "../core/input.ts"
import { detectTier, tier, TierGovernor, type Tier, type TierName } from "../core/tiers.ts"
import { Renderer, SHAPE } from "../gfx/renderer.ts"
import { BEHAVIOUR, ENEMIES, E_INDEX, hpScale, speedScale, targetPopulation } from "./enemies.ts"
import { Feel } from "./feel.ts"
import {
  cooldown, makeBuild, realDamage, reach, rollCards, xpForLevel,
  type Build, type Card,
} from "./loadout.ts"
import { Curriculum } from "./curriculum.ts"
import { Bullets, Enemies, Gems, Grid, Numbers, Particles, Shocks } from "./world.ts"
import { Overlay } from "../ui/overlay.ts"

const STEP = 1 / 60
const AREA = 402 // sqrt(halfW*halfH): a constant amount of world on any screen

type Mode = "title" | "play" | "levelup" | "core" | "rift" | "over" | "paused"

type Orb = { x: number; y: number; ang: number; text: string; correct: boolean; state: number; t: number }

export class Game {
  private root: HTMLElement
  private host: Host
  private canvas: HTMLCanvasElement
  private r: Renderer
  private input: Input
  private audio = new Audio()
  private feel = new Feel()
  private ui: Overlay
  private guide: Instructions
  private gov: TierGovernor
  private T: Tier

  private E!: Enemies
  private B!: Bullets
  private EB!: Bullets
  private P!: Particles
  private G!: Gems
  private N!: Numbers
  private S!: Shocks
  private grid!: Grid
  private range = new Int32Array(4)
  private shakeOut = new Float32Array(2)

  private raf = 0
  private lastT = 0
  private acc = 0
  private alive = true
  private ro: ResizeObserver | null = null

  /* ------------------------------------------------------------ run state */
  mode: Mode = "title"
  private runT = 0
  private wallT = 0
  /**
   * The longest run, in seconds. Held here and not only in `localStorage`,
   * because inside a pack frame there is no `localStorage` to hold it in: the
   * frame is sandboxed onto an opaque origin and every access throws. Read
   * straight back off storage, the game-over panel printed `BEST 0:00` after a
   * four-minute run, forever. In memory it is at least true for the sitting;
   * storage upgrades it to true across sittings wherever storage exists.
   */
  private best = 0
  private kills = 0
  private level = 1
  private xp = 0
  private xpNeed = xpForLevel(1)
  private build: Build = makeBuild()
  private px = 0
  private py = 0
  private pvx = 0
  private pvy = 0
  private pAng = 0
  private invuln = 0
  private overcharge = 0
  private revives = 0
  private hurtCd = 0
  private levelUps = 0
  /**
   * Every question this run: which one to ask next, and what the host is told
   * about it. Escalation lives in here and it reads right answers, not the
   * clock — see curriculum.ts.
   */
  private curriculum = new Curriculum()
  private bestMs = 0

  private camX = 0
  private camY = 0
  private halfW = AREA
  private halfH = AREA
  private timeScale = 1
  private timeScaleTarget = 1
  private desat = 0

  private spawnAcc = 0
  private wardenAt = 42
  private tideAt = 74
  private coreAt = 20
  private coreX = 0
  private coreY = 0
  private coreLive = false
  private corePhase = 0

  private q: Question | null = null
  private orbs: Orb[] = []
  private qT = 0
  private qTMax = 0
  private qStart = 0
  private qAnswered = false

  private riftNeeded = 1
  private riftCharges = 0
  private riftT = 0
  private riftQ: Question | null = null

  private cards: Card[] = []
  private sealedQ: Question | null = null

  private rng: () => number
  private fpsAcc = 0
  private fpsN = 0
  private fpsShown = 0
  private debug = false
  private reduced = false

  constructor(root: HTMLElement, host: Host) {
    this.root = root
    this.host = host
    this.reduced = host.prefersReducedMotion()
    this.feel.reduced = this.reduced

    this.canvas = document.createElement("canvas")
    this.canvas.className = "hz-canvas"
    root.appendChild(this.canvas)

    const name: TierName = detectTier()
    this.T = tier(name)
    this.gov = new TierGovernor(name)
    this.r = new Renderer(this.canvas, this.T.maxInstances)
    this.applyTier(this.T)
    this.allocate(this.T)

    this.input = new Input(this.canvas)
    this.ui = new Overlay(root)
    this.wireUi()

    // How to play. The title card carries three lines of hint and then it is
    // gone for the rest of the run — which is exactly the wrong moment, because
    // the CORE, the sealed CACHE and the RIFT all arrive minutes later and none
    // of them were ever named. The manual stays behind the how-to-play button
    // for the whole session, and the swarm holds still while it is open.
    this.guide = createInstructions(root, {
      title: "DEEPSWARM",
      summary: [
        "You are one small light in the deep. The swarm comes for you and never stops.",
        "Your weapons fire on their own. Your only job is to move.",
      ],
      sections: [
        {
          heading: "Moving",
          lines: [
            "Put a finger anywhere on the screen and drag. Your light swims that way.",
            "On a keyboard, use the arrow keys or W, A, S and D.",
            "You never aim and you never shoot. Steering is the whole game.",
          ],
        },
        {
          heading: "Getting stronger",
          lines: [
            "Beaten enemies drop bright gems. Swim over them to fill the bar at the top.",
            "When the bar fills, the game stops and shows you cards. Pick one to take it.",
            "Each card shows what it changes, like 12 damage becoming 17 damage.",
            "Read both numbers and take the bigger jump. That is the real choice.",
          ],
        },
        {
          heading: "The CORE",
          lines: [
            "Every so often a gold CORE appears. Swim into it.",
            "Time slows down and three numbered balls circle you. One holds the answer.",
            "Swim out and touch the right one. For nine seconds nothing can stand near you.",
            "Touch a wrong one and a ring of enemies drops on top of you. The gold ball then lights up so you can see which it was.",
          ],
        },
        {
          heading: "The CACHE",
          lines: [
            "Sometimes a fourth card is sealed shut with a question on it.",
            "Answer it and you get a stronger card than any of the other three.",
            "You never have to open it. Take a plain card instead and nothing is lost.",
          ],
        },
        {
          heading: "The RIFT",
          lines: [
            "When your life runs out you do not lose straight away. A RIFT opens.",
            "Answer questions to fill the round lamps. Fill them all and you come back with full life.",
            "A wrong answer never takes a lamp away. It takes time off the clock.",
            "If the clock empties before the lamps fill, the run is over.",
          ],
        },
      ],
      reducedMotion: this.reduced,
    })

    let seed = (Date.now() ^ 0x9e3779b9) >>> 0
    this.rng = () => {
      seed = (seed + 0x6d2b79f5) >>> 0
      let t = seed
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }

    try {
      this.debug = new URLSearchParams(location.search).has("debug")
    } catch { /* no location in an embedded host */ }

    this.resize()
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(root)
    window.addEventListener("resize", this.onWinResize)

    this.reset()
    this.lastT = performance.now()
    this.raf = requestAnimationFrame(this.tick)
  }

  private onWinResize = () => this.resize()

  private applyTier(T: Tier): void {
    this.r.bloomOctaves = this.reduced ? Math.min(1, T.bloomOctaves) : T.bloomOctaves
    this.r.stainEnabled = T.stain
  }

  private allocate(T: Tier): void {
    this.E = new Enemies(T.maxEnemies)
    this.B = new Bullets(T.maxBullets)
    this.EB = new Bullets(Math.max(140, T.maxBullets >> 2))
    this.P = new Particles(T.maxParticles)
    this.G = new Gems(T.maxGems)
    this.N = new Numbers(T.maxNumbers)
    this.S = new Shocks(96)
    this.grid = new Grid(T.maxEnemies)
  }

  private wireUi(): void {
    this.ui.onStart = () => {
      void this.audio.init().then(() => this.audio.markStarted())
      this.ui.hideTitle()
      this.reset()
      this.mode = "play"
    }
    this.ui.onRestart = () => {
      this.ui.hideOver()
      this.reset()
      this.mode = "play"
    }
    this.ui.onToggleSound = () => {
      const on = !this.audio.enabled
      this.audio.setEnabled(on)
      this.ui.setSound(on)
      if (on) void this.audio.init().then(() => this.audio.markStarted())
    }
    this.ui.onTogglePause = () => {
      if (this.mode === "play") {
        this.mode = "paused"
        this.ui.setPaused(true)
        this.ui.say("PAUSED", "", "#9fd8ff")
      } else if (this.mode === "paused") {
        this.mode = "play"
        this.ui.setPaused(false)
      }
    }
    this.ui.onPickCard = (i) => this.pickCard(i)
    this.ui.onSealed = (res) => this.sealedAnswer(res)
    this.ui.onRiftAnswer = (res) => this.riftAnswer(res)
  }

  /* -------------------------------------------------------------- lifecycle */

  private resize(): void {
    const rect = this.root.getBoundingClientRect()
    const w = Math.max(200, rect.width || window.innerWidth)
    const h = Math.max(200, rect.height || window.innerHeight)
    const dpr = Math.min(window.devicePixelRatio || 1, this.T.maxDpr)
    this.r.resize(w, h, dpr * this.T.renderScale)
    const aspect = w / h
    this.halfW = AREA * Math.sqrt(aspect)
    this.halfH = AREA / Math.sqrt(aspect)
  }

  reset(): void {
    this.E.pool.reset()
    this.B.pool.reset()
    this.EB.pool.reset()
    this.P.pool.reset()
    this.G.pool.reset()
    this.N.pool.reset()
    this.S.pool.reset()
    this.r.clearStain()
    this.build = makeBuild()
    this.runT = 0
    this.kills = 0
    this.level = 1
    this.xp = 0
    this.xpNeed = xpForLevel(1)
    this.px = 0
    this.py = 0
    this.pvx = 0
    this.pvy = 0
    this.camX = 0
    this.camY = 0
    this.invuln = 2
    this.overcharge = 0
    this.revives = 0
    this.levelUps = 0
    this.curriculum.reset()
    this.bestMs = 0
    this.spawnAcc = 0
    this.wardenAt = 42
    this.tideAt = 74
    this.coreAt = 20
    this.coreLive = false
    this.q = null
    this.orbs.length = 0
    this.timeScale = 1
    this.timeScaleTarget = 1
    this.desat = 0
    this.feel.reset()
    this.ui.hideCards()
    this.ui.hideRift()
    this.ui.setPaused(false)
    this.syncHud()
  }

  destroy(): void {
    this.alive = false
    cancelAnimationFrame(this.raf)
    this.ro?.disconnect()
    window.removeEventListener("resize", this.onWinResize)
    this.guide.destroy()
    this.input.destroy()
    this.audio.destroy()
    this.r.destroy()
    this.ui.destroy()
    this.canvas.remove()
  }

  /* -------------------------------------------------------------- the loop */

  private tick = (now: number) => {
    if (!this.alive) return
    this.raf = requestAnimationFrame(this.tick)

    let frame = (now - this.lastT) / 1000
    this.lastT = now
    if (frame > 0.25) frame = 0.25
    const frameMs = frame * 1000

    this.fpsAcc += frame
    this.fpsN++
    if (this.fpsAcc >= 0.5) {
      this.fpsShown = this.fpsN / this.fpsAcc
      this.fpsAcc = 0
      this.fpsN = 0
      if (this.debug) {
        this.ui.setFps(
          `${this.fpsShown.toFixed(0)} fps  ${this.T.name}\n` +
          `${this.E.pool.n} foes  ${this.B.pool.n} shots\n` +
          `${this.P.pool.n} bits  ${this.r.spriteCount} quads`,
        )
      }
    }
    if (this.mode === "play") {
      const t = this.gov.sample(frameMs)
      if (t) this.downgrade(t)
    }

    this.wallT += frame
    this.audio.frame()
    this.input.update(frame)
    this.feel.update(frame)

    // Reading the rules is not playing. With the manual open the swarm holds
    // its shape, the rift clock stops, and the finger resting on the panel is
    // not a steer — a child who looks something up must not be eaten for it.
    // The renderer keeps drawing, so the world is still there behind the sheet.
    const reading = this.guide.isOpen
    if (!reading) this.keyboard()

    // Hitstop freezes the simulation, never the renderer.
    if (this.feel.hitstopMs > 0) {
      this.feel.hitstopMs -= frameMs
    } else {
      const simming = !reading && (this.mode === "play" || this.mode === "core")
      if (simming) {
        this.timeScale += (this.timeScaleTarget - this.timeScale) * Math.min(1, frame * 9)
        this.acc += frame
        let steps = 0
        while (this.acc >= STEP && steps < 4) {
          this.step(STEP)
          this.acc -= STEP
          steps++
        }
        if (steps === 4) this.acc = 0
      } else {
        this.acc = 0
      }
    }

    if (this.mode === "rift" && !reading) this.riftTick(frame)
    this.desat += ((this.mode === "rift" ? 0.85 : 0) - this.desat) * Math.min(1, frame * 6)

    this.draw(frame)
  }

  /** Desktop is deliberate: a keyboard plays the whole game, menus included. */
  private keyboard(): void {
    if (this.input.pressed("escape") || this.input.pressed("p")) {
      if (this.mode === "play" || this.mode === "paused") this.ui.onTogglePause()
    }
    if (this.mode === "title" || this.mode === "over") {
      if (this.input.pressed("enter") || this.input.pressed(" ")) {
        if (this.mode === "title") this.ui.onStart()
        else this.ui.onRestart()
      }
      return
    }
    if (this.mode === "levelup") {
      for (let i = 0; i < 3; i++) {
        if (this.input.pressed(String(i + 1))) this.pickCard(i)
      }
    }
    this.input.takeAnyPress()
  }

  private downgrade(name: TierName): void {
    console.warn(`[horde] frame budget missed — dropping to the ${name} tier`)
    this.T = tier(name)
    this.applyTier(this.T)
    this.r.setCapacity(this.T.maxInstances)
    // Entity pools keep their size: shrinking them mid-run would delete the
    // swarm the player is fighting. Only the ornament goes.
    this.resize()
  }

  /* ------------------------------------------------------------------ step */

  private step(rawDt: number): void {
    const dt = rawDt * this.timeScale
    // Bullet time slows the world, not the diver. That asymmetry *is* the
    // reward for reaching the core.
    const pdt = rawDt * (0.62 + 0.38 * this.timeScale)

    if (this.mode === "play") this.runT += dt
    const minutes = this.runT / 60

    this.movePlayer(pdt)
    this.buildGrid()
    this.updateEnemies(dt, minutes)
    this.fireWeapons(dt)
    this.updateBullets(dt)
    this.updateShocks(dt)
    this.updateGems(dt)
    this.updateParticles(rawDt)
    this.updateNumbers(rawDt)
    this.contact(dt)

    if (this.mode === "play") {
      this.director(dt, minutes)
      this.regen(dt)
      this.checkCore()
    }
    if (this.mode === "core") this.questTick(rawDt)

    if (this.overcharge > 0) {
      this.overcharge -= dt
      if (this.overcharge <= 0) this.ui.say("SPENT", "", "#8fb6d8")
    }
    if (this.invuln > 0) this.invuln -= dt
    if (this.hurtCd > 0) this.hurtCd -= dt

    this.audio.setIntensity(Math.min(1, minutes / 9 + (this.overcharge > 0 ? 0.3 : 0)))
  }

  private movePlayer(dt: number): void {
    const s = this.build.stats
    const st = this.input.stick
    const ax = st.x * s.speed
    const ay = st.y * s.speed
    // Heavy acceleration but a hard cap, so the diver feels weighty yet exact.
    const k = 1 - Math.pow(0.00004, dt)
    this.pvx += (ax - this.pvx) * k
    this.pvy += (ay - this.pvy) * k
    this.px += this.pvx * dt
    this.py += this.pvy * dt
    if (st.mag > 0.02) this.pAng = Math.atan2(this.pvy, this.pvx)

    // Wake bubbles.
    if (st.mag > 0.3 && this.rng() < 0.5) {
      this.particle(
        this.px - this.pvx * 0.04, this.py - this.pvy * 0.04,
        -this.pvx * 0.12 + (this.rng() - 0.5) * 26, -this.pvy * 0.12 + (this.rng() - 0.5) * 26,
        0.5, 5 + this.rng() * 4, 0.4, 0.85, 1.0, SHAPE.DISC, 0.3,
      )
    }
  }

  private buildGrid(): void {
    const pad = 260
    this.grid.configure(
      this.px - this.halfW - pad, this.py - this.halfH - pad,
      (this.halfW + pad) * 2, (this.halfH + pad) * 2, 46,
    )
    this.grid.build(this.E.pool.cap, this.E.pool.alive, this.E.x, this.E.y)
  }

  /* --------------------------------------------------------------- enemies */

  private updateEnemies(dt: number, minutes: number): void {
    const E = this.E
    const cap = E.pool.cap
    const sScale = speedScale(minutes)
    const far = (this.halfW + this.halfH) * 1.9

    for (let i = 0; i < cap; i++) {
      if (E.pool.alive[i] === 0) continue
      const def = ENEMIES[E.type[i]]
      let dx = this.px - E.x[i]
      let dy = this.py - E.y[i]
      const d2 = dx * dx + dy * dy
      const d = Math.sqrt(d2) || 1

      // Anything that wanders far outside the live region is recycled rather
      // than simulated forever.
      if (d > far) { E.pool.kill(i); continue }

      const spd = def.speed * sScale
      let wx = dx / d
      let wy = dy / d

      switch (def.behaviour) {
        case BEHAVIOUR.DART: {
          E.st[i] -= dt
          if (E.st[i] <= 0) { E.st[i] = 0.9 + this.rng() * 0.8; E.st2[i] = 0.42 }
          if (E.st2[i] > 0) { E.st2[i] -= dt; wx *= 2.1; wy *= 2.1 }
          break
        }
        case BEHAVIOUR.KEEP: {
          const want = 250
          if (d < want) { wx = -wx * 0.9; wy = -wy * 0.9 }
          else if (d < want + 90) { wx = -wy * 0.8; wy = wx * 0.8 }
          E.st[i] -= dt
          if (E.st[i] <= 0 && d < 520) {
            E.st[i] = 2.4 + this.rng() * 1.4
            this.enemyShot(E.x[i], E.y[i], dx / d, dy / d, 8 + minutes * 1.4)
          }
          break
        }
        case BEHAVIOUR.CHARGE: {
          E.st[i] -= dt
          if (E.st2[i] > 0) {
            // Committed dash: no steering, which is what makes it dodgeable.
            E.st2[i] -= dt
            E.vx[i] *= 1 - dt * 0.6
            E.vy[i] *= 1 - dt * 0.6
            E.x[i] += E.vx[i] * dt
            E.y[i] += E.vy[i] * dt
            E.rot[i] = Math.atan2(E.vy[i], E.vx[i])
            E.flash[i] = Math.max(E.flash[i], 0.25)
            if (E.hitCd[i] > 0) E.hitCd[i] -= dt
            continue
          }
          if (E.st[i] <= 0 && d < 460) {
            E.st[i] = 2.6 + this.rng() * 1.2
            E.st2[i] = 0.72
            E.vx[i] = (dx / d) * 780
            E.vy[i] = (dy / d) * 780
            this.audio.tick()
            for (let k = 0; k < 8; k++) {
              const a = this.rng() * Math.PI * 2
              this.particle(E.x[i], E.y[i], Math.cos(a) * 130, Math.sin(a) * 130, 0.3, 6, 1, 0.4, 0.15, SHAPE.SPARK, 0.5)
            }
          }
          break
        }
        case BEHAVIOUR.ORBIT: {
          const want = 150
          const tang = d < want + 60 ? 1 : 0.25
          const nx = -wy
          const ny = wx
          const pull = (d - want) / want
          wx = nx * tang + wx * pull
          wy = ny * tang + wy * pull
          break
        }
        case BEHAVIOUR.WARDEN: {
          E.st[i] -= dt
          if (E.st[i] <= 0) {
            E.st[i] = 3.6
            const n = 5
            for (let k = 0; k < n; k++) {
              const a = (k / n) * Math.PI * 2 + this.rng()
              this.spawnAt(
                E.x[i] + Math.cos(a) * 60, E.y[i] + Math.sin(a) * 60,
                this.rng() < 0.5 ? E_INDEX.darter : E_INDEX.drifter, minutes,
              )
            }
            this.shock(E.x[i], E.y[i], 130, 0, 0.4, 1, 1.0, 0.78, 0.3, 0)
          }
          break
        }
        default:
          break
      }

      const tvx = wx * spd
      const tvy = wy * spd
      const acc = 1 - Math.pow(0.02, dt)
      E.vx[i] += (tvx - E.vx[i]) * acc
      E.vy[i] += (tvy - E.vy[i]) * acc
      E.x[i] += E.vx[i] * dt
      E.y[i] += E.vy[i] * dt
      E.rot[i] += def.spin * dt + (def.behaviour === BEHAVIOUR.DART ? 0 : 0)
      if (def.behaviour === BEHAVIOUR.DART) E.rot[i] = Math.atan2(E.vy[i], E.vx[i]) - Math.PI / 2
      if (E.flash[i] > 0) E.flash[i] = Math.max(0, E.flash[i] - dt * 5.5)
      if (E.hitCd[i] > 0) E.hitCd[i] -= dt
    }

    this.separate(dt)
  }

  /** The horde has to look like a horde: bodies push each other apart. */
  private separate(dt: number): void {
    const E = this.E
    const g = this.grid
    const items = g.items
    const cols = g.cols
    const rows = g.rows
    const budget = this.T.separationBudget
    const push = 260 * dt

    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const c = cy * cols + cx
        const s0 = g.start(c)
        const e0 = g.end(c)
        if (e0 - s0 === 0) continue
        for (let a = s0; a < e0; a++) {
          const i = items[a]
          let used = 0
          // Same cell, later entries only — every pair is visited once.
          for (let b = a + 1; b < e0 && used < budget; b++) {
            if (this.pair(i, items[b], push)) used++
          }
          // Right, down-left, down, down-right — the standard half-neighbourhood.
          for (let n = 0; n < 4 && used < budget; n++) {
            const nx = cx + (n === 0 ? 1 : n === 1 ? -1 : n === 2 ? 0 : 1)
            const ny = cy + (n === 0 ? 0 : 1)
            if (nx < 0 || nx >= cols || ny >= rows) continue
            const c2 = ny * cols + nx
            const s1 = g.start(c2)
            const e1 = g.end(c2)
            for (let b = s1; b < e1 && used < budget; b++) {
              if (this.pair(i, items[b], push)) used++
            }
          }
        }
      }
    }
    void E
  }

  private pair(i: number, j: number, push: number): boolean {
    const E = this.E
    const dx = E.x[j] - E.x[i]
    const dy = E.y[j] - E.y[i]
    const want = E.radius[i] + E.radius[j]
    const d2 = dx * dx + dy * dy
    if (d2 >= want * want || d2 < 0.0001) return false
    const d = Math.sqrt(d2)
    const overlap = (want - d) / want
    const nx = dx / d
    const ny = dy / d
    const mi = ENEMIES[E.type[i]].massInv
    const mj = ENEMIES[E.type[j]].massInv
    const f = push * overlap
    E.x[i] -= nx * f * mi
    E.y[i] -= ny * f * mi
    E.x[j] += nx * f * mj
    E.y[j] += ny * f * mj
    return true
  }

  /* --------------------------------------------------------------- weapons */

  private fireWeapons(dt: number): void {
    const s = this.build.stats
    const rate = s.ratePct * (this.overcharge > 0 ? 2 : 1)
    const dmgPct = s.dmgPct * (this.overcharge > 0 ? 1.5 : 1)

    for (const w of this.build.weapons) {
      const cd = cooldown(w, rate) / 1000
      w.phase += dt
      switch (w.key) {
        case "splinter": {
          w.t -= dt
          if (w.t > 0) break
          w.t = cd
          const tgt = this.nearest(this.px, this.py, 900)
          const base = tgt >= 0 ? Math.atan2(this.E.y[tgt] - this.py, this.E.x[tgt] - this.px) : this.pAng
          const spread = Math.min(0.62, 0.09 * (w.count - 1))
          for (let k = 0; k < w.count; k++) {
            const a = base + (w.count === 1 ? 0 : (k / (w.count - 1) - 0.5) * 2 * spread)
            this.shot(a, 640, realDamage(w, dmgPct), w.pierce, 1.5, 0.62, 0.94, 1.0, 9, 0)
          }
          this.feel.kick(-Math.cos(base), -Math.sin(base), 0.7)
          break
        }
        case "swarm": {
          w.t -= dt
          if (w.t > 0) break
          w.t = cd
          for (let k = 0; k < w.count; k++) {
            const a = this.rng() * Math.PI * 2
            this.shot(a, 200 + this.rng() * 90, realDamage(w, dmgPct), w.pierce, 4.5, 1.0, 0.45, 0.82, 7, 1)
          }
          break
        }
        case "arc": {
          w.t -= dt
          if (w.t > 0) break
          w.t = cd
          this.arc(w.count, realDamage(w, dmgPct), reach(w, s.areaPct))
          break
        }
        case "pulse": {
          w.t -= dt
          if (w.t > 0) break
          w.t = cd
          this.shock(this.px, this.py, reach(w, s.areaPct), realDamage(w, dmgPct), 0.42, 1, 0.34, 1.0, 0.86, 340)
          this.audio.tick()
          this.feel.shake(0.1)
          break
        }
        case "spore": {
          w.t -= dt
          if (w.t > 0) break
          w.t = cd
          for (let k = 0; k < w.count; k++) {
            const a = this.rng() * Math.PI * 2
            const dst = 40 + this.rng() * 150
            const i = this.B.pool.spawn()
            if (i < 0) break
            this.B.x[i] = this.px + Math.cos(a) * dst
            this.B.y[i] = this.py + Math.sin(a) * dst
            this.B.vx[i] = 0
            this.B.vy[i] = 0
            this.B.life[i] = 1.5
            this.B.dmg[i] = realDamage(w, dmgPct)
            this.B.pierce[i] = 1
            this.B.kind[i] = 2
            this.B.crit[i] = 0
            this.B.rot[i] = 0
            this.B.tgt[i] = reach(w, s.areaPct)
            this.B.r[i] = 0.72; this.B.g[i] = 1.0; this.B.b[i] = 0.36
            this.B.size[i] = 11
          }
          break
        }
        case "halo": {
          const rad = reach(w, s.areaPct)
          const spin = w.phase * 2.1
          for (let k = 0; k < w.count; k++) {
            const a = spin + (k / w.count) * Math.PI * 2
            this.meleeHit(
              this.px + Math.cos(a) * rad, this.py + Math.sin(a) * rad,
              21, realDamage(w, dmgPct), 190,
            )
          }
          break
        }
        case "lance": {
          w.t -= dt
          if (w.t > 0) break
          w.t = cd
          const len = reach(w, s.areaPct)
          const spin = w.phase * 0.85
          for (let k = 0; k < w.count; k++) {
            const a = spin + (k / w.count) * Math.PI * 2
            const steps = Math.max(6, Math.floor(len / 40))
            for (let t = 1; t <= steps; t++) {
              const d = (t / steps) * len
              this.meleeHit(this.px + Math.cos(a) * d, this.py + Math.sin(a) * d, 26, realDamage(w, dmgPct), 90)
            }
          }
          break
        }
      }
    }
  }

  private shot(
    ang: number, speed: number, dmg: number, pierce: number, life: number,
    r: number, g: number, b: number, size: number, kind: number,
  ): number {
    const i = this.B.pool.spawn()
    if (i < 0) return -1
    const s = this.build.stats
    const crit = this.rng() * 100 < s.critPct
    this.B.x[i] = this.px
    this.B.y[i] = this.py
    this.B.vx[i] = Math.cos(ang) * speed
    this.B.vy[i] = Math.sin(ang) * speed
    this.B.life[i] = life
    this.B.dmg[i] = crit ? dmg * s.critMul : dmg
    this.B.pierce[i] = pierce
    this.B.kind[i] = kind
    this.B.crit[i] = crit ? 1 : 0
    this.B.rot[i] = ang
    this.B.tgt[i] = -1
    if (this.overcharge > 0) { this.B.r[i] = 1; this.B.g[i] = 0.82; this.B.b[i] = 0.34 }
    else { this.B.r[i] = r; this.B.g[i] = g; this.B.b[i] = b }
    this.B.size[i] = crit ? size * 1.5 : size
    return i
  }

  private enemyShot(x: number, y: number, dx: number, dy: number, dmg: number): void {
    const i = this.EB.pool.spawn()
    if (i < 0) return
    this.EB.x[i] = x
    this.EB.y[i] = y
    this.EB.vx[i] = dx * 210
    this.EB.vy[i] = dy * 210
    this.EB.life[i] = 5
    this.EB.dmg[i] = dmg
    this.EB.size[i] = 9
    this.EB.rot[i] = Math.atan2(dy, dx)
    this.audio.tick()
  }

  private arc(chains: number, dmg: number, range: number): void {
    let fx = this.px
    let fy = this.py
    let last = -1
    for (let c = 0; c < chains; c++) {
      const i = this.nearest(fx, fy, c === 0 ? range : 210, last)
      if (i < 0) break
      const ex = this.E.x[i]
      const ey = this.E.y[i]
      // Draw the bolt as a chain of short-lived sparks along the segment.
      const steps = Math.max(3, Math.floor(Math.hypot(ex - fx, ey - fy) / 26))
      for (let t = 0; t <= steps; t++) {
        const u = t / steps
        const jx = (this.rng() - 0.5) * 24
        const jy = (this.rng() - 0.5) * 24
        this.particle(
          fx + (ex - fx) * u + jx, fy + (ey - fy) * u + jy,
          0, 0, 0.16, 8, 0.76, 0.66, 1.0, SHAPE.SPARK, 0.9,
        )
      }
      this.damage(i, dmg, this.rng() * 100 < this.build.stats.critPct, fx, fy, 60)
      fx = ex
      fy = ey
      last = i
    }
    if (last >= 0) this.audio.hit()
  }

  /** Damage everything inside a radius, respecting the shared contact cooldown. */
  private meleeHit(x: number, y: number, rad: number, dmg: number, knock: number): void {
    const g = this.grid
    const E = this.E
    g.range(x, y, rad + 48, this.range)
    for (let cy = this.range[1]; cy <= this.range[3]; cy++) {
      for (let cx = this.range[0]; cx <= this.range[2]; cx++) {
        const c = cy * g.cols + cx
        for (let k = g.start(c); k < g.end(c); k++) {
          const i = g.items[k]
          if (E.hitCd[i] > 0) continue
          const dx = E.x[i] - x
          const dy = E.y[i] - y
          const rr = rad + E.radius[i]
          if (dx * dx + dy * dy > rr * rr) continue
          E.hitCd[i] = 0.16
          this.damage(i, dmg, this.rng() * 100 < this.build.stats.critPct, x, y, knock)
        }
      }
    }
  }

  private nearest(x: number, y: number, maxR: number, exclude = -1): number {
    const g = this.grid
    const E = this.E
    g.range(x, y, maxR, this.range)
    let best = -1
    let bestD = maxR * maxR
    for (let cy = this.range[1]; cy <= this.range[3]; cy++) {
      for (let cx = this.range[0]; cx <= this.range[2]; cx++) {
        const c = cy * g.cols + cx
        for (let k = g.start(c); k < g.end(c); k++) {
          const i = g.items[k]
          if (i === exclude) continue
          const dx = E.x[i] - x
          const dy = E.y[i] - y
          const d2 = dx * dx + dy * dy
          if (d2 < bestD) { bestD = d2; best = i }
        }
      }
    }
    return best
  }

  /* --------------------------------------------------------------- bullets */

  private updateBullets(dt: number): void {
    const B = this.B
    const E = this.E
    const g = this.grid
    for (let i = 0; i < B.pool.cap; i++) {
      if (B.pool.alive[i] === 0) continue
      B.life[i] -= dt
      if (B.life[i] <= 0) {
        if (B.kind[i] === 2) {
          // A spore pod blooms when its fuse runs out.
          this.shock(B.x[i], B.y[i], B.tgt[i], B.dmg[i], 0.36, 2, 0.72, 1.0, 0.36, 180)
          this.audio.hit()
        }
        B.pool.kill(i)
        continue
      }

      if (B.kind[i] === 1) {
        // Homing mote: re-acquire when its mark dies.
        if (B.tgt[i] < 0 || E.pool.alive[B.tgt[i]] === 0) B.tgt[i] = this.nearest(B.x[i], B.y[i], 520)
        if (B.tgt[i] >= 0) {
          const dx = E.x[B.tgt[i]] - B.x[i]
          const dy = E.y[B.tgt[i]] - B.y[i]
          const d = Math.hypot(dx, dy) || 1
          const want = 380
          B.vx[i] += ((dx / d) * want - B.vx[i]) * Math.min(1, dt * 5.5)
          B.vy[i] += ((dy / d) * want - B.vy[i]) * Math.min(1, dt * 5.5)
        }
        B.rot[i] = Math.atan2(B.vy[i], B.vx[i])
      }

      if (B.kind[i] !== 2) {
        B.x[i] += B.vx[i] * dt
        B.y[i] += B.vy[i] * dt
      }

      if (B.kind[i] === 2) continue // pods only detonate

      const rad = B.size[i] * 0.9
      g.range(B.x[i], B.y[i], rad + 50, this.range)
      let done = false
      for (let cy = this.range[1]; cy <= this.range[3] && !done; cy++) {
        for (let cx = this.range[0]; cx <= this.range[2] && !done; cx++) {
          const c = cy * g.cols + cx
          for (let k = g.start(c); k < g.end(c); k++) {
            const j = g.items[k]
            const dx = E.x[j] - B.x[i]
            const dy = E.y[j] - B.y[i]
            const rr = rad + E.radius[j]
            if (dx * dx + dy * dy > rr * rr) continue
            this.damage(j, B.dmg[i], B.crit[i] === 1, B.x[i], B.y[i], 150)
            if (--B.pierce[i] <= 0) { B.pool.kill(i); done = true; break }
          }
        }
      }
    }

    // Enemy fire.
    const EB = this.EB
    for (let i = 0; i < EB.pool.cap; i++) {
      if (EB.pool.alive[i] === 0) continue
      EB.life[i] -= dt
      EB.x[i] += EB.vx[i] * dt
      EB.y[i] += EB.vy[i] * dt
      if (EB.life[i] <= 0) { EB.pool.kill(i); continue }
      const dx = EB.x[i] - this.px
      const dy = EB.y[i] - this.py
      if (dx * dx + dy * dy < 22 * 22) {
        this.hurt(EB.dmg[i])
        EB.pool.kill(i)
      }
    }
  }

  private shock(
    x: number, y: number, rMax: number, dmg: number, life: number, kind: number,
    r: number, g: number, b: number, knock: number,
  ): void {
    const i = this.S.pool.spawn()
    if (i < 0) return
    this.S.x[i] = x
    this.S.y[i] = y
    this.S.r[i] = 6
    this.S.rMax[i] = rMax
    this.S.dmg[i] = dmg
    this.S.life[i] = life
    this.S.max[i] = life
    this.S.kind[i] = kind
    this.S.cr[i] = r
    this.S.cg[i] = g
    this.S.cb[i] = b
    this.S.knock[i] = knock
  }

  private updateShocks(dt: number): void {
    const S = this.S
    const E = this.E
    const g = this.grid
    for (let i = 0; i < S.pool.cap; i++) {
      if (S.pool.alive[i] === 0) continue
      const prev = S.r[i]
      S.life[i] -= dt
      const u = 1 - Math.max(0, S.life[i]) / S.max[i]
      S.r[i] = S.rMax[i] * (1 - Math.pow(1 - u, 2.6))
      if (S.life[i] <= 0) { S.pool.kill(i); continue }
      if (S.dmg[i] <= 0) continue

      g.range(S.x[i], S.y[i], S.r[i] + 48, this.range)
      for (let cy = this.range[1]; cy <= this.range[3]; cy++) {
        for (let cx = this.range[0]; cx <= this.range[2]; cx++) {
          const c = cy * g.cols + cx
          for (let k = g.start(c); k < g.end(c); k++) {
            const j = g.items[k]
            const dx = E.x[j] - S.x[i]
            const dy = E.y[j] - S.y[i]
            const d = Math.hypot(dx, dy)
            // Only the leading edge of the ring bites, so it reads as a wave.
            if (d > S.r[i] + E.radius[j] || d < prev - E.radius[j] - 10) continue
            if (E.hitCd[j] > 0) continue
            E.hitCd[j] = 0.22
            this.damage(j, S.dmg[i], false, S.x[i], S.y[i], S.knock[i])
          }
        }
      }
    }
  }

  /* ---------------------------------------------------------------- damage */

  private damage(i: number, amount: number, crit: boolean, sx: number, sy: number, knock: number): void {
    const E = this.E
    if (E.pool.alive[i] === 0) return
    const dmg = crit ? amount * this.build.stats.critMul : amount
    E.hp[i] -= dmg
    E.flash[i] = 1

    const dx = E.x[i] - sx
    const dy = E.y[i] - sy
    const d = Math.hypot(dx, dy) || 1
    const mi = ENEMIES[E.type[i]].massInv
    E.vx[i] += (dx / d) * knock * mi
    E.vy[i] += (dy / d) * knock * mi

    this.number(E.x[i], E.y[i] - E.radius[i], Math.round(dmg), crit)

    const hard = this.P.pool.n > this.T.maxParticles * 0.8
    const n = hard ? 1 : Math.round((crit ? 7 : 3) * this.T.particleScale)
    for (let k = 0; k < n; k++) {
      const a = Math.atan2(dy, dx) + (this.rng() - 0.5) * 1.5
      const sp = 90 + this.rng() * 190
      this.particle(
        E.x[i], E.y[i], Math.cos(a) * sp, Math.sin(a) * sp, 0.3 + this.rng() * 0.2,
        4 + this.rng() * 4, 1, 1, 1, SHAPE.SPARK, 0.85,
      )
    }
    this.audio.hit()

    if (E.hp[i] <= 0) this.slay(i)
  }

  private slay(i: number): void {
    const E = this.E
    const def = ENEMIES[E.type[i]]
    const x = E.x[i]
    const y = E.y[i]
    const [cr, cg, cb] = def.col
    this.kills++

    const burst = Math.round((def.elite ? 60 : 8) * this.T.particleScale)
    for (let k = 0; k < burst; k++) {
      const a = this.rng() * Math.PI * 2
      const sp = (def.elite ? 240 : 110) * (0.35 + this.rng())
      this.particle(
        x, y, Math.cos(a) * sp, Math.sin(a) * sp,
        0.35 + this.rng() * (def.elite ? 0.9 : 0.35),
        (def.elite ? 9 : 4) + this.rng() * 6,
        cr, cg, cb, this.rng() < 0.4 ? SHAPE.SPARK : SHAPE.DISC, 0.4,
      )
    }
    this.r.stain(x, y, def.radius * (def.elite ? 3.4 : 1.9), cr * 0.16, cg * 0.16, cb * 0.16, def.elite ? 0.5 : 0.16)

    if (def.elite) {
      this.audio.killBig()
      this.feel.shake(0.5)
      this.feel.stop(70)
      this.feel.punch(0.4)
      this.feel.flash(1, 0.85, 0.5, 0.2)
      this.host.haptic("heavy")
      this.shock(x, y, 320, 0, 0.55, 1, 1, 0.82, 0.32, 0)
      this.ui.say("WARDEN FELLED", "THE LIGHT IS YOURS", "#ffd166")
      // The vacuum moment: every gem on the field comes to you at once.
      for (let k = 0; k < this.G.pool.cap; k++) if (this.G.pool.alive[k] === 1) this.G.pulled[k] = 1
      this.dropCore(x, y)
    } else {
      this.audio.kill()
      this.feel.shake(0.035)
    }

    // Splitters seed the next wave from their own corpse.
    if (def.behaviour === BEHAVIOUR.SPLIT) {
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + this.rng()
        const j = this.spawnAt(x + Math.cos(a) * 26, y + Math.sin(a) * 26, E_INDEX.sporeling, this.runT / 60)
        if (j >= 0) {
          this.E.vx[j] = Math.cos(a) * 220
          this.E.vy[j] = Math.sin(a) * 220
        }
      }
    }

    this.dropGem(x, y, def.xp)
    E.pool.kill(i)
  }

  private hurt(amount: number): void {
    if (this.invuln > 0 || this.mode !== "play") return
    const s = this.build.stats
    const dmg = Math.max(1, amount - s.armor)
    s.hp -= dmg
    if (this.hurtCd <= 0) {
      this.hurtCd = 0.24
      this.audio.hurt()
      this.host.haptic("medium")
      this.feel.shake(0.24)
      // A directional kick rather than hitstop: being hurt must never be the
      // slow, emphatic moment.
      this.feel.kick(this.pvx, this.pvy, 2.4)
      this.feel.flash(1, 0.28, 0.4, 0.1, 9)
    }
    this.ui.setLife(s.hp, s.maxHp)
    if (s.hp <= 0) this.die()
  }

  private regen(dt: number): void {
    const s = this.build.stats
    if (s.regenPer10s > 0 && s.hp < s.maxHp) {
      s.hp = Math.min(s.maxHp, s.hp + (s.regenPer10s / 10) * dt)
      this.ui.setLife(s.hp, s.maxHp)
    }
  }

  private contact(dt: number): void {
    const g = this.grid
    const E = this.E
    g.range(this.px, this.py, 70, this.range)
    let touch = 0
    for (let cy = this.range[1]; cy <= this.range[3]; cy++) {
      for (let cx = this.range[0]; cx <= this.range[2]; cx++) {
        const c = cy * g.cols + cx
        for (let k = g.start(c); k < g.end(c); k++) {
          const i = g.items[k]
          const dx = E.x[i] - this.px
          const dy = E.y[i] - this.py
          const rr = 15 + E.radius[i]
          if (dx * dx + dy * dy > rr * rr) continue
          touch += ENEMIES[E.type[i]].dps
        }
      }
    }
    if (touch > 0) this.hurt(touch * dt)
  }

  /* ------------------------------------------------------------------ gems */

  private dropGem(x: number, y: number, value: number): void {
    const i = this.G.pool.spawn()
    if (i < 0) return
    const a = this.rng() * Math.PI * 2
    this.G.x[i] = x
    this.G.y[i] = y
    this.G.vx[i] = Math.cos(a) * 70
    this.G.vy[i] = Math.sin(a) * 70
    this.G.value[i] = value
    this.G.t[i] = 0
    this.G.pulled[i] = 0
  }

  private updateGems(dt: number): void {
    const G = this.G
    const s = this.build.stats
    const mag = s.magnet
    for (let i = 0; i < G.pool.cap; i++) {
      if (G.pool.alive[i] === 0) continue
      G.t[i] += dt
      const dx = this.px - G.x[i]
      const dy = this.py - G.y[i]
      const d = Math.hypot(dx, dy) || 1
      if (G.pulled[i] === 1 || d < mag) {
        G.pulled[i] = 1
        const pull = 240 + (1 - Math.min(1, d / 420)) * 900
        G.vx[i] += (dx / d) * pull * dt
        G.vy[i] += (dy / d) * pull * dt
      } else {
        G.vx[i] *= 1 - Math.min(1, dt * 3.2)
        G.vy[i] *= 1 - Math.min(1, dt * 3.2)
      }
      G.x[i] += G.vx[i] * dt
      G.y[i] += G.vy[i] * dt
      if (d < 22) {
        this.gain(G.value[i])
        this.audio.pickup()
        for (let k = 0; k < 2; k++) {
          this.particle(G.x[i], G.y[i], (this.rng() - 0.5) * 90, (this.rng() - 0.5) * 90, 0.25, 4, 0.4, 1, 0.86, SHAPE.SPARK, 0.8)
        }
        G.pool.kill(i)
      }
    }
  }

  private gain(v: number): void {
    this.xp += Math.max(1, Math.round((v * this.build.stats.xpPct) / 100))
    while (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed
      this.level++
      this.xpNeed = xpForLevel(this.level)
      this.levelUp()
    }
    this.ui.setXp(this.xp / this.xpNeed)
    this.ui.setKills(this.kills)
  }

  /* -------------------------------------------------------------- particles */

  private particle(
    x: number, y: number, vx: number, vy: number, life: number, size: number,
    r: number, g: number, b: number, shape: number, drag: number,
  ): void {
    const i = this.P.pool.spawn()
    if (i < 0) return
    const P = this.P
    P.x[i] = x; P.y[i] = y; P.vx[i] = vx; P.vy[i] = vy
    P.life[i] = life; P.max[i] = life; P.size[i] = size
    P.r[i] = r; P.g[i] = g; P.b[i] = b
    P.rot[i] = this.rng() * 6.28
    P.spin[i] = (this.rng() - 0.5) * 9
    P.drag[i] = drag
    P.shape[i] = shape
    P.glow[i] = 0.4
  }

  private updateParticles(dt: number): void {
    const P = this.P
    for (let i = 0; i < P.pool.cap; i++) {
      if (P.pool.alive[i] === 0) continue
      P.life[i] -= dt
      if (P.life[i] <= 0) { P.pool.kill(i); continue }
      const k = 1 - Math.pow(P.drag[i] * 0.02 + 0.0002, dt)
      P.vx[i] -= P.vx[i] * k
      P.vy[i] -= P.vy[i] * k
      P.x[i] += P.vx[i] * dt
      P.y[i] += P.vy[i] * dt
      P.rot[i] += P.spin[i] * dt
    }
  }

  private number(x: number, y: number, value: number, crit: boolean): void {
    if (!crit && this.N.pool.n > this.T.maxNumbers * 0.82) return
    const i = this.N.pool.spawn()
    if (i < 0) return
    const N = this.N
    N.x[i] = x + (this.rng() - 0.5) * 14
    N.y[i] = y
    N.vy[i] = crit ? -150 : -96
    N.vx[i] = (this.rng() - 0.5) * 46
    N.life[i] = crit ? 0.95 : 0.62
    N.max[i] = N.life[i]
    N.value[i] = Math.max(1, value)
    N.crit[i] = crit ? 1 : 0
    if (crit) { N.r[i] = 1; N.g[i] = 0.82; N.b[i] = 0.24 }
    else { N.r[i] = 0.86; N.g[i] = 0.96; N.b[i] = 1 }
  }

  private updateNumbers(dt: number): void {
    const N = this.N
    for (let i = 0; i < N.pool.cap; i++) {
      if (N.pool.alive[i] === 0) continue
      N.life[i] -= dt
      if (N.life[i] <= 0) { N.pool.kill(i); continue }
      N.y[i] += N.vy[i] * dt
      N.x[i] += N.vx[i] * dt
      N.vy[i] += 190 * dt
    }
  }

  /* -------------------------------------------------------------- director */

  private spawnAt(x: number, y: number, type: number, minutes: number): number {
    const i = this.E.pool.spawn()
    if (i < 0) return -1
    const def = ENEMIES[type]
    const E = this.E
    E.x[i] = x
    E.y[i] = y
    E.vx[i] = 0
    E.vy[i] = 0
    E.type[i] = type
    E.hp[i] = Math.round(def.hp * hpScale(minutes))
    E.maxHp[i] = E.hp[i]
    E.radius[i] = def.radius
    E.flash[i] = 0.6
    E.hitCd[i] = 0
    E.rot[i] = this.rng() * 6.28
    E.st[i] = this.rng() * 2
    E.st2[i] = 0
    E.born[i] = this.runT
    return i
  }

  private spawnRing(count: number, type: number, minutes: number, angle: number, spread: number): void {
    const rad = Math.max(this.halfW, this.halfH) * 1.16
    for (let k = 0; k < count; k++) {
      const a = angle + (count === 1 ? 0 : (k / count - 0.5) * spread)
      const jitter = 1 + (this.rng() - 0.5) * 0.14
      this.spawnAt(this.px + Math.cos(a) * rad * jitter, this.py + Math.sin(a) * rad * jitter, type, minutes)
    }
  }

  private pickType(minutes: number): number {
    let total = 0
    for (const e of ENEMIES) if (minutes >= e.from) total += e.weight
    let r = this.rng() * total
    for (let i = 0; i < ENEMIES.length; i++) {
      if (minutes < ENEMIES[i].from) continue
      r -= ENEMIES[i].weight
      if (r <= 0) return i
    }
    return 0
  }

  private director(dt: number, minutes: number): void {
    const want = targetPopulation(minutes, this.T.maxEnemies - 40)
    const deficit = want - this.E.pool.n
    if (deficit > 0) {
      this.spawnAcc += dt * (7 + minutes * 5)
      const n = Math.min(Math.floor(this.spawnAcc), deficit, 14)
      if (n > 0) {
        this.spawnAcc -= n
        const a = this.rng() * Math.PI * 2
        const type = this.pickType(minutes)
        this.spawnRing(n, type, minutes, a, 1.1)
      }
    }

    if (this.runT >= this.wardenAt) {
      this.wardenAt += Math.max(34, 62 - minutes * 2)
      const a = this.rng() * Math.PI * 2
      this.spawnRing(1, E_INDEX.warden, minutes, a, 0)
      this.ui.say("WARDEN", "SOMETHING BIG IS AWAKE", "#ffd166")
      this.audio.warn()
      this.feel.shake(0.32)
      this.host.haptic("heavy")
    }

    if (this.runT >= this.tideAt) {
      this.tideAt += Math.max(38, 78 - minutes * 2.5)
      const a = this.rng() * Math.PI * 2
      const type = minutes > 5 ? this.pickType(minutes) : E_INDEX.drifter
      this.spawnRing(Math.min(90, 22 + Math.floor(minutes * 7)), type, minutes, a, 0.85)
      this.ui.say("A TIDE", "IT IS COMING FROM ONE SIDE", "#7fe6ff")
      this.audio.warn()
    }

    if (!this.coreLive && this.runT >= this.coreAt) {
      const a = this.rng() * Math.PI * 2
      const d = 300 + this.rng() * 190
      this.dropCore(this.px + Math.cos(a) * d, this.py + Math.sin(a) * d)
    }
  }

  private dropCore(x: number, y: number): void {
    if (this.coreLive) return
    this.coreLive = true
    this.coreX = x
    this.coreY = y
    this.corePhase = 0
    this.coreAt = this.runT + 40
    this.audio.coreOpen()
    this.ui.say("A CORE", "SWIM INTO IT", "#ffd166")
    this.shock(x, y, 260, 0, 0.7, 1, 1, 0.82, 0.34, 0)
  }

  /* ------------------------------------------------------------ the core Q */

  private openQuestion(): void {
    const q = this.curriculum.ask(this.host)
    this.q = q
    this.qAnswered = false
    // The window widens with the arithmetic; it never narrows. Time here is
    // measured, not budgeted.
    this.qTMax = this.curriculum.thinkingSeconds()
    this.qT = this.qTMax
    this.qStart = performance.now()
    this.mode = "core"
    this.timeScaleTarget = 0.15
    this.coreLive = false
    this.audio.duck(0.55, 0.5)
    this.audio.coreOpen()
    this.host.haptic("light")
    this.feel.flash(1, 0.85, 0.45, 0.16)
    this.feel.punch(-0.2)

    const opts = [q.answer, ...q.distractors.slice(0, 2)]
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1))
      const t = opts[i]; opts[i] = opts[j]; opts[j] = t
    }
    this.orbs.length = 0
    const base = this.rng() * Math.PI * 2
    for (let i = 0; i < opts.length; i++) {
      this.orbs.push({
        x: 0, y: 0,
        ang: base + (i / opts.length) * Math.PI * 2,
        text: opts[i],
        correct: opts[i] === q.answer,
        state: 0,
        t: 0,
      })
    }
  }

  private questTick(dt: number): void {
    this.qT -= dt
    const rad = 172
    for (const o of this.orbs) {
      o.ang += dt * 0.42
      o.x = this.px + Math.cos(o.ang) * rad
      o.y = this.py + Math.sin(o.ang) * rad
      if (o.state !== 0) { o.t += dt; continue }
      if (this.qAnswered) continue
      const dx = o.x - this.px
      const dy = o.y - this.py
      // The orbit is a fixed distance away; you reach one by *swimming out*
      // to it, which is the same verb as everything else in the game.
      const px = this.px + this.pvx * 0.06
      const py = this.py + this.pvy * 0.06
      if ((o.x - px) * (o.x - px) + (o.y - py) * (o.y - py) < 40 * 40) {
        void dx; void dy
        this.answer(o)
      }
    }
    if (!this.qAnswered && this.qT <= 0) this.closeQuestion(null)
  }

  private answer(o: Orb): void {
    if (this.qAnswered || !this.q) return
    this.qAnswered = true
    const ms = performance.now() - this.qStart
    if (!this.bestMs || ms < this.bestMs) this.bestMs = ms
    o.state = o.correct ? 1 : 2
    this.curriculum.answered(this.host, this.q, o.text, o.correct, ms)
    if (!o.correct) for (const other of this.orbs) if (other.correct) other.state = 1

    if (o.correct) {
      this.audio.answerRight()
      this.audio.overcharge()
      this.host.haptic("success")
      this.overcharge = 9
      this.feel.stop(110)
      this.feel.shake(0.72)
      this.feel.punch(0.55)
      this.feel.flash(1, 0.9, 0.55, 0.32, 3.4)
      this.ui.say("OVERCHARGE", "NINE SECONDS OF RUIN", "#ffe08a")
      const big = Math.max(this.halfW, this.halfH) * 1.55
      this.shock(this.px, this.py, big, 9999, 0.85, 1, 1, 0.86, 0.4, 620)
      for (let k = 0; k < Math.round(120 * this.T.particleScale); k++) {
        const a = this.rng() * Math.PI * 2
        const sp = 220 + this.rng() * 780
        this.particle(this.px, this.py, Math.cos(a) * sp, Math.sin(a) * sp, 0.5 + this.rng() * 0.7, 6 + this.rng() * 9, 1, 0.86, 0.42, this.rng() < 0.5 ? SHAPE.SPARK : SHAPE.DISC, 0.5)
      }
    } else {
      this.audio.answerWrong()
      this.host.haptic("failure")
      this.feel.shake(0.4)
      this.feel.kick(o.x - this.px, o.y - this.py, 3)
      this.feel.flash(0.9, 0.3, 0.5, 0.1, 8)
      this.ui.say("THE SWARM ANSWERS", "THE GOLD ONE WAS THE ONE", "#ff9ab6")
      // The cost is real and it is legible: a pack lands on top of you.
      const minutes = this.runT / 60
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2
        this.spawnAt(this.px + Math.cos(a) * 190, this.py + Math.sin(a) * 190, this.pickType(minutes), minutes)
      }
      for (let k = 0; k < Math.round(40 * this.T.particleScale); k++) {
        const a = this.rng() * Math.PI * 2
        this.particle(o.x, o.y, Math.cos(a) * 260, Math.sin(a) * 260, 0.5, 6, 1, 0.32, 0.5, SHAPE.SPARK, 0.6)
      }
    }
    // A short beat to read the result, then back to the fight.
    window.setTimeout(() => this.closeQuestion(o), 620)
  }

  private closeQuestion(o: Orb | null): void {
    if (this.mode !== "core") return
    if (!o) {
      this.ui.say("IT CLOSED", "", "#8fb6d8")
      this.audio.tick()
      // Nothing is reported. The child did not answer, so there is no answer to
      // file, and filing an empty one would record them as not knowing a skill
      // they may simply have been slow to reach. See curriculum.ts.
      if (this.q) this.curriculum.expired()
    }
    this.q = null
    this.orbs.length = 0
    this.mode = "play"
    this.timeScaleTarget = 1
  }

  /* -------------------------------------------------------------- level up */

  private levelUp(): void {
    this.levelUps++
    this.ui.setLevel(this.level)
    this.audio.levelup()
    this.audio.duck(0.4, 0.4)
    this.host.haptic("success")
    this.feel.flash(0.6, 0.95, 1, 0.22, 4)
    this.feel.punch(0.3)
    this.feel.stop(70)
    this.mode = "levelup"
    this.timeScale = 1
    this.timeScaleTarget = 1

    this.cards = rollCards(this.build, this.rng, 3, this.runT / 60)
    this.sealedQ = null
    if (this.levelUps % 3 === 0) {
      this.sealedQ = this.curriculum.ask(this.host)
    }
    this.ui.showCards(this.cards, this.sealedQ, this.level)
  }

  private pickCard(i: number): void {
    const c = this.cards[i]
    if (!c) return
    c.apply()
    this.audio.card()
    this.host.haptic("light")
    this.ui.hideCards()
    this.ui.say(c.title, c.tag, "#9fe8ff")
    this.feel.punch(0.22)
    this.syncHud()
    this.mode = "play"
    this.lastT = performance.now()
    this.acc = 0
  }

  private sealedAnswer(res: { correct: boolean; ms: number; answered: string }): void {
    if (!this.sealedQ) return
    this.curriculum.answered(this.host, this.sealedQ, res.answered, res.correct, res.ms)
    if (res.correct) {
      this.audio.evolve()
      this.host.haptic("success")
      const reward = rollCards(this.build, this.rng, 1, this.runT / 60, true)[0]
      reward.apply()
      this.feel.flash(1, 0.88, 0.5, 0.28, 3.6)
      this.feel.punch(0.5)
      this.feel.shake(0.4)
      window.setTimeout(() => {
        this.ui.hideCards()
        this.ui.say(reward.title, `${reward.tag} — SEALED CACHE`, "#ffd166")
        this.syncHud()
        this.mode = "play"
        this.lastT = performance.now()
        this.acc = 0
      }, 520)
    } else {
      this.audio.answerWrong()
      this.host.haptic("failure")
    }
    this.sealedQ = null
  }

  /* ------------------------------------------------------------------ rift */

  private die(): void {
    if (this.mode === "rift" || this.mode === "over") return
    this.build.stats.hp = 0
    this.audio.death()
    this.host.haptic("failure")
    this.feel.shake(0.6)
    this.feel.flash(0.9, 0.35, 0.55, 0.16, 3)
    for (let k = 0; k < Math.round(90 * this.T.particleScale); k++) {
      const a = this.rng() * Math.PI * 2
      const sp = 120 + this.rng() * 420
      this.particle(this.px, this.py, Math.cos(a) * sp, Math.sin(a) * sp, 0.8 + this.rng(), 7, 1, 0.94, 0.7, SHAPE.SPARK, 0.4)
    }
    this.mode = "rift"
    this.riftNeeded = this.revives + 1
    this.riftCharges = 0
    this.riftT = 20 + this.riftNeeded * 6
    this.audio.riftOpen()
    this.audio.duck(0.35, 0.8)
    this.nextRiftQuestion()
  }

  private nextRiftQuestion(): void {
    // A rift question is asked of a child who has just died, so it sits one
    // step below what the run has earned. It is still earned, not clocked.
    this.riftQ = this.curriculum.ask(this.host, -1)
    this.ui.showRift(this.riftQ, this.riftCharges, this.riftNeeded)
  }

  private riftAnswer(res: { correct: boolean; ms: number; answered: string }): void {
    if (!this.riftQ) return
    this.curriculum.answered(this.host, this.riftQ, res.answered, res.correct, res.ms)
    if (res.correct) {
      this.riftCharges++
      this.audio.answerRight()
      this.host.haptic("success")
      this.feel.flash(1, 0.9, 0.6, 0.2)
    } else {
      // Progress is never taken away. Time is: the cost is real, and it is
      // the one cost a child can see draining.
      this.riftT = Math.max(1.5, this.riftT - 4)
      this.audio.answerWrong()
      this.host.haptic("failure")
    }
    window.setTimeout(() => {
      if (this.mode !== "rift") return
      if (this.riftCharges >= this.riftNeeded) this.revive()
      else this.nextRiftQuestion()
    }, res.correct ? 480 : 900)
  }

  private riftTick(dt: number): void {
    this.riftT -= dt
    this.ui.setRiftClock(this.riftT / (20 + this.riftNeeded * 6))
    if (this.riftT <= 0) this.over()
  }

  private revive(): void {
    this.revives++
    this.ui.hideRift()
    this.mode = "play"
    this.lastT = performance.now()
    this.acc = 0
    const s = this.build.stats
    s.hp = s.maxHp
    this.invuln = 3.5
    this.audio.revive()
    this.audio.nova()
    this.host.haptic("success")
    this.feel.stop(140)
    this.feel.shake(0.85)
    this.feel.punch(0.7)
    this.feel.flash(1, 0.95, 0.8, 0.34, 2.6)
    this.ui.say("RISEN", "THE RIFT HELD", "#ffe6a8")
    this.shock(this.px, this.py, Math.max(this.halfW, this.halfH) * 1.7, 9999, 0.9, 1, 1, 0.95, 0.7, 900)
    for (let k = 0; k < Math.round(160 * this.T.particleScale); k++) {
      const a = this.rng() * Math.PI * 2
      const sp = 260 + this.rng() * 900
      this.particle(this.px, this.py, Math.cos(a) * sp, Math.sin(a) * sp, 0.6 + this.rng() * 0.8, 7 + this.rng() * 10, 1, 0.95, 0.75, SHAPE.SPARK, 0.45)
    }
    this.ui.setLife(s.hp, s.maxHp)
  }

  private over(): void {
    this.mode = "over"
    this.ui.hideRift()
    try {
      this.best = Math.max(this.best, Number(localStorage.getItem("hz.best") || 0))
    } catch { /* storage can be denied; the run still counts */ }
    if (this.runT > this.best) {
      this.best = this.runT
      try {
        localStorage.setItem("hz.best", String(Math.round(this.best)))
      } catch { /* denied storage loses the record between sittings, not within one */ }
    }
    const best = this.best
    const mm = Math.floor(this.runT / 60)
    const ss = Math.floor(this.runT % 60)
    this.ui.showOver(
      [
        { label: "SURVIVED", value: `${mm}:${ss < 10 ? "0" : ""}${ss}` },
        { label: "SLAIN", value: String(this.kills) },
        { label: "LEVEL", value: String(this.level) },
        { label: "ANSWERED", value: `${this.curriculum.solved}/${this.curriculum.answeredCount}` },
        { label: "BEST", value: `${Math.floor(best / 60)}:${String(Math.floor(best % 60)).padStart(2, "0")}` },
      ],
      "THE DARK TOOK YOU",
    )
  }

  private syncHud(): void {
    const s = this.build.stats
    this.ui.setLife(s.hp, s.maxHp)
    this.ui.setLevel(this.level)
    this.ui.setXp(this.xp / this.xpNeed)
    this.ui.setKills(this.kills)
    this.ui.setWeapons(
      this.build.weapons.map((w) => `${w.name} <b>${w.count}×${realDamage(w, s.dmgPct)}</b>`),
    )
  }

  /* ------------------------------------------------------------------ draw */

  private draw(frame: number): void {
    const zoom = this.feel.zoom
    const hw = this.halfW / zoom
    const hh = this.halfH / zoom

    // Camera leads the diver so you can see where you are going.
    const leadX = this.px + this.pvx * 0.14
    const leadY = this.py + this.pvy * 0.14
    const k = Math.min(1, frame * 7.5)
    this.camX += (leadX - this.camX) * k
    this.camY += (leadY - this.camY) * k
    this.feel.shakeOffset(this.shakeOut, (hw * 2) / Math.max(1, this.r.w), this.wallT)

    const r = this.r
    r.beginFrame(this.camX + this.shakeOut[0] + this.feel.kickX, this.camY + this.shakeOut[1] + this.feel.kickY, hw, hh)

    const minX = this.camX - hw - 90
    const maxX = this.camX + hw + 90
    const minY = this.camY - hh - 90
    const maxY = this.camY + hh + 90
    const t = this.wallT

    /* stains and ground-level shocks first (order is cosmetic under additive) */
    const S = this.S
    for (let i = 0; i < S.pool.cap; i++) {
      if (S.pool.alive[i] === 0) continue
      const u = 1 - S.life[i] / S.max[i]
      const a = (1 - u) * (1 - u) * 0.95
      const rr = S.r[i]
      r.sprite(S.x[i], S.y[i], rr, rr, 0, S.cr[i], S.cg[i], S.cb[i], a, SHAPE.RING, 0.1 + u * 0.16, 0.3)
      r.sprite(S.x[i], S.y[i], rr * 0.96, rr * 0.96, 0, S.cr[i], S.cg[i], S.cb[i], a * 0.18, SHAPE.DISC, 2.4, 0)
    }

    /* gems */
    const G = this.G
    for (let i = 0; i < G.pool.cap; i++) {
      if (G.pool.alive[i] === 0) continue
      const x = G.x[i]
      const y = G.y[i]
      if (x < minX || x > maxX || y < minY || y > maxY) continue
      const big = G.value[i] >= 40
      const sz = big ? 15 : G.value[i] >= 3 ? 9 : 7
      const pulse = 1 + Math.sin(t * 7 + i) * 0.14
      const cr = big ? 1 : 0.34
      const cg = big ? 0.86 : 1
      const cb = big ? 0.36 : 0.86
      r.sprite(x, y, sz * 2.6, sz * 2.6, 0, cr, cg, cb, 0.22, SHAPE.DISC, 1.7, 0)
      r.sprite(x, y, sz * pulse, sz * pulse, t * 2 + i, cr, cg, cb, 1, SHAPE.GEM, 1, 0.3)
    }

    /* enemies */
    const E = this.E
    for (let i = 0; i < E.pool.cap; i++) {
      if (E.pool.alive[i] === 0) continue
      const x = E.x[i]
      const y = E.y[i]
      if (x < minX || x > maxX || y < minY || y > maxY) continue
      const def = ENEMIES[E.type[i]]
      const rad = E.radius[i]
      const f = E.flash[i]
      const [cr, cg, cb] = def.col
      r.sprite(x, y, rad * 2.3, rad * 2.3, 0, cr, cg, cb, 0.20 + f * 0.3, SHAPE.DISC, 1.9, 0)
      r.sprite(x, y, rad, rad, E.rot[i], cr, cg, cb, 0.95, def.shape, 0.15, f * 0.9)
      if (def.elite) {
        const hpf = Math.max(0, E.hp[i] / E.maxHp[i])
        r.sprite(x, y, rad * 1.5, rad * 1.5, t * 1.3, 1, 0.86, 0.4, 0.55, SHAPE.RING, 0.05, 0.2)
        r.sprite(x, y, rad * 1.9, rad * 1.9, -t * 0.9, 1, 0.7, 0.3, 0.34, SHAPE.RING, 0.03, 0)
        // Health as a shrinking arc of light: readable without a bar.
        r.sprite(x, y - rad * 2.2, rad * 1.5 * hpf, 4, 0, 1, 0.5, 0.4, 0.9, SHAPE.CAPSULE, 0.5, 0.4)
      }
      if (def.behaviour === BEHAVIOUR.CHARGE && E.st2[i] > 0) {
        r.sprite(x, y, rad * 3.4, rad * 1.1, E.rot[i], 1, 0.5, 0.2, 0.5, SHAPE.CAPSULE, 0.35, 0.4)
      }
    }

    /* player bullets */
    const B = this.B
    for (let i = 0; i < B.pool.cap; i++) {
      if (B.pool.alive[i] === 0) continue
      const x = B.x[i]
      const y = B.y[i]
      if (x < minX || x > maxX || y < minY || y > maxY) continue
      const sz = B.size[i]
      if (B.kind[i] === 2) {
        const fuse = 1 - B.life[i] / 1.5
        r.sprite(x, y, sz * (1 + fuse * 1.6), sz * (1 + fuse * 1.6), t * 5, B.r[i], B.g[i], B.b[i], 0.8, SHAPE.RING, 0.2, fuse * 0.6)
        r.sprite(x, y, sz * 2.4, sz * 2.4, 0, B.r[i], B.g[i], B.b[i], 0.2, SHAPE.DISC, 1.8, 0)
      } else {
        r.sprite(x, y, sz * 2.6, sz * 1.7, B.rot[i], B.r[i], B.g[i], B.b[i], 0.9, SHAPE.CAPSULE, 0.34, 0.55)
        r.sprite(x, y, sz * 3.2, sz * 3.2, 0, B.r[i], B.g[i], B.b[i], 0.24, SHAPE.DISC, 1.9, 0)
      }
    }

    /* enemy bullets — a different shape as well as a different colour */
    const EB = this.EB
    for (let i = 0; i < EB.pool.cap; i++) {
      if (EB.pool.alive[i] === 0) continue
      r.sprite(EB.x[i], EB.y[i], 11, 11, t * 4, 1, 0.34, 0.24, 0.95, SHAPE.SHARD, 0.3, 0.2)
      r.sprite(EB.x[i], EB.y[i], 26, 26, 0, 1, 0.3, 0.2, 0.28, SHAPE.DISC, 1.9, 0)
    }

    /* halo + lance, drawn from the build rather than stored */
    this.drawMelee(t)

    /* particles */
    const P = this.P
    for (let i = 0; i < P.pool.cap; i++) {
      if (P.pool.alive[i] === 0) continue
      const u = P.life[i] / P.max[i]
      const sz = P.size[i] * (0.35 + u * 0.65)
      r.sprite(P.x[i], P.y[i], sz, sz, P.rot[i], P.r[i], P.g[i], P.b[i], u * 0.95, P.shape[i], 1.4, P.glow[i] * u)
    }

    /* the core */
    if (this.coreLive) {
      this.corePhase += frame
      const p = this.corePhase
      const pulse = 1 + Math.sin(p * 3.4) * 0.12
      r.sprite(this.coreX, this.coreY, 96 * pulse, 96 * pulse, 0, 1, 0.8, 0.32, 0.28, SHAPE.DISC, 1.6, 0)
      r.sprite(this.coreX, this.coreY, 46 * pulse, 46 * pulse, p * 1.1, 1, 0.84, 0.36, 0.95, SHAPE.RING, 0.09, 0.3)
      r.sprite(this.coreX, this.coreY, 30, 30, -p * 1.7, 1, 0.9, 0.5, 1, SHAPE.SPARK, 0.4, 0.5)
      r.sprite(this.coreX, this.coreY, 70 + Math.sin(p * 2) * 12, 70 + Math.sin(p * 2) * 12, -p * 0.6, 1, 0.78, 0.3, 0.4, SHAPE.RING, 0.03, 0)
      this.drawOffscreenMarker(this.coreX, this.coreY, hw, hh, 1, 0.82, 0.34)
    }

    /* the question */
    if (this.q) {
      const fade = Math.min(1, this.qT * 2)
      r.text(this.q.prompt, this.px, this.py - 116, 56, 1, 1, 1, fade)
      const ring = 172
      r.sprite(this.px, this.py, ring, ring, t * 0.4, 1, 0.86, 0.44, 0.30 * fade, SHAPE.RING, 0.012, 0.2)
      // Time as a closing iris, not a number.
      const frac = Math.max(0, this.qT / Math.max(0.001, this.qTMax))
      r.sprite(this.px, this.py, ring * (0.35 + frac * 0.62), ring * (0.35 + frac * 0.62), -t * 0.9, 1, 0.7, 0.3, 0.34 * fade, SHAPE.RING, 0.02, 0)
      for (const o of this.orbs) {
        const hot = o.state === 1 ? 1 : 0
        const bad = o.state === 2 ? 1 : 0
        const cr = bad ? 1 : 1
        const cg = bad ? 0.3 : 0.88
        const cb = bad ? 0.45 : 0.45
        const s = 40 + (o.state ? Math.sin(o.t * 22) * 5 : Math.sin(t * 5 + o.ang) * 3)
        r.sprite(o.x, o.y, s * 2.4, s * 2.4, 0, cr, cg, cb, 0.3 + hot * 0.5, SHAPE.DISC, 1.7, hot * 0.5)
        r.sprite(o.x, o.y, s, s, t * 0.8, cr, cg, cb, 0.95, SHAPE.RING, 0.14, hot * 0.7 + bad * 0.3)
        r.text(o.text, o.x, o.y, 38, 1, 1, 1, 1)
      }
    }

    /* damage numbers */
    const N = this.N
    for (let i = 0; i < N.pool.cap; i++) {
      if (N.pool.alive[i] === 0) continue
      const u = N.life[i] / N.max[i]
      const crit = N.crit[i] === 1
      const size = (crit ? 34 : 22) * (1 + (1 - u) * 0.12)
      r.text(String(N.value[i]), N.x[i], N.y[i], size, N.r[i], N.g[i], N.b[i], Math.min(1, u * 1.9))
    }

    /* the diver */
    this.drawPlayer(t)

    /* the stick */
    if (this.input.stick.active && this.input.stick.touch) this.drawStick(hw, hh)

    const intensity = Math.min(1, this.runT / 540)
    r.endFrame({
      time: t,
      intensity,
      flashR: this.feel.flashR,
      flashG: this.feel.flashG,
      flashB: this.feel.flashB,
      flashA: this.feel.flashA,
      aberration: this.T.aberration && !this.reduced
        ? Math.min(0.010, this.feel.trauma * this.feel.trauma * 0.014 + (this.overcharge > 0 ? 0.0018 : 0))
        : 0,
      vignette: 0.85,
      desat: this.desat,
      bloom: 1 + (this.overcharge > 0 ? 0.42 : 0),
    })

    if (this.mode === "play" || this.mode === "core") this.ui.setClock(this.runT)
  }

  private drawMelee(t: number): void {
    const r = this.r
    const s = this.build.stats
    for (const w of this.build.weapons) {
      if (w.key === "halo") {
        const rad = reach(w, s.areaPct)
        const spin = w.phase * 2.1
        r.sprite(this.px, this.py, rad, rad, 0, 1, 0.72, 0.34, 0.16, SHAPE.RING, 0.015, 0)
        for (let k = 0; k < w.count; k++) {
          const a = spin + (k / w.count) * Math.PI * 2
          const x = this.px + Math.cos(a) * rad
          const y = this.py + Math.sin(a) * rad
          r.sprite(x, y, 30, 12, a + Math.PI / 2, 1, 0.75, 0.36, 0.95, SHAPE.SHARD, 0.5, 0.35)
          r.sprite(x, y, 46, 46, 0, 1, 0.7, 0.3, 0.22, SHAPE.DISC, 1.8, 0)
        }
      } else if (w.key === "lance") {
        const len = reach(w, s.areaPct)
        const spin = w.phase * 0.85
        for (let k = 0; k < w.count; k++) {
          const a = spin + (k / w.count) * Math.PI * 2
          const mx = this.px + (Math.cos(a) * len) / 2
          const my = this.py + (Math.sin(a) * len) / 2
          r.sprite(mx, my, len / 2, 16, a, 1, 0.4, 0.34, 0.75, SHAPE.CAPSULE, 0.28, 0.5)
          r.sprite(mx, my, len / 2, 34, a, 1, 0.3, 0.3, 0.2, SHAPE.CAPSULE, 0.5, 0)
        }
        void t
      }
    }
  }

  private drawPlayer(t: number): void {
    const r = this.r
    const oc = this.overcharge > 0
    const inv = this.invuln > 0
    const blink = inv ? 0.55 + Math.sin(t * 30) * 0.4 : 1
    const cr = oc ? 1 : 1
    const cg = oc ? 0.85 : 0.96
    const cb = oc ? 0.4 : 0.78

    if (oc) {
      const p = 1 + Math.sin(t * 9) * 0.1
      r.sprite(this.px, this.py, 150 * p, 150 * p, 0, 1, 0.8, 0.3, 0.22, SHAPE.DISC, 1.5, 0)
      r.sprite(this.px, this.py, 64 * p, 64 * p, -t * 3, 1, 0.86, 0.4, 0.55, SHAPE.RING, 0.05, 0.3)
      r.sprite(this.px, this.py, 92, 92, t * 2, 1, 0.78, 0.32, 0.3, SHAPE.RING, 0.02, 0)
    }
    if (inv) r.sprite(this.px, this.py, 44, 44, -t * 4, 0.6, 0.95, 1, 0.5, SHAPE.RING, 0.06, 0.3)

    r.sprite(this.px, this.py, 60, 60, 0, cr, cg, cb, 0.30 * blink, SHAPE.DISC, 1.5, 0)
    r.sprite(this.px, this.py, 30, 30, t * 1.4, cr, cg, cb, 0.75 * blink, SHAPE.RING, 0.16, 0.4)
    r.sprite(this.px, this.py, 26, 26, -t * 2.2, 1, 1, 1, blink, SHAPE.SPARK, 0.28, 0.55)
  }

  private drawStick(hw: number, hh: number): void {
    const st = this.input.stick
    const r = this.r
    const wpp = (hw * 2) / Math.max(1, this.canvas.clientWidth)
    const hpp = (hh * 2) / Math.max(1, this.canvas.clientHeight)
    const ox = this.camX - hw + st.originX * wpp
    const oy = this.camY - hh + st.originY * hpp
    const kx = this.camX - hw + st.knobX * wpp
    const ky = this.camY - hh + st.knobY * hpp
    const rad = 62 * wpp
    r.sprite(ox, oy, rad, rad, 0, 0.5, 0.85, 1, 0.22, SHAPE.RING, 0.03, 0)
    r.sprite(kx, ky, rad * 0.4, rad * 0.4, 0, 0.7, 0.95, 1, 0.5, SHAPE.DISC, 1.2, 0.2)
  }

  private drawOffscreenMarker(x: number, y: number, hw: number, hh: number, r0: number, g0: number, b0: number): void {
    const dx = x - this.camX
    const dy = y - this.camY
    if (Math.abs(dx) < hw * 0.92 && Math.abs(dy) < hh * 0.92) return
    const a = Math.atan2(dy, dx)
    const ex = this.camX + Math.max(-hw * 0.9, Math.min(hw * 0.9, dx))
    const ey = this.camY + Math.max(-hh * 0.9, Math.min(hh * 0.9, dy))
    const pulse = 1 + Math.sin(this.wallT * 6) * 0.2
    this.r.sprite(ex, ey, 26 * pulse, 26 * pulse, a - Math.PI / 2, r0, g0, b0, 0.9, SHAPE.DART, 0.4, 0.4)
    this.r.sprite(ex, ey, 60, 60, 0, r0, g0, b0, 0.2, SHAPE.DISC, 1.7, 0)
  }

  /* ------------------------------------------------------- external events */

  /** Called from the frame loop in `play` mode — kept separate for clarity. */
  checkCore(): void {
    if (!this.coreLive || this.mode !== "play") return
    const dx = this.coreX - this.px
    const dy = this.coreY - this.py
    if (dx * dx + dy * dy < 46 * 46) this.openQuestion()
  }
}
