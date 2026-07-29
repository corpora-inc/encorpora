// THE SPLIT — the game.
//
// One verb: cut.
//
//   * Cut a **composite** and it splits open along your blade; its two factors
//     come out of the wound as real objects you can cut again. The gesture *is*
//     the factor tree.
//   * Cut a **prime** and it bursts gold. Primes are the payoff, not a trap —
//     you are always rewarded for slicing, which is the only way this format
//     works.
//   * Cut a **sigil** and the equation on it detonates into the air as four
//     floating candidates. Cut the right one. The answer is a *slice*, not a
//     button, so the whole game stays one gesture from top to bottom.
//   * Cut a **bomb** and you lose a lamp. Three lamps.
//
// Nothing here ever ends. It escalates.

import { createInstructions, safeRect } from "../../../packs/shared/game-chrome/index.ts"
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
  tickRect,
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
  SIGIL_PLATE,
  UI_FONT,
  WRONG,
  withAlpha,
} from "./render/palette.ts"
import { KIND_DOT, KIND_SHARD, KIND_SPARK, Particles } from "./render/particles.ts"
import { Scene } from "./render/scene.ts"
import { B_BOMB, B_MOTE, B_NUMERAL, B_SIGIL, World, type Body } from "./sim/body.ts"
import { Director, type Throw } from "./sim/director.ts"
import {
  answerGain,
  CANDIDATE_READ_LOCK_MS,
  favourAfter,
  FAVOUR_SECONDS,
  LAMPS,
  lampCost,
  moteSecondsFor,
  READ_PER_LAMP,
  reportsToCurriculum,
  type Verdict,
} from "./sim/economy.ts"
import { buildNumberPool, chooseSplit, isPrime } from "./sim/factor.ts"

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
 * game and it does more to sell "that was cut" than any particle — the eye gets
 * an explicit, geometric record of where the edge went.
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

