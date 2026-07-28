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

import { Audio } from "./audio/audio.ts"
import type { Host } from "./contract.ts"
import { Rng } from "./core/rng.ts"
import { Arena, type ArenaEvent } from "./game/arena.ts"
import { bestChain, recordChain } from "./game/best.ts"
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

/** How far a virtual stick has to travel to be at full deflection. */
const STICK_RANGE = 64

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

  const tick = (t: number): void => {
    if (!running) return
    frame = requestAnimationFrame(tick)
    const dt = last === 0 ? 16 : Math.min(MAX_STEP_MS, t - last)
    last = t

    // Behind a sheet the arena holds its shape. The frame is still drawn — a
    // frozen pack under a translucent host sheet is what a paused game looks
    // like — but nothing moves and nothing is decided.
    if (!paused) {
      readKeys()
      if (firing) apply(arena.fire())
      apply(arena.step(dt))
      grid.step(dt)
      scene.advance(dt)
    }
    scene.draw(arena, grid, { best, paused, stalled: arena.stalled })
  }

  // ── pointers ─────────────────────────────────────────────────────────────

  const at = (event: PointerEvent): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const down = (event: PointerEvent): void => {
    event.preventDefault()
    if (paused) return
    audio.resume()
    const p = at(event)

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
    if (paused) return
    const p = at(event)
    if (moveStick && moveStick.id === event.pointerId) {
      moveStick.x = p.x
      moveStick.y = p.y
      arena.setMove((p.x - moveStick.ox) / STICK_RANGE, (p.y - moveStick.oy) / STICK_RANGE)
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

  const keyDown = (event: KeyboardEvent): void => {
    if (paused || event.repeat) return
    keys.add(event.key)
    if (event.key === " ") {
      event.preventDefault()
      audio.resume()
    }
    if (event.key === "Escape") apply(arena.vent())
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
      // Whatever the thumbs were doing, they are not doing it any more. Left
      // set, a resting thumb would fly the ship through the resonator behind
      // the sheet and assert a product nobody assembled.
      moveStick = null
      aimStick = null
      firing = false
      mouseDown = false
      keys.clear()
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
