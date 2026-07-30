import { createInstructions } from "../../../packs/shared/game-chrome/index.ts"
import type { Host, MountOptions } from "./contract.ts"
import { Gfx } from "./render/gfx.ts"
import { Hud } from "./ui/hud.ts"
import { Input } from "./core/input.ts"
import { Audio } from "./feel/audio.ts"
import { Camera } from "./feel/camera.ts"
import { Floaters } from "./feel/floaters.ts"
import { guessTier, specFor, TierGovernor, type TierName } from "./core/tier.ts"
import { R_K, viewSpanFor, World, type GameEvent } from "./sim/world.ts"
import { statesAnswer } from "./ribbon.ts"

const FIXED = 1 / 60
const MAX_SUBSTEPS = 3

/**
 * A development handle. It exists so a soak/perf harness can drive the
 * simulation and the renderer synchronously — the only way to get a truthful
 * frame time on a machine where the tab is not reliably foregrounded, and the
 * only way to fast-forward twenty minutes of escalation in a few seconds.
 */
type Debug = {
  world: World
  cam: Camera
  gov: TierGovernor
  gfx: Gfx
  forceTier(t: TierName): void
  fps(): number
  /** Run one full frame outside the rAF loop, for the perf/soak harness. */
  frameOnce(dt: number): void
  /** Milliseconds from a Resonance opening to the answer being registered. */
  lastAnswerMs: number
}

