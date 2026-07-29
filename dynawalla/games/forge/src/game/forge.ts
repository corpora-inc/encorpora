// FORGE — the loop.
//
// Six stations, each feeding the one below. You strike the anvil to make sparks
// and to make the fire hotter; the fire multiplies everything; the stations
// multiply each other. Every purchase makes the next purchase cheaper in real
// terms, and about four minutes in the counter stops being a number you read
// and becomes a number you watch.
//
// The arithmetic is not a tax on the game. It is the throttle: a strike pays
// its own answer plus two seconds of your entire production, times the combo.
// At 400 sparks a second that is worth doing. At 4e11 a second it is worth
// doing very fast.

import type { Host, Mounted } from "../contract.ts"
import { makeAudio } from "../audio/audio.ts"
import { MICRO, compact, orderOfMagnitude, superscript } from "../core/bigmath.ts"
import {
  TIERS,
  addHeat,
  addSparks,
  buy,
  heatBonus,
  canBuy,
  carbonFor,
  isRevealed,
  loseHeat,
  newEconomy,
  quench,
  sparksPerSecond,
  step,
  tierOutputPerSecond,
} from "../core/economy.ts"
import { makeRng } from "../core/rng.ts"
import { payoutFor } from "../stub/questions.ts"
import { PAL, makeSurface } from "../render/gfx.ts"
import { clamp01, makeJuice } from "../render/juice.ts"
import {
  KIND_COLD,
  KIND_EMBER,
  KIND_GOLD,
  KIND_SHARD,
  KIND_SPARK,
  KIND_STEAM,
  makeParticles,
} from "../render/particles.ts"
import {
  createInstructions,
  onInsetsChange,
  safeRect,
} from "../../../../packs/shared/game-chrome/index.ts"
import { drawScene, markRects, overlayQuestionRects } from "../scene/draw.ts"
import { computeLayout, hit, type Rect } from "./layout.ts"
import { applyOffer, makeMarkRound } from "./marks.ts"
import { load, save } from "./save.ts"
import type { Game, Slug } from "./types.ts"

const TPS = 60n
const MAX_OFFLINE_S = 4 * 3600
const SAVE_EVERY_S = 6

