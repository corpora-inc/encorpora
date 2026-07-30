import * as THREE from "three"
import { buildAtlas, type Atlas } from "./atlas.ts"
import { Backdrop, Cores, Motes, Numerals, Particles, Rings, Snow } from "./layers.ts"
import { Post } from "./post.ts"
import { valueBuffer } from "../core/digits.ts"
import type { TierSpec } from "../core/tier.ts"
import { MK_ANSWER, MK_VOID, R_K, World } from "../sim/world.ts"
import type { Camera } from "../feel/camera.ts"
import type { Floaters } from "../feel/floaters.ts"

const MAX_MOTE_INSTANCES = 360
const MAX_CORE_INSTANCES = 40

/**
 * Numeral sizes are quoted in CSS pixels of CAP HEIGHT — the height of the ink
 * a child actually has to resolve. `NUM_MIN_PX` is a floor that is never
 * traded away: a numeral is either legible or it is not drawn at all, and a
 * numeral that has to sit outside its own creature to be legible does so.
 */
const NUM_MIN_PX = 13
const NUM_MAX_PX = 72
/** Below this on-screen radius an entity is unambiguous by size alone. */
const LABEL_MIN_RADIUS_PX = 7
/**
 * A number is printed only when it could change a decision — when the value is
 * within this factor of your own mass, either way.
 *
 * The simulation spends 86% of the field on crumbs whose value grows as
 * M^0.6, and the design has always said the numeral "is only there to settle
 * the near-ties". The renderer did not say that: at mass 2,987 a phone frame
 * carried thirty labels reading 76, 77, 80, 97, 103, 106 — every one of them a
 * rounding error, all of them louder than the motes they sat on, and each one
 * competing for the same pixels as the near-tie that actually mattered. The
 * size grammar already says "smaller than you" without a single digit. So the
 * digits are spent where the grammar runs out.
 */
const LABEL_NEAR_BAND = 6

const LAB_CAP = 384
/** A value nine times your mass, or a ninth of it, needs no number on it. */
const LOG_SPAN = Math.log(9)

function blend(a: readonly number[], b: readonly number[], out: [number, number, number], k: number): void {
  out[0] = (a[0] as number) + ((b[0] as number) - (a[0] as number)) * k
  out[1] = (a[1] as number) + ((b[1] as number) - (a[1] as number)) * k
  out[2] = (a[2] as number) + ((b[2] as number) - (a[2] as number)) * k
}

export class Gfx {
  readonly renderer: THREE.WebGLRenderer
  readonly canvas: HTMLCanvasElement
  readonly particles: Particles
  readonly rings: Rings
  private readonly scene = new THREE.Scene()
  private readonly overlay = new THREE.Scene()
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private readonly backdrop: Backdrop
  private readonly snow: Snow
  private readonly motes: Motes
  private readonly cores: Cores
  private readonly numerals: Numerals
  private readonly post: Post
  private readonly atlas: Atlas

  private w = 1
  private h = 1
  private dpr = 1
  private spec: TierSpec

  // Palette, smoothly blended between depths so a boundary is a slow tide
  // rather than a hard cut.
  private water: [number, number, number] = [0, 0, 0]
  private shaft: [number, number, number] = [0, 0, 0]
  private food: [number, number, number] = [0, 0, 0]
  private threatC: [number, number, number] = [0, 0, 0]
  private selfC: [number, number, number] = [0, 0, 0]
  private paletteReady = false

  // -- label placement ------------------------------------------------------
  // Every numeral is a *candidate* until it has been given room. Four-digit
  // values on adjacent cores used to print straight through each other —
  // 1530/1486/760 overlapping, and the player's own mass sitting on top of a
  // floating pop — in a game that asks you to tell 3,418 from 3,481. So labels
  // are collected, ranked, and laid out with an overlap test, and the ones that
  // lose are the ones whose number could not have changed a decision anyway.
  private labN = 0
  private readonly labX = new Float32Array(LAB_CAP)
  private readonly labY = new Float32Array(LAB_CAP)
  private readonly labCap = new Float32Array(LAB_CAP)
  private readonly labHW = new Float32Array(LAB_CAP)
  // Float64, not Float32, and `valueBuffer` says why: this array holds the
  // number a child reads, and Float32 rounds one past 2^24 into a different
  // number without a word.
  private readonly labV = valueBuffer(LAB_CAP)
  private readonly labR = new Float32Array(LAB_CAP)
  private readonly labG = new Float32Array(LAB_CAP)
  private readonly labB = new Float32Array(LAB_CAP)
  private readonly labA = new Float32Array(LAB_CAP)
  private readonly labPrio = new Float32Array(LAB_CAP)
  private readonly labOrder = new Int32Array(LAB_CAP)
  private readonly labKeep = new Int32Array(LAB_CAP)

