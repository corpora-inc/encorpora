// THE LATTICE — the shell. Canvas, clock, twin-stick input, and the wiring
// from the rules in `game/arena.ts` to the sheet in `sim/grid.ts` and the
// drawing in `render/scene.ts`.
//
// **The pause.** The host can put a sheet — a stopping-point card, a parent
// gate, a day-pass offer — over a pack that is still mounted and still running,
// and this game calls `transition` every time a resonator opens, so it raises
// that sheet itself. Three things have to stop dead, and each is a real bug if
// it does not:
//
//   1. **Input.** A thumb resting on a virtual stick while a sheet is up is not
//      the child flying. Unguarded, the ship keeps moving, sweeps motes nobody
//      chose, and can fly through the resonator and assert a product the child
//      never assembled — reporting an answer to a question they never saw.
//   2. **The resonator's clock.** The latency reported is meant to be time the
//      child spent thinking. Time behind a sheet is not that.
//   3. **The world.** The husks would drift, the sheet would ring out, and the
//      arena would be a different arena when the sheet came off.
//
// `Arena.pause`/`Arena.resume` own 1 and 2 — every rule method returns early
// while paused, and `resume` shifts the question mark forward by exactly the
// sheet. The rAF loop here owns 3.
//
// **Twin-stick, on every input a child might have.** Left thumb moves, right
// thumb aims and fires; on a keyboard WASD moves and the arrow keys aim, with
// the mouse as an alternative aim and its button as the trigger. Tablet and
// desktop are first-class targets here, not a phone game stretched.

import { createInstructions } from "../../../packs/shared/game-chrome/index.ts"
import { Audio } from "./audio/audio.ts"
import type { Host } from "./contract.ts"
import { Rng } from "./core/rng.ts"
import { Arena, RESONATOR_R, SHIP_R, type ArenaEvent } from "./game/arena.ts"
import { bestChain, recordChain } from "./game/best.ts"
import { shapeStick, STICK_RANGE } from "./game/steer.ts"
import { Scene } from "./render/scene.ts"
import { BRASS_LIGHT, CELESTIAL, OXIDE } from "./render/palette.ts"
import { Grid } from "./sim/grid.ts"

/**
 * The largest step the clock may take in one frame.
 *
 * A backgrounded tab hands back a delta of minutes. Nothing here is on a timer,
 * so this is about the physics: a two-minute step would teleport every husk
 * through the sheet and tear the whole lattice at once.
 */
const MAX_STEP_MS = 120

/** Grid density. Chosen so a tablet draws about 1,100 struts, not 10,000. */
const GRID_CELL = 46

type Stick = { id: number; ox: number; oy: number; x: number; y: number } | null

