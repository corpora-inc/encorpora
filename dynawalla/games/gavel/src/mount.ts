// THE GAVEL — the shell. Canvas, clock, input, and the wiring from the rules in
// `game/auction.ts` to the gallery in `render/scene.ts`.
//
// **The pause.** The host can put a sheet — a stopping-point card, a parent gate —
// over a pack that is still mounted and still running, and this game calls
// `transition` at the end of every consignment, so that is not hypothetical. Three
// things have to stop dead, and each of them is a real bug if it does not:
//
//   1. **Input.** A touch that lands while the sheet is up is not something the
//      child did. Left unguarded it drops the hammer on a room nobody was looking
//      at, reports a bid to a lot they never saw, and adds two lots for it.
//   2. **The lot's clock.** The reported latency is the time the child spent
//      working the room out. Time spent behind a sheet is not that.
//   3. **The frame.** The reveal would otherwise play out to nobody.
//
// `Auction.pause`/`resume` own 1 and 2; the rAF loop here owns 3.

import { Audio } from "./audio/audio.ts"
import type { Host } from "./contract.ts"
import { Rng } from "./core/rng.ts"
import { Auction, type AuctionEvent } from "./game/auction.ts"
import { MIN_TABLETS } from "./game/ladder.ts"
import { Scene, type View } from "./render/scene.ts"
import { createInstructions, onInsetsChange } from "../../../packs/shared/game-chrome/index.ts"

/**
 * The largest step the clock may take in one frame.
 *
 * A backgrounded tab hands back a delta of minutes. Nothing a child is answering
 * is on a timer here, so this only bounds the reveal and the coin walk: clamped,
 * a tab that comes back does not skip the settled room the child was reading.
 */
const MAX_STEP_MS = 120

