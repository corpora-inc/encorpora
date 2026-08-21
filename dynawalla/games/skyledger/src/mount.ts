// SKY LEDGER — the shell. Canvas, clock, input, and the wiring from the rules
// in `game/game.ts` to the observatory in `render/scene.ts`.
//
// **The pause.** The host can put a sheet — a stopping-point card, a parent
// gate, a day-pass offer — over a pack that is still mounted and still running,
// and this game calls `transition` at the end of every watch the child worked,
// so it raises that sheet itself. Four things have to stop dead:
//
//   1. **Input.** A touch behind the sheet is not something the child did.
//   2. **The ledger lines' clocks.** Time behind a sheet is not thinking time.
//   3. **The sky.** Stars must not fall onto lamps nobody was watching.
//   4. **The chain.** A live chain must not expire while the host is talking.
//
// `Game.pause`/`Game.resume` own all four; the rAF loop here stops advancing
// the scene so the world holds its shape under the sheet. **Neither is reached
// unless `pack.ts` subscribes** — the handlers are inert on their own, and a
// pack that registers a `pause()` and never wires it up is the exact bug this
// comment exists to prevent.
//
// The game's own how-to-play sheet is the *other* thing that puts a scrim over
// a running observatory, and it is the one a child raises deliberately, because
// they are stuck. Stars falling behind the rules a child opened in order to
// understand why they were falling is the whole defect. So the manual takes the
// same pause — but only lifts one it put on itself, or a watch the host had
// already stopped would come back running the moment the rules were closed.
//
// **Hitstop and timescale.** The escalation's channels arrive on the bloom
// event. Hitstop is a global time-scale of exactly zero applied to the
// simulation only: audio keeps ringing, input keeps being sampled, and the
// particles spawned by the impact are already on screen, so the freeze contains
// the flash rather than preceding it.

import { createInstructions, onInsetsChange } from "../../../packs/shared/game-chrome/index.ts"
import { Audio } from "./audio/audio.ts"
import type { Host } from "./contract.ts"
import { unit } from "./core/feel.ts"
import { Rng } from "./core/rng.ts"
import { bestChain, recordChain } from "./game/best.ts"
import { loggedEver, noteLogged } from "./game/seen.ts"
import { CHAIN_CAP } from "./game/escalation.ts"
import { Game, LAMPS, SIGHTINGS, type GameEvent } from "./game/game.ts"
import { angleAt, ringAt, type Ring } from "./render/astrolabe.ts"
import { Scene, type SceneState } from "./render/scene.ts"
import { starPoint, type StarView } from "./render/sky.ts"

/**
 * The largest step the clock may take in one frame.
 *
 * A backgrounded tab hands back a delta of minutes. Clamping means time nearly
 * stops when frames stop, instead of a watch of stars teleporting into the
 * ground while the child was in another app.
 */
const MAX_STEP_MS = 120

/** How far a finger sweeps around a ring before it seats in the next detent. */
const DETENT_ARC = Math.PI / 9

/** How close a touch has to land to a star to sight it, as a fraction of a cell. */
const SIGHT_RADIUS = 1.5

