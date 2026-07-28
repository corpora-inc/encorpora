// LATTICE RUNNER — the game.
//
// You ride the foot of a lattice of numbered beams. Automata walk down it
// carrying numbers. A pulse fired up beam `b` destroys an automaton carrying
// `v` **if and only if b divides v** — that is the entire rule, it is stated
// once in `sim/lattice.ts`, and nothing here is allowed to have an opinion
// about it.
//
// Because the automata step sideways as they descend, a number is reachable
// from several beams at different moments, so "can I kill this" is never a
// lookup: 84 can be taken from 3, from 4, from 7 — and the tight divisor pays
// double, which is the pedagogy written into the economy rather than into a
// lecture.
//
// Every eight seconds a CORE comes down the middle carrying a problem the
// curriculum served — `247 + 158` — and fractures into candidate values. To
// hand one in you must do the column arithmetic *and* find a beam that divides
// the value you believe in. The divisibility rule is the lock on the trigger:
// you cannot submit a number you cannot factor.
//
// And the whole time, the beam you are riding sings against the automaton above
// you at the phase `(v mod b) / b`. At zero the two waveforms fuse. Division,
// audible.

import type { Host, Question } from "./contract.ts"
import { Audio } from "./audio.ts"
import { Feel } from "./core/feel.ts"
import { Rng } from "./core/rng.ts"
import { detectTier, TierGovernor } from "./core/tiers.ts"
import { columnAt, columnX, makeGeom, project } from "./render/geom.ts"
import {
  drawAnchors,
  drawAutomaton,
  drawBeams,
  drawHall,
  drawPulse,
  drawRunner,
  drawScore,
  drawTraces,
  type BeamStyle,
} from "./render/hall.ts"
import {
  BEAM_HOT,
  BRASS_HOT,
  DISSONANT,
  font,
  LAPIS_HOT,
  PAPER,
  RESONANT,
  RESONANT_HOT,
  UI_FONT,
  withAlpha,
} from "./render/palette.ts"
import { KIND_MOTE, KIND_SHARD, Particles } from "./render/particles.ts"
import { buildCore, type CoreWave } from "./sim/core.ts"
import { Director, fieldValue, killScore } from "./sim/director.ts"
import { A_CANDIDATE, A_CORE, A_ORDINARY, type Automaton, Field } from "./sim/field.ts"
import { phaseOffset, resonates, tuneLattice, validBeamCount } from "./sim/lattice.ts"
import { resolveStrike } from "./sim/pulse.ts"

const N_BEAMS = 5
const ANCHORS = 3
/** Cores read that buy an anchor back. Cumulative — never taken away again. */
const READ_PER_ANCHOR = 2
const RESONANCE_MAX = 4
const RESONANCE_SECONDS = 10
const CHAIN_WINDOW = 1.4
const PULSE_SECONDS = 0.42
const FIRE_COOLDOWN = 0.14
/** The in-memory best, so a pack frame with no storage still shows one. */
let sessionBest = 0

type Pulse = { alive: boolean; col: number; t: number; prevT: number; hits: number }
type Pop = { alive: boolean; x: number; y: number; life: number; max: number; text: string; size: number; color: string }
type Banner = { text: string; sub: string; life: number; max: number; color: string }

