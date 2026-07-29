// COLOSSUS — the shell. Canvas, clock, input, and the wiring from the rules in
// `game/game.ts` to the building in `render/scene.ts`.
//
// **The pause.** The host can put a sheet — a stopping-point card, a parent
// gate — over a pack that is still mounted and still running, and this game
// calls `transition` at the end of every tower, so that is not hypothetical.
// Three things have to stop dead, and each of them is a real bug if it does
// not:
//
//   1. **Input.** A touch that lands while the sheet is up is not something the
//      child did. Left unguarded it strikes the fist, reports an answer to a
//      keystone nobody was looking at, and grows the tower for it.
//   2. **The keystone's clock.** The reported latency is the time the child
//      spent thinking. Time spent behind a sheet is not that.
//   3. **The frame.** The collapse would otherwise play out to nobody and the
//      tower would be a different shape when the sheet came off.
//
// `Game.pause`/`Game.resume` own 1 and 2; the rAF loop here owns 3.

import { Audio } from "./audio/audio.ts"
import type { Host } from "./contract.ts"
import { Rng } from "./core/rng.ts"
import { bestStreak, recordStreak } from "./game/best.ts"
import { Game, type GameEvent } from "./game/game.ts"
import { Scene, type Banner } from "./render/scene.ts"
import { STRIKE_ON } from "./render/palette.ts"
import { createInstructions } from "../../../packs/shared/game-chrome/index.ts"

/**
 * The largest step the clock may take in one frame.
 *
 * A backgrounded tab hands back a delta of minutes. Nothing in COLOSSUS is on a
 * timer, so this is about the physics: a two-minute step would teleport every
 * falling slab through the building and land it with a shake like an
 * earthquake. Clamping means time nearly stops when frames stop.
 */
const MAX_STEP_MS = 120

const BANNER_MS = 1500