export function mountGavel(
  el: HTMLElement,
  host: Host,
): { unmount(): void; pause(): void; resume(): void } {
  const canvas = document.createElement("canvas")
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none"
  el.appendChild(canvas)

  const reduced = host.prefersReducedMotion()
  const seed = (Date.now() ^ 0x9a7e1) >>> 0
  const scene = new Scene(canvas, reduced)
  const audio = new Audio()
  const game = new Auction(host, new Rng(seed), now())

  // How to play. The rule a child cannot deduce from the screen is the *one over*
  // rule and the offer that bounds it, so both get a heading, and the failure is
  // stated plainly: nothing is taken away, there is just more to sell.
  const guide = createInstructions(el, {
    title: "THE GAVEL",
    summary: [
      "The bidders hold up sums, not prices. Work them out and find the biggest bid in the room.",
      "Then bid ONE more than it, and the lot is yours for the smallest money in the room.",
    ],
    sections: [
      {
        heading: "Winning the lot",
        lines: [
          "Tap the tablet you think is the biggest bid. Tapping is free — tap another to change your mind.",
          "Then tap the numbers to set your bid, and tap GAVEL.",
          "Bid the same as the biggest, or less, and a rival takes the lot instead.",
        ],
      },
      {
        heading: "Selling it on",
        lines: [
          "The blue plate is what the broker will pay you for the lot.",
          "Your coins are the broker's price take away what you paid.",
          "Win it at EXACTLY one over the biggest bid and the guild pays you double. That is a keen bid.",
          "Two over earns less. Ten over earns almost nothing.",
          "Bid MORE than the broker pays and nobody buys it — the lot just sits on your shelf.",
        ],
      },
      {
        heading: "When to walk away",
        lines: [
          "Sometimes the broker's price is not above the room at all. Then no bid can make money.",
          "Tap FOLD. Spotting one of those is worth a coin on its own.",
          "FOLD is always safe. It never costs you anything.",
        ],
      },
      {
        heading: "There is no clock",
        lines: [
          "Nothing is timed. Take as long as you like on every room.",
          "If a lot does not sell it comes round again, and the broker adds one more to the pile.",
          "That is the only cost of being wrong. No lives, no buzzer, nothing taken away.",
        ],
      },
    ],
    reducedMotion: reduced,
    // Behind the scrim the reveal keeps playing and the lot keeps being timed, and
    // a child reading the rules is being billed for it.
    //
    // The manual only lifts a pause it put on itself. The host can already have a
    // sheet over the frame — and this game raises one itself at the end of every
    // consignment — so a child who opens and closes the rules underneath it must
    // not be handed back a running gallery.
    onOpen: () => {
      if (paused) return
      heldForManual = true
      raiseSheet()
    },
    onClose: () => {
      if (!heldForManual) return
      heldForManual = false
      lowerSheet()
    },
  })

  let running = true
  let paused = false
  /** True only while the pause in force is the one the manual raised. */
  let heldForManual = false
  let last = 0
  let frame = 0

  function now(): number {
    return typeof performance === "object" ? performance.now() : Date.now()
  }

  function raiseSheet(): void {
    if (paused) return
    paused = true
    game.pause(now())
  }

  function lowerSheet(): void {
    if (!paused) return
    paused = false
    game.resume(now())
    // The next frame computes its delta from `last`, which was set before the sheet
    // went up. Forget it, or the first frame back is a whole sheet's worth of reveal
    // in one step.
    last = 0
  }

  const apply = (events: readonly AuctionEvent[]): void => {
    for (const event of events) {
      switch (event.kind) {
        case "lot": {
          scene.raiseRoom(event.room.tablets.length)
          break
        }
        case "mark": {
          audio.mark()
          host.haptic("light")
          break
        }
        case "unmark": {
          audio.release()
          break
        }
        case "digit": {
          audio.tick()
          break
        }
        case "settled": {
          scene.settle()
          audio.hammer()
          if (event.settled.coins > 0) {
            audio.coins(event.settled.coins)
            host.haptic("success")
          } else if (event.settled.outcome === "outbid" || event.settled.outcome === "unsold") {
            // Not a scold. The cost is the lots, and the lots are what the child
            // sees arriving on the strip.
            audio.dull()
            host.haptic("medium")
          } else {
            host.haptic("light")
          }
          break
        }
        case "consignment": {
          if (event.sold > 0) audio.cleared()
          break
        }
        case "stalled": {
          console.error("[gavel] stalled: nothing the gallery can call")
          break
        }
        default:
          break
      }
    }
  }

  const view = (): View => ({
    lot: game.lot,
    room: game.room,
    marked: game.marked,
    digits: game.digits,
    phase: game.phase,
    settled: game.settled,
    studying: game.studying,
    nudgeable: game.nudgeable,
    coins: game.coins,
    storeroom: game.storeroom,
    remaining: game.remaining,
    armed: game.armed,
    paused,
    stalled: game.stalled,
  })

  const tick = (t: number): void => {
    if (!running) return
    frame = requestAnimationFrame(tick)
    const dt = last === 0 ? 16 : Math.min(MAX_STEP_MS, t - last)
    last = t

    // Behind a sheet the gallery holds its shape. The frame is still drawn — a
    // frozen pack under a translucent host sheet is what a paused game looks like —
    // but nothing in it moves and nothing in it is decided.
    if (!paused) {
      apply(game.advance(dt, now()))
      scene.advance(dt, view())
    }
    scene.draw(view())
  }

  const press = (event: PointerEvent): void => {
    event.preventDefault()
    // A press that lands while the host's sheet is up is the sheet's, not ours.
    if (paused) return
    audio.resume()
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // A tap anywhere during the reveal moves on. It is not a wait for an answer —
    // the answer has already been given — so ending it early costs nothing.
    if (game.phase === "settled") {
      apply(game.nudge())
      return
    }

    const key = scene.keyAt(x, y)
    if (key) {
      scene.press(key.id)
      if (key.digit !== null) {
        apply(game.pressDigit(key.digit))
        return
      }
      if (key.id === "back") {
        apply(game.backspace())
        return
      }
      if (key.id === "fold") {
        apply(game.fold())
        return
      }
      apply(game.hammer(now()))
      return
    }

    const tablet = scene.tabletAt(x, y)
    if (tablet !== null) apply(game.tapTablet(tablet))
  }

  const key = (event: KeyboardEvent): void => {
    if (event.repeat || paused) return
    audio.resume()
    if (game.phase === "settled") {
      apply(game.nudge())
      return
    }
    if (/^[0-9]$/.test(event.key)) {
      apply(game.pressDigit(Number(event.key)))
      return
    }
    if (event.key === "Backspace") {
      event.preventDefault()
      apply(game.backspace())
      return
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      apply(game.hammer(now()))
      return
    }
    if (event.key === "f" || event.key === "F") {
      apply(game.fold())
      return
    }
    // Left and right walk the mark along the gallery, so the whole game is
    // playable from a keyboard in the dev harness.
    const room = game.room
    if (!room) return
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      const n = room.tablets.length
      const at = game.marked
      const step = event.key === "ArrowRight" ? 1 : n - 1
      apply(game.tapTablet(at === null ? 0 : (at + step) % n))
    }
  }

  const resize = (): void => {
    scene.resize()
  }

  // The insets change more often than "never": rotation swaps them, and iPadOS changes
  // them when a pack is resized in Split View. They also arrive from the HOST rather
  // than from anything this frame can measure, so a push with no size change is a real
  // event and `resize` alone would miss it.
  const stopWatchingInsets = onInsetsChange(() => {
    scene.resize()
  })

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

  scene.raiseRoom(MIN_TABLETS)
  apply(game.begin(now()))
  frame = requestAnimationFrame(tick)

  return {
    pause(): void {
      raiseSheet()
    },
    resume(): void {
      lowerSheet()
    },
    unmount(): void {
      running = false
      cancelAnimationFrame(frame)
      canvas.removeEventListener("pointerdown", press)
      globalThis.removeEventListener("keydown", key)
      globalThis.removeEventListener("resize", resize)
      stopWatchingInsets()
      observer?.disconnect()
      // Every question still on the bench or the board, closed rather than left open.
      game.closeAll()
      audio.dispose()
      guide.destroy()
      canvas.remove()
    },
  }
}