const CHAIN_WINDOW = 0.75 // seconds; a cut inside this extends the chain

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
  // THE SPLIT had no pause at all. The host can put a sheet over a still-mounted
  // pack, and the child can open the manual mid-run, and underneath either one
  // the market kept throwing: bombs kept arriving, a live question's window kept
  // draining, and a child who opened the rules *because they were stuck* was
  // charged the reading time and sometimes lost the lamp while reading about it.
  //
  // Declared here rather than beside the loop because `createInstructions` below
  // closes over them, and a `let` is in its temporal dead zone until this line.
  let paused = false
  let pausedAt = 0
  // The manual only lifts a pause it put on itself. A game the host had already
  // paused must not be handed back running because a child closed the rules.
  let heldForManual = false

  // How to play. THE SPLIT shipped with none: a child was handed a screen of
  // flying gourds and had to infer from nothing that a swipe cuts, that a cut
  // number splits into its factors, and that the four lanterns are a question.
  // The manual stays reachable during play, because the moment a child needs
  // the rules is never the title.
  const guide = createInstructions(el, {
    title: "THE SPLIT",
    summary: [
      "Fruit flies up out of the market. Swipe your finger across it to cut it.",
      "Cut a number and it splits into two smaller numbers. Cut those too.",
    ],
    sections: [
      {
        heading: "Cutting numbers",
        lines: [
          "Swipe your finger right across a gourd to slice it open.",
          "A gourd with 48 on it splits into a 6 and an 8. Both of them fly out.",
          "Cut the 8 and it splits again, into 2 and 4.",
          "Some numbers do not split at all. A 7 just bursts into gold. Those are the best ones to find.",
        ],
      },
      {
        heading: "Answering a question",
        lines: [
          "Some things that fly up are flat tablets with a sum on them, like 7 x 8.",
          "Cut the tablet and four numbers float up and stop in a row.",
          "Work out the sum, then swipe the number that is the answer.",
          "You cannot cut them straight away. You get a moment to read them first.",
        ],
      },
      {
        heading: "The market waits for you",
        lines: [
          "While a sum is up, the whole market stops. Nothing is thrown and no bombs come out.",
          "Take as long as you need. A big sum keeps the lanterns up for much longer than a small one.",
          "The market only starts again once you have answered, so answering is how you get it back.",
        ],
      },
      {
        heading: "Your three lamps",
        lines: [
          "You lose a lamp if you cut a bomb. Bombs are small and spiky and have a lit fuse.",
          "A wrong answer never costs a lamp. It costs the market's favour, which is your multiplier.",
          "Thinking is always free, and so is running out of time.",
          "When all three lamps go out the market shuts. One tap opens it again.",
        ],
      },
    ],
    reducedMotion: reduced,
    // The one part of pausing the shared sheet cannot do for us: sound, keys and
    // taps are already held over there, but nothing outside this file knows what
    // this game's clock is.
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
  // 324 and not 144: three digits is the legibility ceiling on a 320px screen,
  // and the director walks its magnitude cap up to it over a long run rather
  // than starting there. 288 = 2·2·2·2·2·3·3 is a seven-deep cascade, and that
  // is what minute fifteen is for.
  const numbers = buildNumberPool(2, 324)
  let rng = new Rng(0x51ce ^ (Date.now() & 0xffff))
  let director = new Director(rng, numbers)

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
  let chain = 0
  let chainTimer = 0
  let bestChain = 0
  let cutsThisStroke = 0
  let totalCuts = 0
  let asked = 0
  let right = 0
  let vignette = 0
  let goldGlow = 0
  let lastAnswerMs = 0

  // ── market favour: the reason reading beats guessing ──────────────────────
  //
  // A measured playtest of the previous build had a pure-guesser bot score
  // 31,208 against a skilled bot's 31,190 over the same seventy seconds —
  // statistically identical — because score came overwhelmingly from slicing
  // gourds and a sigil was a ten-second interruption to a slicer.
  //
  // Favour fixes the economy at its root instead of nerfing the slicing. Every
  // correct answer raises a global multiplier that applies to **everything** —
  // every gourd, every prime, every cascade — so answering is not merely worth
  // points, it is worth all of your other points again. A wrong answer drops it
  // straight back to one. Guessing does not cost the child a lecture; it costs
  // them the entire economy.
  //
  // And the reason it is now the ONLY cost a wrong lantern carries. Stacking a
  // lamp on top of it is what made never answering the rational play: a timeout
  // cost a point of favour and nothing else, a wrong answer cost a lamp and all
  // of it, so a child unsure of the sum was strictly better off letting the
  // sigil expire. Lamps are spent on bombs now — the one hazard a child chooses
  // to touch. See `economy.ts`.
  let favour = 1
  let favourLeft = 0
  /**
   * Progress toward relighting a lamp, in sigils read. Deliberately
   * **cumulative, not consecutive**: two correct answers at any point in the
   * run buy a lamp back, and a wrong one never takes that progress away. The
   * house rule against streak-keyed escalation is right — "don't break it" is
   * the anxiety this product does not sell — and a recovery meter that only
   * ever fills is both kinder and a better reason to keep reading.
   */
  let readCredit = 0
  let bestFavour = 1
  /**
   * Where the score actually came from. Exposed on the debug object so the
   * claim "answering is the biggest score event in the game" is a number
   * somebody can check, not a designer's opinion. The previous build's judge
   * had to infer it from a guesser bot scoring the same as a reader.
   */
  let earnedAnswering = 0
  let earnedSlicing = 0

  // The FAVOUR CUT — a shockwave that answers the question "why should I care
  // about the tablet". A correct answer throws a ring out of the lantern that
  // splits every gourd it passes through, cascading their factors, at the
  // multiplier the answer just raised. It is the biggest score event in the
  // game and it is the only one the child cannot reach by slicing.
  let waveOn = false
  let waveX = 0
  let waveY = 0
  let waveR = 0
  let waveSpeed = 0
  let waveMax = 0
  let waveId = 0
  let waveCuts = 0
  let waveBornCut = 0
  /** Everything the wave earns, paid out as ONE label instead of a dozen. */
  let waveGain = 0

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
      // Grows outward as it fades: the wound opens.
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

  // Active question, if a sigil has been opened.
  let liveQ: Question | null = null
  let liveQAt = 0
  let moteLeft = 0
  let moteWindow = moteSecondsFor(1)
  // Questions riding on sigils that are in the air but not yet cut, by id. A
  // Map and not a single slot: two sigils can legitimately overlap, and holding
  // one variable made the older tablet cut into nothing at all.
  const pendingQ = new Map<string, Question>()

  const throwBuf: Throw[] = []
  for (let i = 0; i < 24; i++)
    throwBuf.push({ kind: "numeral", value: 0, delayMs: 0, bandT: 0.5, apex: 0.7 })

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

  // ── layout ───────────────────────────────────────────────────────────────
  /**
   * Where every readout goes.
   *
   * Re-derived on every resize, never cached across one: rotation swaps the
   * insets top-for-side, and iPadOS changes them when the pack is resized in
   * Split View. A layout solved once at mount is correct until the first
   * rotation and wrong after it.
   */
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

  /**
   * A floating label.
   *
   * Two labels that overlap read as one number — a screenshot of the previous
   * pass has `+1211` sitting on `+13080` and the eye reports "+121180", which is
   * the same run-on defect this batch was told off for. So a new pop is nudged
   * clear of every live one before it is placed, and if it cannot find clear
   * air within a few nudges it is dropped rather than drawn on top of another.
   * A missing label costs nothing; an unreadable one costs trust in every
   * number on screen.
   */
  function pop(text: string, x: number, y: number, size0: number, color: string, weight = 1): void {
    // Labels shrink with the viewport. A 44px `+20886` is 260px wide, which ran
    // clean off the right edge of a 390px phone — half a number is worse than
    // no number.
    const size = Math.max(13, Math.min(size0, W * 0.085, (W * 0.86) / Math.max(1, text.length * 0.62)))
    // Rough half-extents. Numerals in UI_FONT run about 0.62em wide.
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
      // Always inside the frame, on every viewport.
      px = Math.max(hw + 4, Math.min(W - hw - 4, px))
      py = Math.max(size * 0.7, Math.min(H - size * 0.9, py))
      // And never inside a live banner. The banner is the equation the child is
      // being shown; a score label laid across it is the run-on defect again,
      // just with two different kinds of number.
      if (banner) {
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

  function launch(t: Throw): boolean {
    // Never stack questions. A second tablet while one is live would put eight
    // candidates in the air belonging to two different prompts, which is the
    // single most confusing thing this game could do.
    if (t.kind === "sigil" && (liveQ !== null || world.liveCount(B_SIGIL) > 0)) return false
    const b = world.spawnBody()
    if (!b) return false
    const gr = gravity()
    const x = W * (0.06 + t.bandT * 0.88)
    const y = H + 70
    const apexH = H * t.apex + 70
    const vy = -Math.sqrt(2 * gr * apexH)
    // Drift toward the middle so nothing leaves the frame before its apex.
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
    } else if (t.kind === "sigil") {
      b.kind = B_SIGIL
      b.r = Math.max(34, Math.min(62, H * 0.062))
      const q = host.next({ difficulty: director.questionDifficulty(asked ? right / asked : 0.75) })
      pendingQ.set(q.id, q)
      b.qid = q.id
      b.text = q.prompt
      b.glyphH = b.r * 1.02
      b.spin = rng.range(-0.9, 0.9)
      // A sigil hangs longer so it is always answerable: two-thirds gravity.
      b.grav = gr * 0.62
      b.vy = -Math.sqrt(2 * b.grav * apexH)
    } else {
      b.kind = B_NUMERAL
      b.value = t.value
      b.text = String(t.value)
      b.r = radiusFor(t.value)
      b.glyphH = b.r * 1.34
      b.fleshIdx = rng.int(0, FLESHES.length - 1)
      b.depth = 0
    }
    world.shape(b, rng)
    audio.toss()
    return true
  }

  function radiusFor(v: number): number {
    // Bigger numbers are bigger objects — the value is legible from the
    // silhouette before you can read the glyph, which buys reaction time.
    //
    // Sized against the SHORT axis, not the tall one. A height-derived radius
    // put 94px-wide gourds on a 390px phone, and once the density floor put
    // seven of them in the air at once they stacked into an unreadable heap —
    // the numbers stop meaning anything the moment they overlap. Roughly five
    // three-digit gourds now fit across any viewport.
    const digits = String(v).length
    const base = Math.min(H * 0.045, W * 0.055)
    return Math.max(17, Math.min(H * 0.075, W * 0.09, base * (0.98 + digits * 0.14)))
  }

  function spawnFactor(
    from: Body,
    value: number,
    dirX: number,
    dirY: number,
    speed: number,
    depth: number,
  ): void {
    const b = world.spawnBody()
    if (!b) return
    b.kind = B_NUMERAL
    b.value = value
    b.text = String(value)
    b.r = radiusFor(value)
    b.glyphH = b.r * 1.34
    b.fleshIdx = from.fleshIdx
    b.depth = depth
    b.x = from.x + dirX * from.r * 0.4
    b.y = from.y + dirY * from.r * 0.4
    b.vx = from.vx * 0.55 + dirX * speed
    b.vy = from.vy * 0.5 + dirY * speed - H * 0.28
    b.grav = gravity()
    b.spin = rng.range(-6, 6)
    b.rot = rng.range(0, Math.PI * 2)
    b.bornAt = performance.now()
    // Long enough that the stroke which opened the parent cannot also take the
    // children, short enough that a quick second flick still chains.
    b.cuttableAt = b.bornAt + 140
    world.shape(b, rng)
  }

  function openSigil(b: Body): void {
    const q = pendingQ.get(b.qid)
    if (!q) return
    pendingQ.delete(b.qid)
    if (liveQ) expireQuestion()
    liveQ = q
    liveQAt = performance.now()
    moteWindow = moteSecondsFor(q.difficulty)
    moteLeft = moteWindow
    asked++
    audio.sigilOpen()

    const values = rng.shuffle([q.answer, ...q.distractors.slice(0, 3)])
    const n = values.length
    // Candidates take **fixed, evenly spaced slots** and spring to them.
    //
    // They used to scatter ballistically from the tablet, and a normal 260px
    // stroke aimed at the right answer routinely clipped a neighbour on the way
    // in — the child was punished for aiming correctly. Slots guarantee clear
    // air between any two candidates.
    //
    // The row is solved in `render/hud.ts`, against the SAFE rect rather than
    // the canvas and never rising into the host's two corner controls. These
    // lanterns are the answer input: they are the one thing here a child must
    // both read and touch, so they get the strictest clearance in the game.
    const row = candidateRow(hud, n, b.x, b.y)
    const r = row.r
    for (let i = 0; i < n; i++) {
      const m = world.spawnBody()
      if (!m) continue
      const home = candidateHome(row, i, n)
      m.kind = B_MOTE
      m.text = values[i] as string
      m.value = Number(values[i])
      m.correct = values[i] === q.answer
      m.qid = q.id
      m.x = b.x
      m.y = b.y
      // A shallow arc, high in the middle: it reads as a row of raised lanterns
      // rather than a line of buttons.
      m.homeX = home.x
      m.homeY = home.y
      m.vx = (m.homeX - b.x) * 2.4
      m.vy = (m.homeY - b.y) * 2.4 - H * 0.1
      m.grav = 0
      m.r = r
      m.spin = 0
      m.rot = 0
      m.phase = i * 1.6
      m.bornAt = performance.now()
      // A candidate has to be *read* before it can be cut. Without this the
      // stroke that opened the tablet answered the question itself, in 0ms.
      m.cuttableAt = m.bornAt + CANDIDATE_READ_LOCK_MS
      m.glyphH = m.r * 1.24
      world.shape(m, rng)
    }
  }

  function clearMotes(exceptCorrectFlash: boolean): void {
    for (const b of world.bodies) {
      if (!b.alive || b.kind !== B_MOTE) continue
      if (exceptCorrectFlash && b.correct) {
        // Show the child *where* the answer was, then dissolve it. The value
        // itself is stated by the banner, not left floating over the field as
        // an uncuttable numeral.
        burst(b.x, b.y, PRIME_GOLD, 26, 220)
        addSlash(b.x, b.y, 1, 0, b.r * 2.2, PRIME_GOLD)
      } else {
        burst(b.x, b.y, MOTE_RING, 8, 120)
      }
      b.reset()
    }
    liveQ = null
  }

  function burst(x: number, y: number, color: string, n: number, speed: number): void {
    const cid = parts.colorId(color)
    const q = gov.quality
    const count = Math.round(n * q.burst)
    for (let i = 0; i < count; i++) {
      const a = rng.next() * Math.PI * 2
      const s = speed * (0.25 + rng.next() * 1.1)
      parts.spawn(
        KIND_DOT,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        0.35 + rng.next() * 0.55,
        10 + rng.next() * 22,
        cid,
        2.2,
        420,
        0,
      )
    }
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
          // Candidates use a tighter hit radius than fruit: the cost of clipping
          // the wrong one is a lamp, so the blade has to actually go through it.
          const rr = b.r * (b.kind === B_MOTE ? 0.82 : 1.06)
          if (segPointDistSq(seg.ax, seg.ay, seg.bx, seg.by, b.x, b.y) > rr * rr) continue
          cutBody(b, seg.ax, seg.ay, seg.bx, seg.by, seg.speed)
        }
      }
    }
  }

  function cutBody(
    b: Body,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    speed: number,
  ): void {
    let dx = bx - ax
    let dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    const nx = -dy
    const ny = dx
    const impulse = Math.min(760, 150 + speed * 0.34)
    const q = gov.quality

    // Chain bookkeeping is shared by every cuttable class.
    const inChain = chainTimer > 0
    chain = inChain ? chain + 1 : 1
    chainTimer = CHAIN_WINDOW
    bestChain = Math.max(bestChain, chain)
    cutsThisStroke++
    totalCuts++

    if (b.kind === B_BOMB) {
      addSlash(b.x, b.y, dx, dy, b.r * 2.0, WRONG)
      b.reset()
      onBomb(b, nx, ny)
      return
    }
    addSlash(
      b.x,
      b.y,
      dx,
      dy,
      b.r * 2.3,
      b.kind === B_MOTE ? (b.correct ? PRIME_HOT : WRONG) : b.kind === B_SIGIL ? SIGIL_HOT : "#fffaf0",
    )

    if (b.kind === B_SIGIL) {
      world.cut(b, b.x, b.y, nx, ny, impulse, false)
      spray(b.x, b.y, SIGIL_EDGE, SIGIL_HOT, impulse, nx, ny, 1.15)
      feel.addTrauma(0.2)
      feel.kick(dx, dy, 5)
      feel.punch(0.02)
      host.haptic("medium")
      openSigil(b)
      b.reset()
      return
    }

    if (b.kind === B_MOTE) {
      const wasCorrect = b.correct
      const answered = b.text
      const qid = b.qid
      world.cut(b, b.x, b.y, nx, ny, impulse, wasCorrect)
      b.reset()
      onMoteCut(wasCorrect, answered, qid, b.x, b.y, dx, dy, nx, ny)
      return
    }

    // ── a numeral ──────────────────────────────────────────────────────────
    const flesh = FLESHES[b.fleshIdx % FLESHES.length]
    if (!flesh) return
    const prime = isPrime(b.value)
    world.cut(b, b.x, b.y, nx, ny, impulse, prime)
    spray(b.x, b.y, flesh.juice, flesh.core, impulse, nx, ny, prime ? 1.4 : 1)
    if (q.splats) {
      splats.splat(b.x, b.y, prime ? PRIME_GOLD : flesh.juice, prime ? 6 : 4, b.r * 1.5, () =>
        rng.next(),
      )
    }

    const mult = scoreMul()
    if (prime) {
      const gain = Math.round((10 + b.value * 0.9 + b.depth * 7) * mult)
      score += gain
      if (waveOn) {
        earnedAnswering += gain
        waveGain += gain
      } else {
        earnedSlicing += gain
        // `+68`, never `68`. The old build popped the prime's own value here,
        // in gold, at forty pixels — which is exactly what a live gourd looks
        // like, so the screen filled with numbers that meant nothing and could
        // not be cut. Every floating label in this game now either starts with
        // a plus or contains a multiplication sign; none can be mistaken for a
        // target. During a favour wave they are suppressed entirely and paid as
        // one number, because eleven of them at once is not a reward, it is a
        // wall of overlapping digits.
        pop(`+${gain}`, b.x, b.y - b.r * 0.2, 34, PRIME_GOLD, 1.35)
      }
      audio.prime(chain)
      feel.addTrauma(0.26)
      feel.kick(dx, dy, 7)
      feel.punch(0.028)
      feel.requestFlash(0.1, PRIME_HOT)
      goldGlow = Math.min(1, goldGlow + 0.42)
      host.haptic("medium")
      // Gold shards: a prime leaves *metal*, not pulp. Different debris for a
      // different event, so the payoff is legible with the sound off.
      for (let i = 0; i < Math.round(11 * q.burst); i++) {
        const a = rng.next() * Math.PI * 2
        const sp = 160 + rng.next() * 460
        parts.spawn(
          KIND_SHARD,
          b.x,
          b.y,
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
    } else {
      const split = chooseSplit(b.value, () => rng.next())
      const gain = Math.round((3 + b.value * 0.16) * mult)
      score += gain
      if (waveOn) {
        earnedAnswering += gain
        waveGain += gain
      } else earnedSlicing += gain
      audio.cut(chain, 1)
      feel.addTrauma(0.13)
      feel.kick(dx, dy, 3.4)
      host.haptic("light")
      if (split) {
        const [p, r] = split
        // The factors come out of the wound, along the cut normal, in opposite
        // directions. You can see the arithmetic happen.
        const sp = 120 + impulse * 0.34
        spawnFactor(b, p, nx, ny, sp, b.depth + 1)
        spawnFactor(b, r, -nx, -ny, sp, b.depth + 1)
        // The whole equation, not just the right-hand side: "48 = 6×8" is the
        // factor tree you just performed with your hand, written down.
        if (!waveOn) pop(`${b.value} = ${p}×${r}`, b.x, b.y - b.r * 0.85, 18, flesh.core, 0.4)
      }
    }
    b.reset()

    // Multi-cut in one stroke — the Fruit Ninja "blade" moment. Suppressed
    // while the favour wave is sweeping: those cuts are the *answer's*, not the
    // stroke's, and FAVOUR CUT is the banner that moment has earned.
    if (waveOn) return
    if (cutsThisStroke === 3) {
      feel.slowmo(0.42, 460)
      feel.punch(0.05)
      showBanner("CLEAN SWEEP", "three in one stroke", MOTE_HOT, 1.1)
      host.haptic("success")
    } else if (cutsThisStroke === 5) {
      feel.slowmo(0.32, 620)
      feel.addTrauma(0.4)
      showBanner("FIVE", "one stroke", PRIME_GOLD, 1.3)
    }
    if (chain === 8 || chain === 14 || chain === 22) {
      feel.slowmo(0.5, 420)
      showBanner(`CHAIN ${chain}`, `×${multiplier()}`, PRIME_GOLD, 1.0)
      host.haptic("success")
    }
  }

  function multiplier(): number {
    return 1 + Math.min(5, Math.floor(chain / 4))
  }

  /**
   * Chain × favour, doubled while the favour wave is sweeping.
   *
   * The double is what makes answering unambiguously the biggest score event in
   * the game rather than merely a large one: the answer pays, and then it pays
   * again for every gourd it opens on its way off the screen.
   */
  function scoreMul(): number {
    return multiplier() * favour * (waveOn ? 2 : 1)
  }

  /**
   * Fire the favour shockwave out of (x, y).
   *
   * It only cuts bodies that were already in the air when it started, so a
   * cascade cannot feed itself and run away; the factors it frees are the
   * child's to take with the next stroke.
   */
  function startWave(x: number, y: number): void {
    waveOn = true
    waveX = x
    waveY = y
    waveR = 0
    waveCuts = 0
    waveGain = 0
    waveId++
    waveBornCut = performance.now()
    waveMaxSet()
  }

  function waveMaxSet(): void {
    // Far enough to leave the frame from wherever it started.
    waveMax = Math.hypot(Math.max(waveX, W - waveX), Math.max(waveY, H - waveY)) + 80
    waveSpeed = waveMax / 0.62 // clears the screen in about six-tenths of a second
  }

  function stepWave(dt: number, nowMs: number): void {
    if (!waveOn) return
    const prev = waveR
    waveR += waveSpeed * dt
    const band = Math.max(26, H * 0.05)
    for (const b of world.bodies) {
      if (!b.alive || b.waveMark === waveId) continue
      if (b.kind === B_MOTE || b.kind === B_SIGIL) continue
      // Anything born *after* the wave started is a factor the wave itself
      // freed. Leaving it alone is what keeps a cascade from feeding itself
      // into an unbounded chain reaction on a screen full of 288s.
      if (b.bornAt >= waveBornCut) continue
      const d = Math.hypot(b.x - waveX, b.y - waveY)
      if (d > waveR + b.r * 0.5 || d < prev - band - b.r) continue
      b.waveMark = waveId
      if (b.kind === B_BOMB) {
        // The wave does not detonate bombs in the child's face — it *defuses*
        // them. Being rewarded and then punished by the same event is the kind
        // of thing that teaches a child not to answer.
        burst(b.x, b.y, MOTE_HOT, 14, 200)
        audio.toss()
        b.reset()
        continue
      }
      // Cut along the tangent of the wavefront: the ring visibly opens each
      // gourd as it passes through it.
      const ux = (b.x - waveX) / (d || 1)
      const uy = (b.y - waveY) / (d || 1)
      const tx = -uy
      const ty = ux
      const len = Math.max(b.r * 2.4, 60)
      waveCuts++
      b.cuttableAt = 0
      cutBody(b, b.x - tx * len, b.y - ty * len, b.x + tx * len, b.y + ty * len, 900)
    }
    if (waveR >= waveMax) {
      waveOn = false
      if (waveGain > 0) {
        // Under the banner, never through it: the equation the child just
        // answered is the more important string of the two.
        const py = Math.max(H * 0.46, Math.min(H * 0.8, waveY + H * 0.12))
        pop(`+${waveGain}`, waveX, py, 44, PRIME_HOT, 1.5)
      }
      if (waveCuts >= 6) {
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

  function spray(
    x: number,
    y: number,
    juice: string,
    core: string,
    impulse: number,
    nx: number,
    ny: number,
    scale: number,
  ): void {
    const q = gov.quality
    const cj = parts.colorId(juice)
    const cc = parts.colorId(core)
    const n = Math.round(26 * q.burst * scale)
    for (let i = 0; i < n; i++) {
      // Biased along the cut normal — juice leaves through the wound, both
      // sides, in a cone. A uniform circle reads as an explosion, not a cut.
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

  function onBomb(b: Body, nx: number, ny: number): void {
    audio.bomb()
    feel.addTrauma(reduced ? 0 : 0.95)
    feel.kick(-nx, -ny, 26)
    feel.punch(-0.06)
    feel.requestFlash(0.34, WRONG)
    host.haptic("failure")
    vignette = 1
    chain = 0
    chainTimer = 0
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
    pop("BOMB", b.x, b.y, 34, WRONG, 1.2)
    loseLamp()
  }

  function onMoteCut(
    correct: boolean,
    answered: string,
    qid: string,
    x: number,
    y: number,
    dx: number,
    dy: number,
    nx: number,
    ny: number,
  ): void {
    const ms = Math.round(performance.now() - liveQAt)
    lastAnswerMs = ms
    const verdict: Verdict = correct ? "correct" : "wrong"
    if (reportsToCurriculum(verdict)) host.report({ questionId: qid, correct, ms, answered })
    // The hush ends the instant the question is settled, whichever way it went.
    // A child who answers hands the market back now; a child who lets it expire
    // hands it back at the end of the window. That difference is the entire
    // reason answering beats not answering.
    director.settleQuestion()

    if (correct) {
      right++
      // Recovery is only earned while there is something to recover. Banking
      // credit at full lamps would make the first mistake of a long run free.
      if (lamps < LAMPS) readCredit = Math.min(READ_PER_LAMP, readCredit + 1)
      const q = liveQ
      // Favour is raised *before* the gain is scored, so the answer that earns
      // the multiplier is also the first thing paid at it.
      favour = favourAfter(verdict, favour)
      favourLeft = FAVOUR_SECONDS
      bestFavour = Math.max(bestFavour, favour)
      const mult = scoreMul()
      const gain = answerGain(q?.difficulty ?? 3, mult)
      score += gain
      earnedAnswering += gain
      audio.ascend()
      // The biggest response in the game, and it still blocks nothing.
      feel.hitstop(reduced ? 0 : 100)
      feel.slowmo(0.3, 620)
      feel.addTrauma(0.5)
      feel.kick(dx, dy, 11)
      feel.punch(0.085)
      feel.requestFlash(0.24, PRIME_HOT)
      host.haptic("success")
      goldGlow = 1
      pop(`+${gain}`, x, y - 30, 46, PRIME_GOLD, 1.5)
      showBanner(
        q ? `${q.prompt} = ${answered}` : answered,
        favour > 1 ? `FAVOUR ×${favour}` : `×${mult}`,
        PRIME_GOLD,
        1.5,
      )
      spray(x, y, PRIME_GOLD, PRIME_HOT, 620, nx, ny, 1.7)
      if (gov.quality.splats) {
        splats.splat(x, y, PRIME_GOLD, 9, 120, () => rng.next())
      }
      for (const b of world.bodies) {
        if (b.alive && b.kind === B_MOTE && b.qid === qid) {
          burst(b.x, b.y, PRIME_GOLD, 12, 260)
          b.reset()
        }
      }
      liveQ = null
      // …and the market pays out. Everything in the air opens at once.
      startWave(x, y)
      // Three sigils read buys a lamp back. This is the "math instead of an ad"
      // beat: where a free-to-play game would show a video to continue, this
      // asks for arithmetic — and it never takes the progress away again.
      if (readCredit >= READ_PER_LAMP && lamps < LAMPS) {
        lamps++
        readCredit -= READ_PER_LAMP
        audio.riser()
        showBanner("A LAMP RELIT", "two sigils read", LAMP, 1.4)
        host.haptic("success")
      }
    } else {
      audio.ash()
      // No hitstop on a miss — the retry must stay fast. A kick instead.
      feel.kick(-dx, -dy, 15)
      feel.addTrauma(0.34)
      feel.requestFlash(0.16, WRONG)
      host.haptic("failure")
      vignette = 1
      chain = 0
      chainTimer = 0
      // The whole economy, gone — and that is now the *entire* cost. Favour
      // multiplies every gourd, every prime and every cascade, so a wrong
      // lantern is still the most expensive mistake in the game; it just no
      // longer costs a lamp on top, because a lamp was the thing that made
      // never answering the safe play. `lampCost` is where that is written
      // down and `economy.test.ts` is where it is enforced.
      favour = favourAfter(verdict, favour)
      favourLeft = 0
      // No bare red numeral floating over the field — the equation completes
      // itself instead, in the sigil's own colour. Never a lecture, never a
      // cross; just the thing that was true, stated once.
      if (liveQ) showBanner(`${liveQ.prompt} = ${liveQ.answer}`, "", SIGIL_HOT, 1.4)
      burst(x, y, WRONG, 26, 320)
      clearMotes(true)
      for (let i = 0; i < lampCost(verdict); i++) loseLamp()
    }
  }

  function loseLamp(): void {
    lamps--
    audio.lampOut()
    if (lamps <= 0) {
      lamps = 0
      endRun()
    }
  }

  function endRun(): void {
    over = true
    overAt = performance.now()
    if (score > best) {
      best = score
      writeBest(best)
    }
    feel.addTrauma(0.7)
    feel.slowmo(0.25, 900)
    showBanner("THE MARKET CLOSES", "tap to open again", LAMP, 3)
  }

  function restart(): void {
    over = false
    score = 0
    lamps = LAMPS
    chain = 0
    chainTimer = 0
    bestChain = 0
    totalCuts = 0
    asked = 0
    right = 0
    vignette = 0
    goldGlow = 0
    favour = 1
    favourLeft = 0
    bestFavour = 1
    readCredit = 0
    earnedAnswering = 0
    earnedSlicing = 0
    waveOn = false
    liveQ = null
    pendingQ.clear()
    moteLeft = 0
    banner = null
    world.clear()
    parts.clear()
    splats.clear()
    feel.reset()
    rng = new Rng(0x51ce ^ (Date.now() & 0xffffff))
    director = new Director(rng, numbers)
    for (const p of pops) p.alive = false
    for (const sl of slashes) sl.alive = false
  }

  // ── input ────────────────────────────────────────────────────────────────
  function local(e: PointerEvent): { x: number; y: number } {
    const r = canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function onDown(e: PointerEvent): void {
    // A host sheet is not the manual: the shared module's pointer swallow only
    // covers its own scrim, so the game has to refuse the touch itself. A tap
    // behind a paywall must not start a blade, and must not restart the run.
    if (paused) return
    void audio.start()
    if (over && performance.now() - overAt > 550) {
      restart()
      return
    }
    if (blades.size >= MAX_BLADES) return
    const b = new Blade()
    b.maxSamples = gov.quality.trail
    const p = local(e)
    b.begin(p.x, p.y, e.timeStamp)
    blades.set(e.pointerId, b)
    cutsThisStroke = 0
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
    // Coalesced events are the whole ballgame on a 120Hz digitiser: three
    // positions per frame instead of one, so the trail *is* the finger and a
    // fast flick cannot slip between two samples.
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
    // Keep the ribbon around until it has faded, then drop the blade.
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
    // Coming back to a paused game must not bring the sound back with it: the
    // sheet is still up, and the whole complaint was hearing the game behind it.
    else if (!paused) audio.resume()
  }
  document.addEventListener("visibilitychange", onVisibility)

  let showPerf = false

  // ── update ───────────────────────────────────────────────────────────────
  function update(dtS: number, nowMs: number): void {
    const floor = H

    if (director.rushJustStarted) {
      director.rushJustStarted = false
      audio.riser()
      feel.slowmo(0.45, 700)
      showBanner("MARKET RUSH", "no bombs — cut everything", MOTE_HOT, 1.8)
    }

    if (director.rushJustEnded) {
      director.rushJustEnded = false
      // A rush survived. THE SPLIT's natural stopping point — never `over`,
      // which is a failure, and nothing may be shown after one.
      try {
        host.transition?.("run", "market rush")
      } catch {
        /* a host that throws on a stopping point must not kill the run */
      }
    }

    if (!over) {
      director.quiet = liveQ !== null
      // The density floor is enforced against what is actually in the air, so
      // it holds on a 320×568 phone exactly as it does on a 1280 desktop.
      const live = world.liveCount(B_NUMERAL) + world.liveCount(B_BOMB)
      const n = director.step(dtS, throwBuf, live)
      for (let i = 0; i < n; i++) {
        const t = throwBuf[i] as Throw
        if (!launch(t) && t.kind === "sigil") director.sigilRefused()
      }
    }

    stepWave(dtS, nowMs)

    // Favour cools rather than snapping: a child who answers one more sigil
    // before the meter drains keeps their run alive.
    if (favourLeft > 0) {
      favourLeft -= dtS
      if (favourLeft <= 0) {
        favour = Math.max(1, favour - 1)
        favourLeft = favour > 1 ? FAVOUR_SECONDS * 0.72 : 0
      }
    }

    // Bodies.
    for (const b of world.bodies) {
      if (!b.alive) continue
      b.vy += b.grav * dtS
      b.x += b.vx * dtS
      b.y += b.vy * dtS
      b.rot += b.spin * dtS

      if (b.kind === B_MOTE) {
        // A critically-damped spring to the slot, then a slow bob. Motes are a
        // decision, not a reflex test, so they never fall and never leave.
        // Stiff and critically damped: the lanterns are *hoisted* into their
        // slots in about a quarter second. At k = 46 they were still bunched
        // together when a fast player arrived, which put the whole reason for
        // having slots back in the bin.
        const k = 150
        const damp = 2 * Math.sqrt(k)
        b.vx += ((b.homeX - b.x) * k - b.vx * damp) * dtS
        b.vy += ((b.homeY - b.y) * k - b.vy * damp) * dtS
        b.rot = Math.sin(nowMs * 0.0016 + b.phase) * 0.06
      }
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

      // Off-screen retirement. A numeral that falls past the bottom is simply
      // gone — no penalty. Missing is not a punishment in this game; the
      // punishment is only ever for a cut you chose to make.
      if (b.kind === B_MOTE) continue
      if (b.y > floor + b.r * 3 + 90 || b.x < -W * 0.4 || b.x > W * 1.4) {
        if (b.kind === B_SIGIL) {
          // An uncut tablet leaves with its question; nothing is reported,
          // because nothing was ever asked of the child.
          pendingQ.delete(b.qid)
        }
        b.reset()
      }
    }

    world.updateChunks(dtS, floor)
    parts.update(dtS)
    splats.update(dtS)
    scene.update(dtS)

    // Chain decay.
    if (chainTimer > 0) {
      chainTimer -= dtS
      if (chainTimer <= 0) chain = 0
    }
    vignette = Math.max(0, vignette - dtS * 1.5)
    goldGlow = Math.max(0, goldGlow - dtS * 1.1)

    // The live question's clock.
    if (liveQ) {
      moteLeft -= dtS
      if (moteLeft <= 0) expireQuestion()
    }

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

    audio.setIntensity(director.heat * (director.rushLeft > 0 ? 1 : 0.7))
  }

  function expireQuestion(): void {
    const q = liveQ
    if (!q) return
    const verdict: Verdict = "timeout"
    // **Nothing crosses the wire.** A window that closed on an untouched screen
    // is not evidence that the child does not know the skill — it is evidence
    // that they were still working, and the ladder is the one place that
    // mistake compounds. It used to report `correct: false` here.
    if (reportsToCurriculum(verdict)) {
      host.report({
        questionId: q.id,
        correct: false,
        ms: Math.round(performance.now() - liveQAt),
        answered: "",
      })
    }
    // Never punished with damage, and never with less than an honest wrong
    // answer either: favour falls all the way to one, exactly as a wrong lantern
    // does. What a timeout costs *more* of is market — the hush ran the whole
    // window rather than ending at the cut.
    favour = favourAfter(verdict, favour)
    favourLeft = 0
    for (let i = 0; i < lampCost(verdict); i++) loseLamp()
    director.settleQuestion()
    showBanner(`${q.prompt} = ${q.answer}`, "", SIGIL_EDGE, 1.2)
    clearMotes(true)
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
    // Two passes. Candidates are drawn **last, over everything**, because a
    // gourd sailing through the lantern row put two numerals of different
    // classes on top of each other — and the one that costs a lamp if you get
    // it wrong is the one that has to win.
    drawBodyPass(ctx, nowMs, false)
    drawBodyPass(ctx, nowMs, true)
  }

  function drawBodyPass(ctx: CanvasRenderingContext2D, nowMs: number, motes: boolean): void {
    for (const b of world.bodies) {
      if (!b.alive) continue
      if ((b.kind === B_MOTE) !== motes) continue
      const age = (nowMs - b.bornAt) / 1000
      // Squash-and-stretch on arrival: 1.35 → 1 over 180ms. Everything that
      // enters the frame *lands* rather than appearing.
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
        // Spikes, so the silhouette is unmistakable with no colour at all.
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
        // Fuse.
        ctx.strokeStyle = "#4a3a2a"
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(0, -b.r)
        ctx.quadraticCurveTo(b.r * 0.4, -b.r * 1.5, b.r * 0.1, -b.r * 1.85)
        ctx.stroke()
        ctx.restore()
        continue
      }

      if (b.kind === B_SIGIL) {
        const pulse = 0.72 + Math.sin(nowMs * 0.006 + b.phase) * 0.28
        drawBodyShape(ctx, b)
        ctx.fillStyle = SIGIL_PLATE
        ctx.fill()
        ctx.strokeStyle = withAlpha(SIGIL_EDGE, 0.55 + pulse * 0.45)
        ctx.lineWidth = 3
        ctx.stroke()
        // Corner filaments.
        ctx.fillStyle = withAlpha(SIGIL_HOT, pulse)
        for (const [sx, sy] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ] as const) {
          ctx.beginPath()
          ctx.arc(sx * b.r * 1.42, sy * b.r * 0.72, 3.2, 0, Math.PI * 2)
          ctx.fill()
        }
        drawNumeral(ctx, b.text, b.r * 1.02)
        ctx.restore()
        continue
      }

      if (b.kind === B_MOTE) {
        const pulse = 0.6 + Math.sin(nowMs * 0.005 + b.phase) * 0.4
        // A lantern: ring, inner glass, numeral. Never coloured by correctness —
        // that would give the answer away.
        //
        // The wide, nearly opaque backing plate is deliberate: it darkens
        // whatever fruit happens to be passing behind so the candidate always
        // reads as the front-most object in the frame.
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

      // A numeral gourd.
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
      // Lamp specular from above-left; the market lights are overhead.
      ctx.beginPath()
      ctx.ellipse(-b.r * 0.34, -b.r * 0.44, b.r * 0.3, b.r * 0.18, -0.6, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(255,238,205,0.3)"
      ctx.fill()
      drawNumeral(ctx, b.text, b.r * 1.34)
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
      // The cut face is a *bright* gradient running from the wound inward — the
      // lamp light got inside. This is the wet chunk.
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
      // …and the half of the numeral that was on this piece. Same glyph, same
      // place, clipped by the same polygon — so a 48 cut down the middle falls
      // apart into two halves of a 48 rather than politely vanishing.
      if (c.text && c.gh > 0) {
        const img = atl.numeral.get(c.text)
        const s = c.gh / img.h
        ctx.globalAlpha = Math.min(1, t * 2.4) * 0.92
        ctx.drawImage(
          img.c,
          c.gx - (img.w * s) / 2,
          c.gy - (img.h * s) / 2,
          img.w * s,
          img.h * s,
        )
      }
      ctx.restore()
      ctx.strokeStyle = "rgba(255,246,225,0.5)"
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.restore()
      ctx.globalAlpha = 1
    }
  }

  function drawHud(ctx: CanvasRenderingContext2D, nowMs: number): void {
    // Every number below comes off the layout, which knows two things this
    // function must not have to: where the safe rect is, and where the host
    // floats its exit and how-to-play controls. Nothing here is measured from
    // the canvas edge any more.
    const { big } = hud

    // Score, top-left — under the safe edge and clear of the exit control.
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

    // Lamps, top-right. Three hanging lanterns; a dead one is dark AND unlit AND
    // struck through, so "how much life" never depends on colour. They hang from
    // BELOW the how-to-play control — they used to hang behind it.
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

    // Progress toward relighting, in sigils read. Only drawn when there is a
    // lamp to win back, so it is never decoration. Three filled ticks and the
    // dark lamp comes on — this is the game's "watch an ad to continue", and
    // the price is arithmetic.
    if (lamps < LAMPS) {
      for (let i = 0; i < READ_PER_LAMP; i++) {
        const t = tickRect(i, hud)
        ctx.fillStyle =
          i < readCredit ? withAlpha(SIGIL_HOT, 0.95) : "rgba(255,255,255,0.16)"
        ctx.fillRect(t.x, t.y, t.w, t.h)
      }
    }

    // One multiplier line, and where it came from. Chain is what your hand
    // earned; favour is what your reading earned. Showing the product first is
    // deliberate — the child should see the number that scales their whole run,
    // and only then notice that most of it says FAVOUR.
    if (chain >= 3 || favour > 1) {
      const m = scoreMul()
      const t = Math.min(1, chainTimer / CHAIN_WINDOW)
      const hot = favour > 1
      ctx.textAlign = "left"
      ctx.textBaseline = "top"
      const ms = big * (hot ? 0.78 : 0.62)
      const y0 = hud.mulY
      ctx.font = font(UI_FONT, ms)
      const label = `×${m}`
      ctx.fillStyle = withAlpha(hot ? PRIME_HOT : PRIME_GOLD, 0.62 + t * 0.38)
      ctx.fillText(label, hud.scoreX, y0)
      // MEASURED, not guessed. A fixed offset put "×36" straight through
      // "FAVOUR 3" the moment the multiplier reached two digits — the same
      // run-on-number defect this batch was told off for, in the HUD instead of
      // the playfield. Every offset below is derived from a real metric.
      const lx = hud.scoreX + ctx.measureText(label).width + big * 0.42
      const sm = big * 0.34
      ctx.font = font(UI_FONT, sm)
      if (favour > 1) {
        // A drain bar for favour, so its expiry is never a surprise. Width, not
        // colour, carries the information. It sits ABOVE the label with a full
        // line of clearance, not through it.
        const bw2 = big * 1.9
        const f = Math.max(0, Math.min(1, favourLeft / FAVOUR_SECONDS))
        ctx.fillStyle = "rgba(255,255,255,0.16)"
        ctx.fillRect(lx, y0 + 1, bw2, 3)
        ctx.fillStyle = withAlpha(PRIME_HOT, 0.95)
        ctx.fillRect(lx, y0 + 1, bw2 * f, 3)
        ctx.fillStyle = withAlpha(PAPER, 0.72)
        ctx.fillText(`FAVOUR ${favour}`, lx, y0 + sm * 0.9)
        ctx.fillStyle = withAlpha(PAPER, 0.42)
        ctx.fillText(`CHAIN ${chain}`, lx, y0 + sm * 2.1)
      } else {
        ctx.fillStyle = withAlpha(PAPER, 0.62)
        ctx.fillText(`CHAIN ${chain}`, lx, y0 + sm * 0.9)
      }
    }

    // The live question banner. Pinned, legible, with a draining bar — a child
    // who lost track of which sigil they opened can always re-read it.
    if (liveQ) {
      const { x: bx, y: by, w: bw, h: bh } = hud.banner
      ctx.fillStyle = "rgba(8,6,20,0.82)"
      roundRect(ctx, bx, by, bw, bh, 10)
      ctx.fill()
      ctx.strokeStyle = withAlpha(SIGIL_EDGE, 0.75)
      ctx.lineWidth = 2
      roundRect(ctx, bx, by, bw, bh, 10)
      ctx.stroke()
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.font = font(UI_FONT, bh * 0.5)
      ctx.fillStyle = PAPER
      ctx.fillText(`${liveQ.prompt} = ?`, bx + bw / 2, by + bh * 0.46)
      const frac = Math.max(0, moteLeft / moteWindow)
      ctx.fillStyle = withAlpha(frac < 0.3 ? WRONG : SIGIL_EDGE, 0.9)
      ctx.fillRect(bx + 6, by + bh - 7, (bw - 12) * frac, 4)
    }

    // Floating score pops.
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

    // Banner. Suppressed once the market has closed: the overlay owns the
    // screen then, and two centred strings fought each other.
    if (banner && !over) {
      const t = banner.life / banner.maxLife
      const a = Math.min(1, t * 3.4)
      const s = Math.max(26, Math.min(64, W * 0.062)) * (1 + (1 - t) * 0.12)
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
      const acc = asked ? Math.round((right / asked) * 100) : 0
      ctx.fillText(
        `${totalCuts} cuts · best chain ${bestChain} · ${right}/${asked} sigils (${acc}%)`,
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
          `${parts.alive}p · ${world.liveCount()}b · ans ${lastAnswerMs}ms`,
        W - 8,
        H - 18,
      )
      ctx.textAlign = "left"
    }
  }

  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
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
    scene.draw(g, director.heat * 0.6 + goldGlow * 0.4, px, py)
    splats.draw(g, 0.5)
    drawChunks(g)
    drawBodies(g, nowMs)
    g.restore()

    // Emissive pass → bloom.
    const eg = bloom.begin()
    if (eg) {
      pushCamera(eg)
      drawSlashes(eg)
      drawWave(eg)
      parts.drawAdditive(eg, atl)
      for (const b of blades.values()) {
        if (b.visible(nowMs)) b.draw(eg, nowMs, Math.max(3, H * 0.014), 1 + Math.min(1.2, chain * 0.06), q.glow)
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
        if (b.visible(nowMs)) b.draw(g, nowMs, Math.max(3, H * 0.014), 1 + Math.min(1.2, chain * 0.06), q.glow)
      }
      g.restore()
    }

    pushCamera(g)
    scene.drawForeground(g, px)
    g.restore()

    // Damage vignette. Red at the edges, never a full-screen wash — a
    // full-screen red on a children's product is both a flash risk and a scold.
    if (vignette > 0.001) {
      const grd = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.72)
      grd.addColorStop(0, "rgba(0,0,0,0)")
      grd.addColorStop(1, withAlpha(WRONG, 0.5 * vignette))
      g.fillStyle = grd
      g.fillRect(0, 0, W, H)
    }
    // Reduced motion replaces the flash with a static border pulse: the same
    // information, none of the luminance change.
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
      // Nothing steps, nothing resolves and nothing is drawn: the canvas holds
      // its last frame, which is exactly what belongs under the scrim. `last`
      // still tracks the real clock so the resume cannot land one enormous
      // frame — a minute behind the manual would otherwise arrive as a minute
      // of gravity in a single step.
      last = nowMs
      return
    }
    const rawDt = Math.min(64, nowMs - last)
    last = nowMs
    if (gov.sample(rawDt)) resize()

    const simMs = feel.advance(rawDt, nowMs)
    if (simMs > 0) {
      // Fixed-ish substeps so a 30fps device does not tunnel objects through
      // the blade or integrate gravity visibly wrong.
      let remaining = simMs / 1000
      let guard = 0
      while (remaining > 0 && guard++ < 4) {
        const step = Math.min(remaining, 1 / 90)
        update(step, nowMs)
        remaining -= step
      }
    }
    // Cuts resolve even during hitstop: the freeze is a *visual* reward and must
    // never eat an input the child already made.
    if (!over) resolveCuts(nowMs)
    else for (const b of blades.values()) b.takeSegments()

    draw(nowMs)
  }
  raf = requestAnimationFrame(frame)

  /**
   * Stop or start the market's clock.
   *
   * Idempotent in both directions: two pauses are one pause, and resuming a
   * running game is nothing. The host calls this around its own sheets, and the
   * manual calls it around itself.
   */
  function setPaused(on: boolean): void {
    if (on === paused) return
    paused = on
    if (on) {
      pausedAt = performance.now()
      // A finger that was mid-stroke when the sheet came up will never get its
      // `pointerup` — the shared module swallows it — so the ribbons are ended
      // here rather than left hanging for the length of the read.
      for (const b of blades.values()) b.end()
      audio.suspend()
      return
    }
    // Every wall-clock mark moves forward by exactly the time the game was
    // stopped. This is the whole difference between "the game froze" and "the
    // game skipped": without it, a three-minute read makes the live question
    // expire on the first frame back, every bomb's fuse tick at once, and the
    // next `report` bills the child three minutes of thinking time they spent
    // reading the rules.
    //
    // The shift is UNIFORM, which is what keeps every comparison between two
    // marks — `b.bornAt >= waveBornCut`, `nowMs > b.cuttableAt` — answering the
    // same way it did before the pause.
    const held = performance.now() - pausedAt
    overAt += held
    liveQAt += held
    waveBornCut += held
    for (const b of world.bodies) {
      b.bornAt += held
      b.cuttableAt += held
      b.nextFuseAt += held
    }
    // Hitstop and slow-motion are wall-clock too, over in `feel`.
    feel.shift(held)
    // Blade ribbons are deliberately NOT shifted. A stroke from before the read
    // has expired, and bringing it back would hand the child a live blade they
    // are not touching.
    last = performance.now()
    audio.resume()
  }

  // Diagnostics, opt-in via `?debug` on the harness URL. Not attached in normal
  // play, so nothing leaks into the host page. This is what the automated
  // playtest aims with — a bot that cannot see the objects cannot prove the
  // game is playable.
  type Dbg = {
    stats(): Record<string, number | string>
    targets(): Array<{ x: number; y: number; r: number; kind: number; text: string; correct: boolean }>
    setTier(name: "low" | "high" | "ultra"): void
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
        particles: parts.alive,
        chunks: world.chunks.filter((c) => c.alive).length,
        elapsed: Number(director.elapsed.toFixed(1)),
        heat: Number(director.heat.toFixed(3)),
        phase: director.phase,
        score,
        best,
        lamps,
        chain,
        favour,
        bestFavour,
        readCredit,
        earnedAnswering,
        earnedSlicing,
        wave: waveOn ? 1 : 0,
        waveCuts,
        answerShare: Number(
          (earnedAnswering / Math.max(1, earnedAnswering + earnedSlicing)).toFixed(3),
        ),
        floor: director.floorCount(),
        over: over ? 1 : 0,
        asked,
        right,
        lastAnswerMs,
        liveQ: liveQ ? liveQ.prompt : "",
        blades: blades.size,
        bladeVisible: [...blades.values()].filter((b) => b.visible(performance.now())).length,
        bladeSamples: [...blades.values()].reduce((a, b) => a + b.sampleCount, 0),
        bladeSpeed: Math.round([...blades.values()].reduce((a, b) => Math.max(a, b.speed), 0)),
        bladeDrawPts: [...blades.values()].reduce((a, b) => Math.max(a, b.lastDrawPts), 0),
        bladeMaxW: +[...blades.values()].reduce((a, b) => Math.max(a, b.lastMaxW), 0).toFixed(2),
        bladeOldestAge: Math.round([...blades.values()].reduce((a, b) => Math.max(a, b.lastOldestAge), 0)),
      }),
      targets: () =>
        world.bodies
          .filter((b) => b.alive)
          .map((b) => ({ x: b.x, y: b.y, r: b.r, kind: b.kind, text: b.text, correct: b.correct })),
      setTier: (name) => {
        gov.quality = TIERS[name]
        resize()
      },
    }
  }

  return {
    setPaused,

    unmount(): void {
      running = false
      guide.destroy()
      cancelAnimationFrame(raf)
      ro.disconnect()
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