export function mountSkyLedger(
  el: HTMLElement,
  host: Host,
): { unmount(): void; pause(): void; resume(): void } {
  const canvas = document.createElement("canvas")
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none"
  el.appendChild(canvas)

  const reduced = host.prefersReducedMotion()
  const seed = (Date.now() ^ 0x5c7ed6) >>> 0
  const scene = new Scene(canvas, reduced, seed)
  const audio = new Audio()

  function now(): number {
    return typeof performance === "object" ? performance.now() : Date.now()
  }

  // The calm opening's index: stars this child has logged in every previous
  // sitting. Read ONCE, here — the rules keep counting within the sitting.
  const game = new Game(host, new Rng(seed), now(), reduced, loggedEver())
  let best = bestChain()

  let running = true
  let paused = false
  /** Did the manual put this pause on? Only then may closing it lift one. */
  let heldForManual = false
  let last = 0
  let frame = 0

  /** Simulation time owed to a freeze. Counted down in wall-clock ms. */
  let hitstopLeft = 0
  let timescale = 1
  let chroma = 0
  let bloomLevel = 0

  /** Stations written down this sitting. It only ever fills in. */
  const logged = new Set<number>()

  /** The astrolabe's live gesture. */
  let held: Ring | null = null
  let heldAngle = 0
  let heldDrift = 0
  let press = 0
  let refuse = 0
  let pointer = -1

  // ── events ───────────────────────────────────────────────────────────────

  const apply = (events: readonly GameEvent[]): void => {
    for (const event of events) {
      switch (event.kind) {
        case "turn": {
          audio.detent(event.ring === "ones" ? event.station.x : event.station.y)
          host.haptic("light")
          break
        }
        case "sight": {
          audio.detent(2)
          break
        }
        case "bloom": {
          scene.addBloom(event.star, event.station, unit(event.link / CHAIN_CAP), event.link)
          logged.add(event.station.y * 10 + event.station.x)
          // The write side of the ramp. One true assertion, banked, so tomorrow
          // starts where today finished.
          noteLogged()
          audio.bloom(event.link)
          host.haptic(event.link >= 4 ? "heavy" : "success")
          hitstopLeft = Math.max(hitstopLeft, event.channels.hitstopMs)
          timescale = event.channels.timescale
          chroma = event.channels.chromaRpx
          bloomLevel = event.channels.bloom
          break
        }
        case "wide": {
          // Restraint. A cold ring where the child said the star was, and
          // nothing else: no shake, no buzzer, no red. A recognised slip is
          // quieter still, because the register has seen it before.
          scene.addCold(event.station)
          audio.wide()
          host.haptic(event.recognised ? "light" : "medium")
          break
        }
        case "shown": {
          // The observatory finishes the sum and holds it. No shake, no red,
          // no buzzer: the register is writing a line out. What is DRAWN comes
          // from `game.shown` on every frame, because the reveal has no
          // duration — it is up until a hand takes it down — so it cannot be a
          // fading effect the scene owns.
          audio.wide()
          host.haptic("light")
          break
        }
        case "refused": {
          if (event.reason === "dry") {
            refuse = 1
            audio.refuse()
            host.haptic("failure")
          }
          break
        }
        case "release": {
          // The hard snap-back. The channels are already at rest in the rules;
          // here they come off the renderer in the same single step, and the
          // ceremony plays over the top of a world that is already moving at
          // full speed again.
          timescale = 1
          chroma = 0
          bloomLevel = 0
          hitstopLeft = 0
          scene.addRelease(event.release.links, event.release.weight)
          audio.release(event.release.links)
          if (recordChain(event.release.links)) best = event.release.links
          break
        }
        case "land": {
          scene.addLanding()
          audio.snuff()
          host.haptic("medium")
          break
        }
        case "over": {
          if (recordChain(event.ledger.longest)) best = event.ledger.longest
          break
        }
        case "stalled": {
          console.error("[skyledger] stalled: the host served nothing this sky can hold")
          break
        }
        default:
          break
      }
    }
  }

  apply(game.begin(now()))

  // ── the loop ─────────────────────────────────────────────────────────────

  const view = (t: number): SceneState => {
    const sighted = game.sighted
    // The whole tutorial, and it is one string the rules built out of the star's
    // own prompt and the child's own reading: the sighted plate says
    // `247 + 225 = 74` while the rings stand at 74. Nothing is revealed — the
    // right-hand side is theirs — and no new copy is shipped, which matters at
    // fifty locales. `null` once the opening is past needing it.
    const plate = game.guide
    const stars: StarView[] = game.stars
      .filter((s) => s.state === "falling")
      .map((s) => ({
        id: s.id,
        lane: s.lane,
        t: s.t,
        order: s.order,
        prompt: plate !== null && sighted?.id === s.id ? plate : s.item.prompt,
        sighted: sighted?.id === s.id,
        visible: s.t > 0,
      }))
    return {
      stars,
      lamps: game.lamps,
      lampsMax: LAMPS,
      logged,
      bloom: bloomLevel,
      chromaRpx: chroma,
      stalled: game.stalled,
      shown: game.shown,
      over: game.isOver
        ? { ...game.ledger, best: Math.max(best, game.ledger.longest) }
        : null,
      held,
      dial: {
        ones: game.station.x,
        tens: game.station.y,
        onesDrift: held === "ones" ? heldDrift : 0,
        tensDrift: held === "tens" ? heldDrift : 0,
        order: sighted?.order ?? 0,
        reading: game.reading,
        links: game.links,
        chainCap: CHAIN_CAP,
        fuse: game.fuse(t),
        sightings: game.sightings,
        sightingsMax: SIGHTINGS,
        press,
        refuse,
      },
    }
  }

  const tick = (t: number): void => {
    if (!running) return
    frame = requestAnimationFrame(tick)
    const wall = last === 0 ? 16 : Math.min(MAX_STEP_MS, t - last)
    last = t

    if (!paused) {
      press = Math.max(0, press - wall / 110)
      refuse = Math.max(0, refuse - wall / 260)

      // Hitstop: the world stops, the frame does not. Audio is already ringing
      // and input is still being sampled; only the simulation is frozen.
      let sim = wall
      if (hitstopLeft > 0) {
        const spent = Math.min(hitstopLeft, wall)
        hitstopLeft -= spent
        sim = wall - spent
      }
      apply(game.tick(sim * timescale, t))
      scene.advance(wall, view(t))
    }
    scene.draw(view(t))
  }
  frame = requestAnimationFrame(tick)

  // ── input ────────────────────────────────────────────────────────────────

  const local = (e: PointerEvent): { px: number; py: number } => {
    const rect = canvas.getBoundingClientRect()
    return { px: e.clientX - rect.left, py: e.clientY - rect.top }
  }

  const onDown = (e: PointerEvent): void => {
    if (paused) return
    e.preventDefault()
    if (pointer !== -1) return
    pointer = e.pointerId
    canvas.setPointerCapture?.(e.pointerId)
    const { px, py } = local(e)

    // A held sum is taken down by the same hand that would have done anything
    // else. Checked FIRST, and it consumes the gesture: a tap that lands on the
    // dial while the lesson is up must not also turn a ring.
    if (game.shown !== null) {
      apply(game.dismiss(now()))
      return
    }

    if (game.isOver) {
      apply(game.restart(now()))
      logged.clear()
      return
    }

    const zone = ringAt(scene.l, px, py)
    if (zone === "boss") {
      press = 1
      apply(game.mark(now()))
      return
    }
    if (zone === "ones" || zone === "tens") {
      held = zone
      heldAngle = angleAt(scene.l, px, py)
      heldDrift = 0
      return
    }

    // Otherwise: the sky. A touch there chooses which ledger line the child is
    // working, and does nothing else at all. It cannot name a station — the
    // rings are the only thing that can — so there is no way to point.
    const l = scene.l
    let bestStar = -1
    let bestDist = l.cell * SIGHT_RADIUS
    for (const star of game.stars) {
      if (star.state !== "falling" || star.t <= 0) continue
      const p = starPoint(l, star.lane, star.t)
      const d = Math.hypot(p.px - px, p.py - py)
      if (d < bestDist) {
        bestDist = d
        bestStar = star.id
      }
    }
    if (bestStar >= 0) apply(game.sight(bestStar))
  }

  const onMove = (e: PointerEvent): void => {
    if (paused || e.pointerId !== pointer || !held) return
    e.preventDefault()
    const { px, py } = local(e)
    const a = angleAt(scene.l, px, py)
    let delta = a - heldAngle
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    heldDrift += delta / DETENT_ARC
    heldAngle = a
    // Seat one detent at a time, however fast the finger swept. A ring that
    // jumps four digits in one flick is a ring a child cannot aim.
    while (heldDrift >= 1) {
      heldDrift -= 1
      apply(game.dial(held, 1))
    }
    while (heldDrift <= -1) {
      heldDrift += 1
      apply(game.dial(held, -1))
    }
  }

  const onUp = (e: PointerEvent): void => {
    if (e.pointerId !== pointer) return
    pointer = -1
    held = null
    heldDrift = 0
    canvas.releasePointerCapture?.(e.pointerId)
  }

  /**
   * A keyboard, for the harness and for anyone playing on a laptop. Arrow keys
   * turn the two rings; space marks. Still a production, never a jump — there
   * is deliberately no way to type "72".
   */
  const onKey = (e: KeyboardEvent): void => {
    if (paused) return
    if (game.shown !== null) {
      // Any key, and only the dismissal. The rings must not move under a lesson.
      e.preventDefault()
      apply(game.dismiss(now()))
      return
    }
    switch (e.key) {
      case "ArrowRight":
        apply(game.dial("ones", 1))
        break
      case "ArrowLeft":
        apply(game.dial("ones", -1))
        break
      case "ArrowUp":
        apply(game.dial("tens", 1))
        break
      case "ArrowDown":
        apply(game.dial("tens", -1))
        break
      case " ":
      case "Enter":
        e.preventDefault()
        press = 1
        if (game.isOver) {
          apply(game.restart(now()))
          logged.clear()
        } else {
          apply(game.mark(now()))
        }
        break
      default:
        return
    }
  }

  canvas.addEventListener("pointerdown", onDown, { passive: false })
  canvas.addEventListener("pointermove", onMove, { passive: false })
  canvas.addEventListener("pointerup", onUp)
  canvas.addEventListener("pointercancel", onUp)
  globalThis.addEventListener("keydown", onKey)

  const onResize = (): void => scene.resize()
  globalThis.addEventListener("resize", onResize)
  const observer =
    typeof ResizeObserver === "function" ? new ResizeObserver(() => scene.resize()) : null
  observer?.observe(canvas)
  // The safe rect is not a constant and it does not always move with the canvas
  // box. `env(safe-area-inset-*)` resolves to ZERO inside a pack frame — the
  // document is opaque-origin, and `env()` is a property of the TOP-LEVEL
  // browsing context — so the real numbers arrive from the host on the
  // `settings` channel, AFTER this shell has already laid itself out once, and
  // change again on a Split View resize that leaves the canvas the same shape.
  // `Layout` is computed from `safeRect()` at `resize` and nowhere else, so
  // without this the astrolabe and the lattice stay where the zeros put them.
  const unwatchInsets = onInsetsChange(() => scene.resize())

  // ── the pause ────────────────────────────────────────────────────────────
  // One pair, reached from two places: the host, through the handle below, and
  // the manual, through the callbacks under it.

  const doPause = (): void => {
    if (paused) return
    paused = true
    held = null
    pointer = -1
    game.pause(now())
  }

  const doResume = (): void => {
    // The rules are still up. Whoever asked for this — the host taking its own
    // sheet down over the top of the manual — the child is still reading, and
    // the only thing allowed to start the sky again is the rules going down.
    // Without this the host's resume hands back a running observatory behind a
    // scrim, which is the whole defect wearing a different hat.
    if (guide.isOpen) {
      heldForManual = true
      return
    }
    if (!paused) return
    paused = false
    // The next frame is a fresh one. Without this the delta carries the whole
    // length of the sheet and the sky drops a watch's worth of stars in a
    // single step the moment the child closes it.
    last = 0
    game.resume(now())
  }

  // ── how to play ──────────────────────────────────────────────────────────
  //
  // SKY LEDGER shipped with no instructions at all: a child was shown a sky, a
  // dial and the words "THE REGISTER IS EMPTY", and nothing told them the dial
  // is how you name where to strike. The manual stays reachable during play,
  // because the moment a child needs the rules is never the title.
  //
  // Built after the loop rather than before it because it holds the loop:
  // `onOpen` and `onClose` are the only part of pausing a game has to opt into,
  // and they need the pair above.
  const guide = createInstructions(el, {
    title: "SKY LEDGER",
    summary: [
      "Stars fall out of the dark, each one dragging a bright trail. Every star carries a sum.",
      "The astrolabe is the pair of brass rings at the bottom. Turn them to the answer, then press MARK.",
    ],
    sections: [
      {
        heading: "Naming a place",
        lines: [
          "The sky is a grid. Every place in it has two numbers: how far across, then how far up.",
          "The two together make one number. Four across and seven up is 74.",
          "The outer ring of the astrolabe says ONES and the inner ring says TENS. Turn each one until the pair is your answer.",
          "Then press MARK. Marking is how you say the answer out loud.",
          "If the answer is bigger than 99, the hundreds are already written for you. The two empty boxes are the part you turn.",
          "You are not pointing at the answer. You are saying it.",
        ],
      },
      {
        heading: "Chains",
        lines: [
          "A chain is a run of right marks with no wrong one in between.",
          "Mark a second star soon after the first and the two link into a chain.",
          "Each new link gives you more time for the next one, so a chain is a rhythm rather than a race.",
          "Nine links is the longest chain the sky will hold.",
          "A mark that is wrong goes wide. It cuts the chain, and the end card counts it under MARKS WIDE.",
        ],
      },
      {
        heading: "The lamps",
        lines: [
          "Seven lamps burn along the horizon. A star that falls all the way down puts one out.",
          "When the last lamp goes out the night is over. Touch the screen for another one.",
          "Get through a watch and one lamp comes back on.",
        ],
      },
      {
        heading: "The watch",
        lines: [
          "A watch is one night of work: a set number of stars, then a rest. Each watch sends down more stars than the last, up to ten.",
          "There is no winning. The watch ends and the observatory writes down what you logged. Logged means marked right.",
          "A longer chain is worth more than a faster one.",
        ],
      },
    ],
    reducedMotion: reduced,
    // The manual only lifts a pause it put on itself. A watch the host had
    // already stopped — a stopping-point card, a parent gate — must not be
    // handed back running because the child closed the rules.
    onOpen: () => {
      if (paused) return
      heldForManual = true
      doPause()
    },
    onClose: () => {
      if (!heldForManual) return
      heldForManual = false
      doResume()
    },
  })

  return {
    unmount(): void {
      running = false
      guide.destroy()
      cancelAnimationFrame(frame)
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerup", onUp)
      canvas.removeEventListener("pointercancel", onUp)
      globalThis.removeEventListener("keydown", onKey)
      globalThis.removeEventListener("resize", onResize)
      unwatchInsets()
      observer?.disconnect()
      audio.close()
      canvas.remove()
    },
    pause: doPause,
    resume: doResume,
  }
}