export function mountColossus(
  el: HTMLElement,
  host: Host,
): { unmount(): void; pause(): void; resume(): void } {
  const canvas = document.createElement("canvas")
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none"
  el.appendChild(canvas)

  const reduced = host.prefersReducedMotion()
  const seed = (Date.now() ^ 0xc0105) >>> 0
  const scene = new Scene(canvas, reduced, seed)
  const audio = new Audio()
  const game = new Game(host, new Rng(seed), now())

  // How to play. The growth penalty is the whole design of this game and it is
  // the one thing a child cannot deduce from the screen before it happens to
  // them, so it gets a heading of its own and is stated plainly: nothing is
  // taken away, you just get more building.
  const guide = createInstructions(el, {
    title: "COLOSSUS",
    summary: [
      "A stone tower stands in front of the giant. Every floor has a number on it.",
      "Work out the sum on the keystone. Then punch out the floors that multiply to that answer.",
    ],
    sections: [
      {
        heading: "Taking a swing",
        lines: [
          "Tap a floor to grab it. Tap it again to let go. Grabbing costs you nothing.",
          "The fist shows what you are holding, like 8 x 9. It never shows the total.",
          "Multiplying it out is your job.",
          "Tap STRIKE when you think you have it.",
        ],
      },
      {
        heading: "A wrong strike makes the tower taller",
        lines: [
          "If your floors do not multiply to the keystone, two new floors thud down on top.",
          "Nothing is taken away from you. No buzzer, no lost life, no red cross.",
          "You just get more building to knock down. So it pays to be sure first.",
        ],
      },
      {
        heading: "Bringing it down",
        lines: [
          "A right strike blows those floors out, and everything above falls into the hole.",
          "Clear every keystone and the whole tower comes down.",
          "Some floors carry numbers that look close but are wrong. Do the sum before you swing.",
          "Sometimes one floor on its own is the whole answer.",
        ],
      },
    ],
    reducedMotion: reduced,
  })

  let best = bestStreak()
  let streak = 0
  let running = true
  let paused = false
  let last = 0
  let frame = 0
  let banner: Banner | null = null

  function now(): number {
    return typeof performance === "object" ? performance.now() : Date.now()
  }

  const apply = (events: readonly GameEvent[]): void => {
    for (const event of events) {
      switch (event.kind) {
        case "hold": {
          audio.hold(game.holding.length)
          host.haptic("light")
          break
        }
        case "release": {
          audio.release()
          break
        }
        case "clear": {
          scene.blowOut(event.removed, game.floors)
          audio.collapse(event.removed.length)
          host.haptic("success")
          break
        }
        case "grow": {
          // Not a buzz and not a scold. The cost is the stone, and the stone is
          // what the child hears and sees arriving.
          scene.dropIn(event.added, game.height - event.added.length)
          audio.growth(event.added.length)
          host.haptic("medium")
          break
        }
        case "level": {
          if (event.toppled) {
            streak += 1
            audio.topple()
            host.haptic("heavy")
            if (recordStreak(streak)) best = streak
            banner = { title: "THE COLOSSUS KNEELS", tint: STRIKE_ON, age: 0 }
          } else {
            // Not a failure and not drawn as one. The tower that is still
            // standing is the only comment the game makes, and the next one is
            // already going up.
            streak = 0
          }
          scene.reset()
          break
        }
        case "stalled": {
          console.error("[colossus] stalled: no buildable keystones")
          break
        }
        default:
          break
      }
    }
  }

  const tick = (t: number): void => {
    if (!running) return
    frame = requestAnimationFrame(tick)
    const dt = last === 0 ? 16 : Math.min(MAX_STEP_MS, t - last)
    last = t

    // Behind a sheet the world holds its shape. The frame is still drawn — a
    // frozen pack under a translucent host sheet is what a paused game looks
    // like — but nothing in it moves and nothing in it is decided.
    if (!paused) {
      scene.advance(dt, state())
      if (banner) {
        banner.age += dt
        if (banner.age > BANNER_MS) banner = null
      }
    }
    scene.draw(state())
  }

  const state = () => ({
    floors: game.floors,
    isHeld: (id: number) => game.isHeld(id),
    prompt: game.keystone?.prompt ?? "",
    heldValues: game.heldValues(),
    level: game.level,
    progress: game.progress,
    best,
    paused,
    stalled: game.stalled,
    banner,
  })

  const press = (event: PointerEvent): void => {
    event.preventDefault()
    // A press that lands while the host's sheet is up is the sheet's, not ours.
    if (paused) return
    audio.resume()
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    if (scene.hitsStrike(x, y)) {
      apply(game.strike(now()))
      return
    }
    const id = scene.floorAt(x, y, game.floors)
    if (id !== null) apply(game.toggle(id))
  }

  const key = (event: KeyboardEvent): void => {
    if (event.repeat || paused) return
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault()
      audio.resume()
      apply(game.strike(now()))
      return
    }
    if (event.key === "Escape") game.releaseAll()
  }

  const resize = (): void => {
    scene.resize()
  }

  canvas.addEventListener("pointerdown", press)
  globalThis.addEventListener("keydown", key)
  globalThis.addEventListener("resize", resize)

  const observer =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          scene.resize()
        })
      : null
  observer?.observe(el)

  apply(game.begin(now()))
  frame = requestAnimationFrame(tick)

  return {
    pause(): void {
      if (paused) return
      paused = true
      game.pause(now())
    },
    resume(): void {
      if (!paused) return
      paused = false
      game.resume(now())
      // The next frame computes its delta from `last`, which was set before the
      // sheet went up. Forget it, or the first frame back is a whole sheet's
      // worth of gravity in one step.
      last = 0
    },
    unmount(): void {
      running = false
      cancelAnimationFrame(frame)
      canvas.removeEventListener("pointerdown", press)
      globalThis.removeEventListener("keydown", key)
      globalThis.removeEventListener("resize", resize)
      observer?.disconnect()
      audio.dispose()
      guide.destroy()
      canvas.remove()
    },
  }
}