  // Palette scratch. Preallocated because `draw` runs sixty times a second and
  // this file is not allowed to hand the collector anything.
  private readonly tw: [number, number, number] = [0, 0, 0]
  private readonly ts: [number, number, number] = [0, 0, 0]
  private readonly tf: [number, number, number] = [0, 0, 0]
  private readonly tt: [number, number, number] = [0, 0, 0]
  private readonly tse: [number, number, number] = [0, 0, 0]

  // Per-frame label sizing constants, set once at the top of `draw`.
  private capMin = 1
  private capMax = 1
  private pMass = 1
  private halfDiag = 1
  private camX = 0
  private camY = 0

  constructor(container: HTMLElement, spec: TierSpec) {
    this.spec = spec
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      stencil: false,
      depth: false,
    })
    this.renderer.autoClear = false
    this.renderer.setClearColor(0x000000, 1)
    this.canvas = this.renderer.domElement
    this.canvas.style.position = "absolute"
    this.canvas.style.inset = "0"
    this.canvas.style.width = "100%"
    this.canvas.style.height = "100%"
    this.canvas.style.display = "block"
    container.appendChild(this.canvas)

    this.atlas = buildAtlas()
    this.backdrop = new Backdrop()
    this.snow = new Snow(1100)
    this.motes = new Motes(MAX_MOTE_INSTANCES)
    this.cores = new Cores(MAX_CORE_INSTANCES)
    this.particles = new Particles(3200)
    this.rings = new Rings()
    this.numerals = new Numerals(this.atlas)

    this.scene.add(this.backdrop.mesh)
    this.scene.add(this.snow.mesh)
    this.scene.add(this.particles.mesh)
    this.scene.add(this.motes.mesh)
    this.scene.add(this.cores.mesh)
    this.scene.add(this.rings.mesh)
    this.overlay.add(this.numerals.plate)
    this.overlay.add(this.numerals.mesh)

    this.post = new Post(this.renderer)
    this.applySpec(spec)
  }

  applySpec(spec: TierSpec): void {
    this.spec = spec
    this.snow.setCount(spec.snow)
    this.particles.setCount(spec.particles)
    this.post.passes = spec.bloomPasses
    this.post.dispersion = spec.dispersion
    this.post.setScale(spec.bloomScale)
    this.resize(this.w, this.h, true)
  }

  resize(cssW: number, cssH: number, force = false): void {
    if (!force && cssW === this.w && cssH === this.h) return
    this.w = Math.max(1, cssW)
    this.h = Math.max(1, cssH)
    this.dpr = Math.min(window.devicePixelRatio || 1, this.spec.dprCap)
    this.renderer.setPixelRatio(this.dpr)
    this.renderer.setSize(this.w, this.h, false)
    this.post.resize(this.w * this.dpr, this.h * this.dpr, this.spec.bloomScale)
  }

  get aspect(): number {
    return this.w / this.h
  }

  /** World units per screen pixel, for sizing numerals in real terms. */
  private worldPerPx(span: number): number {
    return span / this.h
  }

  /** Cap height that keeps a value inside its own body where it can. */
  private capFor(v: number, r: number, want: number): number {
    const per = this.numerals.widthOf(v, 1)
    const fit = (r * 1.72) / Math.max(0.5, per)
    return Math.max(this.capMin, Math.min(this.capMax, Math.min(r * want, fit)))
  }

  /** Could this value's exact digits change what a child does about it? */
  private decides(v: number): boolean {
    const a = Math.abs(v)
    return a * LABEL_NEAR_BAND >= this.pMass && a <= this.pMass * LABEL_NEAR_BAND
  }

  /** How near this value is to a decision — the only reason to print it. */
  private nearness(v: number, x: number, y: number): number {
    const rel = Math.abs(Math.log(Math.max(1, Math.abs(v)) / this.pMass)) / LOG_SPAN
    const d = Math.hypot(x - this.camX, y - this.camY) / this.halfDiag
    return 120 * (1 - Math.min(1, rel)) + 60 * (1 - Math.min(1, d))
  }

  private label(v: number, x: number, y: number, cap: number, r: number, g: number, b: number, a: number, prio: number): void {
    if (this.labN >= LAB_CAP || a <= 0.01) return
    const i = this.labN++
    this.labX[i] = x
    this.labY[i] = y
    this.labCap[i] = cap
    this.labHW[i] = this.numerals.widthOf(v, cap) * 0.5
    this.labV[i] = v
    this.labR[i] = r
    this.labG[i] = g
    this.labB[i] = b
    this.labA[i] = a
    this.labPrio[i] = prio
  }

  /**
   * Rank by priority, then lay out greedily with an overlap test. The highest
   * ranked label always wins its ground, so the one number a child is actually
   * deciding on — their own mass, an answer sphere, the rival that is nearly
   * their size — is never the one that gets dropped.
   */
  private placeLabels(): void {
    const n = this.labN
    const order = this.labOrder
    for (let i = 0; i < n; i++) {
      let j = i - 1
      const v = i
      const p = this.labPrio[i] as number
      while (j >= 0 && (this.labPrio[order[j] as number] as number) < p) {
        order[j + 1] = order[j] as number
        j--
      }
      order[j + 1] = v
    }

    let kept = 0
    for (let k = 0; k < n; k++) {
      const i = order[k] as number
      const xi = this.labX[i] as number
      const yi = this.labY[i] as number
      const hwi = this.labHW[i] as number
      const hhi = (this.labCap[i] as number) * 0.72
      let free = true
      for (let m = 0; m < kept; m++) {
        const j = this.labKeep[m] as number
        if (Math.abs(xi - (this.labX[j] as number)) >= hwi + (this.labHW[j] as number)) continue
        if (Math.abs(yi - (this.labY[j] as number)) >= hhi + (this.labCap[j] as number) * 0.72) continue
        free = false
        break
      }
      if (free) this.labKeep[kept++] = i
    }

    for (let m = 0; m < kept; m++) {
      const i = this.labKeep[m] as number
      this.numerals.number(
        this.labV[i] as number,
        this.labX[i] as number,
        this.labY[i] as number,
        this.labCap[i] as number,
        this.labR[i] as number,
        this.labG[i] as number,
        this.labB[i] as number,
        this.labA[i] as number,
      )
    }
    this.labN = 0
  }

  draw(world: World, cam: Camera, time: number, reduced: boolean, floaters?: Floaters): void {
    const span = cam.span
    const cx = cam.viewX
    const cy = cam.viewY
    const aspect = this.aspect

    // --- palette ----------------------------------------------------------
    // Taken straight off the world so the picture can never disagree with the
    // ratcheted band the simulation is actually running.
    const depth = world.depth
    const next = world.depthNext
    const t = world.depthT
    // Only the last third of a band bleeds into the next one, and it never
    // bleeds all the way. A run whose mass has outrun the clock sits at t = 1
    // for minutes, and at a full blend the picture became the NEXT depth
    // entirely: the water went vent-amber while the label still said THE CHURN.
    // Half a blend reads as "you can see the next depth coming", which is what
    // this was always for.
    const k = Math.min(0.45, Math.max(0, (t - 0.66) / 0.34) * 0.45)
    const { tw, ts, tf, tt, tse } = this
    blend(depth.water, next.water, tw, k)
    blend(depth.shaft, next.shaft, ts, k)
    blend(depth.food, next.food, tf, k)
    blend(depth.threat, next.threat, tt, k)
    blend(depth.self, next.self, tse, k)
    const ease = this.paletteReady ? 0.035 : 1
    this.paletteReady = true
    for (let i = 0; i < 3; i++) {
      this.water[i] = (this.water[i] as number) + ((tw[i] as number) - (this.water[i] as number)) * ease
      this.shaft[i] = (this.shaft[i] as number) + ((ts[i] as number) - (this.shaft[i] as number)) * ease
      this.food[i] = (this.food[i] as number) + ((tf[i] as number) - (this.food[i] as number)) * ease
      this.threatC[i] = (this.threatC[i] as number) + ((tt[i] as number) - (this.threatC[i] as number)) * ease
      this.selfC[i] = (this.selfC[i] as number) + ((tse[i] as number) - (this.selfC[i] as number)) * ease
    }

    const res = world.resonance
    // The hush has to land almost instantly. A 0.4s ramp meant the frame in
    // which the question appears was still the loudest frame in the game.
    // `res.resolveT` and not `res.t - res.duration`: the beat no longer has a
    // duration to be relative to, and the resolve carries its own clock from zero.
    const calm = res.active ? Math.min(1, res.t * 6) * (res.phase >= 3 ? Math.max(0, 1 - res.resolveT * 2.6) : 1) : 0

    // --- cull bounds ------------------------------------------------------
    const halfH = span * 0.5
    const halfW = halfH * aspect
    const margin = 1.35
    const minX = cx - halfW * margin
    const maxX = cx + halfW * margin
    const minY = cy - halfH * margin
    const maxY = cy + halfH * margin

    world.viewAspect = aspect
    const wpp = this.worldPerPx(span)
    const capMin = wpp * NUM_MIN_PX
    const capMax = wpp * NUM_MAX_PX
    const labelMinR = wpp * LABEL_MIN_RADIUS_PX
    this.capMin = capMin
    this.capMax = capMax
    this.pMass = Math.max(1, world.mass)
    this.halfDiag = Math.hypot(halfW, halfH)
    this.camX = cx
    this.camY = cy

    // --- motes ------------------------------------------------------------
    this.motes.begin()
    this.numerals.begin()
    for (let i = 0; i < world.mx.length; i++) {
      if (!world.malive[i]) continue
      const x = world.mx[i] as number
      const y = world.my[i] as number
      const r = world.mr[i] as number
      if (x + r < minX || x - r > maxX || y + r < minY || y - r > maxY) continue
      const kind = world.mkind[i] as number
      const flip = world.mflip[i] as number
      this.motes.push(x, y, r, flip, kind, world.mphase[i] as number, (i * 0.618034) % 1)

      if (r < labelMinR) continue
      const v = world.mval[i] as number
      if (kind === MK_ANSWER) {
        this.label(v, x, y, this.capFor(v, r, 0.78), 1, 1, 1, 1, 4000)
        continue
      }
      // A void always carries its number: the minus sign IS the warning, and
      // it is the one place where colour must not be doing the work alone.
      if (kind !== MK_VOID && !this.decides(v)) continue
      const a = Math.min(1, 0.62 + flip * 0.38) * (1 - calm * 0.9)
      const prio = (kind === MK_VOID ? 620 : 300) + this.nearness(v, x, y)
      this.label(v, x, y, this.capFor(v, r, 0.62), 1, 1, 1, a, prio)
    }

    // --- cores ------------------------------------------------------------
    this.cores.begin()
    for (let k2 = 0; k2 < world.rx.length; k2++) {
      if (!world.ralive[k2]) continue
      const x = world.rx[k2] as number
      const y = world.ry[k2] as number
      const m = world.rMassVis[k2] as number
      const r = R_K * Math.sqrt(m)
      if (x + r * 1.4 < minX || x - r * 1.4 > maxX || y + r * 1.4 < minY || y - r * 1.4 > maxY) continue
      const threat = m > world.mass * 1.04 ? Math.min(1, (m / world.mass - 1) * 2.2) : 0
      const hue = world.rhue[k2] as number
      // Rivals are tinted around the depth's food/threat colours so the field
      // stays coherent, with enough hue spread to tell individuals apart.
      // Vary brightness and a single accent, never the channel ratios — a
      // per-channel scramble turns a saturated palette into mud.
      const base = threat > 0 ? this.threatC : this.food
      const lift = 0.78 + hue * 0.42
      const accent = ((hue * 7) % 1) * 0.22
      const cr = (base[0] as number) * lift + accent * 0.5
      const cg = (base[1] as number) * lift + accent
      const cb = (base[2] as number) * lift + accent * 0.8
      const lev = world.rleviathan[k2] === 1
      this.cores.push(
        x,
        y,
        r,
        lev ? 1.0 : cr,
        lev ? 0.45 : cg,
        lev ? 0.12 : cb,
        lev ? 1 : threat,
        world.rsurge[k2] as number,
        0,
        hue * 6.28,
      )
      if (r >= labelMinR && this.decides(world.rmass[k2] as number)) {
        const rv = Math.round(world.rmass[k2] as number)
        this.label(rv, x, y, this.capFor(rv, r, 0.52), 1, 1, 1, 0.96 * (1 - calm * 0.9), 900 + this.nearness(rv, x, y))
      }
    }

    // player last so it sits on top of the shoal
    const pr = world.playerR
    this.cores.push(
      world.px,
      world.py,
      pr,
      this.selfC[0] as number,
      this.selfC[1] as number,
      this.selfC[2] as number,
      0,
      world.surging ? 1 : 0,
      1,
      time * 0.7,
    )
    // Your own number is the one that must never be lost, at any size, under
    // anything: it outranks every other label on the field.
    const pv = Math.round(world.mass)
    const pPer = this.numerals.widthOf(pv, 1)
    const pcap = Math.max(capMin * 1.35, Math.min(capMax * 1.4, Math.min(pr * 0.62, (pr * 1.66) / Math.max(0.5, pPer))))
    this.label(pv, world.px, world.py, pcap, 1, 1, 1, 1, 1e6)

    // --- floating value pops ----------------------------------------------
    if (floaters) {
      for (let i = 0; i < floaters.items.length; i++) {
        const f = floaters.items[i]!
        if (f.life <= 0) continue
        const u = f.t / f.life
        // Overshoot out, then settle — the pop reads as a thing being thrown.
        const scale = u < 0.16 ? 0.4 + (u / 0.16) * 0.85 : 1.25 - (u - 0.16) * 0.28
        const a = u > 0.55 ? 1 - (u - 0.55) / 0.45 : 1
        this.label(f.v, f.x, f.y, Math.max(capMin, f.size * scale), f.r, f.g, f.b, a, 5000 + i)
      }
    }

    this.placeLabels()

    this.motes.end()
    this.cores.end()
    this.numerals.end()

    // --- uniforms ---------------------------------------------------------
    const intensity = reduced ? 0.7 : 1
    this.backdrop.set(time, this.water, this.shaft, cx, cy, span, aspect, this.spec.godrays, intensity, world.arenaR, calm)
    this.snow.set(time, cx, cy, span, aspect, this.shaft, intensity)
    this.motes.set(time, cx, cy, span, aspect, this.food, this.threatC, calm)
    this.cores.set(time, cx, cy, span, aspect, Math.min(1, world.combo / 14), Math.min(1, world.invuln), calm)
    this.rings.set(time, cx, cy, span, aspect)
    this.particles.flush(time, cx, cy, span, aspect, reduced ? 0.35 : 1, calm)
    // Device pixels, not CSS pixels: the antialias width is derived from the
    // real framebuffer, so a 2x display gets a genuinely sharper glyph.
    this.numerals.set(cx, cy, span, aspect, (this.h * this.dpr) / span)

    const cu = this.post.composite.uniforms
    ;(cu.uFlash as THREE.IUniform).value = cam.flash
    ;(cu.uFlashColor as THREE.IUniform).value.set(cam.flashR, cam.flashG, cam.flashB)
    ;(cu.uAberration as THREE.IUniform).value = cam.aberration
    ;(cu.uDesat as THREE.IUniform).value = cam.desat
    ;(cu.uIntensity as THREE.IUniform).value = this.spec.bloomPasses > 0 ? 0.95 : 0
    const rx = (cam.rippleX - cx) / (span * 0.5) * 0.5
    const ry = (cam.rippleY - cy) / (span * 0.5) * 0.5
    ;(cu.uRipple as THREE.IUniform).value.set(rx, ry, cam.rippleT, cam.rippleAmp)

    // --- render -----------------------------------------------------------
    this.renderer.setRenderTarget(this.post.scene)
    this.renderer.clear(true, false, false)
    this.renderer.render(this.scene, this.cam)
    this.post.run()
    // Numerals go on last, straight to the screen, so bloom can never eat them.
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.overlay, this.cam)
  }

  /** Colour the effects layer wants, without reaching into private state. */
  get palette(): { food: readonly number[]; threat: readonly number[]; self: readonly number[]; shaft: readonly number[] } {
    return { food: this.food, threat: this.threatC, self: this.selfC, shaft: this.shaft }
  }

  dispose(): void {
    this.post.dispose()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
      const mat = m.material as THREE.Material | undefined
      if (mat) mat.dispose()
    })
    this.overlay.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
      const mat = m.material as THREE.Material | undefined
      if (mat) mat.dispose()
    })
    this.atlas.texture.dispose()
    this.renderer.dispose()
    this.canvas.remove()
  }
}