export function mountLattice(
  el: HTMLElement,
  host: Host,
): { unmount(): void; pause(): void; resume(): void } {
  const canvas = document.createElement("canvas")
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none"
  el.appendChild(canvas)

  const reduced = host.prefersReducedMotion()
  const seed = (Date.now() ^ 0x1a771ce) >>> 0
  const scene = new Scene(canvas, reduced)
  const audio = new Audio()
  const arena = new Arena(host, new Rng(seed), {
    width: scene.cssWidth,
    height: scene.cssHeight,
  })
  const grid = new Grid({
    cols: Math.max(6, Math.round(scene.cssWidth / GRID_CELL)),
    rows: Math.max(6, Math.round(scene.cssHeight / GRID_CELL)),
    width: scene.cssWidth,
    height: scene.cssHeight,
    reduced,
  })

  // How to play. Nothing on this screen says that the ring wants the ANSWER to
  // the sum on its face, built out of numbers that multiply — and a child who
  // does not know that plays the passive layer forever, shooting husks apart
  // and sweeping them up, and never once does the thinking the game is for. The
  // manual stays reachable during play, because the moment a child needs the
  // rules is never the title screen.
  const guide = createInstructions(el, {
    title: "THE LATTICE",
    summary: [
      "A ring floats in the middle with a sum on it. Work out the answer.",
      "Then collect glowing numbers that multiply to that answer, and fly into the ring.",
    ],
    sections: [
      {
        heading: "Flying and shooting",
        lines: [
          "Put a thumb on the left half of the screen and slide it. Your ship flies that way.",
          "Put a thumb on the right half and slide it. Your ship aims that way and shoots.",
          "On a keyboard: W A S D to fly, arrow keys to shoot, space to shoot straight ahead.",
        ],
      },
      {
        heading: "Breaking numbers open",
        lines: [
          "The stone squares hold big numbers. Shoot one and it breaks into two numbers that multiply back to it. Shoot 72 and you get 8 and 9.",
          "Keep shooting the pieces. The 8 breaks into 2 and 4. The 4 breaks into 2 and 2.",
          "Some numbers glow instead. Shooting one only shoves it, because nothing multiplies to make it. Those are called prime numbers, and they are the pieces you collect.",
        ],
      },
      {
        heading: "Your hold",
        lines: [
          "Fly into a glowing number to pick it up. It goes in the bar along the bottom.",
          "The bar shows what you are carrying, like 2 · 2 · 3, and the number those pieces multiply to: 12.",
          "Do not fly into a stone square. It knocks your biggest piece loose and drops it back on the field.",
          "You can carry twelve pieces at once.",
        ],
      },
      {
        heading: "Opening the ring",
        lines: [
          "The ring shows a sum, like 47 + 25. Work it out: 72.",
          "Now find pieces that multiply to 72. That is 2 · 2 · 2 · 3 · 3.",
          "Carry exactly those and fly into the ring. It opens, and a new sum arrives.",
        ],
      },
      {
        heading: "The little tree button",
        lines: [
          "Above the bar on the left there is a round button with a tiny tree on it. Press it any time you like.",
          "A factor tree grows above the bar. At first every number on it is hidden. Press again and one of them shows, then another, then all of them.",
          "The glowing ones at the bottom of the tree are exactly the pieces to collect. If you wait a while, the tree starts showing itself.",
          "It costs nothing. Use it as much as you want. On a keyboard, press H.",
        ],
      },
      {
        heading: "If the ring says NOT YET",
        lines: [
          "Your pieces multiply to the wrong number. One extra 5 turns 72 into 360.",
          "Nothing is lost. Your pieces drop back on the field and you can pick them up again.",
          "To empty the bar yourself, tap the bar. On a keyboard, press Escape.",
        ],
      },
      {
        heading: "When the answer is a glowing number",
        lines: [
          "Sometimes the answer is a number that cannot be broken, like 41.",
          "Then no pile of smaller pieces will ever reach it. Look for the single 41 drifting on the field and carry that in on its own.",
        ],
      },
      {
        heading: "The counters at the top",
        lines: [
          "OPENED is how many rings you have opened.",
          "CHAIN is how many you opened in a row without a wrong one.",
          "BEST is your longest chain ever.",
        ],
      },
    ],
    reducedMotion: reduced,
  })

  let best = bestChain()
  let running = true
  let paused = false
  let last = 0
  let frame = 0
  let firing = false
  let mouseDown = false

  let moveStick: Stick = null
  let aimStick: Stick = null
  const keys = new Set<string>()

  function now(): number {
    return typeof performance === "object" ? performance.now() : Date.now()
  }

  const apply = (events: readonly ArenaEvent[]): void => {
    for (const event of events) {
      switch (event.kind) {
        case "split": {
          grid.impulse(event.at.x, event.at.y, 620, 2.4)
          scene.split(event.at.x, event.at.y)
          audio.split(String(event.from).length)
          host.haptic("light")
          break
        }
        case "wall": {
          grid.impulse(event.at.x, event.at.y, 180, 1.4)
          scene.wall(event.at.x, event.at.y)
          audio.wall()
          break
        }
        case "sweep": {
          scene.sweep(event.at.x, event.at.y)
          audio.sweep(event.tiles.length)
          host.haptic("light")
          break
        }
        case "full": {
          scene.say("HOLD IS FULL", OXIDE)
          audio.refuse()
          break
        }
        case "jostle": {
          grid.impulse(event.at.x, event.at.y, 420, 2)
          scene.jostle(event.at.x, event.at.y)
          audio.jostle()
          host.haptic("medium")
          break
        }
        case "vent": {
          scene.sweep(arena.ship.x, arena.ship.y)
          audio.refuse()
          host.haptic("light")
          break
        }
        case "fire": {
          audio.shot()
          break
        }
        case "open": {
          grid.implode(event.at.x, event.at.y, 1400, 7)
          scene.celebrate(event.at.x, event.at.y, event.tiles)
          audio.open(event.tiles.length)
          if (recordChain(arena.chain)) best = arena.chain
          break
        }
        case "refuse": {
          // Not a scold and not drawn as one. The primes come back on the
          // field; what it cost was the trip, and that is the whole comment.
          grid.impulse(event.at.x, event.at.y, 300, 3)
          scene.refusal(event.at.x, event.at.y)
          scene.say("NOT YET", OXIDE)
          audio.refuse()
          break
        }
        case "arrive": {
          grid.impulse(event.at.x, event.at.y, 260, 5)
          break
        }
        case "hint": {
          // Warm and small. No banner and no word — a hint that announced itself
          // in language would be the game telling a child, in front of them, that
          // it had noticed they were struggling. The sheet stirs under the ring
          // the help is coming from, two notes rise, and the tree is there.
          //
          // The tick is `light`, the same one a mote gives when it is swept, and
          // it is not decoration: an automatic hint arrives while a child is
          // looking somewhere else in the arena, and a tree that fades in
          // unnoticed at the bottom of the screen has helped nobody.
          grid.impulse(event.at.x, event.at.y, 150, 3)
          audio.hint(event.stage)
          host.haptic("light")
          break
        }
        case "stalled": {
          console.error("[lattice] no askable target; the arena is running without a resonator")
          break
        }
        default:
          break
      }
    }
  }

  /** Keyboard sticks, folded into the same two vectors the thumbs produce. */
  const readKeys = (): void => {
    let mx = 0
    let my = 0
    if (keys.has("a") || keys.has("A")) mx -= 1
    if (keys.has("d") || keys.has("D")) mx += 1
    if (keys.has("w") || keys.has("W")) my -= 1
    if (keys.has("s") || keys.has("S")) my += 1
    let ax = 0
    let ay = 0
    if (keys.has("ArrowLeft")) ax -= 1
    if (keys.has("ArrowRight")) ax += 1
    if (keys.has("ArrowUp")) ay -= 1
    if (keys.has("ArrowDown")) ay += 1

    if (moveStick === null) arena.setMove(mx, my)
    if (aimStick === null && (ax !== 0 || ay !== 0)) arena.setAim(ax, ay)

    // Derived every frame rather than latched, so no input path can leave the
    // trigger stuck down — a held trigger through a pause is exactly the class
    // of bug the pause guards exist to prevent.
    firing = aimStick !== null || mouseDown || keys.has(" ") || ax !== 0 || ay !== 0
  }

  /** Whatever the thumbs were doing, they are not doing it any more. */
  const dropSticks = (): void => {
    moveStick = null
    aimStick = null
    firing = false
    mouseDown = false
    keys.clear()
  }

  const tick = (t: number): void => {
    if (!running) return
    frame = requestAnimationFrame(tick)
    const dt = last === 0 ? 16 : Math.min(MAX_STEP_MS, t - last)
    last = t

    // The world is held for two reasons, and the second one is easy to miss:
    // the host's sheet, and the child reading the rules. A manual that leaves
    // the arena running is a manual a child cannot afford to open — they come
    // back to a ship that drifted into a husk, or through the resonator, and
    // asserted a hold they were not there for. That is the same damage the
    // host's sheet does unguarded, from a button this pack owns.
    const held = paused || guide.isOpen
    if (held && !arena.isPaused) {
      arena.pause(now())
      dropSticks()
    } else if (!held && arena.isPaused) {
      arena.resume(now())
    }

    // Behind a sheet the arena holds its shape. The frame is still drawn — a
    // frozen pack under a translucent host sheet is what a paused game looks
    // like — but nothing moves and nothing is decided.
    if (!held) {
      readKeys()
      if (firing) apply(arena.fire())
      apply(arena.step(dt))
      // Flying into the resonator is what asserts the hold, and it is the only
      // act in this game the host ever hears about. `Arena.step` resolves every
      // other collision itself, but not this one: the assertion is timed
      // against the wall clock the report carries, and the wall clock belongs
      // to the shell. Missing, the whole reasoning layer is unreachable — the
      // ship flies through the ring and nothing at all happens.
      const res = arena.resonator
      if (res && Math.hypot(arena.ship.x - res.x, arena.ship.y - res.y) < RESONATOR_R + SHIP_R) {
        apply(arena.enter(now()))
      }
      // A barren band leaves the arena without a question rather than without a
      // future: it asks again a few seconds later, and this is the only place
      // that clock is read. Inert whenever there is a resonator.
      apply(arena.rearm(now()))
      // Has the hint moved on its own? The stage is derived rather than timed,
      // so this is only an edge detector for the sound and the ripple — the
      // tree would be drawn identically whether or not this line existed. It is
      // inside the `held` guard because a hint must not unfold behind a sheet: a
      // child comes back to the tree they left, not to two more stages of it.
      apply(arena.unfold(now()))
      grid.step(dt)
      scene.advance(dt)
    }
    scene.draw(arena, grid, { best, paused, stalled: arena.stalled, hint: arena.hint(now()) })
  }

  // ── pointers ─────────────────────────────────────────────────────────────

  const at = (event: PointerEvent): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const down = (event: PointerEvent): void => {
    event.preventDefault()
    if (paused || guide.isOpen) return
    audio.resume()
    const p = at(event)

    // Asking for the next piece of the factor tree. Checked before the sticks,
    // like the tile bar, because the whole left half of the screen is otherwise
    // a thumbstick — and checked before the bar because it is the smaller
    // target of the two and sits directly above it.
    if (scene.hitsHint(p.x, p.y)) {
      apply(arena.askHint(now()))
      return
    }

    // Tapping your own hold lets it go. The bank is exact, so a child who swept
    // a stray 5 needs a way out that is not "start again" — and nothing is
    // destroyed: the motes go back on the field.
    if (scene.hitsTileBar(p.x, p.y)) {
      apply(arena.vent())
      return
    }

    // A mouse is not a thumb. On a desktop the cursor is the right stick and
    // the button is the trigger; WASD is the left stick. Making a mouse drag a
    // virtual stick would fight the pointer the child is already aiming with.
    if (event.pointerType === "mouse") {
      mouseDown = true
      arena.setAim(p.x - arena.ship.x, p.y - arena.ship.y)
      return
    }

    if (p.x < scene.cssWidth / 2 && moveStick === null) {
      moveStick = { id: event.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y }
      canvas.setPointerCapture(event.pointerId)
      return
    }
    if (aimStick === null) {
      aimStick = { id: event.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y }
      canvas.setPointerCapture(event.pointerId)
    }
  }

  const move = (event: PointerEvent): void => {
    if (paused || guide.isOpen) return
    const p = at(event)
    if (moveStick && moveStick.id === event.pointerId) {
      moveStick.x = p.x
      moveStick.y = p.y
      // Shaped, not divided: a dead zone under a resting thumb's tremor and a
      // curve that leaves most of the stick's travel for the slow, accurate part.
      // See `game/steer.ts`.
      const shaped = shapeStick(p.x - moveStick.ox, p.y - moveStick.oy, STICK_RANGE)
      arena.setMove(shaped.x, shaped.y)
      return
    }
    if (aimStick && aimStick.id === event.pointerId) {
      aimStick.x = p.x
      aimStick.y = p.y
      const dx = p.x - aimStick.ox
      const dy = p.y - aimStick.oy
      if (Math.hypot(dx, dy) > 6) arena.setAim(dx, dy)
      return
    }
    // A mouse with no button down still aims.
    if (event.pointerType === "mouse") {
      arena.setAim(p.x - arena.ship.x, p.y - arena.ship.y)
    }
  }

  const up = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") mouseDown = false
    if (moveStick && moveStick.id === event.pointerId) {
      moveStick = null
      arena.setMove(0, 0)
    }
    if (aimStick && aimStick.id === event.pointerId) aimStick = null
    try {
      canvas.releasePointerCapture(event.pointerId)
    } catch {
      // A capture the browser already dropped is not an error.
    }
  }

  // While the manual is up, the keyboard belongs to the manual: Escape closes
  // it rather than dumping the hold, and nothing lands in `keys` to be found
  // still held down when the child comes back.
  const keyDown = (event: KeyboardEvent): void => {
    if (paused || guide.isOpen || event.repeat) return
    keys.add(event.key)
    if (event.key === " ") {
      event.preventDefault()
      audio.resume()
    }
    if (event.key === "Escape") apply(arena.vent())
    if (event.key === "h" || event.key === "H") apply(arena.askHint(now()))
    if (event.key.startsWith("Arrow")) event.preventDefault()
  }

  const keyUp = (event: KeyboardEvent): void => {
    keys.delete(event.key)
  }

  const resize = (): void => {
    const box = scene.resize()
    arena.resize(box.width, box.height)
    grid.resize(box.width, box.height)
  }

  canvas.addEventListener("pointerdown", down)
  canvas.addEventListener("pointermove", move)
  canvas.addEventListener("pointerup", up)
  canvas.addEventListener("pointercancel", up)
  globalThis.addEventListener("keydown", keyDown)
  globalThis.addEventListener("keyup", keyUp)
  globalThis.addEventListener("resize", resize)

  const observer =
    typeof ResizeObserver === "function" ? new ResizeObserver(() => resize()) : null
  observer?.observe(el)

  resize()
  scene.say("SHOOT WHAT SPLITS", CELESTIAL)
  apply(arena.begin(now()))
  frame = requestAnimationFrame(tick)

  return {
    pause(): void {
      if (paused) return
      paused = true
      arena.pause(now())
      // Left set, a resting thumb would fly the ship through the resonator
      // behind the sheet and assert a product nobody assembled.
      dropSticks()
      scene.say("PAUSED", BRASS_LIGHT)
    },
    resume(): void {
      if (!paused) return
      paused = false
      arena.resume(now())
      // The next frame computes its delta from `last`, set before the sheet
      // went up. Forget it, or the first frame back is a whole sheet's worth of
      // drift and springs in one step.
      last = 0
    },
    unmount(): void {
      running = false
      guide.destroy()
      cancelAnimationFrame(frame)
      canvas.removeEventListener("pointerdown", down)
      canvas.removeEventListener("pointermove", move)
      canvas.removeEventListener("pointerup", up)
      canvas.removeEventListener("pointercancel", up)
      globalThis.removeEventListener("keydown", keyDown)
      globalThis.removeEventListener("keyup", keyUp)
      globalThis.removeEventListener("resize", resize)
      observer?.disconnect()
      audio.dispose()
      scene.dispose()
    },
  }
}