export function mount(el: HTMLElement, host: Host): Mounted {
  const surface = makeSurface(el)
  const reduced = host.prefersReducedMotion()
  const juice = makeJuice(reduced)
  const particles = makeParticles(reduced ? 320 : 1100)
  particles.budget = reduced ? 0.2 : 1
  const audio = makeAudio()
  const rng = makeRng((Date.now() ^ 0x9e37) >>> 0)

  const restored = load()
  const economy = restored?.e ?? newEconomy()
  let markOom = restored?.markOom ?? 3
  let peakSparks = economy.sparks
  const pointerFine =
    typeof matchMedia === "function" ? matchMedia("(pointer: fine)").matches : true

  // Rotation swaps the safe-area insets and iPadOS changes them when the pack
  // is resized in Split View, both of which can happen without the canvas
  // changing size — and `surface.resize()` reports false in that case. A layout
  // read once at mount is right until the first turn of the tablet.
  let relayout = false
  const stopInsets = onInsetsChange(() => {
    relayout = true
  })

  const g: Game = {
    layout: computeLayout(surface.w, surface.h, 1, safeRect(surface.w, surface.h)),
    economy,
    juice,
    particles,
    mode: "play",
    clock: 0,
    reduced,
    pointerFine,
    q: host.next(),
    slugs: [],
    struckAt: -1,
    struckIndex: -1,
    lastCorrect: false,
    askedAt: 0,
    combo: 0,
    bestCombo: 0,
    hammer: 0,
    billetIn: 1,
    shatter: 0,
    oom: orderOfMagnitude(economy.sparks),
    stamp: 0,
    stampText: "",
    heatBar: 0,
    rateGhost: 0,
    revealed: 1,
    rowIn: [0, 0, 0, 0, 0, 0],
    rowPulse: [0, 0, 0, 0, 0, 0],
    buyHeld: 0,
    heldRow: -1,
    sealTier: -1,
    sealT: 0,
    mark: null,
    pendingMark: null,
    pendingMarkIn: 0,
    markT: 0,
    markPicked: -1,
    markGood: false,
    quenchT: 0,
    quenchPhase: "confirm",
    quenchGain: 0n,
    quenchReady: false,
    quenchPreview: 0n,
    haul: 0n,
    haulSeconds: 0,
    haulDone: true,
    floats: [],
    flyers: [],
    audioOn: restored?.audio ?? true,
    fps: 60,
    showFps: false,
  }
  audio.setEnabled(g.audioOn)

  // Playtest hook, DEV ONLY (Vite strips the branch from the production
  // bundle). It exposes state for READING — which ingot is the right one, what
  // the layout rects are — so a scripted session can drive the REAL pointer
  // path at the REAL targets. Nothing here bypasses input, scoring or the
  // economy; a harness that cheats proves nothing about the game.
  if (import.meta.env.DEV) {
    ;(globalThis as unknown as { __forge?: Game }).__forge = g
  }

  // Rows that already exist on a restored save are in place, not animating in.
  for (let i = 0; i < TIERS.length; i++) g.rowIn[i] = isRevealed(economy, i) ? 1 : 0
  g.revealed = countRevealed()

  setSlugsFor(g.q)

  // --- offline haul --------------------------------------------------------
  //
  // Runs on a cold start AND on tab resume. A child who switches apps for
  // twenty minutes and comes back has been away exactly as much as one who
  // closed the app, and the forge does not care which.
  function catchUp(elapsedMs: number): void {
    if (elapsedMs <= 45_000 || sparksPerSecond(economy) <= 0n) return
    const secs = Math.min(MAX_OFFLINE_S, Math.floor(elapsedMs / 1000))
    const before = economy.sparks
    // The identical simulation, run at 1 Hz. No second formula to disagree.
    for (let i = 0; i < secs; i++) step(economy, 1n)
    const haul = economy.sparks - before
    if (haul <= 0n) return
    g.haul = haul
    g.haulSeconds = secs
    g.mode = "haul"
    g.haulDone = false
    g.sealT = 0
    newQuestion()
  }
  if (restored) catchUp(restored.elapsedMs)

  // -------------------------------------------------------------------------

  function countRevealed(): number {
    let n = 0
    for (let i = 0; i < TIERS.length; i++) if (isRevealed(economy, i)) n++
    return n
  }

  function setSlugsFor(q: { answer: string; distractors: string[] }): void {
    const labels = [q.answer, ...q.distractors.slice(0, 3)]
    const order = rng.shuffle([0, 1, 2, 3])
    const out: Slug[] = []
    for (const idx of order) {
      out.push({ label: labels[idx] ?? "?", correct: idx === 0, hit: 0, fade: 0, bob: 0 })
    }
    g.slugs = out
  }

  function newQuestion(): void {
    g.q = host.next()
    setSlugsFor(g.q)
    g.struckAt = -1
    g.struckIndex = -1
    g.askedAt = g.clock
    g.billetIn = 0
    g.shatter = 0
  }

  function float(x: number, y: number, str: string, color: string, size: number): void {
    if (g.floats.length > 24) g.floats.shift()
    g.floats.push({ x, y, vy: -70, life: 0.95, max: 0.95, text: str, color, size })
  }

  function flyTo(x0: number, y0: number, x1: number, y1: number, color: string, size: number): void {
    if (g.flyers.length > 40) g.flyers.shift()
    g.flyers.push({ x: x0, y: y0, x0, y0, x1, y1, t: 0, dur: 0.5, color, size })
  }

  // --- answering -----------------------------------------------------------

  function answerRects(): Rect[] {
    if (g.mode === "seal" || g.mode === "haul") return overlayQuestionRects(g).slugs
    return g.layout.slugs
  }

  function resolveAnswer(i: number): void {
    if (g.struckAt >= 0) return
    const slug = g.slugs[i]
    if (!slug) return
    const rects = answerRects()
    const r = rects[i]
    const cx = r.x + r.w / 2
    const cy = r.y + r.h / 2
    const ms = Math.max(1, Math.round((g.clock - g.askedAt) * 1000))

    g.struckAt = g.clock
    g.struckIndex = i
    g.lastCorrect = slug.correct
    g.hammer = 1
    slug.hit = 1
    host.report({ questionId: g.q.id, correct: slug.correct, ms, answered: slug.label })

    if (slug.correct) onCorrect(cx, cy, ms)
    else onWrong(i, cx, cy)
  }

  function onCorrect(cx: number, cy: number, _ms: number): void {
    const L = g.layout
    g.combo++
    if (g.combo > g.bestCombo) g.bestCombo = g.combo
    const payout = payoutFor(g.q.answer)

    // HITSTOP first, and scaled by combo: the tenth hit in a row lands harder
    // than the first, which is most of why a run feels like it is accelerating.
    juice.hitstop(Math.min(140, 58 + g.combo * 7))
    juice.shake(Math.min(26, 9 + g.combo * 1.7))
    juice.punch(0, 1, Math.min(14, 5 + g.combo))

    const heatGain = addHeat(economy, payout, g.combo)
    const sps = sparksPerSecond(economy)
    const gain = ((BigInt(payout) * MICRO + sps) * (2n + BigInt(Math.min(g.combo, 10)))) / 2n
    addSparks(economy, gain)

    particles.burst({
      kind: KIND_SPARK,
      x: cx,
      y: cy,
      n: 22 + g.combo * 3,
      speed: 620,
      life: 0.55,
      size: 12,
    })
    particles.burst({
      kind: KIND_EMBER,
      x: L.billet.x + L.billet.w / 2,
      y: L.billet.y + L.billet.h / 2,
      n: 26 + g.combo * 4,
      speed: 460,
      life: 0.85,
      size: 15,
    })
    flyTo(cx, cy, L.crucible.x, L.crucible.y, "rgba(255,190,90,ALPHA)", 26 * L.scale)
    float(
      L.billet.x + L.billet.w / 2,
      L.billet.y - 6 * L.scale,
      `+${compact(gain)}`,
      PAL.white,
      Math.round(26 * L.scale),
    )
    float(
      L.header.x + Math.min(L.header.w * 0.6, 300 * L.scale) + 34 * L.scale,
      L.header.y + L.header.h - 34 * L.scale,
      `+${heatGain / MICRO}`,
      PAL.bright,
      Math.round(18 * L.scale),
    )

    audio.strike(g.combo)
    host.haptic(g.combo >= 8 ? "heavy" : "medium")

    // WHITE HOT. Every eighth link in the chain, the room changes.
    if (g.combo % 8 === 0) {
      juice.requestFlash(0.22)
      juice.slowmo(0.32, 300)
      juice.shake(30)
      particles.burst({
        kind: KIND_SPARK,
        x: cx,
        y: cy,
        n: 80,
        speed: 900,
        life: 1.1,
        size: 16,
      })
      audio.perfect()
      host.haptic("success")
    }
  }

  function onWrong(i: number, cx: number, cy: number): void {
    const L = g.layout
    g.combo = 0
    const lost = loseHeat(economy)
    g.shatter = 0.0001
    g.slugs[i].fade = 0.0001
    for (const s of g.slugs) if (s.correct) s.hit = 1

    juice.hitstop(120)
    juice.shake(22)
    juice.punch(0, -1, 10)
    particles.burst({
      kind: KIND_SHARD,
      x: L.billet.x + L.billet.w / 2,
      y: L.billet.y + L.billet.h / 2,
      n: 34,
      speed: 560,
      life: 1.1,
      size: 14,
    })
    particles.burst({ kind: KIND_SHARD, x: cx, y: cy, n: 16, speed: 420, life: 0.9, size: 10 })
    if (lost > 0n) {
      float(
        L.header.x + Math.min(L.header.w * 0.6, 300 * L.scale) + 34 * L.scale,
        L.header.y + L.header.h - 34 * L.scale,
        `−${lost / MICRO}`,
        "rgba(255,120,90,0.95)",
        Math.round(19 * L.scale),
      )
    }
    audio.shatter()
    host.haptic("failure")
  }

  // --- stations ------------------------------------------------------------

  function doBuy(i: number, count = 1): void {
    if (!canBuy(economy, i)) return
    const n = buy(economy, i, count)
    if (n === 0) return
    g.rowPulse[i] = 1
    const r = g.layout.rows[i]
    particles.burst({
      kind: KIND_EMBER,
      x: r.x + r.w * 0.72,
      y: r.y + r.h / 2,
      n: 12 + n,
      speed: 320,
      life: 0.6,
      size: 11,
    })
    juice.shake(4 + Math.min(6, n * 0.4))
    audio.buy(Number(economy.tiers[i].purchased % 24n))
    host.haptic("light")
    // Crossing a doubling is a real event, not a silent threshold.
    if (economy.tiers[i].purchased % 10n === 0n) {
      juice.shake(14)
      juice.hitstop(50)
      audio.magnitude(Number(economy.tiers[i].purchased / 10n) + 2)
      host.haptic("success")
      particles.burst({
        kind: KIND_GOLD,
        x: r.x + r.w / 2,
        y: r.y + r.h / 2,
        n: 40,
        speed: 520,
        life: 0.9,
        size: 13,
      })
      float(
        r.x + r.w / 2,
        r.y - 4,
        `×${1n << (economy.tiers[i].purchased / 10n)}`,
        PAL.gold,
        Math.round(24 * g.layout.scale),
      )
    }
  }

  function openSeal(i: number): void {
    const t = economy.tiers[i]
    if (t.unlocked) return
    if (economy.sparks < t.cost * MICRO) {
      juice.shake(3)
      audio.blip()
      return
    }
    g.mode = "seal"
    g.sealTier = i
    g.sealT = 0
    newQuestion()
    audio.blip()
  }

  function crackSeal(): void {
    const i = g.sealTier
    const t = economy.tiers[i]
    economy.sparks -= t.cost * MICRO
    t.unlocked = true
    t.purchased = 1n
    t.powNum = TIERS[i].growthNum
    t.powDen = TIERS[i].growthDen
    t.cost = (TIERS[i].baseCost * t.powNum) / t.powDen
    g.mode = "play"
    g.rowIn[i] = 0
    g.rowPulse[i] = 1

    juice.hitstop(150)
    juice.shake(36)
    juice.requestFlash(0.24)
    juice.slowmo(0.3, 340)
    const r = g.layout.rows[i]
    particles.burst({
      kind: KIND_SPARK,
      x: r.x + r.w / 2,
      y: r.y + r.h / 2,
      n: 110,
      speed: 1000,
      life: 1.2,
      size: 16,
    })
    particles.burst({
      kind: KIND_SHARD,
      x: r.x + r.w / 2,
      y: r.y + r.h / 2,
      n: 40,
      speed: 700,
      life: 1.3,
      size: 12,
    })
    audio.unlock()
    host.haptic("heavy")
    g.stampText = TIERS[i].name
    g.stamp = 1
  }

  // --- milestones ----------------------------------------------------------

  function checkMilestones(): void {
    // Milestones fire on the number the player is WATCHING — the highest the
    // spark counter has ever read this run — not on lifetime production. A
    // 10^9 stamp landing while the counter says 5.2x10^7 is a lie about which
    // number just did something. It also creates the only genuinely tense
    // decision in the early game: spend now, or hold ten more seconds and
    // watch the exponent tick over.
    if (economy.sparks > peakSparks) peakSparks = economy.sparks
    const oom = orderOfMagnitude(peakSparks)
    if (oom > g.oom) {
      const jumped = g.oom
      g.oom = oom
      if (oom >= 2 && jumped >= 0) {
        g.stampText = `10${superscript(oom)}`
        g.stamp = 1
        juice.shake(20)
        juice.requestFlash(0.19)
        juice.hitstop(70)
        audio.magnitude(oom)
        host.haptic("heavy")
        const L = g.layout
        particles.burst({
          kind: KIND_GOLD,
          x: L.w / 2,
          y: L.h * 0.43,
          n: 70,
          speed: 780,
          life: 1.2,
          size: 15,
        })
      }
      // One FORGE MARK per order of magnitude, ever. They never come back, so
      // each one is worth stopping for — which is exactly why it does not open
      // on the same frame as the milestone punch. The punch lands, the screen
      // settles, and THEN two ingots rise out of the crucible.
      if (oom >= 4 && oom > markOom && !g.pendingMark && !g.mark) {
        markOom = oom
        g.pendingMark = makeMarkRound(economy, rng)
        g.pendingMarkIn = 0.95
      }
    }

    const nowRevealed = countRevealed()
    if (nowRevealed > g.revealed) {
      for (let i = 0; i < TIERS.length; i++) {
        if (isRevealed(economy, i) && g.rowIn[i] === 0) {
          g.rowIn[i] = 0.0001
          juice.shake(10)
          juice.hitstop(45)
          audio.buy(18)
          host.haptic("medium")
        }
      }
      g.revealed = nowRevealed
    }
  }

  // --- overlay actions -----------------------------------------------------

  function pickMark(i: number): void {
    const m = g.mark
    if (!m || g.markPicked >= 0) return
    g.markPicked = i
    applyOffer(economy, m.offers[i])
    const good = i === m.better
    g.markGood = good
    const r = i === 0 ? markRects(g).a : markRects(g).b
    if (good) {
      economy.marks += 1n
      juice.slowmo(0.28, 380)
      juice.requestFlash(0.22)
      juice.shake(24)
      juice.hitstop(130)
      particles.burst({
        kind: KIND_GOLD,
        x: r.x + r.w / 2,
        y: r.y + r.h / 2,
        n: 100,
        speed: 820,
        life: 1.3,
        size: 15,
      })
      audio.perfect()
      host.haptic("success")
    } else {
      juice.shake(8)
      juice.hitstop(60)
      particles.burst({
        kind: KIND_EMBER,
        x: r.x + r.w / 2,
        y: r.y + r.h / 2,
        n: 26,
        speed: 380,
        life: 0.8,
        size: 12,
      })
      audio.buy(4)
      host.haptic("medium")
    }
  }

  function startQuench(): void {
    if (!g.quenchReady) return
    g.mode = "quench"
    g.quenchPhase = "confirm"
    g.quenchT = 0
    g.quenchGain = carbonFor(economy.lifetime) - economy.carbon
    audio.blip()
  }

  function plunge(): void {
    const L = g.layout
    // The quench IS the run: everything is cashed in and the forge starts
    // cold again. FORGE's one natural ending, and the child chose it — which
    // is exactly the property a stopping point has to have.
    try {
      host.transition?.("run", "quench")
    } catch {
      /* a host that throws on a stopping point must not kill the run */
    }
    quench(economy)
    g.quenchPhase = "steam"
    g.quenchT = 0
    g.quenchReady = false
    g.quenchPreview = 0n
    g.oom = -1
    peakSparks = 0n
    g.revealed = countRevealed()
    for (let i = 0; i < TIERS.length; i++) g.rowIn[i] = isRevealed(economy, i) ? 1 : 0
    particles.clear()
    for (let i = 0; i < (reduced ? 40 : 220); i++) {
      particles.spawn(
        KIND_STEAM,
        Math.random() * L.w,
        L.h * (0.6 + Math.random() * 0.5),
        (Math.random() - 0.5) * 260,
        -120 - Math.random() * 260,
        1.6 + Math.random() * 1.6,
        26 + Math.random() * 34,
      )
    }
    for (let i = 0; i < (reduced ? 20 : 90); i++) {
      particles.spawn(
        KIND_COLD,
        L.crucible.x + (Math.random() - 0.5) * L.crucible.r,
        L.crucible.y,
        (Math.random() - 0.5) * 700,
        -Math.random() * 700,
        1.1,
        16,
      )
    }
    juice.requestFlash(0.4)
    juice.shake(40)
    juice.hitstop(180)
    audio.quench()
    host.haptic("heavy")
  }

  // --- input ---------------------------------------------------------------

  let heldRect: Rect | null = null
  // Press and hold a station to keep buying, faster the longer you hold. This
  // is why there is no x1/x10/x100 selector: a repeat that accelerates under
  // your thumb reads as one gesture, works identically on touch and mouse, and
  // costs no screen space at all.
  const HOLD_DELAY = 0.34
  const HOLD_MIN = 0.045
  let repeatIn = 0

  function pointAt(ev: PointerEvent): { x: number; y: number } {
    const r = surface.canvas.getBoundingClientRect()
    return { x: ev.clientX - r.left, y: ev.clientY - r.top }
  }

  function onDown(ev: PointerEvent): void {
    ev.preventDefault()
    audio.resume()
    const { x, y } = pointAt(ev)
    heldRect = null

    if (g.mode === "mark") {
      const { a, b } = markRects(g)
      if (hit(a, x, y)) pickMark(0)
      else if (hit(b, x, y)) pickMark(1)
      return
    }

    if (g.mode === "quench") {
      if (g.quenchPhase !== "confirm") return
      const L = g.layout
      const pw = Math.min(L.w - L.pad * 2, 700 * L.scale)
      const ph = Math.min(L.h - L.pad * 2, 420 * L.scale)
      const panel: Rect = { x: (L.w - pw) / 2, y: (L.h - ph) / 2, w: pw, h: ph }
      const bw = Math.min(300 * L.scale, panel.w - 60 * L.scale)
      const btn: Rect = {
        x: panel.x + (panel.w - bw) / 2,
        y: panel.y + panel.h - 82 * L.scale,
        w: bw,
        h: 58 * L.scale,
      }
      if (hit(btn, x, y)) plunge()
      else if (!hit(panel, x, y)) g.mode = "play"
      return
    }

    if (g.mode === "seal" || g.mode === "haul") {
      const { panel, slugs } = overlayQuestionRects(g)
      for (let i = 0; i < slugs.length; i++) {
        if (hit(slugs[i], x, y, 6)) {
          resolveAnswer(i)
          return
        }
      }
      if (g.mode === "seal" && !hit(panel, x, y)) g.mode = "play"
      return
    }

    // play
    const L = g.layout
    for (let i = 0; i < L.slugs.length; i++) {
      if (hit(L.slugs[i], x, y, 6)) {
        resolveAnswer(i)
        return
      }
    }
    if (hit(L.audio, x, y, 10)) {
      g.audioOn = !g.audioOn
      audio.setEnabled(g.audioOn)
      if (g.audioOn) audio.blip()
      return
    }
    if (g.quenchReady && hit(L.quench, x, y)) {
      startQuench()
      return
    }
    for (let i = 0; i < TIERS.length; i++) {
      if (!isRevealed(economy, i)) continue
      if (!hit(L.rows[i], x, y)) continue
      if (!economy.tiers[i].unlocked) openSeal(i)
      else {
        doBuy(i)
        g.heldRow = i
        heldRect = L.rows[i]
        g.buyHeld = 0
        repeatIn = HOLD_DELAY
      }
      return
    }
  }

  function onUp(): void {
    g.heldRow = -1
    g.buyHeld = 0
    heldRect = null
  }

  function onMove(ev: PointerEvent): void {
    if (g.heldRow < 0 || !heldRect) return
    const { x, y } = pointAt(ev)
    if (!hit(heldRect, x, y, 12)) onUp()
  }

  function onKey(ev: KeyboardEvent): void {
    audio.resume()
    const k = ev.key.toLowerCase()
    if (k >= "1" && k <= "4") {
      const i = Number(k) - 1
      if (g.mode === "play" || g.mode === "seal" || g.mode === "haul") resolveAnswer(i)
      else if (g.mode === "mark" && i < 2) pickMark(i)
      ev.preventDefault()
      return
    }
    const row = "asdfgh".indexOf(k)
    if (row >= 0 && g.mode === "play") {
      if (!isRevealed(economy, row)) return
      if (!economy.tiers[row].unlocked) openSeal(row)
      else doBuy(row)
      ev.preventDefault()
      return
    }
    if (k === "m") {
      g.audioOn = !g.audioOn
      audio.setEnabled(g.audioOn)
    } else if (k === "p") {
      g.showFps = !g.showFps
    } else if (k === "escape") {
      if (g.mode === "seal" || (g.mode === "quench" && g.quenchPhase === "confirm")) g.mode = "play"
    } else if (k === " " || k === "enter") {
      if (g.mode === "quench" && g.quenchPhase === "confirm") plunge()
      else if (g.mode === "play" && g.quenchReady) startQuench()
      ev.preventDefault()
    }
  }

  // --- how to play ---------------------------------------------------------
  //
  // The README says "no instructions, because none are needed. Everything
  // appears when it becomes relevant." That is true of the anvil and false of
  // everything else. Nothing on screen says a CRUCIBLE makes BELLOWS rather
  // than sparks, nothing says heat leaks away while you think, and nothing says
  // the two glowing ingots are a comparison you are supposed to LOOK at the row
  // to settle. A child who never works that out plays a tapping game.
  //
  // It is a manual and not a tutorial: the panel stays reachable during play,
  // because the moment a child needs the rules is never the title screen.
  const guide = createInstructions(el, {
    title: "FORGE",
    summary: [
      "You run a forge. Answer the sum on the anvil and you earn sparks.",
      "Spend sparks on machines. The machines build other machines, and everything you own starts making more, faster.",
    ],
    sections: [
      {
        heading: "The anvil",
        lines: [
          "A bar of hot iron shows a sum, like 15 − 8.",
          "Four ingots sit under it, each with a number on it. Hit the one that is the answer.",
          "You are paid the answer itself, plus one second of everything your machines make.",
          "So a big answer pays more. 12 × 11 pays 132 sparks. 4 + 5 pays 9. Pick the big ones when you can.",
          "Get several right in a row and each one pays more than the last.",
        ],
      },
      {
        heading: "The six machines",
        lines: [
          "Down the side: BELLOWS, CRUCIBLE, HAMMER, ANVIL, FOUNDRY, REACTOR.",
          "Bellows make sparks. Crucibles make bellows. Hammers make crucibles. Each machine builds the one above it in the list.",
          "Tap a machine to buy one. Press and hold to keep buying, and it speeds up the longer you hold.",
          "A REACTOR makes no sparks at all by itself. It makes the thing that makes the thing that makes sparks. Buy one and watch the counter a minute later.",
          "The last four machines arrive chained shut. Answer a sum to break the chain. Getting it wrong here costs you nothing — it just asks again.",
        ],
      },
      {
        heading: "Heat",
        lines: [
          "Every right answer pours heat into the forge, and heat multiplies everything you make.",
          "Heat leaks away all the time, so the bar is dropping while you think.",
          "A wrong answer costs you a quarter of the heat you had. The better you are doing, the more a guess costs you.",
        ],
      },
      {
        heading: "Forge marks",
        lines: [
          "Sometimes two glowing ingots rise out of the crucible. One says something like +14 HAMMER. The other says ×2 HAMMER.",
          "Look at the HAMMER row to see how many you own, then work out which ingot gives you more.",
          "Own 9 hammers? ×2 gives 18, and +14 gives 23. Take the +14.",
          "Own 400 hammers? ×2 gives 800, and +14 gives 414. Now take the ×2.",
          "Neither one is wrong and nothing is lost. But the better one changes as you play, so look at the row every time.",
        ],
      },
      {
        heading: "The quench",
        lines: [
          "When the QUENCH plate lights up blue you can plunge the forge, start again from nothing, and keep some carbon.",
          "Carbon is permanent. It multiplies everything from now on, so the next run gets as far in ninety seconds as this one did in four minutes.",
          "The screen shows you the square root it worked out to decide how much carbon you get.",
        ],
      },
      {
        heading: "While you are away",
        lines: [
          "The forge keeps working when you close the app, for up to four hours.",
          "When you come back, one strike claims what it made. A right answer claims all of it, a wrong answer claims half. Nothing is ever taken away.",
        ],
      },
      {
        heading: "Keyboard",
        lines: [
          "A S D F G H buy the six machines.",
          "1 2 3 4 pick an ingot.",
          "Space quenches. M turns the sound off.",
        ],
      },
    ],
    reducedMotion: reduced,
  })

  surface.canvas.addEventListener("pointerdown", onDown, { passive: false })
  globalThis.addEventListener("pointerup", onUp)
  globalThis.addEventListener("pointercancel", onUp)
  surface.canvas.addEventListener("pointermove", onMove)
  globalThis.addEventListener("keydown", onKey)

  // --- the loop ------------------------------------------------------------

  let acc = 0
  let last = performance.now()
  let saveTimer = 0
  let raf = 0
  let frameSum = 0
  let frameCount = 0
  let emberAcc = 0
  let quenchCheck = 0

  function frame(now: number): void {
    raf = requestAnimationFrame(frame)
    const realDt = Math.min(0.25, (now - last) / 1000)
    last = now
    juice.update(realDt * 1000)

    frameSum += realDt
    frameCount++
    if (frameSum > 0.5) {
      g.fps = frameCount / frameSum
      frameSum = 0
      frameCount = 0
      // Adaptive particle budget: if the device cannot hold the frame, spend
      // fewer particles rather than dropping below 60.
      if (!reduced) {
        if (g.fps < 52) particles.budget = Math.max(0.35, particles.budget - 0.15)
        else if (g.fps > 58) particles.budget = Math.min(1, particles.budget + 0.08)
      }
    }

    const dt = realDt * juice.timeScale
    g.clock += dt

    if (surface.resize() || relayout) {
      relayout = false
      g.layout = computeLayout(surface.w, surface.h, g.revealed, safeRect(surface.w, surface.h))
    }

    // Economy: fixed 60 Hz, frozen during hitstop. Deterministic regardless of
    // display refresh rate — a 120 Hz tablet earns exactly what a 60 Hz one does.
    if (!juice.frozen && g.mode !== "quench") {
      acc += dt
      let guard = 0
      while (acc >= 1 / 60 && guard < 8) {
        step(economy, TPS)
        acc -= 1 / 60
        guard++
      }
      if (guard >= 8) acc = 0
    }

    updateAnimations(dt)
    checkMilestones()
    particles.update(dt)
    spawnAmbient(dt)

    saveTimer += realDt
    if (saveTimer > SAVE_EVERY_S) {
      saveTimer = 0
      save(economy, markOom, g.audioOn)
    }

    const ctx = surface.ctx
    ctx.setTransform(surface.dpr, 0, 0, surface.dpr, 0, 0)
    drawScene(ctx, g)
  }

  function updateAnimations(dt: number): void {
    const L = g.layout

    if (g.pendingMark) {
      g.pendingMarkIn -= dt
      if (g.pendingMarkIn <= 0 && g.mode === "play" && g.struckAt < 0) {
        g.mark = g.pendingMark
        g.pendingMark = null
        g.markPicked = -1
        g.markGood = false
        g.markT = 0
        g.mode = "mark"
        audio.claim()
      }
    }

    if (g.heldRow >= 0) {
      g.buyHeld = Math.min(1, g.buyHeld + dt * 0.55)
      repeatIn -= dt
      if (repeatIn <= 0) {
        const before = economy.tiers[g.heldRow].purchased
        doBuy(g.heldRow)
        if (economy.tiers[g.heldRow].purchased === before) {
          // Ran out of sparks mid-hold; stop rather than buzz uselessly.
          g.heldRow = -1
          g.buyHeld = 0
        } else {
          repeatIn = Math.max(HOLD_MIN, 0.2 * (1 - g.buyHeld) + HOLD_MIN)
        }
      }
    }

    g.hammer = Math.max(0, g.hammer - dt * 3.6)
    g.billetIn = Math.min(1, g.billetIn + dt * 4.2)
    if (g.shatter > 0) g.shatter = Math.min(1, g.shatter + dt * 3.2)
    g.stamp = Math.max(0, g.stamp - dt * 1.15)
    g.sealT = Math.min(1, g.sealT + dt * 4)
    g.markT = Math.min(1, g.markT + dt * 4)

    for (let i = 0; i < TIERS.length; i++) {
      if (g.rowIn[i] > 0 && g.rowIn[i] < 1) g.rowIn[i] = Math.min(1, g.rowIn[i] + dt * 2.6)
      if (g.rowPulse[i] > 0) g.rowPulse[i] = Math.max(0, g.rowPulse[i] - dt * 2.2)
    }
    for (const s of g.slugs) {
      if (s.hit > 0) s.hit = Math.max(0, s.hit - dt * 2.4)
      if (s.fade > 0) s.fade = Math.min(1, s.fade + dt * 3)
    }

    // Quench availability, twice a second. `carbonFor` takes an integer square
    // root of a number with hundreds of digits; running it per frame is a
    // measurable stall in the late game and buys nothing — the plate does not
    // need to light up within 16 ms of the threshold.
    quenchCheck -= dt
    if (quenchCheck <= 0) {
      quenchCheck = 0.5
      const c = carbonFor(economy.lifetime)
      g.quenchReady = c > economy.carbon
      g.quenchPreview = g.quenchReady ? c - economy.carbon : 0n
    }

    // The bar IS the multiplier, not a proxy for it: it fills in proportion to
    // the bonus the economy actually applies, so a full bar and a printed
    // "x11.0" are the same fact told twice.
    const target = clamp01(Number(heatBonus(economy)) / 1000)
    g.heatBar += (target - g.heatBar) * Math.min(1, dt * 9)
    audio.setRoar(g.audioOn ? clamp01(g.heatBar * 1.15) : 0)

    for (let i = g.floats.length - 1; i >= 0; i--) {
      const f = g.floats[i]
      f.life -= dt
      f.y += f.vy * dt
      f.vy *= Math.exp(-2.4 * dt)
      if (f.life <= 0) g.floats.splice(i, 1)
    }
    for (let i = g.flyers.length - 1; i >= 0; i--) {
      const f = g.flyers[i]
      f.t += dt
      if (f.t >= f.dur) {
        particles.burst({
          kind: KIND_EMBER,
          x: f.x1,
          y: f.y1,
          n: 16,
          speed: 300,
          life: 0.7,
          size: 13,
        })
        g.flyers.splice(i, 1)
      }
    }

    // Next question after the beat lands.
    if (g.struckAt >= 0 && g.mode !== "mark") {
      const wait = g.lastCorrect ? 0.24 : 0.6
      if (g.clock - g.struckAt > wait) {
        if (g.mode === "seal") {
          if (g.lastCorrect) crackSeal()
          else newQuestion()
        } else if (g.mode === "haul") {
          if (!g.haulDone) {
            g.haulDone = true
            if (!g.lastCorrect) {
              const half = g.haul / 2n
              economy.sparks -= half
              if (economy.sparks < 0n) economy.sparks = 0n
            } else {
              addHeat(economy, 40, 4)
              audio.claim()
            }
            g.mode = "play"
            juice.shake(16)
            juice.requestFlash(0.2)
            particles.burst({
              kind: KIND_GOLD,
              x: L.w / 2,
              y: L.h / 2,
              n: 90,
              speed: 800,
              life: 1.2,
              size: 15,
            })
            newQuestion()
          }
        } else {
          newQuestion()
        }
      }
    }

    if (g.mode === "mark" && g.markPicked >= 0) {
      g.quenchT += dt
      if (g.quenchT > 1.25) {
        g.quenchT = 0
        g.mark = null
        g.mode = "play"
        newQuestion()
      }
    }

    if (g.mode === "quench" && g.quenchPhase === "confirm") {
      g.quenchT = Math.min(1, g.quenchT + dt * 4)
    }

    if (g.mode === "quench" && g.quenchPhase !== "confirm") {
      g.quenchT += dt * (g.quenchPhase === "steam" ? 0.42 : 0.62)
      if (g.quenchT >= 1) {
        if (g.quenchPhase === "steam") {
          g.quenchPhase = "reignite"
          g.quenchT = 0
          audio.reignite()
          for (let i = 0; i < (reduced ? 30 : 140); i++) {
            particles.spawn(
              KIND_EMBER,
              Math.random() * L.w,
              L.h + Math.random() * 40,
              (Math.random() - 0.5) * 120,
              -260 - Math.random() * 340,
              1.4 + Math.random(),
              14 + Math.random() * 16,
            )
          }
          juice.shake(18)
        } else {
          g.mode = "play"
          g.quenchT = 0
          newQuestion()
        }
      }
    }
  }

  /**
   * Ambient life: embers off the crucible, and a visible flow of material DOWN
   * the column from each station into the one it feeds. The chain is not a list
   * of numbers — you can watch the reactor pour into the foundry.
   */
  function spawnAmbient(dt: number): void {
    if (reduced) return
    const L = g.layout
    emberAcc += dt
    const tick = 1 / 45
    while (emberAcc > tick) {
      emberAcc -= tick
      const heat = clamp01(g.heatBar)
      if (Math.random() < 0.55 + heat * 0.45) {
        particles.spawn(
          KIND_EMBER,
          L.crucible.x + (Math.random() - 0.5) * L.crucible.r * 0.9,
          L.crucible.y - 4,
          (Math.random() - 0.5) * 80,
          -60 - Math.random() * 120 * (1 + heat),
          1.4 + Math.random() * 1.4,
          6 + Math.random() * 8,
        )
      }
      for (let i = 1; i < TIERS.length; i++) {
        if (!economy.tiers[i].unlocked || !isRevealed(economy, i)) continue
        if (tierOutputPerSecond(economy, i) <= 0n) continue
        if (Math.random() > 0.34) continue
        const from = L.rows[i]
        particles.spawn(
          KIND_SPARK,
          from.x + 20 + Math.random() * (from.w - 40),
          from.y + from.h,
          (Math.random() - 0.5) * 30,
          70 + Math.random() * 60,
          0.45,
          4 + Math.random() * 4,
          40,
        )
      }
      // And the bottom station pouring into the crucible.
      if (economy.tiers[0].purchased > 0n && Math.random() < 0.5) {
        const from = L.rows[0]
        particles.spawn(
          KIND_SPARK,
          from.x + 20 + Math.random() * (from.w - 40),
          from.y + from.h,
          (Math.random() - 0.5) * 40,
          90 + Math.random() * 70,
          0.55,
          5 + Math.random() * 5,
          60,
        )
      }
    }
  }

  raf = requestAnimationFrame(frame)

  let hiddenAt = 0
  const onVisibility = (): void => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now()
      save(economy, markOom, g.audioOn)
      return
    }
    // Back in the foreground. requestAnimationFrame was throttled or stopped
    // while we were away, so the live sim earned nothing — pay it out through
    // the same catch-up path a cold start uses.
    if (hiddenAt > 0 && g.mode === "play") {
      const away = Date.now() - hiddenAt
      hiddenAt = 0
      last = performance.now()
      acc = 0
      catchUp(away)
    }
  }
  document.addEventListener("visibilitychange", onVisibility)
  globalThis.addEventListener("pagehide", onVisibility)

  return {
    unmount() {
      cancelAnimationFrame(raf)
      save(economy, markOom, g.audioOn)
      guide.destroy()
      stopInsets()
      surface.canvas.removeEventListener("pointerdown", onDown)
      surface.canvas.removeEventListener("pointermove", onMove)
      globalThis.removeEventListener("pointerup", onUp)
      globalThis.removeEventListener("pointercancel", onUp)
      globalThis.removeEventListener("keydown", onKey)
      document.removeEventListener("visibilitychange", onVisibility)
      globalThis.removeEventListener("pagehide", onVisibility)
      audio.dispose()
      surface.destroy()
    },
  }
}