export function mountBeam(el: HTMLElement, host: Host): { unmount(): void } {
  // ── surface ──────────────────────────────────────────────────────────────
  const root = document.createElement("div")
  root.style.cssText =
    "position:relative;width:100%;height:100%;overflow:hidden;touch-action:none;" +
    "-webkit-user-select:none;user-select:none;background:#04060d;cursor:pointer;"
  const canvas = document.createElement("canvas")
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;"
  root.appendChild(canvas)
  el.appendChild(root)

  const ctx0 = canvas.getContext("2d", { alpha: false })
  if (!ctx0) throw new Error("beam: could not acquire a 2D context")
  const g: CanvasRenderingContext2D = ctx0

  // ── systems ──────────────────────────────────────────────────────────────
  const reduced = host.prefersReducedMotion()
  const gov = new TierGovernor(detectTier())
  const feel = new Feel({ reducedMotion: reduced })
  const audio = new Audio()
  const parts = new Particles()
  const field = new Field()
  const director = new Director()
  // Two streams, deliberately separated.
  //
  // `rng` is the RUN: the numbers on the hulls, how the lattice tunes, which
  // column a candidate takes, when an automaton turns. `fx` is decoration: the
  // angle a spark leaves at, and nothing else.
  //
  // They were one stream, and that was a real defect rather than an untidiness.
  // Every emitter draws once per particle, and the quality tier scales the
  // particle count — so a cheap tablet, spawning 45% of the sparks, consumed a
  // different number of draws and from that frame on played a *different game*
  // from the same seed than an expensive one. It also made the headless loop
  // test pass on a 12-core laptop and fail on a 4-core CI runner, which is how
  // it was caught. Decoration must never be able to move the mathematics.
  let rng = new Rng(0xbea3 ^ (Date.now() & 0xffffff))
  let fx = new Rng(0x0fec7 ^ (Date.now() & 0xffffff))

  // ── run state ────────────────────────────────────────────────────────────
  let geom = makeGeom(320, 480, N_BEAMS)
  let dpr = 1
  let running = true
  let over = false
  let overAt = 0
  let beams: number[] = tuneLattice([], N_BEAMS, () => rng.next())
  let runnerCol = Math.floor(N_BEAMS / 2)
  let runnerSlide = runnerCol
  let fireOnArrive = false
  let fireCooldown = 0
  let score = 0
  let best = readBest()
  let anchors = ANCHORS
  let credit = 0
  let chain = 0
  let chainTimer = 0
  let resonance = 1
  let resonanceLeft = 0
  let traceScroll = 0
  let asked = 0
  let right = 0
  let coresRead = 0
  let lastTransitionAt = 0

  // ── the live CORE ────────────────────────────────────────────────────────
  let wave: CoreWave | null = null
  let waveAskedAt = 0
  let coreBody: Automaton | null = null

  const pulses: Pulse[] = []
  for (let i = 0; i < 4; i++) pulses.push({ alive: false, col: 0, t: 0, prevT: 0, hits: 0 })

  const pops: Pop[] = []
  for (let i = 0; i < 24; i++)
    pops.push({ alive: false, x: 0, y: 0, life: 0, max: 1, text: "", size: 20, color: PAPER })
  let banner: Banner | null = null

  const swept: Automaton[] = []
  const landed: Automaton[] = []
  /** Reused every frame so the draw order costs no allocation. */
  const order: Automaton[] = []

  const colBrass = parts.colorId(BRASS_HOT)
  const colGold = parts.colorId(RESONANT)
  const colGoldHot = parts.colorId(RESONANT_HOT)
  const colBeam = parts.colorId(BEAM_HOT)
  const colWrong = parts.colorId(DISSONANT)
  const colLapis = parts.colorId(LAPIS_HOT)

  function readBest(): number {
    try {
      return Math.max(sessionBest, Number(localStorage.getItem("dw.beam.best") ?? "0") || 0)
    } catch {
      // A pack frame is an opaque origin and every `localStorage` access throws
      // there. The in-memory best is not a fallback, it is the real one on a
      // tablet; the browser copy is a convenience for the dev harness.
      console.warn("[beam] localStorage unavailable; best score is session-only")
      return sessionBest
    }
  }
  function writeBest(v: number): void {
    sessionBest = Math.max(sessionBest, v)
    try {
      localStorage.setItem("dw.beam.best", String(v))
    } catch {
      console.warn("[beam] could not persist best score")
    }
  }

  // ── layout ───────────────────────────────────────────────────────────────
  function resize(): void {
    const q = gov.quality
    const rect = root.getBoundingClientRect()
    const w = Math.max(320, Math.round(rect.width))
    const h = Math.max(320, Math.round(rect.height))
    geom = makeGeom(w, h, N_BEAMS)
    dpr = Math.min(q.maxDpr, globalThis.devicePixelRatio || 1)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    parts.limit = q.particles
  }
  const ro = new ResizeObserver(() => resize())
  ro.observe(root)
  resize()

  // ── helpers ──────────────────────────────────────────────────────────────
  function pop(text: string, x: number, y: number, size: number, color: string): void {
    const s = Math.max(12, Math.min(size, geom.w * 0.09))
    for (const p of pops) {
      if (p.alive) continue
      p.alive = true
      p.x = Math.max(s * 2, Math.min(geom.w - s * 2, x))
      p.y = y
      p.max = 0.85
      p.life = p.max
      p.text = text
      p.size = s
      p.color = color
      return
    }
  }

  function showBanner(text: string, sub: string, color: string, secs: number): void {
    banner = { text, sub, life: secs, max: secs, color }
  }

  function burst(x: number, y: number, colorId: number, n: number, speed: number, shard = false): void {
    const count = Math.round(n * gov.quality.burst)
    for (let i = 0; i < count; i++) {
      const a = fx.next() * Math.PI * 2
      const s = speed * (0.2 + fx.next() * 1.1)
      parts.spawn(
        shard && fx.chance(0.45) ? KIND_SHARD : KIND_MOTE,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        0.32 + fx.next() * 0.55,
        3 + fx.next() * 6,
        colorId,
        1.9,
      )
    }
  }

  function scoreMul(): number {
    return (1 + Math.min(4, Math.floor(chain / 3))) * resonance
  }

  /** Cheap, allocation-free scan for the values currently in the air. */
  function liveOrdinaryValues(): number[] {
    const out: number[] = []
    for (const b of field.bodies) if (b.alive && b.kind === A_ORDINARY) out.push(b.value)
    return out
  }

  /**
   * Re-tune the lattice.
   *
   * The candidates come first so the answer is always killable; the values
   * already in the air come second, so an automaton in flight keeps its beam
   * whenever there is room. Anything that survives the retune out of tune is
   * dispersed rather than left as a breach the child could do nothing about.
   */
  function retune(required: readonly number[]): void {
    beams = tuneLattice([...required, ...liveOrdinaryValues()], N_BEAMS, () => rng.next())
    for (const b of field.bodies) {
      if (!b.alive || b.kind !== A_ORDINARY) continue
      if (validBeamCount(beams, b.value) > 0) continue
      const p = project(geom, b.slide, b.t)
      burst(p.x, p.y, colBeam, 10, 130)
      b.alive = false
    }
  }

  function spawnOrdinary(): void {
    const p = director.pressure()
    const b = field.spawn()
    if (!b) return
    b.kind = A_ORDINARY
    b.value = fieldValue(beams, p.tightness, () => rng.next())
    b.text = String(b.value)
    b.beam = rng.int(0, N_BEAMS - 1)
    b.slide = b.beam
    b.t = 0
    b.speed = 1 / p.descentSeconds
    b.stepIn = rng.range(0.3, 1) * p.stepSeconds
    b.stepDir = rng.chance(0.5) ? 1 : -1
    b.spawnedAt = performance.now()
    director.noteSpawn()
  }

  /**
   * Draw an item the lattice can actually be tuned to.
   *
   * An answer with no divisor in the beam range — a prime, or 169 — cannot be
   * killed on a board a child can read, so the item is passed over and the next
   * one drawn. A passed-over item is never shown and never reported: silence is
   * honest, an unanswerable question is not.
   */
  function drawWave(): CoreWave | null {
    const p = director.pressure()
    for (let tries = 0; tries < 8; tries++) {
      const q: Question = host.next({ difficulty: 2 + Math.round(p.level * 7) })
      if (!q.id) return null
      const built = buildCore(
        { id: q.id, prompt: q.prompt, answer: q.answer, distractors: q.distractors },
        N_BEAMS,
        () => rng.next(),
      )
      if (built) return built
    }
    console.warn("[beam] no item in eight draws had an answer this lattice can be tuned to")
    return null
  }

  function spawnCore(): void {
    // The body is claimed *before* the item is drawn. The other way round, a
    // full field threw away a question the host had already served — and,
    // because nothing reset the cooldown, it did so again on the next frame and
    // every frame after that, draining the pool at sixty items a second.
    const b = field.spawn()
    if (!b) {
      director.deferCore()
      return
    }
    const built = drawWave()
    if (!built) {
      b.alive = false
      director.deferCore()
      return
    }
    wave = built
    retune(built.candidates.map((c) => c.value))
    const p = director.pressure()
    b.kind = A_CORE
    b.value = built.answer
    b.text = built.prompt
    b.beam = Math.floor(N_BEAMS / 2)
    b.slide = b.beam
    b.t = 0
    // A CORE crosses a little faster than the stream and never steps sideways:
    // it is the thing being read, not the thing being chased, and the reading
    // time it owes the child is spent on the candidates rather than on the
    // approach.
    b.speed = 1 / (p.descentSeconds * 0.85)
    b.stepIn = 1e9
    b.spawnedAt = performance.now()
    coreBody = b
    waveAskedAt = performance.now()
    asked++
    director.noteCore()
    audio.coreArrive()
  }

  function fracture(core: Automaton): void {
    const w = wave
    if (!w) return
    core.fractured = true
    const p = director.pressure()
    const cp = project(geom, core.slide, core.t)
    burst(cp.x, cp.y, colLapis, 40, 320, true)
    feel.addTrauma(0.25)
    feel.punch(0.02)
    audio.fracture()

    const cols = rng.shuffle([...Array(N_BEAMS).keys()])
    w.candidates.forEach((c, i) => {
      const b = field.spawn()
      if (!b) return
      b.kind = A_CANDIDATE
      b.value = c.value
      b.text = String(c.value)
      b.correct = c.correct
      b.beam = cols[i % cols.length] as number
      b.slide = core.slide
      b.t = core.t
      // Slower than the stream, and it steps: a candidate has to be reachable
      // from more than the beam it happened to land on. The fall from the
      // fracture line to the floor is the answering window — about ten seconds
      // early in a run, closing to six at full pressure, which brackets the
      // house p50 of six and p90 of fourteen for two-digit regrouping.
      b.speed = 1 / (p.descentSeconds * 1.6)
      b.stepIn = 0.55 + i * 0.12
      b.stepDir = i % 2 === 0 ? 1 : -1
      b.spawnedAt = performance.now()
    })
    core.alive = false
    coreBody = null
  }

  function clearCandidates(flashCorrect: boolean): void {
    for (const b of field.bodies) {
      if (!b.alive || b.kind !== A_CANDIDATE) continue
      const p = project(geom, b.slide, b.t)
      if (flashCorrect && b.correct) burst(p.x, p.y, colGold, 26, 240, true)
      else burst(p.x, p.y, colBeam, 8, 120)
      b.alive = false
    }
  }

  function expireWave(): void {
    const w = wave
    if (!w) return
    // Reported, and honestly: the child did not answer. `answered` is empty
    // because nothing was handed in, and this is the one report in the game
    // that is not the result of an action.
    host.report({
      questionId: w.questionId,
      correct: false,
      ms: Math.round(performance.now() - waveAskedAt),
      answered: "",
    })
    showBanner(`${w.prompt} = ${w.answer}`, "", LAPIS_HOT, 1.6)
    clearCandidates(true)
    wave = null
    coreBody = null
  }

  // ── firing ───────────────────────────────────────────────────────────────
  function fire(): void {
    if (over || fireCooldown > 0) return
    for (const p of pulses) {
      if (p.alive) continue
      p.alive = true
      p.col = runnerCol
      p.t = 1
      p.prevT = 1
      p.hits = 0
      fireCooldown = FIRE_COOLDOWN
      feel.kick(0, -1, 2.4)
      audio.fire()
      host.haptic("light")
      return
    }
  }

  function stepPulses(dt: number): void {
    for (const p of pulses) {
      if (!p.alive) continue
      p.prevT = p.t
      p.t -= dt / PULSE_SECONDS
      const beam = beams[p.col]
      if (beam === undefined) {
        p.alive = false
        continue
      }
      field.sweep(p.col, p.prevT, Math.max(0, p.t), swept)
      for (const body of swept) {
        const strike = resolveStrike(beam, body.kind, body.value, body === swept[0])
        if (strike === "submit") {
          p.hits++
          submit(body, beam)
          p.alive = false
          break
        }
        if (strike === "shatter") {
          p.hits++
          shatter(body, beam, p.hits)
        } else if (strike === "dissonance") {
          dissonance(body)
        }
      }
      if (p.t <= 0) p.alive = false
    }
  }

  function shatter(body: Automaton, beam: number, step: number): void {
    const p = project(geom, body.slide, body.t)
    const valid = validBeamCount(beams, body.value)
    const gain = Math.round(killScore(beam, body.value, valid) * scoreMul())
    score += gain
    chain++
    chainTimer = CHAIN_WINDOW
    director.recordKill()
    body.alive = false
    burst(p.x, p.y, colBrass, 22, 260, true)
    burst(p.x, p.y, colGold, 10, 180)
    audio.shatter(chain)
    feel.addTrauma(0.16)
    feel.punch(0.015)
    host.haptic("light")
    if (valid <= 1) {
      // The tight intercept: the only beam on the board that divides it. This
      // is the read worth learning and it is the one the economy pays for.
      pop(`SOLE ×2  +${gain}`, p.x, p.y - 18, 22, RESONANT_HOT)
      feel.requestFlash(0.1, RESONANT_HOT)
      host.haptic("medium")
    } else {
      pop(`+${gain}`, p.x, p.y - 14, 20, RESONANT)
    }
    if (step === 3) {
      feel.slowmo(0.42, 420)
      showBanner("HARMONIC", "three on one pulse", RESONANT, 1.0)
      host.haptic("success")
    }
  }

  function dissonance(body: Automaton): void {
    body.ring = 0.5
    // The cost of a wrong read is time, not damage: the automaton is shoved
    // down the lattice. Nothing is deducted, nothing is scolded.
    body.urgency = Math.min(2.4, body.urgency + 0.35)
    const p = project(geom, body.slide, body.t)
    burst(p.x, p.y, colWrong, 8, 130)
    audio.dissonance()
    feel.kick(0, 1, 3)
    host.haptic("medium")
  }

  function submit(body: Automaton, beam: number): void {
    const w = wave
    if (!w) return
    const p = project(geom, body.slide, body.t)
    const ms = Math.round(performance.now() - waveAskedAt)
    host.report({ questionId: w.questionId, correct: body.correct, ms, answered: String(body.value) })
    body.alive = false

    if (body.correct) {
      right++
      coresRead++
      if (anchors < ANCHORS) credit = Math.min(READ_PER_ANCHOR, credit + 1)
      resonance = Math.min(RESONANCE_MAX, resonance + 1)
      resonanceLeft = RESONANCE_SECONDS
      const gain = Math.round((260 + beam * 40) * scoreMul())
      score += gain
      audio.ascend()
      feel.hitstop(reduced ? 0 : 90)
      feel.slowmo(0.32, 560)
      feel.addTrauma(0.45)
      feel.punch(0.07)
      feel.requestFlash(0.22, RESONANT_HOT)
      host.haptic("success")
      burst(p.x, p.y, colGoldHot, 60, 520, true)
      pop(`+${gain}`, p.x, p.y - 26, 34, RESONANT_HOT)
      showBanner(
        `${w.prompt} = ${body.value}`,
        `${beam} DIVIDES IT · RESONANCE ×${resonance}`,
        RESONANT,
        1.6,
      )
      clearCandidates(false)
      wave = null
      if (credit >= READ_PER_ANCHOR && anchors < ANCHORS) {
        anchors++
        credit -= READ_PER_ANCHOR
        audio.riser()
        showBanner("AN ANCHOR RELIT", "two cores read", RESONANT, 1.5)
        host.haptic("success")
      }
      // A natural stopping point the child reached, never a failure. Rationed
      // here as well as by the host so a long run does not spam it.
      const now = performance.now()
      if (coresRead % 5 === 0 && now - lastTransitionAt > 60_000) {
        lastTransitionAt = now
        host.transition?.("level", `${coresRead} cores`)
      }
    } else {
      audio.settleWrong()
      feel.kick(0, 1, 9)
      feel.addTrauma(0.28)
      feel.requestFlash(0.12, DISSONANT)
      host.haptic("failure")
      // The whole economy, gone. That is the cost of a guess — never an anchor,
      // never a lecture, and the true statement is shown once, plainly.
      resonance = 1
      resonanceLeft = 0
      burst(p.x, p.y, colWrong, 26, 300)
      showBanner(`${w.prompt} = ${w.answer}`, "", LAPIS_HOT, 1.7)
      clearCandidates(true)
      wave = null
    }
  }

  function breach(body: Automaton): void {
    const x = columnX(geom, body.slide)
    burst(x, geom.floorY, colWrong, 34, 340, true)
    audio.breach()
    feel.addTrauma(reduced ? 0 : 0.7)
    feel.kick(0, 1, 16)
    feel.requestFlash(0.2, DISSONANT)
    host.haptic("failure")
    chain = 0
    chainTimer = 0
    anchors--
    if (anchors <= 0) {
      anchors = 0
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
    audio.collapse()
    feel.addTrauma(0.6)
    feel.slowmo(0.25, 900)
    showBanner("THE LATTICE GOES DARK", "tap to tune it again", RESONANT, 3)
  }

  function restart(): void {
    over = false
    score = 0
    anchors = ANCHORS
    credit = 0
    chain = 0
    chainTimer = 0
    resonance = 1
    resonanceLeft = 0
    fireOnArrive = false
    fireCooldown = 0
    asked = 0
    right = 0
    coresRead = 0
    wave = null
    coreBody = null
    banner = null
    field.clear()
    parts.clear()
    feel.reset()
    director.reset()
    for (const p of pulses) p.alive = false
    for (const p of pops) p.alive = false
    rng = new Rng(0xbea3 ^ (Date.now() & 0xffffff))
    fx = new Rng(0x0fec7 ^ (Date.now() & 0xffffff))
    beams = tuneLattice([], N_BEAMS, () => rng.next())
    runnerCol = Math.floor(N_BEAMS / 2)
    runnerSlide = runnerCol
  }

  // ── input ────────────────────────────────────────────────────────────────
  let pointerDown = false
  let downX = 0
  let downY = 0
  let dragged = false

  function localX(e: PointerEvent): number {
    return e.clientX - canvas.getBoundingClientRect().left
  }

  function rideTo(col: number, alsoFire: boolean): void {
    const c = Math.max(0, Math.min(N_BEAMS - 1, col))
    if (c !== runnerCol) {
      runnerCol = c
      audio.ride()
    }
    if (alsoFire) fireOnArrive = true
  }

  function onDown(e: PointerEvent): void {
    void audio.start()
    if (over) {
      if (performance.now() - overAt > 550) restart()
      return
    }
    pointerDown = true
    dragged = false
    downX = e.clientX
    downY = e.clientY
    const col = columnAt(geom, localX(e))
    if (col === runnerCol) fire()
    else rideTo(col, true)
    canvas.setPointerCapture(e.pointerId)
  }

  function onMove(e: PointerEvent): void {
    if (!pointerDown) return
    if (!dragged && Math.hypot(e.clientX - downX, e.clientY - downY) > 14) dragged = true
    if (!dragged) return
    // A drag is the *listening* verb: it rides the lattice without firing, so a
    // child can sweep the beams and hear which one locks.
    fireOnArrive = false
    rideTo(columnAt(geom, localX(e)), false)
  }

  function onUp(e: PointerEvent): void {
    pointerDown = false
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "ArrowLeft") rideTo(runnerCol - 1, false)
    else if (e.key === "ArrowRight") rideTo(runnerCol + 1, false)
    else if (e.key === " " || e.key === "Enter") {
      void audio.start()
      if (over) restart()
      else fire()
    } else return
    e.preventDefault()
  }

  canvas.addEventListener("pointerdown", onDown)
  canvas.addEventListener("pointermove", onMove)
  canvas.addEventListener("pointerup", onUp)
  canvas.addEventListener("pointercancel", onUp)
  globalThis.addEventListener("keydown", onKey)

  // ── frame ────────────────────────────────────────────────────────────────
  let last = performance.now()
  let raf = 0

  function step(dt: number): void {
    const p = director.pressure()
    director.advance(dt)
    fireCooldown = Math.max(0, fireCooldown - dt)
    if (chainTimer > 0) {
      chainTimer -= dt
      if (chainTimer <= 0) chain = 0
    }
    if (resonanceLeft > 0) {
      resonanceLeft -= dt
      if (resonanceLeft <= 0) resonance = 1
    }
    if (!reduced) traceScroll += dt * 0.42

    // The runner slides; a tap on another beam fires the moment it arrives, so
    // the ride and the shot are one gesture rather than two.
    runnerSlide += (runnerCol - runnerSlide) * Math.min(1, dt * 16)
    if (Math.abs(runnerSlide - runnerCol) < 0.05) {
      runnerSlide = runnerCol
      if (fireOnArrive) {
        fireOnArrive = false
        fire()
      }
    }

    if (!over) {
      if (director.wantsCore(wave !== null)) spawnCore()
      if (field.liveCount(A_ORDINARY) < 9 && director.wantsSpawn(field.liveCount(A_ORDINARY))) {
        spawnOrdinary()
      }
    }

    field.update(dt, N_BEAMS, p.stepSeconds, landed)
    for (const body of landed) {
      if (over) {
        body.alive = false
        continue
      }
      if (body.kind === A_CANDIDATE) {
        body.alive = false
        // One candidate on the floor ends the reading — the rest are its
        // siblings and there is nothing left to choose between.
        if (wave) expireWave()
      } else if (body.kind === A_CORE) {
        body.alive = false
        coreBody = null
        if (wave) expireWave()
      } else {
        body.alive = false
        breach(body)
      }
    }

    if (coreBody && coreBody.alive && !coreBody.fractured && coreBody.t >= 0.26) {
      fracture(coreBody)
    }

    stepPulses(dt)
    parts.update(dt)

    for (const q of pops) {
      if (!q.alive) continue
      q.life -= dt
      q.y -= dt * 46
      if (q.life <= 0) q.alive = false
    }
    if (banner) {
      banner.life -= dt
      if (banner.life <= 0) banner = null
    }
  }

  /** The resonance lock: what the beam under the runner is singing against. */
  function lock(): { target: Automaton | null; phase: number } {
    const col = Math.round(runnerSlide)
    const beam = beams[col]
    const target = field.target(col)
    if (beam === undefined || !target || target.kind === A_CORE) {
      return { target: null, phase: 0.5 }
    }
    return { target, phase: phaseOffset(beam, target.value) }
  }

  function draw(nowMs: number): void {
    const q = gov.quality
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawHall(g, geom)

    const { target, phase } = lock()
    const locked = target !== null && phase === 0
    const beamCol = Math.round(runnerSlide)

    g.save()
    // Screenshake, punch zoom and the slow-motion camera, all at once.
    g.translate(geom.w / 2 + feel.shakeX, geom.h / 2 + feel.shakeY)
    g.scale(feel.scale, feel.scale)
    g.translate(-geom.w / 2, -geom.h / 2)

    const styles: BeamStyle[] = []
    for (let i = 0; i < N_BEAMS; i++) {
      styles.push({ lit: i === beamCol ? (locked ? 1 : 0.72) : 0.12, label: beams[i] ?? 0 })
    }
    drawBeams(g, geom, styles)

    if (target) {
      drawTraces(g, geom, beamCol, phase, reduced ? 0 : traceScroll, q.traceSamples, locked)
    }

    // Far to near, so a nearer automaton overlaps a further one.
    const ridden = beams[beamCol]
    order.length = 0
    for (const b of field.bodies) if (b.alive) order.push(b)
    order.sort((a, b) => a.t - b.t)
    for (const b of order) {
      const pr = project(geom, b.slide, b.t)
      // The lock ring: worn only by an automaton the beam under the runner
      // actually divides, right now. Never by "the correct candidate" — a
      // candidate carrying the answer is drawn exactly like one that is not.
      const hot =
        b.kind !== A_CORE &&
        Math.round(b.slide) === beamCol &&
        ridden !== undefined &&
        resonates(ridden, b.value)
          ? 1
          : 0
      drawAutomaton(g, {
        x: pr.x,
        y: pr.y,
        r: Math.max(7, (b.kind === A_CORE ? 46 : 26) * pr.scale),
        text: b.text,
        kind: b.kind,
        ring: b.ring,
        hot,
        glow: q.glow,
      })
    }

    for (const p of pulses) if (p.alive) drawPulse(g, geom, p.col, Math.max(0, p.t))
    parts.draw(g)
    drawRunner(g, geom, runnerSlide, fireCooldown > 0 ? 1 : locked ? 0.7 : 0.2, q.glow)
    g.restore()

    // Chrome sits outside the shake so the numbers never blur.
    drawScore(g, geom, score, resonance)
    drawAnchors(g, geom, anchors, ANCHORS, credit, READ_PER_ANCHOR)

    for (const p of pops) {
      if (!p.alive) continue
      const t = p.life / p.max
      g.globalAlpha = Math.min(1, t * 2)
      g.font = font(UI_FONT, p.size)
      g.textAlign = "center"
      g.textBaseline = "middle"
      g.fillStyle = p.color
      g.fillText(p.text, p.x, p.y)
      g.globalAlpha = 1
    }

    if (banner) {
      const t = banner.life / banner.max
      g.globalAlpha = Math.min(1, t * 3)
      const y = geom.h * 0.3
      const size = Math.max(19, Math.min(geom.w * 0.075, 40))
      g.font = font(UI_FONT, size)
      g.textAlign = "center"
      g.textBaseline = "middle"
      g.fillStyle = withAlpha("#04060d", 0.72)
      g.fillRect(0, y - size * 1.1, geom.w, size * 2.5)
      g.fillStyle = banner.color
      g.fillText(banner.text, geom.w / 2, y)
      if (banner.sub) {
        g.font = font(UI_FONT, Math.max(11, size * 0.42))
        g.fillStyle = withAlpha(PAPER, 0.7)
        g.fillText(banner.sub, geom.w / 2, y + size * 0.95)
      }
      g.globalAlpha = 1
    }

    if (over) {
      g.fillStyle = withAlpha("#04060d", 0.62)
      g.fillRect(0, 0, geom.w, geom.h)
      g.font = font(UI_FONT, Math.max(15, Math.min(geom.w * 0.05, 24)))
      g.textAlign = "center"
      g.fillStyle = withAlpha(PAPER, 0.85)
      g.fillText(`${score}`, geom.w / 2, geom.h * 0.52)
      g.font = font(UI_FONT, 13)
      g.fillStyle = withAlpha(PAPER, 0.5)
      g.fillText(
        `best ${best} · ${right}/${asked} cores read`,
        geom.w / 2,
        geom.h * 0.52 + 26,
      )
    }

    audio.setLock(140 + (beams[beamCol] ?? 2) * 26, target ? phase : 0.5, target !== null)
    void nowMs
  }

  function frame(nowMs: number): void {
    if (!running) return
    raf = requestAnimationFrame(frame)
    const rawDt = Math.min(64, nowMs - last)
    last = nowMs
    // A tier change moves the render scale and the particle ceiling, and both
    // of those live in `resize` — without this the governor drops the tier and
    // nothing gets cheaper.
    if (gov.sample(rawDt)) resize()
    const simMs = feel.advance(rawDt, nowMs)
    if (simMs > 0) step(Math.min(0.05, simMs / 1000))
    draw(nowMs)
  }
  raf = requestAnimationFrame(frame)

  return {
    unmount(): void {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerup", onUp)
      canvas.removeEventListener("pointercancel", onUp)
      globalThis.removeEventListener("keydown", onKey)
      audio.dispose()
      root.remove()
    },
  }
}