export function mountArena(el: HTMLElement, host: Host, opts?: MountOptions): { unmount(): void } {
  const container = document.createElement("div")
  container.style.position = "absolute"
  container.style.inset = "0"
  container.style.overflow = "hidden"
  container.style.background = "#01040c"
  container.style.contain = "strict"
  el.appendChild(container)

  const readReduced = (): boolean => {
    try {
      return host.prefersReducedMotion()
    } catch (err) {
      console.error("[arena] host.prefersReducedMotion threw", err)
      return false
    }
  }
  let reduced = readReduced()

  // Sampled once at mount, the setting could only take effect on a remount —
  // a child who turns motion down mid-session, which is exactly when they
  // would, saw no change at all. Re-ask the Host whenever the OS setting
  // moves; the Host stays the source of truth, this is only the trigger.
  const motionQuery =
    typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null
  const onMotionChange = (): void => {
    reduced = readReduced()
    cam.reduced = reduced
  }
  motionQuery?.addEventListener("change", onMotionChange)

  const startTier = guessTier()
  const gfx = new Gfx(container, specFor(startTier))
  const hud = new Hud(container, (on) => {
    audio.setEnabled(on)
    return on
  })
  const input = new Input(container)

  // How to play. The arena states its rule with a picture and most children do
  // read it in three seconds — but "most" is not "all", and a child who reads
  // it wrong learns it by being stung, which is the one way we do not want to
  // teach it. The manual is a button, never a wall: it opens nothing on its own
  // and it stays reachable during play, because the moment a child needs the
  // rules is never the title.
  const guide = createInstructions(el, {
    title: "ARENA",
    summary: [
      "You are a number swimming in dark water. Eat every number smaller than you and you grow.",
      "Numbers bigger than you sting. Stay away from those.",
    ],
    sections: [
      {
        heading: "How to swim",
        lines: [
          "Put a finger on the screen and drag. You swim the way you drag.",
          "Hold a second finger down to surge. You go fast, but you shrink while you do it.",
          "The bits you drop while surging turn into food. Other numbers will eat them.",
          "On a computer: point with the mouse to swim, and hold the space bar to surge.",
        ],
      },
      {
        heading: "What to eat",
        lines: [
          "A smooth filled circle is smaller than you. Swim into it and you eat it.",
          "A spiky hollow ring is bigger than you. It stings and takes some of your size.",
          "A red circle marked with a minus sign always hurts, however small it looks.",
          "Some numbers are close, like 3,418 and 3,481. Read the digits before you swim in.",
        ],
      },
      {
        heading: "The dark moment",
        lines: [
          "Every so often the water goes dark and a math question appears above you. The screen calls it a RESONANCE, which is just the name for this moment.",
          "Four glass balls float around you. Each ball holds a different answer.",
          "Swim into the ball with the right answer and you grow a lot.",
          "Pick the wrong ball and you lose some size. The right ball lights up so you can see it.",
        ],
      },
      {
        heading: "Going deeper",
        lines: [
          "The deeper you go, the more the water changes colour and the more there is to dodge.",
          "The small marks under the depth name fill in as you go down. They never empty.",
          "RANK counts the numbers bigger than you. RANK 4 means three of them are bigger; RANK 1 means none are.",
          "If something much bigger hits you, you burst and scatter, then come straight back.",
          "There is no ending and no way to lose the run. You play until you want to stop.",
        ],
      },
    ],
    reducedMotion: reduced,
  })

  const audio = new Audio()
  const cam = new Camera()
  cam.reduced = reduced
  const floaters = new Floaters()
  // The WORLD's seed, not the Host's. `?seed=` reproducing a run means this
  // one; seeding only the question generator reproduces the arithmetic and
  // leaves every mote, rival and spawn to the wall clock.
  const worldSeed = opts?.seed ?? ((Date.now() ^ 0x9e3779b9) | 0)
  const world = new World(host, specFor(startTier), worldSeed)

  const gov = new TierGovernor(startTier, (spec) => {
    gfx.applySpec(spec)
    world.applySpec(spec)
  })

  cam.span = viewSpanFor(world.mass)
  cam.x = world.px
  cam.y = world.py

  let running = true
  let last = performance.now()
  let acc = 0
  let time = 0
  let raf = 0
  let hintTimer = 0
  const showPerf = new URLSearchParams(location.search).has("perf")

  // -- resize -------------------------------------------------------------
  const ro = new ResizeObserver(() => {
    const r = container.getBoundingClientRect()
    gfx.resize(Math.max(1, r.width), Math.max(1, r.height))
  })
  ro.observe(container)
  {
    const r = container.getBoundingClientRect()
    gfx.resize(Math.max(1, r.width || window.innerWidth), Math.max(1, r.height || window.innerHeight))
  }

  // -- audio unlock -------------------------------------------------------
  const unlock = (): void => {
    audio.init().catch((e: unknown) => console.warn("[arena] audio init failed", e))
  }
  container.addEventListener("pointerdown", unlock, { once: false })
  window.addEventListener("keydown", unlock, { once: false })

  const onVisibility = (): void => {
    if (document.hidden) {
      running = false
    } else if (!running) {
      running = true
      last = performance.now()
      acc = 0
      raf = requestAnimationFrame(frame)
    }
  }
  document.addEventListener("visibilitychange", onVisibility)

  // -- screen <-> world ---------------------------------------------------
  function screenToWorld(px: number, py: number, out: { x: number; y: number }): void {
    const r = container.getBoundingClientRect()
    const w = Math.max(1, r.width)
    const h = Math.max(1, r.height)
    const aspect = w / h
    out.x = cam.viewX + ((px - r.left) / w - 0.5) * cam.span * aspect
    out.y = cam.viewY + (0.5 - (py - r.top) / h) * cam.span
  }
  const aim = { x: 0, y: 0 }

  // -- effects ------------------------------------------------------------
  const pal = gfx.palette

  function burst(
    x: number,
    y: number,
    n: number,
    speed: number,
    life: number,
    size: number,
    r: number,
    g: number,
    b: number,
    kind: number,
    towardX?: number,
    towardY?: number,
  ): void {
    const count = reduced ? Math.max(2, Math.round(n * 0.35)) : n
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const s = speed * (0.35 + Math.random() * 0.9)
      let vx = Math.cos(a) * s
      let vy = Math.sin(a) * s
      if (towardX !== undefined && towardY !== undefined) {
        // Bias the spray toward a point — absorbs suck inward, hits spray out.
        const dx = towardX - x
        const dy = towardY - y
        const d = Math.hypot(dx, dy) || 1
        vx = vx * 0.35 + (dx / d) * s * 1.1
        vy = vy * 0.35 + (dy / d) * s * 1.1
      }
      gfx.particles.spawn(
        x,
        y,
        vx,
        vy,
        life * (0.6 + Math.random() * 0.8),
        size * (0.55 + Math.random() * 0.9),
        r,
        g,
        b,
        kind,
        time,
      )
    }
  }

  function handle(e: GameEvent): void {
    const pr = world.playerRTrue
    switch (e.kind) {
      case "absorb": {
        const share = Math.min(1, e.a / Math.max(1, world.mass))
        burst(e.x, e.y, 4 + Math.round(share * 16), 260 + share * 460, 0.34, pr * 0.16 + 4, pal.food[0] as number, pal.food[1] as number, pal.food[2] as number, 1, world.px, world.py)
        cam.addPunch(0.006 + share * 0.05)
        if (share > 0.22) {
          cam.addTrauma(0.05 + share * 0.14)
          cam.addHitstop(0.012 + share * 0.03)
          gfx.rings.spawn(e.x, e.y, 8, 40 + share * 190, 0.42, 0.16, 0, pal.food[0] as number, pal.food[1] as number, pal.food[2] as number, time)
        }
        if (share > 0.1 || e.b % 5 === 0) {
          floaters.push(e.a, e.x, e.y, Math.max(cam.span * 0.013, pr * 0.19), 0.75, 1, 0.9)
        }
        audio.absorb(e.b, e.a, world.mass)
        break
      }
      case "sting": {
        cam.addTrauma(0.34)
        cam.addHitstop(0.05)
        cam.addAberration(0.006)
        cam.addFlash(0.10, 1, 0.25, 0.35)
        cam.addRipple(e.x, e.y, 0.5, 1.6)
        burst(e.x, e.y, 26, 520, 0.6, pr * 0.2 + 6, 1, 0.24, 0.34, 1)
        gfx.rings.spawn(e.x, e.y, 10, 260, 0.5, 0.2, 1, 1, 0.3, 0.4, time)
        floaters.push(-Math.round(e.a), e.x, e.y, Math.max(cam.span * 0.017, pr * 0.22), 1, 0.35, 0.42, 1.0)
        audio.sting(e.a, world.mass)
        break
      }
      case "kill": {
        cam.addTrauma(0.6)
        cam.addHitstop(0.085)
        cam.addPunch(0.10)
        cam.addFlash(0.20, pal.food[0] as number, pal.food[1] as number, pal.food[2] as number)
        cam.addRipple(e.x, e.y, 0.85, 0.9)
        burst(e.x, e.y, 54, 780, 0.9, pr * 0.22 + 8, pal.food[0] as number, pal.food[1] as number, pal.food[2] as number, 1, world.px, world.py)
        burst(e.x, e.y, 22, 340, 1.4, pr * 0.14 + 5, 1, 1, 1, 0)
        gfx.rings.spawn(e.x, e.y, 12, 420, 0.75, 0.20, 2, 1, 1, 1, time)
        gfx.rings.spawn(e.x, e.y, 12, 260, 0.55, 0.34, 0, pal.food[0] as number, pal.food[1] as number, pal.food[2] as number, time)
        floaters.push(Math.round(e.a), e.x, e.y, Math.max(cam.span * 0.025, pr * 0.33), 1, 1, 0.7, 1.3)
        audio.devour(world.mass, e.a)
        break
      }
      case "rupture": {
        cam.addTrauma(1)
        cam.addHitstop(0.13)
        cam.addFlash(0.30, 1, 0.35, 0.4)
        cam.addAberration(0.012)
        cam.addRipple(e.x, e.y, 1, 0.7)
        cam.desat = 0.55
        burst(e.x, e.y, 110, 1000, 1.5, pr * 0.24 + 10, 1, 0.35, 0.45, 1)
        burst(e.x, e.y, 40, 420, 2.2, pr * 0.16 + 6, 1, 0.85, 0.9, 0)
        gfx.rings.spawn(e.x, e.y, 14, pr * 9, 1.1, 0.16, 2, 1, 0.4, 0.5, time)
        gfx.rings.spawn(e.x, e.y, 14, pr * 5, 0.8, 0.3, 0, 1, 1, 1, time)
        audio.rupture()
        break
      }
      case "flip": {
        if (!reduced && Math.random() < 0.5) {
          burst(e.x, e.y, 3, 120, 0.4, e.a * 0.14 + 2, pal.food[0] as number, pal.food[1] as number, pal.food[2] as number, 0)
        }
        audio.flip()
        break
      }
      case "depth": {
        // A rung. This is the structural beat of the whole run — it is the only
        // thing on screen that only ever goes one way — so it is the biggest
        // non-fatal event in the game, and it settles rather than snaps.
        // `e.b` says whether the run BOUGHT this band with mass or whether the
        // clock simply delivered it; same rung, different colour, different
        // chord, and a child can hear which one they got.
        const bought = e.b > 0.5
        const cr = bought ? 1 : (pal.shaft[0] as number)
        const cg = bought ? 0.86 : (pal.shaft[1] as number)
        const cb = bought ? 0.42 : (pal.shaft[2] as number)
        cam.addTrauma(bought ? 0.55 : 0.34)
        cam.addPunch(bought ? 0.13 : 0.06)
        cam.addFlash(bought ? 0.22 : 0.16, cr, cg, cb)
        cam.addRipple(world.px, world.py, bought ? 0.9 : 0.7, 0.48)
        burst(world.px, world.py, bought ? 90 : 40, 620, 2.0, pr * 0.18 + 7, cr, cg, cb, 0)
        burst(world.px, world.py, bought ? 34 : 16, 260, 3.0, pr * 0.12 + 5, 1, 0.98, 0.9, 0)
        gfx.rings.spawn(world.px, world.py, pr, cam.span * 1.6, 1.7, 0.10, 2, cr, cg, cb, time)
        gfx.rings.spawn(world.px, world.py, pr, cam.span * 1.1, 1.2, 0.20, 0, 1, 1, 1, time)
        if (bought) gfx.rings.spawn(world.px, world.py, pr * 0.6, pr * 9, 1.5, 0.22, 1, 1, 0.94, 0.62, time)
        hud.showVerdict(world.depth.name, bought ? "#ffd479" : "#9fe8ff")
        if (bought) audio.anchor(world.depth.index)
        else audio.depth(world.depth.index)
        break
      }
      case "held": {
        // Gold, brief, and it reads as the water refusing to take any more.
        cam.addFlash(0.09, 1, 0.84, 0.40)
        cam.addPunch(0.05)
        gfx.rings.spawn(world.px, world.py, pr * 1.6, pr * 3.6, 0.7, 0.30, 1, 1, 0.86, 0.42, time)
        gfx.rings.spawn(world.px, world.py, pr * 1.1, pr * 2.4, 0.5, 0.42, 0, 1, 0.96, 0.70, time)
        burst(world.px, world.py, 22, 300, 0.9, pr * 0.10 + 4, 1, 0.86, 0.42, 0, world.px, world.py)
        audio.held()
        host.haptic("light")
        break
      }
      case "resonance-open": {
        // The one place a camera cue had no reduced-motion counterpart: this
        // event fired only `addRipple`, which returns immediately under
        // reduced motion, so the "the arena is about to ask you something"
        // beat was silently dropped. A pale, low flash carries the same
        // meaning with zero travel.
        cam.addRipple(world.px, world.py, 0.55, 0.6)
        cam.addFlash(0.08, 0.7, 0.92, 1)
        gfx.rings.spawn(world.px, world.py, pr, e.a * 1.15, 0.9, 0.14, 2, 0.7, 0.92, 1, time)
        audio.resonanceOpen()
        break
      }
      case "resonance-hit": {
        // THE BIGGEST THING IN THE GAME, and it was not.
        //
        // Audited before this change: `rupture` — bursting, a FAILURE — carried
        // trauma 1.00 and hitstop 0.13, and a right answer carried 0.85 and
        // 0.11. The loudest single moment in a mathematics product was a
        // mistake. Celebration on successful retrieval is what reinforces the
        // retrieval, so the maths moment now outranks everything, on every axis,
        // and it gets a second beat nothing else has: a slow outer wave that
        // lands a quarter-second after the first, which is the "BOOOOOOOM".
        //
        // The flash is 0.34 because that is `Camera.addFlash`'s own hard cap —
        // asked for more, it would be given 0.34 anyway, and asking for the cap
        // rather than past it keeps the WCAG rate limiter's arithmetic honest.
        // `e.r` is how QUICK the answer was, 0..1. Speed is paid out in
        // spectacle as well as in mass — a brisk answer gets a visibly bigger
        // celebration — and a slow correct answer still gets all of the above,
        // which is the floor this may never drop below.
        const quick = e.r
        cam.addTrauma(1)
        cam.addHitstop(0.14)
        cam.addPunch(0.24 + quick * 0.06)
        cam.addFlash(0.34, 1, 0.98, 0.85)
        cam.addRipple(world.px, world.py, 1, 0.5)
        burst(world.px, world.py, Math.round(220 + quick * 140), 1500, 1.8, pr * 0.22 + 9, 1, 0.95, 0.7, 1)
        burst(world.px, world.py, Math.round(110 + quick * 70), 560, 2.8, pr * 0.18 + 7, 0.6, 0.95, 1, 0)
        burst(world.px, world.py, 70, 260, 3.6, pr * 0.12 + 5, 1, 1, 1, 0)
        gfx.rings.spawn(world.px, world.py, pr, pr * 9, 1.3, 0.075, 2, 1, 0.95, 0.75, time)
        gfx.rings.spawn(world.px, world.py, pr, pr * 6, 0.95, 0.14, 0, 1, 1, 1, time)
        gfx.rings.spawn(world.px, world.py, pr, pr * 13, 1.8, 0.045, 1, 0.6, 0.9, 1, time)
        gfx.rings.spawn(world.px, world.py, pr * 0.4, pr * 20, 2.6, 0.030, 2, 1, 0.9, 0.6, time + 0.26)
        floaters.push(Math.round(e.a), world.px, world.py, Math.max(cam.span * 0.038, pr * 0.5), 1, 1, 0.75, 1.7)
        // The sum that earned it, in the ribbon, held long enough to read. A
        // correct answer wipes every mote inside seven player radii, and each
        // of those absorbs would otherwise overwrite the line within a frame.
        const q = world.resonance.question
        if (q) {
          const p = q.prompt
          hud.showEquation(statesAnswer(p, q.answer), 2.8, "solved")
        }
        hud.showVerdict(e.b >= 3 ? `RESONANT ×${e.b}` : "RESONANT", "#b9ffe4")
        audio.resonanceHit(e.b)
        break
      }
      case "resonance-miss": {
        // THE REVEAL. Not a correction — there is no "wrong", no red cross and
        // no scolding anywhere in this branch. The arena simply finishes the
        // sum, in the ribbon, the same way it would have celebrated it and
        // merely quieter, and holds it for as long as the player's own pace
        // says they want. A child at the bottom of the ladder gets four
        // patient seconds of `12 + 5 = 17`; a player in wizard mode gets none,
        // because being held for it would be a punishment for being good.
        const rq = world.resonance.question
        const hold = world.revealSeconds
        if (rq && hold >= 0.25) {
          const rp = rq.prompt
          hud.showEquation(statesAnswer(rp, rq.answer), hold, "reveal")
        }
        cam.addTrauma(0.5)
        cam.addHitstop(0.07)
        cam.addAberration(0.009)
        cam.addFlash(0.12, 1, 0.4, 0.5)
        burst(e.x, e.y, 44, 620, 0.9, pr * 0.18 + 6, 1, 0.4, 0.5, 1)
        gfx.rings.spawn(e.x, e.y, 12, 340, 0.6, 0.24, 0, 1, 0.4, 0.5, time)
        floaters.push(-Math.round(e.a), world.px, world.py, Math.max(cam.span * 0.019, pr * 0.28), 1, 0.5, 0.55, 1.1)
        audio.resonanceMiss()
        break
      }
      case "shockwave": {
        gfx.rings.spawn(e.x, e.y, pr * 0.5, e.a, e.b === 2 ? 1.1 : 0.7, 0.07, e.b === 2 ? 2 : 0, 1, 1, 1, time)
        break
      }
      case "rival-death": {
        burst(e.x, e.y, e.b ? 60 : 18, 480, 0.8, R_K * Math.sqrt(e.a) * 0.2 + 4, pal.threat[0] as number, pal.threat[1] as number, pal.threat[2] as number, 1)
        gfx.rings.spawn(e.x, e.y, 8, R_K * Math.sqrt(e.a) * 4, 0.5, 0.24, 0, pal.threat[0] as number, pal.threat[1] as number, pal.threat[2] as number, time)
        break
      }
      case "resonance-fade":
      default:
        break
    }
  }

  /**
   * One complete frame: camera, simulation, every event turned into juice, and
   * the draw. The rAF loop and the soak harness both go through here, so a
   * headless run exercises exactly the code a child's frame does — there is no
   * second, more forgiving path that only the tests ever see.
   */
  function advance(dtReal: number): void {
    cam.update(dtReal, world.px, world.py, world.pvx, world.pvy, viewSpanFor(world.massVis))
    floaters.step(dtReal)

    // Hit-stop freezes the simulation, never the camera or the particles —
    // that is the whole trick: the world stops, the *presentation* does not.
    if (cam.hitstop <= 0) {
      acc += dtReal
      let steps = 0
      while (acc >= FIXED && steps < MAX_SUBSTEPS) {
        acc -= FIXED
        steps++
        world.step(FIXED)
        for (let i = 0; i < world.eventLen; i++) handle(world.events[i] as GameEvent)
      }
      if (steps >= MAX_SUBSTEPS) acc = 0
    }

    time += dtReal
    gfx.draw(world, cam, time, reduced, floaters)
  }

  // -- the loop -----------------------------------------------------------
  function frame(now: number): void {
    if (!running) return
    raf = requestAnimationFrame(frame)

    let dtReal = (now - last) / 1000
    last = now
    if (!Number.isFinite(dtReal) || dtReal < 0) dtReal = FIXED
    gov.sample(dtReal * 1000)
    dtReal = Math.min(dtReal, 0.1)

    // Reading the rules is not playing. With the manual open the water holds
    // its shape and nothing eats the child while they are looking something up
    // — the picture keeps being drawn, the simulation does not advance, and the
    // finger they are holding on the panel is not a steer.
    if (guide.isOpen) {
      gfx.draw(world, cam, time, reduced, floaters)
      return
    }

    const st = input.sample()
    if (st.hasAbsolute) {
      screenToWorld(st.absX, st.absY, aim)
      world.aimX = aim.x
      world.aimY = aim.y
    } else if (st.dx !== 0 || st.dy !== 0) {
      world.aimX = world.px + st.dx * cam.span * 0.7
      world.aimY = world.py - st.dy * cam.span * 0.7
    } else {
      world.aimX = world.px
      world.aimY = world.py
    }
    world.surging = st.surge && !world.resonance.active

    advance(dtReal)

    audio.setState(world.mass, world.depth.index, Math.min(1, world.combo / 20 + (world.invuln > 0 ? 0.4 : 0)))
    audio.surge(world.surging, Math.hypot(world.pvx, world.pvy))
    audio.tick(dtReal)

    // A wordless nudge toward the second verb, and only if it has never been
    // found. No copy, no arrow, no tooltip — just a pulse where your thumb is.
    if (!st.everSurged && world.time > 12) {
      hintTimer -= dtReal
      if (hintTimer <= 0) {
        hintTimer = 2.2
        gfx.rings.spawn(world.px, world.py, world.playerR * 1.2, world.playerR * 2.6, 1.1, 0.10, 0, 0.55, 0.9, 1, time)
      }
    }

    hud.update(world, dtReal, gov.fps, gov.spec.name, showPerf)
  }

  raf = requestAnimationFrame(frame)

  // The handle is a development affordance, not a shipped surface: anything on
  // the page could otherwise drive a child's game. It attaches under Vite dev,
  // or when explicitly asked for.
  const wantDebug =
    ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV ?? false) ||
    new URLSearchParams(location.search).has("dev") ||
    showPerf

  const dbg: Debug = {
    world,
    cam,
    gov,
    gfx,
    forceTier: (t) => gov.force(t),
    fps: () => gov.fps,
    frameOnce: (dt) => {
      advance(dt)
      hud.update(world, dt, gov.fps, gov.spec.name, showPerf)
    },
    get lastAnswerMs() {
      return world.resonance.answerMs
    },
  }
  if (wantDebug) (window as unknown as { __arena?: Debug }).__arena = dbg

  return {
    unmount() {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
      motionQuery?.removeEventListener("change", onMotionChange)
      container.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
      input.dispose()
      guide.destroy()
      hud.dispose()
      audio.dispose()
      gfx.dispose()
      container.remove()
      if (wantDebug) delete (window as unknown as { __arena?: Debug }).__arena
    },
  }
}
