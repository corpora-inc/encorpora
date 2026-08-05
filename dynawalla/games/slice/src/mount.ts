// MATH NINJA — the game.
//
// A market customer places an order. It sits at the top of the screen until it
// is filled. The market throws fruit. You cut what fills the order.
//
//                        10  +  15  +  □  =  33
//
// One verb: cut. What changed is what cutting is *for*.
//
//   * Cut a **helpful** gourd — one whose value fits the blank without
//     overshooting and leaves something you can still make — and it drops into
//     the plate. The order advances. That is the only thing in this game that
//     scores.
//   * Cut a **decoy** and nothing happens. No blank consumed, nothing lost, no
//     scolding. The plate not advancing is the information.
//   * Cut an **overshoot** — bigger than what is left — and the sum completes
//     itself in front of you, held, and the order rotates. It costs no lamp, no
//     points you already banked and no progress you already made. It is the only
//     miss in the game.
//   * Cut a **melon** and you find out what was inside. It may help; it never
//     overshoots, so bad luck can never take an order off you.
//   * Cut an **absurd** — `π`, `−∞`, `½` — and it bursts. Not every symbol is a
//     whole number you can add.
//   * Cut a **bomb** and the market freezes. One question, no timer of any kind,
//     and a correct answer hands the lamp straight back. Where a free-to-play
//     game would show you a video advertisement, this asks for arithmetic.
//
// **Helpful and decoy gourds are visually identical.** Same silhouette, same
// flesh, same motion. Telling them apart is arithmetic and nothing else. That is
// the game, and it is the answer to "all you do is just slice randomly and not
// ever think or care about anything".
//
// Nothing here has a clock on it. Nothing ends. It escalates on evidence.

import { createInstructions, onInsetsChange, safeRect } from "../../../packs/shared/game-chrome/index.ts"
import { SECOND_GRADE_FLOW, observe, seedSuccess, settle } from "../../../packs/shared/game-pacing/index.ts"
import type { Host, Question } from "./contract.ts"
import { Audio } from "./audio.ts"
import { Feel } from "./core/feel.ts"
import { segPointDistSq } from "./core/geom.ts"
import { Rng } from "./core/rng.ts"
import { detectTier, TierGovernor, TIERS } from "./core/tiers.ts"
import { createAtlases } from "./render/atlas.ts"
import { Blade } from "./render/blade.ts"
import {
  candidateHome,
  candidateRow,
  hudLayout,
  lampX,
  type HudLayout,
} from "./render/hud.ts"
import { Bloom, Splats } from "./render/layers.ts"
import {
  FLESHES,
  font,
  IRON,
  IRON_EDGE,
  FUSE,
  LAMP,
  MOTE_HOT,
  MOTE_RING,
  PAPER,
  PRIME_GOLD,
  PRIME_HOT,
  SIGIL_EDGE,
  SIGIL_HOT,
  UI_FONT,
  withAlpha,
} from "./render/palette.ts"
import { KIND_DOT, KIND_SHARD, KIND_SPARK, Particles } from "./render/particles.ts"
import { Scene } from "./render/scene.ts"
import { B_BOMB, B_GOURD, B_MELON, B_MOTE, World, type Body } from "./sim/body.ts"
import { Director, type Market, type Throw } from "./sim/director.ts"
import {
  advanceValue,
  CANDIDATE_READ_LOCK_MS,
  favourAfter,
  FAVOUR_SECONDS,
  gateHoldSeconds,
  LAMPS,
  lampCost,
  orderValue,
  reportsToCurriculum,
  REVEAL_FADE_SECONDS,
  revealDwellSeconds,
  revealHoldSeconds,
  tidyBonus,
  type Verdict,
} from "./sim/economy.ts"
import {
  BANDS,
  BLANK,
  makeTarget,
  Order,
  printedFor,
  targetIsUsable,
} from "./sim/order.ts"
import { rungAt } from "../../../packs/shared/game-pacing/index.ts"

type Pop = {
  alive: boolean
  x: number
  y: number
  vy: number
  life: number
  maxLife: number
  text: string
  size: number
  color: string
  weight: number
}

type Banner = { text: string; sub: string; life: number; maxLife: number; color: string }

/**
 * The wound: a bright line left along the exact path the blade took through an
 * object, for about a tenth of a second. It is the single cheapest thing in the
 * game and it does more to sell "that was cut" than any particle.
 */
type Slash = {
  alive: boolean
  x: number
  y: number
  dx: number
  dy: number
  len: number
  life: number
  maxLife: number
  color: string
}

export function mountSlice(
  el: HTMLElement,
  host: Host,
): { unmount(): void; setPaused(paused: boolean): void } {
  // ── surface ──────────────────────────────────────────────────────────────
  const root = document.createElement("div")
  root.style.cssText =
    "position:relative;width:100%;height:100%;overflow:hidden;touch-action:none;" +
    "-webkit-user-select:none;user-select:none;background:#08061a;cursor:crosshair;"
  const canvas = document.createElement("canvas")
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;"
  root.appendChild(canvas)
  el.appendChild(root)

  const ctx0 = canvas.getContext("2d", { alpha: false })
  if (!ctx0) throw new Error("slice: could not acquire a 2D context")
  const g: CanvasRenderingContext2D = ctx0

  // ── systems ──────────────────────────────────────────────────────────────
  const reduced = host.prefersReducedMotion()

  // ── the clock, and who is allowed to stop it ──────────────────────────────
  //
  // The host can put a sheet over a still-mounted pack, and the child can open
  // the manual mid-run, and underneath either one the market used to keep
  // throwing. Declared here rather than beside the loop because
  // `createInstructions` closes over them.
  let paused = false
  let pausedAt = 0
  // The manual only lifts a pause it put on itself.
  let heldForManual = false

  const guide = createInstructions(el, {
    title: "MATH NINJA",
    summary: [
      "There is an order at the top of the screen, like 10 + 15 + □ = 33.",
      "Fruit flies up out of the market. Slice the numbers that fill the order.",
    ],
    sections: [
      {
        heading: "Filling the order",
        lines: [
          "The order says what the customer wants: some numbers that add up to the big number on the right.",
          "The □ is the empty space. Slice a fruit and its number goes in there.",
          "10 + 15 + □ = 33 means you still need 8. Find the fruit with 8 on it and slice it.",
          "You can slice the numbers in any order you like. 3, 3, 3, 4 and 4, 3, 3, 3 are the same answer.",
        ],
      },
      {
        heading: "Which fruit help",
        lines: [
          "Every fruit looks the same. The only way to tell is to work out the number.",
          "A number that is too big will not fit — that one is the one to let go past.",
          "A number that fits goes straight into the order.",
          "Some numbers do nothing at all. Nothing bad happens. Try another one.",
          "Fruit you miss just falls. It costs you nothing, ever.",
        ],
      },
      {
        heading: "There is no hurry",
        lines: [
          "Nothing counts down. Take as long as you want.",
          "The number you need keeps coming back around, so you can never get stuck.",
          "If you slice a number that is too big, the game finishes the sum for you and shows it to you.",
          "Look at it as long as you like. One swipe moves you on.",
        ],
      },
      {
        heading: "Melons and odd ones",
        lines: [
          "A big melon has no number on it. Slice it open to find out what is inside.",
          "A melon never has anything in it that would spoil your order.",
          "Some fruit have things like π or ½ on them. Those are not whole numbers, so they cannot go in the order.",
        ],
      },
      {
        heading: "Bombs and your three lamps",
        lines: [
          "The three lanterns at the top right are your lamps. Bombs are small and spiky and have a lit fuse.",
          "If you slice a bomb the whole market stops and one lamp goes out.",
          "Then you get one sum, on its own, with nothing moving and no timer at all.",
          "Get it right and the lamp comes straight back on. That is the only way to get one back.",
          "When all three lamps go out the market closes. One tap opens it again.",
        ],
      },
    ],
    reducedMotion: reduced,
    onOpen: () => {
      if (paused) return
      heldForManual = true
      setPaused(true)
    },
    onClose: () => {
      if (!heldForManual) return
      heldForManual = false
      setPaused(false)
    },
  })

  const gov = new TierGovernor(detectTier())
  const atl = createAtlases()
  const parts = new Particles()
  const world = new World()
  const scene = new Scene()
  const bloom = new Bloom()
  const splats = new Splats()
  const feel = new Feel({ reducedMotion: reduced })
  const audio = new Audio()
  let rng = new Rng(0x51ce ^ (Date.now() & 0xffff))
  let director = new Director(rng)

  const blades = new Map<number, Blade>()
  const MAX_BLADES = 2

  // ── run state ────────────────────────────────────────────────────────────
  let W = 0
  let H = 0
  let dpr = 1
  let running = true
  let over = false
  let overAt = 0
  let score = 0
  let best = readBest()
  let lamps = LAMPS
  let combo = 0
  let bestCombo = 0
  let helpfulThisStroke = 0
  let totalCuts = 0
  /**
   * Cuts that changed nothing: decoys, absurds, melon skins.
   *
   * Instrumented rather than assumed. The measured baseline this build exists to
   * beat is **27.4 free unpriced cuts per single arithmetic decision**, and a
   * claim to have fixed it that is not a number is not a claim.
   */
  let freeCuts = 0
  /** Cuts that were a priced arithmetic decision: helpful, overshoot, gate answer. */
  let pricedCuts = 0
  let ordersFilled = 0
  let overshoots = 0
  /**
   * How many orders took their target from `host.next()` and how many the game
   * had to generate itself. Instrumented rather than assumed: §9's open risk is
   * that a host legitimately answers `3/4`, or a number nowhere near the rung's
   * band, and the pack must fall back silently — but if the fallback were firing
   * for EVERY order, nothing would ever reach the curriculum and nobody would
   * notice.
   */
  let hostOrders = 0
  let ownOrders = 0
  let goldGlow = 0
  let lastDecisionMs = 0

  // ── the one axis ─────────────────────────────────────────────────────────
  //
  // `Director.heat` — a pure function of elapsed seconds — is gone; it was root
  // cause 3 of the pacing audit and this game was one of the seventeen. The
  // shared flow controller replaces it: intensity moves on ORDERS FILLED and
  // OVERSHOOTS MADE, so minute nineteen is harder than minute three only if the
  // child made it so, and a child who is struggling gets the whole world
  // breathing out — fewer objects, slower waves, smaller numbers, and the
  // written residual back.
  let intensity = readIntensity()
  let success = seedSuccess(SECOND_GRADE_FLOW, intensity)
  let rung = rungAt(intensity, BANDS.length)

  // ── the standing order ───────────────────────────────────────────────────
  let order = new Order(rung, BANDS[rung]?.targetLo ?? 3)
  /** Wall-clock mark for the CURRENT decision, not the whole order. See the latency contract. */
  let decisionAt = 0
  const frontierBuf: number[] = []
  const market: Market = { live: 0, frontierLive: 0, frontier: frontierBuf, printed: [], residual: 0 }

  // ── market favour ────────────────────────────────────────────────────────
  //
  // A global multiplier that applies to everything an order pays. A fill raises
  // it; an overshoot drops it straight to one. It is the whole cost of an
  // overshoot — no lamp, no deduction, nothing taken back.
  let favour = 1
  let favourLeft = 0
  let bestFavour = 1

  // The FAVOUR CUT — a shockwave thrown out of a filled order that opens every
  // gourd it passes through. The biggest moment in the game and the only one a
  // child cannot reach by slicing.
  let waveOn = false
  let waveX = 0
  let waveY = 0
  let waveR = 0
  let waveSpeed = 0
  let waveMax = 0
  let waveId = 0
  let waveCuts = 0
  let waveBornCut = 0

  const pops: Pop[] = []
  for (let i = 0; i < 40; i++)
    pops.push({
      alive: false,
      x: 0,
      y: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      text: "",
      size: 24,
      color: PAPER,
      weight: 1,
    })
  let banner: Banner | null = null

  /**
   * THE COMPLETED SUM.
   *
   * `prompt` carries the blank and `answer` is what goes in it, so the reveal is
   * literally the plate finishing itself — `10 + 15 + `**`8`**` = 33` — in the
   * colour a fill is celebrated in. Never red. There is no word for what
   * happened and there is no cross.
   */
  type Reveal = { prompt: string; answer: string; sentence: string; left: number; fade: number }
  let reveal: Reveal | null = null

  /**
   * THE HOLD.
   *
   * `games/stack`'s rule: never aim at one thing while reading another. While
   * this is above zero the market is `quiet` — nothing new is launched — so the
   * completed sum is never read across a live field. A stroke ends it, so a fast
   * player is never held, and at the top of the range `revealHoldSeconds`
   * returns zero and there is no hold at all.
   */
  let holdLeft = 0
  /** Set while a hold is running out the clock on an order that has been lost. */
  let rotateAfterHold = false

  function showReveal(prompt: string, answer: string, sentence: string, hold: number): void {
    reveal = {
      prompt,
      answer,
      sentence,
      left: Math.max(hold, revealDwellSeconds(intensity)),
      fade: REVEAL_FADE_SECONDS,
    }
    holdLeft = hold
  }

  /**
   * A stroke, or a new order. Starts the sum leaving; `hard` takes it at once.
   *
   * Also ends the hold, because a child who has read the sum is done with it and
   * holding them past that is the defect this replaces.
   */
  function dismissReveal(hard = false): void {
    if (holdLeft > 0) holdLeft = 0
    if (!reveal) return
    if (hard) reveal = null
    else reveal.left = 0
  }

  const slashes: Slash[] = []
  for (let i = 0; i < 24; i++)
    slashes.push({
      alive: false,
      x: 0,
      y: 0,
      dx: 1,
      dy: 0,
      len: 0,
      life: 0,
      maxLife: 1,
      color: "#ffffff",
    })

  function addSlash(x: number, y: number, dx: number, dy: number, len: number, color: string): void {
    for (const sl of slashes) {
      if (sl.alive) continue
      sl.alive = true
      sl.x = x
      sl.y = y
      sl.dx = dx
      sl.dy = dy
      sl.len = len
      sl.maxLife = 0.13
      sl.life = sl.maxLife
      sl.color = color
      return
    }
  }

  function drawSlashes(ctx: CanvasRenderingContext2D): void {
    for (const sl of slashes) {
      if (!sl.alive) continue
      const t = sl.life / sl.maxLife
      const l = sl.len * (1.15 - t * 0.35)
      ctx.globalAlpha = t * t
      ctx.strokeStyle = sl.color
      ctx.lineCap = "round"
      for (const [w, a] of [
        [7, 0.25],
        [2.6, 0.8],
        [1, 1],
      ] as const) {
        ctx.globalAlpha = t * t * a
        ctx.lineWidth = w * (0.4 + t * 0.8)
        ctx.beginPath()
        ctx.moveTo(sl.x - sl.dx * l, sl.y - sl.dy * l)
        ctx.lineTo(sl.x + sl.dx * l, sl.y + sl.dy * l)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
  }

  // ── the bomb gate ────────────────────────────────────────────────────────
  //
  // The one modal question in the game, at the one moment the child has already
  // stopped moving. **There is no timer of any kind.** Not a long one — none.
  type Gate = { q: Question; askedAt: number }
  let gate: Gate | null = null
  /** True while the market is genuinely frozen: the gate is open. */
  const frozen = (): boolean => gate !== null

  const throwBuf: Throw[] = []
  for (let i = 0; i < 24; i++)
    throwBuf.push({ kind: "gourd", value: 0, glyph: "", delayMs: 0, bandT: 0.5, apex: 0.7 })

  function readBest(): number {
    try {
      return Number(localStorage.getItem("dw.slice.best") ?? "0") || 0
    } catch {
      console.warn("[slice] localStorage unavailable; best score will not persist")
      return 0
    }
  }
  function writeBest(v: number): void {
    try {
      localStorage.setItem("dw.slice.best", String(v))
    } catch {
      console.warn("[slice] could not persist best score")
    }
  }
  /**
   * Where the child left the ladder, so a second sitting does not make them walk
   * every rung again. The controller still owns the number; this only remembers
   * it across a mount.
   */
  function readIntensity(): number {
    try {
      const v = Number(localStorage.getItem("dw.slice.intensity") ?? "")
      return Number.isFinite(v) && v >= 0 && v <= 1 ? v : SECOND_GRADE_FLOW.start
    } catch {
      console.warn("[slice] localStorage unavailable; the ladder will restart at the floor")
      return SECOND_GRADE_FLOW.start
    }
  }
  function writeIntensity(v: number): void {
    try {
      localStorage.setItem("dw.slice.intensity", v.toFixed(4))
    } catch {
      console.warn("[slice] could not persist the ladder position")
    }
  }

  // ── layout ───────────────────────────────────────────────────────────────
  let hud: HudLayout = hudLayout(320, 300, safeRect(320, 300))

  function resize(): void {
    const q = gov.quality
    const rect = root.getBoundingClientRect()
    W = Math.max(320, Math.round(rect.width))
    H = Math.max(300, Math.round(rect.height))
    hud = hudLayout(W, H, safeRect(W, H))
    dpr = Math.min(q.maxDpr, globalThis.devicePixelRatio || 1)
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    scene.build(W, H, q.parallax)
    bloom.resize(W, H, q.bloom && !reduced)
    splats.resize(W, H, q.splats)
    parts.limit = q.particles
    world.chunkLimit = q.chunks
    for (const b of blades.values()) b.maxSamples = q.trail
  }

  const ro = new ResizeObserver(() => resize())
  ro.observe(root)

  // A ResizeObserver is not enough on its own. The host's real insets arrive
  // over the settings channel AFTER the first layout, and iPadOS changes them
  // in Split View without the element's box moving at all — so the observer
  // never fires and a game that read the safe rectangle once at mount stays
  // laid out against the probe's zeros for ever. MERGE shipped exactly that.
  const stopInsets = onInsetsChange(() => resize())

  resize()

  // ── colour ids for the particle field ────────────────────────────────────
  const colGold = parts.colorId(PRIME_GOLD)
  const colGoldHot = parts.colorId(PRIME_HOT)
  const colIron = parts.colorId(IRON_EDGE)
  const colFuse = parts.colorId(FUSE)

  // ── helpers ──────────────────────────────────────────────────────────────
  function gravity(): number {
    return H * 1.92
  }

  function pop(text: string, x: number, y: number, size0: number, color: string, weight = 1): void {
    const size = Math.max(13, Math.min(size0, W * 0.085, (W * 0.86) / Math.max(1, text.length * 0.62)))
    const hw = text.length * size * 0.31 + 6
    let px = x + (rng.next() - 0.5) * size * 0.8
    let py = y + (rng.next() - 0.5) * size * 0.4
    let clear = false
    for (let attempt = 0; attempt < 5 && !clear; attempt++) {
      clear = true
      for (const q of pops) {
        if (!q.alive) continue
        const qhw = q.text.length * q.size * 0.31 + 6
        if (Math.abs(q.x - px) > hw + qhw) continue
        if (Math.abs(q.y - py) > (size + q.size) * 0.62) continue
        clear = false
        py -= (size + q.size) * 0.66
        px += (rng.next() - 0.5) * size * 0.6
        break
      }
      px = Math.max(hw + 4, Math.min(W - hw - 4, px))
      py = Math.max(size * 0.7, Math.min(H - size * 0.9, py))
      // Never inside a live banner or a completed sum: both are the equation the
      // child is being shown, and a score label across one is a run-on number.
      if (banner || reveal) {
        const bt = H * 0.34
        if (py > bt - size * 1.5 && py < bt + size * 2.2) {
          py = py < bt ? bt - size * 1.6 : bt + size * 2.3
          clear = false
        }
      }
    }
    if (!clear) return
    for (const p of pops) {
      if (p.alive) continue
      p.alive = true
      p.x = px
      p.y = py
      p.vy = -60 - weight * 26
      p.maxLife = 0.75 + weight * 0.35
      p.life = p.maxLife
      p.text = text
      p.size = size
      p.color = color
      p.weight = weight
      return
    }
  }

  function showBanner(text: string, sub: string, color: string, secs: number): void {
    banner = { text, sub, life: secs, maxLife: secs, color }
  }

  function radiusFor(v: number): number {
    // Bigger numbers are bigger objects — a MAGNITUDE tell, which buys reaction
    // time and is desirable. It must never become a HELPFULNESS tell, and it
    // cannot: it reads `String(v).length` and nothing else.
    const digits = String(v).length
    const base = Math.min(H * 0.045, W * 0.055)
    return Math.max(17, Math.min(H * 0.075, W * 0.09, base * (0.98 + digits * 0.14)))
  }

  function launch(t: Throw): boolean {
    const b = world.spawnBody()
    if (!b) return false
    const gr = gravity()
    const x = W * (0.06 + t.bandT * 0.88)
    const y = H + 70
    const apexH = H * t.apex + 70
    const vy = -Math.sqrt(2 * gr * apexH)
    const toward = (W * 0.5 - x) / W
    const vx = toward * W * rng.range(0.22, 0.5) + rng.range(-1, 1) * W * 0.05
    b.x = x
    b.y = y
    b.vx = vx
    b.vy = vy
    b.grav = gr
    b.bornAt = performance.now()
    b.spin = rng.range(-2.2, 2.2)
    b.rot = rng.range(0, Math.PI * 2)
    b.phase = rng.next() * Math.PI * 2

    if (t.kind === "bomb") {
      b.kind = B_BOMB
      b.r = Math.max(20, Math.min(34, H * 0.038))
      b.text = ""
      b.glyphH = 0
      b.nextFuseAt = 0
    } else if (t.kind === "melon") {
      b.kind = B_MELON
      b.r = Math.max(30, Math.min(58, H * 0.058))
      b.text = ""
      b.glyphH = 0
      b.fleshIdx = rng.int(0, FLESHES.length - 1)
      // Slower, so an opaque object is a decision rather than a reflex.
      b.grav = gr * 0.72
      b.vy = -Math.sqrt(2 * b.grav * apexH)
      b.spin = rng.range(-1.1, 1.1)
    } else {
      b.kind = B_GOURD
      b.absurd = t.glyph !== ""
      b.value = b.absurd ? 0 : t.value
      b.text = b.absurd ? t.glyph : String(t.value)
      b.r = radiusFor(b.absurd ? 10 : t.value)
      b.glyphH = b.r * 1.34
      b.fleshIdx = rng.int(0, FLESHES.length - 1)
    }
    world.shape(b, rng)
    audio.toss()
    return true
  }

  /** Cuttable bodies in the air — what the hard cap is enforced against. */
  function liveCuttable(): number {
    return world.liveCount(B_GOURD) + world.liveCount(B_MELON) + world.liveCount(B_BOMB)
  }

  function spawnFrom(from: Body, value: number, dirX: number, dirY: number, speed: number): void {
    const b = world.spawnBody()
    if (!b) return
    b.kind = B_GOURD
    b.value = value
    b.absurd = false
    b.fromMelon = true
    b.text = String(value)
    b.r = radiusFor(value)
    b.glyphH = b.r * 1.34
    b.fleshIdx = from.fleshIdx
    b.x = from.x + dirX * from.r * 0.4
    b.y = from.y + dirY * from.r * 0.4
    b.vx = from.vx * 0.55 + dirX * speed
    b.vy = from.vy * 0.5 + dirY * speed - H * 0.28
    b.grav = gravity()
    b.spin = rng.range(-6, 6)
    b.rot = rng.range(0, Math.PI * 2)
    b.bornAt = performance.now()
    // Long enough that the stroke which opened the melon cannot also take the
    // halves, short enough that a quick second flick still lands.
    b.cuttableAt = b.bornAt + 140
    world.shape(b, rng)
  }

  /**
   * What is inside a melon.
   *
   * **Never an overshoot.** A child can then never destroy an order by cutting
   * an opaque object, which would be bad luck rather than bad arithmetic, and
   * bad luck may not rotate an order. Chosen at the moment it splits, against
   * the live residual, so the promise holds however long the melon was in the
   * air. Biased so a melon is usually a gift and sometimes merely a shrug —
   * the founder's "maybe it helps you and maybe it doesn't".
   */
  function melonContents(): [number, number] {
    const printed = printedFor(rung)
    const safe: number[] = []
    for (const v of printed) if (order.classify(v) !== "overshoot") safe.push(v)
    const help = frontierBuf.length > 0 ? frontierBuf : safe
    const a = rng.chance(0.6) && help.length > 0 ? rng.pick(help) : rng.pick(safe.length ? safe : help)
    const b = rng.chance(0.25) && help.length > 0 ? rng.pick(help) : rng.pick(safe.length ? safe : help)
    return [a, b]
  }

  function burst(x: number, y: number, color: string, n: number, speed: number): void {
    const cid = parts.colorId(color)
    const q = gov.quality
    const count = Math.round(n * q.burst)
    for (let i = 0; i < count; i++) {
      const a = rng.next() * Math.PI * 2
      const s = speed * (0.25 + rng.next() * 1.1)
      parts.spawn(KIND_DOT, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + rng.next() * 0.55, 10 + rng.next() * 22, cid, 2.2, 420, 0)
    }
  }

  // ── the order ────────────────────────────────────────────────────────────

  /**
   * A fresh order.
   *
   * The target comes from `host.next()` where the host's answer is usable at
   * this rung — that keeps the contract frozen, keeps the host's own difficulty
   * selection, and keeps `host.report` honest, because the id is one the host
   * actually issued. Where it is not usable — a fraction, or a number nowhere
   * near this band — the game generates its own target and reports NOTHING for
   * that order. Inventing a question id the host never issued would put fiction
   * into the ladder.
   */
  function newOrder(): void {
    rung = rungAt(intensity, BANDS.length, rung)
    let target = -1
    let qid = ""
    try {
      const q = host.next({ difficulty: director.questionDifficulty() })
      const n = Number(q.answer)
      if (targetIsUsable(rung, n)) {
        target = n
        qid = q.id
      }
    } catch {
      console.warn("[slice] host.next threw; falling back to the pack's own target generator")
    }
    if (target < 0) {
      target = makeTarget(rung, () => rng.next())
      ownOrders++
    } else ownOrders += 0
    if (qid !== "") hostOrders++
    order = new Order(rung, target, qid)
    decisionAt = performance.now()
    refreshMarket()
  }

  /** Recompute the frontier and the view the director offers from. */
  function refreshMarket(): void {
    order.frontier(frontierBuf)
    market.printed = printedFor(order.rung)
    market.residual = order.residual
  }

  function multiplier(): number {
    return 1 + Math.min(5, Math.floor(combo / 4))
  }

  function scoreMul(): number {
    return multiplier() * favour * (waveOn ? 2 : 1)
  }

  /**
   * One outcome, handed to the flow controller and to the host.
   *
   * `seconds` is THINKING time for THIS decision, per `game-pacing`'s latency
   * contract: it starts when the child could first act on the state they are in
   * and ends when they commit. It is not the age of the order, because an order
   * is several decisions.
   */
  function record(verdict: Verdict, answered: string): void {
    const ms = Math.max(0, Math.round(performance.now() - decisionAt))
    lastDecisionMs = ms
    const correct = verdict === "fill"
    success = observe(SECOND_GRADE_FLOW, success, correct, ms / 1000)
    pricedCuts++
    for (let i = 0; i < lampCost(verdict); i++) spendLamp()
    if (reportsToCurriculum(verdict) && order.questionId !== "") {
      host.report({ questionId: order.questionId, correct, ms, answered })
    }
    decisionAt = performance.now()
  }

  function onHelpful(b: Body, dx: number, dy: number, nx: number, ny: number, impulse: number): void {
    const flesh = FLESHES[b.fleshIdx % FLESHES.length]
    const target = order.target
    order.take(b.value)
    refreshMarket()
    combo++
    bestCombo = Math.max(bestCombo, combo)
    helpfulThisStroke++

    // The SIEVE, folded into the rush as a BONUS rather than a filter.
    //
    // §5 proposed replacing "cut everything" with "cut only the evens". As a
    // filter it would put the offer invariant at risk — a residual completable
    // only from odd values would have an empty frontier for the length of the
    // rush — so it is paid instead of enforced. The rush stops being the phase
    // where indiscriminate swiping is optimal without anything becoming
    // unreachable.
    const sieve = director.sieveOn && b.value % 2 === 0 ? 2 : 1
    const gain = Math.round(advanceValue(target) * scoreMul() * sieve)
    score += gain
    if (!waveOn) pop(`+${gain}`, b.x, b.y - b.r * 0.2, 30, PAPER, 1.1)

    spray(b.x, b.y, flesh?.juice ?? PAPER, flesh?.core ?? PAPER, impulse, nx, ny, 1.2)
    audio.cut(combo, 1)
    feel.addTrauma(0.16)
    feel.kick(dx, dy, 4.2)
    host.haptic("light")

    if (order.filled) fillOrder(b.x, b.y, dx, dy, nx, ny)
  }

  function fillOrder(x: number, y: number, dx: number, dy: number, nx: number, ny: number): void {
    const target = order.target
    const cuts = order.cuts
    const plate = order.plate()
    record("fill", String(target))
    ordersFilled++

    favour = favourAfter("fill", favour)
    favourLeft = FAVOUR_SECONDS
    bestFavour = Math.max(bestFavour, favour)

    const mult = scoreMul()
    const bonus = tidyBonus(target, cuts)
    const gain = Math.round((orderValue(target) + bonus) * mult)
    score += gain

    // A high-level celebration EVENT, not a new instrument. The fleet's
    // generative soundscape is being designed elsewhere; this only asks for the
    // ladder it already has.
    audio.ascend()
    feel.hitstop(reduced ? 0 : 100)
    feel.slowmo(0.3, 620)
    feel.addTrauma(0.5)
    feel.kick(dx, dy, 11)
    feel.punch(0.085)
    feel.requestFlash(0.24, PRIME_HOT)
    host.haptic("success")
    goldGlow = 1
    pop(`+${gain}`, x, y - 30, 46, PRIME_GOLD, 1.5)
    showBanner(plate, bonus > 0 ? "THREE CUTS EXACTLY" : favour > 1 ? `FAVOUR ×${favour}` : "SOLD", PRIME_GOLD, 1.5)
    spray(x, y, PRIME_GOLD, PRIME_HOT, 620, nx, ny, 1.7)
    if (gov.quality.splats) splats.splat(x, y, PRIME_GOLD, 9, 120, () => rng.next())
    // Gold shards: a filled order leaves METAL, not pulp. Different debris for a
    // different event, so the payoff is legible with the sound off.
    for (let i = 0; i < Math.round(14 * gov.quality.burst); i++) {
      const a = rng.next() * Math.PI * 2
      const sp = 160 + rng.next() * 460
      parts.spawn(
        KIND_SHARD,
        x,
        y,
        Math.cos(a) * sp,
        Math.sin(a) * sp,
        0.7 + rng.next() * 0.6,
        7 + rng.next() * 13,
        rng.chance(0.5) ? colGold : colGoldHot,
        0.8,
        1500,
        rng.range(-14, 14),
      )
    }

    director.settleOrder()
    startWave(x, y)
    newOrder()
  }

  /**
   * THE ONE MISS IN THE GAME.
   *
   * Never red, never "WRONG", never a cross, never a `failure` haptic. The plate
   * completes itself where it stands, in the accent, and it is HELD — the market
   * stops for as long as the sum is on screen, because you may not be asked to
   * aim at one thing while reading another. Then the order rotates with a surge.
   *
   * It costs no lamp, no points already banked and no progress already made. It
   * is also the anti-mash lock: a masher's next indiscriminate slice destroys the
   * order they were accumulating, every time, and it costs them nothing except
   * the thing they never had — progress.
   */
  function onOvershoot(b: Body, dx: number, dy: number): void {
    const answered = String(order.target - order.residual + b.value)
    const prompt = order.plate()
    const sentence = order.sentence()
    const missing = String(order.residual)
    record("overshoot", answered)
    overshoots++

    favour = favourAfter("overshoot", favour)
    favourLeft = 0
    combo = 0

    burst(b.x, b.y, SIGIL_HOT, 24, 300)
    audio.ash()
    feel.kick(-dx, -dy, 15)
    feel.addTrauma(0.34)
    host.haptic("light")

    const hold = revealHoldSeconds(intensity)
    showReveal(prompt, missing, sentence, hold)
    if (hold <= 0) {
      newOrder()
    } else {
      rotateAfterHold = true
    }
    director.settleOrder()
  }

  // ── the cut ──────────────────────────────────────────────────────────────
  function resolveCuts(nowMs: number): void {
    for (const blade of blades.values()) {
      const { segs, count } = blade.takeSegments()
      if (count === 0) continue
      for (let s = 0; s < count; s++) {
        const seg = segs[s]
        if (!seg) continue
        for (const b of world.bodies) {
          if (!b.alive || nowMs < b.cuttableAt) continue
          // While the gate is open the market is frozen and only the gate's own
          // lanterns may be cut: a stroke aimed at an answer must not also take
          // a gourd that is hanging in mid-air behind it.
          if (frozen() && b.kind !== B_MOTE) continue
          const rr = b.r * (b.kind === B_MOTE ? 0.82 : 1.06)
          if (segPointDistSq(seg.ax, seg.ay, seg.bx, seg.by, b.x, b.y) > rr * rr) continue
          cutBody(b, seg.ax, seg.ay, seg.bx, seg.by, seg.speed)
        }
      }
    }
  }

  function cutBody(b: Body, ax: number, ay: number, bx: number, by: number, speed: number): void {
    let dx = bx - ax
    let dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    const nx = -dy
    const ny = dx
    const impulse = Math.min(760, 150 + speed * 0.34)
    const q = gov.quality
    totalCuts++

    if (b.kind === B_BOMB) {
      addSlash(b.x, b.y, dx, dy, b.r * 2.0, FUSE)
      b.reset()
      onBomb(b, nx, ny)
      return
    }

    if (b.kind === B_MOTE) {
      const wasCorrect = b.correct
      const answered = b.text
      addSlash(b.x, b.y, dx, dy, b.r * 2.3, wasCorrect ? PRIME_HOT : SIGIL_HOT)
      world.cut(b, b.x, b.y, nx, ny, impulse, wasCorrect)
      b.reset()
      onGateAnswer(wasCorrect, answered, b.x, b.y, dx, dy, nx, ny)
      return
    }

    const flesh = FLESHES[b.fleshIdx % FLESHES.length]
    if (!flesh) return
    addSlash(b.x, b.y, dx, dy, b.r * 2.3, "#fffaf0")

    if (b.kind === B_MELON) {
      // The cap is checked BEFORE the melon is allowed to open. "Children arrive
      // after the check" is exactly how the old ceiling was overshot by 50-100%.
      world.cut(b, b.x, b.y, nx, ny, impulse, false)
      spray(b.x, b.y, flesh.juice, flesh.core, impulse, nx, ny, 1.3)
      const [va, vb] = melonContents()
      const room = director.hardCap() - liveCuttable()
      const sp = 120 + impulse * 0.34
      if (room >= 1) spawnFrom(b, va, nx, ny, sp)
      if (room >= 2) spawnFrom(b, vb, -nx, -ny, sp)
      b.reset()
      freeCuts++
      audio.cut(combo, 1)
      feel.addTrauma(0.2)
      feel.kick(dx, dy, 5)
      host.haptic("medium")
      return
    }

    // ── a gourd ────────────────────────────────────────────────────────────
    if (b.absurd) {
      // Not a whole number you can add. It bursts, it breaks the combo, and it
      // does nothing else — the idea is the content.
      world.cut(b, b.x, b.y, nx, ny, impulse, false)
      spray(b.x, b.y, flesh.juice, flesh.core, impulse, nx, ny, 0.8)
      b.reset()
      freeCuts++
      combo = 0
      audio.ash()
      feel.addTrauma(0.1)
      host.haptic("light")
      return
    }

    const klass = order.classify(b.value)
    world.cut(b, b.x, b.y, nx, ny, impulse, klass === "helpful")
    if (q.splats) {
      splats.splat(b.x, b.y, klass === "helpful" ? PRIME_GOLD : flesh.juice, klass === "helpful" ? 6 : 4, b.r * 1.5, () => rng.next())
    }

    if (klass === "helpful") {
      onHelpful(b, dx, dy, nx, ny, impulse)
      b.reset()
    } else if (klass === "overshoot") {
      b.reset()
      onOvershoot(b, dx, dy)
      return
    } else {
      // A DECOY. Nothing changes: no blank consumed, no score, no combo lost,
      // nothing said. The plate not advancing is the information.
      spray(b.x, b.y, flesh.rind, flesh.rind, impulse * 0.55, nx, ny, 0.6)
      b.reset()
      freeCuts++
      audio.cut(1, 0.4)
      feel.addTrauma(0.07)
      host.haptic("light")
      return
    }

    if (waveOn) return
    if (helpfulThisStroke === 3) {
      feel.slowmo(0.42, 460)
      feel.punch(0.05)
      showBanner("CLEAN SWEEP", "three that counted, one stroke", MOTE_HOT, 1.1)
      host.haptic("success")
    }
    if (combo === 8 || combo === 14 || combo === 22) {
      feel.slowmo(0.5, 420)
      showBanner(`STREAM ${combo}`, `×${multiplier()}`, PRIME_GOLD, 1.0)
      host.haptic("success")
    }
  }

  /**
   * Fire the favour shockwave out of (x, y).
   *
   * It only cuts bodies that were already in the air when it started, so it
   * cannot feed itself. Everything it opens is classified normally, so a wave
   * across a fresh order genuinely advances it — and can genuinely overshoot it,
   * which is why the wave skips anything that would.
   */
  function startWave(x: number, y: number): void {
    waveOn = true
    waveX = x
    waveY = y
    waveR = 0
    waveCuts = 0
    waveId++
    waveBornCut = performance.now()
    waveMax = Math.hypot(Math.max(waveX, W - waveX), Math.max(waveY, H - waveY)) + 80
    waveSpeed = waveMax / 0.62
  }

  function stepWave(dt: number, nowMs: number): void {
    if (!waveOn) return
    const prev = waveR
    waveR += waveSpeed * dt
    const band = Math.max(26, H * 0.05)
    for (const b of world.bodies) {
      if (!b.alive || b.waveMark === waveId) continue
      if (b.kind === B_MOTE) continue
      if (b.bornAt >= waveBornCut) continue
      const d = Math.hypot(b.x - waveX, b.y - waveY)
      if (d > waveR + b.r * 0.5 || d < prev - band - b.r) continue
      b.waveMark = waveId
      if (b.kind === B_BOMB) {
        // The wave DEFUSES bombs rather than detonating them. Being rewarded and
        // then punished by the same event teaches a child not to answer.
        burst(b.x, b.y, MOTE_HOT, 14, 200)
        audio.toss()
        b.reset()
        continue
      }
      // …and it never overshoots on the child's behalf. A gift may not cost an
      // order.
      if (b.kind === B_GOURD && !b.absurd && order.classify(b.value) === "overshoot") continue
      const ux = (b.x - waveX) / (d || 1)
      const uy = (b.y - waveY) / (d || 1)
      const tx = -uy
      const ty = ux
      const l = Math.max(b.r * 2.4, 60)
      waveCuts++
      b.cuttableAt = 0
      cutBody(b, b.x - tx * l, b.y - ty * l, b.x + tx * l, b.y + ty * l, 900)
    }
    if (waveR >= waveMax) {
      waveOn = false
      if (waveCuts >= 5) {
        showBanner("FAVOUR CUT", `${waveCuts} opened at once`, PRIME_GOLD, 1.1)
        feel.punch(0.03)
        host.haptic("success")
      }
    }
    void nowMs
  }

  function drawWave(ctx: CanvasRenderingContext2D): void {
    if (!waveOn) return
    const t = Math.min(1, waveR / waveMax)
    const a = (1 - t) * (reduced ? 0.5 : 1)
    const band = Math.max(26, H * 0.05)
    ctx.save()
    ctx.globalCompositeOperation = "lighter"
    for (const [w, alpha, off] of [
      [band * 0.9, 0.1, -band * 0.5],
      [7, 0.55, 0],
      [2.4, 1, 0],
    ] as const) {
      ctx.globalAlpha = a * alpha
      ctx.strokeStyle = alpha === 1 ? PRIME_HOT : PRIME_GOLD
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.arc(waveX, waveY, Math.max(1, waveR + off), 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
    ctx.globalAlpha = 1
  }

  function spray(x: number, y: number, juice: string, core: string, impulse: number, nx: number, ny: number, scale: number): void {
    const q = gov.quality
    const cj = parts.colorId(juice)
    const cc = parts.colorId(core)
    const n = Math.round(26 * q.burst * scale)
    for (let i = 0; i < n; i++) {
      const side = rng.chance(0.5) ? 1 : -1
      const spread = rng.range(-0.75, 0.75)
      const ax = nx * side + -ny * spread
      const ay = ny * side + nx * spread
      const l = Math.hypot(ax, ay) || 1
      const sp = impulse * rng.range(0.28, 1.25) * scale
      parts.spawn(
        rng.chance(0.32) ? KIND_SPARK : KIND_DOT,
        x + ax * 4,
        y + ay * 4,
        (ax / l) * sp,
        (ay / l) * sp,
        0.3 + rng.next() * 0.6,
        7 + rng.next() * 20 * scale,
        rng.chance(0.3) ? cc : cj,
        1.9,
        900,
        0,
      )
    }
  }

  // ── the bomb, and one question to continue ───────────────────────────────
  function onBomb(b: Body, nx: number, ny: number): void {
    audio.bomb()
    feel.addTrauma(reduced ? 0 : 0.95)
    feel.kick(-nx, -ny, 26)
    feel.punch(-0.06)
    host.haptic("heavy")
    combo = 0
    const q = gov.quality
    for (let i = 0; i < Math.round(64 * q.burst); i++) {
      const a = rng.next() * Math.PI * 2
      const sp = 180 + rng.next() * 900
      parts.spawn(
        rng.chance(0.4) ? KIND_SHARD : KIND_SPARK,
        b.x,
        b.y,
        Math.cos(a) * sp,
        Math.sin(a) * sp,
        0.4 + rng.next() * 0.8,
        6 + rng.next() * 16,
        rng.chance(0.4) ? colFuse : colIron,
        1.1,
        1500,
        rng.range(-18, 18),
      )
    }
    // The lamp goes out NOW, and the gate is the way to get it back. This is the
    // only thing in the game that spends one.
    spendLamp()
    openGate()
  }

  /**
   * The gate. The market freezes; one question, centred, four lanterns.
   *
   * **No timer of any kind.** Not a long one — none. The child has already
   * stopped moving and there is nothing to protect them from.
   */
  function openGate(): void {
    let q: Question | null = null
    try {
      q = host.next({ difficulty: director.questionDifficulty() })
    } catch {
      console.warn("[slice] host.next threw at the gate; the lamp is returned unconditionally")
    }
    if (!q) {
      // A host that cannot supply a question may not cost a child a lamp.
      lamps = Math.min(LAMPS, lamps + 1)
      return
    }
    dismissReveal(true)
    gate = { q, askedAt: performance.now() }
    audio.sigilOpen()

    const values = rng.shuffle([q.answer, ...q.distractors.slice(0, 3)])
    const n = values.length
    const row = candidateRow(hud, n, W * 0.5, H * 0.42)
    for (let i = 0; i < n; i++) {
      const m = world.spawnBody()
      if (!m) continue
      const home = candidateHome(row, i, n)
      m.kind = B_MOTE
      m.text = values[i] as string
      m.value = Number(values[i])
      m.correct = values[i] === q.answer
      m.qid = q.id
      m.x = W * 0.5
      m.y = H * 0.62
      m.homeX = home.x
      m.homeY = home.y
      m.vx = (m.homeX - m.x) * 2.4
      m.vy = (m.homeY - m.y) * 2.4 - H * 0.1
      m.grav = 0
      m.r = row.r
      m.spin = 0
      m.rot = 0
      m.phase = i * 1.6
      m.bornAt = performance.now()
      // A candidate has to be READ before it can be cut, or the stroke that hit
      // the bomb answers the question it opened, in 0ms.
      m.cuttableAt = m.bornAt + CANDIDATE_READ_LOCK_MS
      m.glyphH = m.r * 1.24
      world.shape(m, rng)
    }
  }

  function clearGateMotes(showCorrect: boolean): void {
    for (const b of world.bodies) {
      if (!b.alive || b.kind !== B_MOTE) continue
      if (showCorrect && b.correct) {
        burst(b.x, b.y, PRIME_GOLD, 26, 220)
        addSlash(b.x, b.y, 1, 0, b.r * 2.2, PRIME_GOLD)
      } else {
        burst(b.x, b.y, MOTE_RING, 8, 120)
      }
      b.reset()
    }
  }

  function onGateAnswer(correct: boolean, answered: string, x: number, y: number, dx: number, dy: number, nx: number, ny: number): void {
    const gt = gate
    if (!gt) return
    const ms = Math.max(0, Math.round(performance.now() - gt.askedAt - CANDIDATE_READ_LOCK_MS))
    lastDecisionMs = ms
    pricedCuts++
    host.report({ questionId: gt.q.id, correct, ms, answered })
    success = observe(SECOND_GRADE_FLOW, success, correct, ms / 1000)
    gate = null
    clearGateMotes(!correct)

    if (correct) {
      // The lamp comes back. The gate is lamp-NEUTRAL at best — it returns the
      // one you just spent and never grants a new one — so seeking bombs is
      // never profitable.
      lamps = Math.min(LAMPS, lamps + 1)
      audio.riser()
      feel.slowmo(0.3, 480)
      feel.addTrauma(0.4)
      feel.kick(dx, dy, 9)
      feel.requestFlash(0.2, PRIME_HOT)
      host.haptic("success")
      goldGlow = 1
      showBanner("THE LAMP RELIT", `${gt.q.prompt} = ${answered}`, LAMP, 1.5)
      spray(x, y, PRIME_GOLD, PRIME_HOT, 560, nx, ny, 1.5)
      director.settleOrder()
      decisionAt = performance.now()
      return
    }

    // Wrong. The sum completes itself, held, in the accent — and the lamp stays
    // out, because the child chose to touch the bomb. Nothing is red.
    audio.ash()
    feel.kick(-dx, -dy, 12)
    feel.addTrauma(0.3)
    host.haptic("light")
    showReveal(gt.q.prompt, gt.q.answer, "", gateHoldSeconds(gt.q.difficulty, intensity))
    decisionAt = performance.now()
    if (lamps <= 0) endRun()
  }

  /**
   * The ONLY place a lamp goes out, and it is called from exactly two: cutting a
   * bomb, and `lampCost`, which returns zero for every verdict there is. That is
   * the structural guarantee that no arithmetic in this game can cost a life.
   */
  function spendLamp(): void {
    lamps = Math.max(0, lamps - 1)
    audio.lampOut()
  }

  function endRun(): void {
    over = true
    overAt = performance.now()
    if (score > best) {
      best = score
      writeBest(best)
    }
    writeIntensity(intensity)
    feel.addTrauma(0.7)
    feel.slowmo(0.25, 900)
    showBanner("THE MARKET CLOSES", "tap to open again", LAMP, 3)
  }

  function restart(): void {
    over = false
    score = 0
    lamps = LAMPS
    combo = 0
    bestCombo = 0
    totalCuts = 0
    freeCuts = 0
    pricedCuts = 0
    ordersFilled = 0
    overshoots = 0
    hostOrders = 0
    ownOrders = 0
    goldGlow = 0
    favour = 1
    favourLeft = 0
    bestFavour = 1
    waveOn = false
    gate = null
    holdLeft = 0
    rotateAfterHold = false
    banner = null
    reveal = null
    world.clear()
    parts.clear()
    splats.clear()
    feel.reset()
    rng = new Rng(0x51ce ^ (Date.now() & 0xffffff))
    director = new Director(rng)
    director.intensity = intensity
    // The ladder is NOT reset. A child who has been playing for ten minutes and
    // loses their last lamp has not become worse at arithmetic.
    rung = rungAt(intensity, BANDS.length)
    newOrder()
    for (const p of pops) p.alive = false
    for (const sl of slashes) sl.alive = false
  }

  // ── input ────────────────────────────────────────────────────────────────
  function local(e: PointerEvent): { x: number; y: number } {
    const r = canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function onDown(e: PointerEvent): void {
    if (paused) return
    void audio.start()
    if (over && performance.now() - overAt > 550) {
      restart()
      return
    }
    // A stroke while the sum is up moves on. The question is already settled, so
    // ending it early costs nothing and the same stroke goes on to cut whatever
    // it was aimed at. A fast player is never held.
    dismissReveal()
    if (blades.size >= MAX_BLADES) return
    const b = new Blade()
    b.maxSamples = gov.quality.trail
    const p = local(e)
    b.begin(p.x, p.y, e.timeStamp)
    blades.set(e.pointerId, b)
    helpfulThisStroke = 0
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      console.warn("[slice] pointer capture refused")
    }
    e.preventDefault()
  }

  function onMove(e: PointerEvent): void {
    if (paused) return
    const b = blades.get(e.pointerId)
    if (!b) return
    const r = canvas.getBoundingClientRect()
    const evs =
      typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : ([e] as PointerEvent[])
    for (const ev of evs.length ? evs : [e]) {
      b.move(ev.clientX - r.left, ev.clientY - r.top, ev.timeStamp)
    }
    if (b.speed > 700 && rng.chance(0.22)) audio.whoosh(b.speed)
    e.preventDefault()
  }

  function onUp(e: PointerEvent): void {
    const b = blades.get(e.pointerId)
    if (!b) return
    b.end()
    const id = e.pointerId
    setTimeout(() => blades.delete(id), b.lifeMs + 40)
    try {
      canvas.releasePointerCapture(id)
    } catch {
      /* already released; nothing to warn about */
    }
  }

  canvas.addEventListener("pointerdown", onDown, { passive: false })
  canvas.addEventListener("pointermove", onMove, { passive: false })
  canvas.addEventListener("pointerup", onUp)
  canvas.addEventListener("pointercancel", onUp)
  canvas.addEventListener("contextmenu", (e) => e.preventDefault())

  function onKey(e: KeyboardEvent): void {
    if (paused) return
    if (e.key === "m" || e.key === "M") audio.setEnabled(!audio.enabled)
    if (e.key === "p" || e.key === "P") showPerf = !showPerf
    if ((e.key === "Enter" || e.key === " ") && over) restart()
  }
  globalThis.addEventListener("keydown", onKey)

  function onVisibility(): void {
    if (document.hidden) audio.suspend()
    else if (!paused) audio.resume()
  }
  document.addEventListener("visibilitychange", onVisibility)

  let showPerf = false

  // ── update ───────────────────────────────────────────────────────────────
  function update(dtS: number, nowMs: number): void {
    const floorY = H

    if (director.rushJustStarted) {
      director.rushJustStarted = false
      audio.riser()
      feel.slowmo(0.45, 700)
      showBanner("MARKET RUSH", "even numbers pay double", MOTE_HOT, 1.8)
    }

    if (director.rushJustEnded) {
      director.rushJustEnded = false
      try {
        host.transition?.("run", "market rush")
      } catch {
        /* a host that throws on a stopping point must not kill the run */
      }
    }

    // ── the ladder ─────────────────────────────────────────────────────────
    //
    // Evidence in, world out, every frame — and frozen while the gate is open or
    // the manual is up, because nothing is being learned about the child then.
    if (!over && !frozen()) {
      intensity = settle(SECOND_GRADE_FLOW, intensity, success, dtS)
      director.intensity = intensity
    }

    // The hold. `quiet` is the market stopping; the reveal is what it stopped for.
    if (holdLeft > 0) {
      holdLeft = Math.max(0, holdLeft - dtS)
      if (holdLeft === 0 && rotateAfterHold) {
        rotateAfterHold = false
        newOrder()
      }
    } else if (rotateAfterHold) {
      rotateAfterHold = false
      newOrder()
    }

    if (!over && !frozen()) {
      director.quiet = holdLeft > 0
      market.live = liveCuttable()
      market.frontierLive = 0
      for (const b of world.bodies) {
        if (!b.alive || b.kind !== B_GOURD || b.absurd) continue
        if (frontierBuf.includes(b.value)) market.frontierLive++
      }
      const n = director.step(dtS, throwBuf, market)
      for (let i = 0; i < n; i++) launch(throwBuf[i] as Throw)
    }

    stepWave(dtS, nowMs)

    if (favourLeft > 0) {
      favourLeft -= dtS
      if (favourLeft <= 0) {
        favour = Math.max(1, favour - 1)
        favourLeft = favour > 1 ? FAVOUR_SECONDS * 0.72 : 0
      }
    }

    // Bodies. While the gate is open EVERYTHING airborne holds — a real freeze,
    // not a throttle — and only the gate's own lanterns move.
    for (const b of world.bodies) {
      if (!b.alive) continue
      if (b.kind === B_MOTE) {
        const k = 150
        const damp = 2 * Math.sqrt(k)
        b.vx += ((b.homeX - b.x) * k - b.vx * damp) * dtS
        b.vy += ((b.homeY - b.y) * k - b.vy * damp) * dtS
        b.x += b.vx * dtS
        b.y += b.vy * dtS
        b.rot = Math.sin(nowMs * 0.0016 + b.phase) * 0.06
        continue
      }
      if (frozen()) continue

      b.vy += b.grav * dtS
      b.x += b.vx * dtS
      b.y += b.vy * dtS
      b.rot += b.spin * dtS

      if (b.kind === B_BOMB && nowMs > b.nextFuseAt) {
        b.nextFuseAt = nowMs + 150
        audio.fuse()
        parts.spawn(
          KIND_SPARK,
          b.x + Math.cos(b.rot - 1.57) * b.r,
          b.y + Math.sin(b.rot - 1.57) * b.r,
          rng.range(-70, 70),
          rng.range(-190, -60),
          0.35,
          8,
          colFuse,
          1.4,
          520,
          0,
        )
      }

      // A gourd that falls past the bottom is simply gone. **Nothing is
      // reported.** A fruit the child let go past is not evidence about them —
      // it is Fruit Ninja Zen's contract, and it is what makes the arithmetic
      // layer genuinely unrushed.
      if (b.y > floorY + b.r * 3 + 90 || b.x < -W * 0.4 || b.x > W * 1.4) b.reset()
    }

    world.updateChunks(dtS, floorY)
    parts.update(dtS)
    splats.update(dtS)
    scene.update(dtS)

    goldGlow = Math.max(0, goldGlow - dtS * 1.1)

    for (const sl of slashes) {
      if (!sl.alive) continue
      sl.life -= dtS
      if (sl.life <= 0) sl.alive = false
    }

    for (const p of pops) {
      if (!p.alive) continue
      p.life -= dtS
      if (p.life <= 0) {
        p.alive = false
        continue
      }
      p.y += p.vy * dtS
      p.vy += 150 * dtS
    }
    if (banner) {
      banner.life -= dtS
      if (banner.life <= 0) banner = null
    }
    if (reveal) {
      if (reveal.left > 0) reveal.left = Math.max(0, reveal.left - dtS)
      else {
        reveal.fade -= dtS
        if (reveal.fade <= 0) reveal = null
      }
    }

    audio.setIntensity(intensity * (director.rushLeft > 0 ? 1 : 0.7))
  }

  // ── draw ─────────────────────────────────────────────────────────────────
  function pushCamera(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    const cx = W / 2
    const cy = H / 2
    ctx.translate(cx + feel.shakeX, cy + feel.shakeY)
    ctx.scale(feel.scale, feel.scale)
    ctx.translate(-cx, -cy)
  }

  function drawBodyShape(ctx: CanvasRenderingContext2D, b: Body): void {
    ctx.beginPath()
    ctx.moveTo(b.poly[0] as number, b.poly[1] as number)
    for (let i = 1; i < b.polyN; i++) {
      ctx.lineTo(b.poly[i * 2] as number, b.poly[i * 2 + 1] as number)
    }
    ctx.closePath()
  }

  function drawNumeral(ctx: CanvasRenderingContext2D, text: string, h: number): void {
    const img = atl.numeral.get(text)
    const s = h / img.h
    ctx.drawImage(img.c, (-img.w * s) / 2, (-img.h * s) / 2, img.w * s, img.h * s)
  }

  function drawBodies(ctx: CanvasRenderingContext2D, nowMs: number): void {
    drawBodyPass(ctx, nowMs, false)
    drawBodyPass(ctx, nowMs, true)
  }

  function drawBodyPass(ctx: CanvasRenderingContext2D, nowMs: number, motes: boolean): void {
    for (const b of world.bodies) {
      if (!b.alive) continue
      if ((b.kind === B_MOTE) !== motes) continue
      const age = (nowMs - b.bornAt) / 1000
      const sq = reduced ? 1 : 1 + Math.max(0, 0.35 - age * 1.95)

      ctx.save()
      ctx.translate(b.x, b.y)
      ctx.rotate(b.rot)
      ctx.scale(1 / sq, sq)

      if (b.kind === B_BOMB) {
        drawBodyShape(ctx, b)
        const gd = ctx.createLinearGradient(-b.r, -b.r, b.r, b.r)
        gd.addColorStop(0, IRON_EDGE)
        gd.addColorStop(0.45, IRON)
        gd.addColorStop(1, "#000000")
        ctx.fillStyle = gd
        ctx.fill()
        ctx.strokeStyle = "rgba(255,120,50,0.5)"
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = IRON
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2
          ctx.save()
          ctx.rotate(a)
          ctx.beginPath()
          ctx.moveTo(b.r * 0.86, -b.r * 0.17)
          ctx.lineTo(b.r * 1.3, 0)
          ctx.lineTo(b.r * 0.86, b.r * 0.17)
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        }
        ctx.strokeStyle = "#4a3a2a"
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(0, -b.r)
        ctx.quadraticCurveTo(b.r * 0.4, -b.r * 1.5, b.r * 0.1, -b.r * 1.85)
        ctx.stroke()
        ctx.restore()
        continue
      }

      if (b.kind === B_MOTE) {
        const pulse = 0.6 + Math.sin(nowMs * 0.005 + b.phase) * 0.4
        const back = ctx.createRadialGradient(0, 0, b.r * 0.9, 0, 0, b.r * 1.85)
        back.addColorStop(0, "rgba(6,7,22,0.95)")
        back.addColorStop(1, "rgba(6,7,22,0)")
        ctx.fillStyle = back
        ctx.beginPath()
        ctx.arc(0, 0, b.r * 1.85, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(0, 0, b.r * 1.02, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(8,10,28,0.97)"
        ctx.fill()
        ctx.strokeStyle = withAlpha(MOTE_RING, 0.55 + pulse * 0.45)
        ctx.lineWidth = 3.4
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(0, 0, b.r * 1.26, -1.1, 1.1)
        ctx.strokeStyle = withAlpha(MOTE_HOT, 0.22 + pulse * 0.3)
        ctx.lineWidth = 1.6
        ctx.stroke()
        drawNumeral(ctx, b.text, b.r * 1.24)
        ctx.restore()
        continue
      }

      const flesh = FLESHES[b.fleshIdx % FLESHES.length]
      if (!flesh) {
        ctx.restore()
        continue
      }
      drawBodyShape(ctx, b)
      const gd = ctx.createRadialGradient(-b.r * 0.3, -b.r * 0.4, b.r * 0.1, 0, 0, b.r * 1.25)
      gd.addColorStop(0, flesh.flesh)
      gd.addColorStop(0.55, flesh.rind)
      gd.addColorStop(1, "#0b0616")
      ctx.fillStyle = gd
      ctx.fill()
      ctx.strokeStyle = withAlpha(flesh.flesh, 0.55)
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.beginPath()
      ctx.ellipse(-b.r * 0.34, -b.r * 0.44, b.r * 0.3, b.r * 0.18, -0.6, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(255,238,205,0.3)"
      ctx.fill()
      if (b.kind === B_MELON) {
        // Seams, and no glyph at all. You cannot see inside a melon; that is
        // what a melon is.
        ctx.strokeStyle = withAlpha(flesh.rind, 0.85)
        ctx.lineWidth = 2.2
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI
          ctx.beginPath()
          ctx.ellipse(0, 0, b.r * 0.94, b.r * 0.34, a, 0, Math.PI * 2)
          ctx.stroke()
        }
      } else {
        drawNumeral(ctx, b.text, b.r * 1.34)
      }
      ctx.restore()
    }
  }

  function drawChunks(ctx: CanvasRenderingContext2D): void {
    for (const c of world.chunks) {
      if (!c.alive) continue
      const flesh = FLESHES[c.fleshIdx % FLESHES.length]
      const t = c.life / c.maxLife
      ctx.save()
      ctx.globalAlpha = Math.min(1, t * 2.4)
      ctx.translate(c.x, c.y)
      ctx.rotate(c.rot)
      ctx.beginPath()
      ctx.moveTo(c.poly[0] as number, c.poly[1] as number)
      for (let i = 1; i < c.polyN; i++) {
        ctx.lineTo(c.poly[i * 2] as number, c.poly[i * 2 + 1] as number)
      }
      ctx.closePath()
      ctx.save()
      ctx.clip()
      const grad = ctx.createLinearGradient(c.cnx * -60, c.cny * -60, c.cnx * 60, c.cny * 60)
      if (c.gold) {
        grad.addColorStop(0, PRIME_HOT)
        grad.addColorStop(0.35, PRIME_GOLD)
        grad.addColorStop(1, "#4a3405")
      } else if (flesh) {
        grad.addColorStop(0, flesh.core)
        grad.addColorStop(0.3, flesh.flesh)
        grad.addColorStop(1, flesh.rind)
      } else {
        grad.addColorStop(0, "#ffffff")
        grad.addColorStop(1, "#221133")
      }
      ctx.fillStyle = grad
      ctx.fillRect(-400, -400, 800, 800)
      // …and the half of the numeral that was on this piece, clipped by the same
      // polygon — so a 48 cut down the middle falls apart into two halves of a 48.
      if (c.text && c.gh > 0) {
        const img = atl.numeral.get(c.text)
        const s = c.gh / img.h
        ctx.globalAlpha = Math.min(1, t * 2.4) * 0.92
        ctx.drawImage(img.c, c.gx - (img.w * s) / 2, c.gy - (img.h * s) / 2, img.w * s, img.h * s)
      }
      ctx.restore()
      ctx.strokeStyle = "rgba(255,246,225,0.5)"
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.restore()
      ctx.globalAlpha = 1
    }
  }

  /**
   * THE ORDER PLATE — the most prominent thing on the canvas.
   *
   * Laid out inside `hudLayout`'s `banner` rect, which already solves the safe
   * rect and the host's two 44px corner controls across five viewports and three
   * inset profiles. No new layout risk was taken to put this here.
   */
  function drawPlate(ctx: CanvasRenderingContext2D, nowMs: number): void {
    const { x: bx, y: by, w: bw, h: bh } = hud.banner
    const text = order.plate()
    ctx.fillStyle = "rgba(8,6,20,0.86)"
    roundRect(ctx, bx, by, bw, bh, 10)
    ctx.fill()
    ctx.strokeStyle = withAlpha(SIGIL_EDGE, 0.75)
    ctx.lineWidth = 2
    roundRect(ctx, bx, by, bw, bh, 10)
    ctx.stroke()

    // The plate grows with the order and the type bends to fit it. A four-addend
    // thousands order is a long string and half of it off the edge is worse than
    // all of it small.
    const size = Math.max(13, Math.min(bh * 0.5, (bw * 0.92) / Math.max(1, text.length * 0.56)))
    ctx.font = font(UI_FONT, size)
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    const wholeW = ctx.measureText(text).width
    const x0 = bx + (bw - wholeW) / 2
    const y0 = by + bh * 0.44
    const at = text.indexOf(BLANK)
    if (at < 0) {
      ctx.fillStyle = PAPER
      ctx.fillText(text, x0, y0)
    } else {
      const head = text.slice(0, at)
      const tail = text.slice(at + BLANK.length)
      const headW = ctx.measureText(head).width
      const blankW = ctx.measureText(BLANK).width
      ctx.fillStyle = PAPER
      ctx.fillText(head, x0, y0)
      // The open blank pulses. It is the only coloured glyph on the plate, and
      // it is the thing the whole game is about.
      const pulse = 0.66 + Math.sin(nowMs * 0.005) * 0.34
      ctx.fillStyle = withAlpha(SIGIL_HOT, 0.6 + pulse * 0.4)
      ctx.fillText(BLANK, x0 + headW, y0)
      ctx.fillStyle = PAPER
      ctx.fillText(tail, x0 + headW + blankW, y0)
    }

    // THE RESIDUAL LINE, and it is the single most important knob at the bottom
    // of the spectrum. Written while the child is finding it hard, faded as they
    // get faster, and absent once they do not need it — which is exactly where
    // the real subtraction starts living.
    const showResidual = intensity <= 0.62 && !order.filled
    if (showResidual) {
      const alpha = intensity <= 0.35 ? 0.85 : 0.85 * (1 - (intensity - 0.35) / 0.27)
      ctx.font = font(UI_FONT, size * 0.42)
      ctx.textAlign = "center"
      ctx.fillStyle = withAlpha(PAPER, Math.max(0, alpha))
      ctx.fillText(`needs ${order.residual}`, bx + bw / 2, by + bh * 0.84)
    }
    ctx.textAlign = "left"
  }

  function drawHud(ctx: CanvasRenderingContext2D, nowMs: number): void {
    const { big } = hud

    ctx.textAlign = "left"
    ctx.textBaseline = "top"
    ctx.font = font(UI_FONT, big)
    ctx.fillStyle = "rgba(6,4,14,0.6)"
    ctx.fillText(String(score), hud.scoreX + 2, hud.scoreY + 2)
    ctx.fillStyle = PAPER
    ctx.fillText(String(score), hud.scoreX, hud.scoreY)
    ctx.font = font(UI_FONT, big * 0.36)
    ctx.fillStyle = withAlpha(PAPER, 0.5)
    ctx.fillText(`BEST ${best}`, hud.scoreX, hud.bestY)

    // Lamps, top-right. A dead one is dark AND unlit AND struck through, so "how
    // much life" never depends on colour.
    const lr = hud.lampR
    for (let i = 0; i < 3; i++) {
      const x = lampX(hud, i)
      const y = hud.lampY
      const on = i < lamps
      ctx.beginPath()
      ctx.moveTo(x, y - lr * 1.9)
      ctx.lineTo(x, y - lr * 1.05)
      ctx.strokeStyle = "rgba(255,255,255,0.28)"
      ctx.lineWidth = 1.4
      ctx.stroke()
      if (on) {
        const prev = ctx.globalCompositeOperation
        ctx.globalCompositeOperation = "lighter"
        const gr = ctx.createRadialGradient(x, y, 0, x, y, lr * 3.4)
        gr.addColorStop(0, withAlpha(LAMP, 0.55))
        gr.addColorStop(1, "rgba(0,0,0,0)")
        ctx.fillStyle = gr
        ctx.beginPath()
        ctx.arc(x, y, lr * 3.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalCompositeOperation = prev
      }
      ctx.beginPath()
      ctx.moveTo(x, y - lr)
      ctx.quadraticCurveTo(x + lr, y - lr * 0.2, x + lr * 0.62, y + lr)
      ctx.lineTo(x - lr * 0.62, y + lr)
      ctx.quadraticCurveTo(x - lr, y - lr * 0.2, x, y - lr)
      ctx.closePath()
      ctx.fillStyle = on ? LAMP : "rgba(40,34,58,0.9)"
      ctx.fill()
      ctx.strokeStyle = on ? "rgba(255,240,200,0.9)" : "rgba(120,110,140,0.7)"
      ctx.lineWidth = 1.6
      ctx.stroke()
      if (!on) {
        ctx.beginPath()
        ctx.moveTo(x - lr * 0.9, y - lr * 0.9)
        ctx.lineTo(x + lr * 0.9, y + lr * 0.9)
        ctx.strokeStyle = "rgba(200,190,220,0.75)"
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }

    if (combo >= 3 || favour > 1) {
      const m = scoreMul()
      const hot = favour > 1
      ctx.textAlign = "left"
      ctx.textBaseline = "top"
      const ms = big * (hot ? 0.78 : 0.62)
      const y0 = hud.mulY
      ctx.font = font(UI_FONT, ms)
      const label = `×${m}`
      ctx.fillStyle = withAlpha(hot ? PRIME_HOT : PRIME_GOLD, 0.9)
      ctx.fillText(label, hud.scoreX, y0)
      const lx = hud.scoreX + ctx.measureText(label).width + big * 0.42
      const sm = big * 0.34
      ctx.font = font(UI_FONT, sm)
      if (favour > 1) {
        const bw2 = big * 1.9
        const f = Math.max(0, Math.min(1, favourLeft / FAVOUR_SECONDS))
        ctx.fillStyle = "rgba(255,255,255,0.16)"
        ctx.fillRect(lx, y0 + 1, bw2, 3)
        ctx.fillStyle = withAlpha(PRIME_HOT, 0.95)
        ctx.fillRect(lx, y0 + 1, bw2 * f, 3)
        ctx.fillStyle = withAlpha(PAPER, 0.72)
        ctx.fillText(`FAVOUR ${favour}`, lx, y0 + sm * 0.9)
        ctx.fillStyle = withAlpha(PAPER, 0.42)
        ctx.fillText(`STREAM ${combo}`, lx, y0 + sm * 2.1)
      } else {
        ctx.fillStyle = withAlpha(PAPER, 0.62)
        ctx.fillText(`STREAM ${combo}`, lx, y0 + sm * 0.9)
      }
    }

    if (!over) drawPlate(ctx, nowMs)

    // The gate's own prompt, centred, at full size, with nothing moving behind it.
    if (gate) {
      const s = Math.max(24, Math.min(58, W * 0.058))
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.font = font(UI_FONT, s)
      ctx.lineJoin = "round"
      ctx.strokeStyle = "rgba(5,3,12,0.9)"
      ctx.lineWidth = s * 0.16
      ctx.strokeText(`${gate.q.prompt} = ${BLANK}`, W / 2, H * 0.26)
      ctx.fillStyle = PAPER
      ctx.fillText(`${gate.q.prompt} = ${BLANK}`, W / 2, H * 0.26)
      ctx.font = font(UI_FONT, s * 0.34)
      ctx.fillStyle = withAlpha(LAMP, 0.85)
      ctx.fillText("answer to relight the lamp", W / 2, H * 0.26 + s * 0.78)
    }

    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    for (const p of pops) {
      if (!p.alive) continue
      const t = p.life / p.maxLife
      const a = Math.min(1, t * 2.6)
      const s = p.size * (1 + (1 - t) * 0.28)
      ctx.globalAlpha = a
      ctx.font = font(UI_FONT, s)
      ctx.lineJoin = "round"
      ctx.strokeStyle = "rgba(5,3,12,0.85)"
      ctx.lineWidth = s * 0.2
      ctx.strokeText(p.text, p.x, p.y)
      ctx.fillStyle = p.color
      ctx.fillText(p.text, p.x, p.y)
      ctx.globalAlpha = 1
    }

    if (banner && !over) {
      const t = banner.life / banner.maxLife
      const a = Math.min(1, t * 3.4)
      const s = Math.max(22, Math.min(56, W * 0.052)) * (1 + (1 - t) * 0.12)
      ctx.globalAlpha = a
      ctx.font = font(UI_FONT, s)
      ctx.lineJoin = "round"
      ctx.strokeStyle = "rgba(5,3,12,0.9)"
      ctx.lineWidth = s * 0.16
      ctx.strokeText(banner.text, W / 2, H * 0.34)
      ctx.fillStyle = banner.color
      ctx.fillText(banner.text, W / 2, H * 0.34)
      ctx.font = font(UI_FONT, s * 0.34)
      ctx.fillStyle = withAlpha(PAPER, 0.7)
      ctx.fillText(banner.sub, W / 2, H * 0.34 + s * 0.72)
      ctx.globalAlpha = 1
    }

    // THE COMPLETED SUM. The plate finishing itself, in the colour a fill is
    // celebrated in. There is no red here and there is no word for what happened.
    if (reveal && !banner && !over) {
      const s = Math.max(22, Math.min(56, W * 0.052))
      ctx.globalAlpha = reveal.left > 0 ? 1 : Math.max(0, reveal.fade / REVEAL_FADE_SECONDS)
      ctx.font = font(UI_FONT, s)
      ctx.textAlign = "left"
      ctx.textBaseline = "alphabetic"
      ctx.lineJoin = "round"
      const at = reveal.prompt.indexOf(BLANK)
      const filled = at < 0 ? `${reveal.prompt} = ${reveal.answer}` : reveal.prompt
      const shown = at < 0 ? filled : reveal.prompt.slice(0, at) + reveal.answer + reveal.prompt.slice(at + BLANK.length)
      const wholeW = ctx.measureText(shown).width
      const x0 = W / 2 - wholeW / 2
      const y0 = H * 0.34
      ctx.strokeStyle = "rgba(5,3,12,0.9)"
      ctx.lineWidth = s * 0.16
      ctx.strokeText(shown, x0, y0)
      if (at < 0) {
        ctx.fillStyle = PAPER
        ctx.fillText(reveal.prompt, x0, y0)
        ctx.fillStyle = PRIME_GOLD
        ctx.fillText(` = ${reveal.answer}`, x0 + ctx.measureText(reveal.prompt).width, y0)
      } else {
        const head = reveal.prompt.slice(0, at)
        const tail = reveal.prompt.slice(at + BLANK.length)
        const hw = ctx.measureText(head).width
        const aw = ctx.measureText(reveal.answer).width
        ctx.fillStyle = PAPER
        ctx.fillText(head, x0, y0)
        ctx.fillStyle = PRIME_GOLD
        ctx.fillText(reveal.answer, x0 + hw, y0)
        ctx.fillStyle = PAPER
        ctx.fillText(tail, x0 + hw + aw, y0)
      }
      // At the calm end the subtraction is written out underneath. That is the
      // channel doing the work at the bottom of the range: a child who is not
      // producing answers is still absorbing the shape of one resolving.
      if (reveal.sentence && intensity <= 0.3) {
        ctx.font = font(UI_FONT, s * 0.44)
        ctx.textAlign = "center"
        ctx.fillStyle = withAlpha(PAPER, 0.72)
        ctx.fillText(reveal.sentence, W / 2, y0 + s * 0.9)
      }
      ctx.textAlign = "center"
      ctx.globalAlpha = 1
    }

    if (over) {
      ctx.fillStyle = "rgba(6,4,16,0.72)"
      ctx.fillRect(0, 0, W, H)
      const s = Math.max(30, Math.min(72, W * 0.07))
      ctx.textAlign = "center"
      ctx.font = font(UI_FONT, s)
      ctx.fillStyle = PAPER
      ctx.fillText("THE MARKET CLOSES", W / 2, H * 0.34)
      ctx.font = font(UI_FONT, s * 1.5)
      ctx.fillStyle = PRIME_GOLD
      ctx.fillText(String(score), W / 2, H * 0.34 + s * 1.5)
      ctx.font = font(UI_FONT, s * 0.34)
      ctx.fillStyle = withAlpha(PAPER, 0.72)
      ctx.fillText(
        `${ordersFilled} orders filled · best stream ${bestCombo} · ${totalCuts} cuts`,
        W / 2,
        H * 0.34 + s * 2.5,
      )
      ctx.font = font(UI_FONT, s * 0.44)
      ctx.fillStyle = PAPER
      const blink = 0.6 + Math.sin(nowMs * 0.005) * 0.4
      ctx.globalAlpha = blink
      ctx.fillText("tap to open again", W / 2, H * 0.34 + s * 3.5)
      ctx.globalAlpha = 1
    }

    if (showPerf) {
      ctx.textAlign = "right"
      ctx.font = font(UI_FONT, 13)
      ctx.fillStyle = "rgba(255,255,255,0.75)"
      const fps = 1000 / Math.max(0.001, gov.medianMs())
      ctx.fillText(
        `${gov.quality.name} · ${fps.toFixed(0)}fps med · p95 ${gov.p95Ms().toFixed(1)}ms · ` +
          `${parts.alive}p · ${world.liveCount()}b · i ${intensity.toFixed(2)}`,
        W - 8,
        H - 18,
      )
      ctx.textAlign = "left"
    }
  }

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  function draw(nowMs: number): void {
    const q = gov.quality
    g.setTransform(dpr, 0, 0, dpr, 0, 0)

    pushCamera(g)
    const px = (feel.shakeX + feel.kickX) * 0.5
    const py = feel.shakeY * 0.4
    scene.draw(g, intensity * 0.6 + goldGlow * 0.4, px, py)
    splats.draw(g, 0.5)
    drawChunks(g)
    drawBodies(g, nowMs)
    g.restore()

    const eg = bloom.begin()
    if (eg) {
      pushCamera(eg)
      drawSlashes(eg)
      drawWave(eg)
      parts.drawAdditive(eg, atl)
      for (const b of blades.values()) {
        if (b.visible(nowMs)) b.draw(eg, nowMs, Math.max(3, H * 0.014), 1 + Math.min(1.2, combo * 0.06), q.glow)
      }
      eg.restore()
      pushCamera(g)
      parts.drawSolid(g, atl)
      g.restore()
      bloom.composite(g, 0.85 + goldGlow * 0.5)
    } else {
      pushCamera(g)
      parts.drawSolid(g, atl)
      const prevOp = g.globalCompositeOperation
      g.globalCompositeOperation = "lighter"
      drawSlashes(g)
      g.globalCompositeOperation = prevOp
      drawWave(g)
      parts.drawAdditive(g, atl)
      for (const b of blades.values()) {
        if (b.visible(nowMs)) b.draw(g, nowMs, Math.max(3, H * 0.014), 1 + Math.min(1.2, combo * 0.06), q.glow)
      }
      g.restore()
    }

    pushCamera(g)
    scene.drawForeground(g, px)
    g.restore()

    // The gate dims and desaturates the frozen market behind it.
    if (gate) {
      g.fillStyle = "rgba(6,4,16,0.66)"
      g.fillRect(0, 0, W, H)
    }

    // NOTHING IN THIS GAME IS RED. The damage vignette is gone with the rest of
    // the scolding; a bomb is loud, and loud is not the same as red.
    if (reduced && feel.flashAlpha > 0.001) {
      g.strokeStyle = withAlpha(feel.currentFlashColor, Math.min(0.8, feel.flashAlpha * 2))
      g.lineWidth = 10
      g.strokeRect(5, 5, W - 10, H - 10)
    } else if (feel.flashAlpha > 0.001) {
      g.fillStyle = withAlpha(feel.currentFlashColor, feel.flashAlpha)
      g.fillRect(0, 0, W, H)
    }

    drawHud(g, nowMs)
  }

  // ── loop ─────────────────────────────────────────────────────────────────
  let raf = 0
  let last = performance.now()

  function frame(nowMs: number): void {
    if (!running) return
    raf = requestAnimationFrame(frame)
    if (paused) {
      last = nowMs
      return
    }
    const rawDt = Math.min(64, nowMs - last)
    last = nowMs
    if (gov.sample(rawDt)) resize()

    const simMs = feel.advance(rawDt, nowMs)
    if (simMs > 0) {
      let remaining = simMs / 1000
      let guard = 0
      while (remaining > 0 && guard++ < 4) {
        const step = Math.min(remaining, 1 / 90)
        update(step, nowMs)
        remaining -= step
      }
    }
    if (!over) resolveCuts(nowMs)
    else for (const b of blades.values()) b.takeSegments()

    draw(nowMs)
  }
  raf = requestAnimationFrame(frame)

  function setPaused(on: boolean): void {
    if (on === paused) return
    paused = on
    if (on) {
      pausedAt = performance.now()
      for (const b of blades.values()) b.end()
      audio.suspend()
      return
    }
    // Every wall-clock mark moves forward by exactly the time the game was
    // stopped. This is the difference between "the game froze" and "the game
    // skipped", and the shift is UNIFORM so every comparison between two marks
    // answers the same way it did before.
    const held = performance.now() - pausedAt
    overAt += held
    waveBornCut += held
    decisionAt += held
    if (gate) gate.askedAt += held
    for (const b of world.bodies) {
      b.bornAt += held
      b.cuttableAt += held
      b.nextFuseAt += held
    }
    feel.shift(held)
    last = performance.now()
    audio.resume()
  }

  // The first order, once every closure above exists.
  director.intensity = intensity
  newOrder()

  // Diagnostics, opt-in via `?debug`. Not attached in normal play.
  type Dbg = {
    stats(): Record<string, number | string>
    targets(): Array<{ x: number; y: number; r: number; kind: number; text: string; correct: boolean; value: number }>
    setTier(name: "low" | "high" | "ultra"): void
    setIntensity(v: number): void
  }
  type DebugWindow = typeof globalThis & { __slice?: Dbg }
  if (typeof location !== "undefined" && location.search.includes("debug")) {
    ;(globalThis as DebugWindow).__slice = {
      stats: () => ({
        W,
        H,
        dpr,
        tier: gov.quality.name,
        medianMs: Number(gov.medianMs().toFixed(2)),
        p95Ms: Number(gov.p95Ms().toFixed(2)),
        bodies: world.liveCount(),
        cuttable: liveCuttable(),
        particles: parts.alive,
        chunks: world.chunks.filter((c) => c.alive).length,
        elapsed: Number(director.elapsed.toFixed(1)),
        intensity: Number(intensity.toFixed(4)),
        success: Number(success.toFixed(4)),
        rung,
        phase: director.phase,
        hardCap: director.hardCap(),
        targetCount: director.targetCount(),
        score,
        best,
        lamps,
        combo,
        favour,
        bestFavour,
        totalCuts,
        freeCuts,
        pricedCuts,
        ordersFilled,
        overshoots,
        hostOrders,
        ownOrders,
        orderQid: order.questionId,
        target: order.target,
        residual: order.residual,
        plate: order.plate(),
        frontier: frontierBuf.join(","),
        gate: gate ? gate.q.prompt : "",
        hold: Number(holdLeft.toFixed(3)),
        wave: waveOn ? 1 : 0,
        waveCuts,
        over: over ? 1 : 0,
        lastDecisionMs,
        reveal: reveal ? `${reveal.prompt} = ${reveal.answer}` : "",
        revealLeft: reveal ? Number(reveal.left.toFixed(3)) : -1,
        revealFade: reveal ? Number(reveal.fade.toFixed(3)) : -1,
        blades: blades.size,
      }),
      targets: () =>
        world.bodies
          .filter((b) => b.alive)
          .map((b) => ({ x: b.x, y: b.y, r: b.r, kind: b.kind, text: b.text, correct: b.correct, value: b.value })),
      setTier: (name) => {
        gov.quality = TIERS[name]
        resize()
      },
      // Diagnostics only, and gated behind `?debug` exactly as `setTier` is: a
      // gate test that had to play its way up the ladder first would be a test
      // of the ladder, not of the gate.
      setIntensity: (v) => {
        intensity = Math.max(0, Math.min(1, v))
        success = seedSuccess(SECOND_GRADE_FLOW, intensity)
        director.intensity = intensity
        rung = rungAt(intensity, BANDS.length)
      },
    }
  }

  return {
    setPaused,

    unmount(): void {
      running = false
      writeIntensity(intensity)
      guide.destroy()
      cancelAnimationFrame(raf)
      ro.disconnect()
      stopInsets()
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerup", onUp)
      canvas.removeEventListener("pointercancel", onUp)
      globalThis.removeEventListener("keydown", onKey)
      document.removeEventListener("visibilitychange", onVisibility)
      audio.dispose()
      root.remove()
    },
  }
}
