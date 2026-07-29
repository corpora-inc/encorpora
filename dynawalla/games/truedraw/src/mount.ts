// THE TRUE DRAW.
//
// One verb: draw.
//
//   * A statement is cut into the slate — `47 + 25 = 72`, or `47 + 25 = 62`.
//     The wrong ones are not `answer ± 1`; they are what a child who drops the
//     carry actually writes, so rejecting one means doing the arithmetic.
//   * The street goes still. Then the slate lights. That is the only cue there
//     is, and it is a light change, not a motion.
//   * **Draw if it is true.** Hold if it is false.
//   * A correct hold is the best thing in the game: the caller bows, and the
//     slate rolls itself right in front of you.
//   * A wrong draw is ignored. The slate does not change, the caller does not
//     move, nothing sounds, nothing buzzes. A shot goes dark and the round ends
//     in the silence it started in.
//
// Draw at everything and you are right exactly half the time, which is three
// calls before the street clears. There is no percentage anywhere in this game
// to misread as a pass.

import { createInstructions, onInsetsChange } from "../../../packs/shared/game-chrome/index.ts"
import { Audio } from "./audio/audio.ts"
import type { Host } from "./contract.ts"
import { bestCalls, recordCalls } from "./game/best.ts"
import { Dealer } from "./game/dealer.ts"
import { HAPTIC } from "./game/energy.ts"
import { isCorrect, reportsToCurriculum, responseFor } from "./game/response.ts"
import { Round, TIMING, TIMING_REDUCED, type RoundEvent } from "./game/round.ts"
import { Rng } from "./core/rng.ts"
import { Scene } from "./render/scene.ts"

/** A milestone the child *reached*. Never fired when a run ends. */
const TRANSITION_EVERY = 10

/**
 * The largest step the clock is allowed to take in one frame.
 *
 * A backgrounded tab hands back a delta of minutes. Letting that through would
 * spend a draw window, three shots and a whole run while the child was looking
 * at something else. Clamping means time nearly stops when frames stop, which is
 * the only fair reading of "they were not here".
 */
const MAX_STEP_MS = 120

export function mountTrueDraw(
  el: HTMLElement,
  host: Host,
): { unmount(): void; pause(): void; resume(): void } {
  const canvas = document.createElement("canvas")
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none"
  el.appendChild(canvas)

  const reduced = host.prefersReducedMotion()
  const scene = new Scene(canvas)
  const audio = new Audio()
  const rng = new Rng((Date.now() ^ 0x51ed) >>> 0)
  const dealer = new Dealer(host, rng)
  const round = new Round(() => dealer.deal(), reduced ? TIMING_REDUCED : TIMING)

  // How to play. Everything about this game is a rule you have to know before
  // the first slate lights: the whole of it is a decision between two moves,
  // and a child who has not been told that holding is a move will draw at
  // everything and be off the street in three sums. The manual stays reachable
  // during play, because the moment a child needs the rules is never the title.
  const guide = createInstructions(el, {
    title: "THE TRUE DRAW",
    summary: [
      "A sum lights up on the slate. If it is right, tap to draw. If it is wrong, keep still.",
      "You have three shots. Getting it wrong either way costs one.",
    ],
    sections: [
      {
        heading: "The two moves",
        lines: [
          "Read the slate. It says something like 47 + 25 = 62.",
          "If that sum is right, tap the screen to draw.",
          "If that sum is wrong, do nothing at all and let it stand.",
          "Getting it right either way keeps all three of your shots.",
        ],
      },
      {
        heading: "The slate waits for you",
        lines: [
          "Work the sum out properly. There is no rush and there is no bar counting down.",
          "A big sum keeps the slate lit for much longer than a small one does.",
          "The light only goes out when you draw, or when the caller does.",
        ],
      },
      {
        heading: "Your three shots",
        lines: [
          "Draw at a sum that is wrong and nothing happens at all. No sound, no flash, nobody moves. But a shot is gone.",
          "Keep still when the sum was right, and the caller draws first. That costs a shot too.",
          "When all three shots are gone, the street clears and the run is over.",
        ],
      },
      {
        heading: "You cannot just tap every time",
        lines: [
          "About half the slates are wrong.",
          "If you draw at every single one, your three shots are gone in about three sums.",
          "Reading the sum every time is the only way to keep the run going.",
        ],
      },
      {
        heading: "Why the wrong sums look right",
        lines: [
          "A wrong slate is never just one off. That would be too easy to spot.",
          "It shows the answer you get if you make a real mistake, like forgetting to carry.",
          "So the only way to know is to work the sum out yourself.",
        ],
      },
    ],
    reducedMotion: reduced,
  })

  let best = bestCalls()
  let running = true
  let last = 0
  let frame = 0
  let milestones = 0

  const handle = (events: readonly RoundEvent[]): void => {
    for (const event of events) {
      switch (event.kind) {
        case "cue": {
          audio.cue()
          break
        }
        case "settled": {
          // The host is the judge. What goes across is the value the child
          // effectively asserted — and on a wrong draw that value is a mal-rule
          // output, so the misconception routes itself.
          //
          // A `slow` crosses nothing at all: nobody performed it, and it cannot
          // be told apart from a child who was still working. See
          // `reportsToCurriculum`. The shot still goes dark; the ladder just
          // does not hear about it.
          if (reportsToCurriculum(event.outcome)) {
            host.report({
              questionId: event.statement.questionId,
              correct: isCorrect(event.outcome),
              ms: event.reactionMs,
              answered: responseFor(event.outcome, event.statement),
            })
          }
          audio.outcome(event.outcome)
          const cue = HAPTIC[event.outcome]
          if (cue) host.haptic(cue)
          // A run of ten calls is a thing the child finished. A run that ended
          // is not, and `transition` is never called there: a purchase surface
          // must not sit next to a failure.
          if (isCorrect(event.outcome)) {
            const calls = round.run.calls
            if (calls > 0 && calls % TRANSITION_EVERY === 0 && calls > milestones) {
              milestones = calls
              host.transition?.("level")
            }
          }
          break
        }
        case "over": {
          audio.over()
          host.haptic("heavy")
          if (recordCalls(event.run.calls)) best = event.run.calls
          break
        }
        case "begin": {
          milestones = 0
          break
        }
        default:
          break
      }
    }
  }

  const tick = (now: number): void => {
    if (!running) return
    frame = requestAnimationFrame(tick)
    const dt = last === 0 ? 16 : Math.min(MAX_STEP_MS, now - last)
    last = now
    // Reading the rules is not playing. The manual opens over a live street,
    // and a draw window that ran while a child was reading would take all three
    // shots before they looked up — which would teach them that asking how to
    // play is punished.
    if (!guide.isOpen) handle(round.advance(dt))
    scene.draw({
      phase: round.phase,
      progress: round.progress,
      elapsedMs: round.elapsedMs,
      statement: round.statement,
      outcome: round.outcome,
      run: round.run,
      best,
      reduced,
    })
  }

  const press = (event: Event): void => {
    event.preventDefault()
    // Web Audio needs a gesture, and the first press in the game is the first
    // gesture there is.
    audio.resume()
    handle(round.press())
  }

  const key = (event: KeyboardEvent): void => {
    if (event.repeat) return
    // The manual takes the keyboard while it is up: space is how it is
    // dismissed, not a draw at a slate nobody can see.
    if (guide.isOpen) return
    if (event.key !== " " && event.key !== "Enter") return
    press(event)
  }

  const resize = (): void => {
    scene.resize()
  }

  // Rotation swaps the insets top-for-left, and iPadOS changes them when the
  // pack is resized in Split View. A layout derived from them once at mount is
  // correct until the first rotation and wrong after it.
  const stopInsets = onInsetsChange(resize)

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

  // No start screen and no start button. The street stands empty with three
  // loaded shots breathing under a lowered slate, and the first tap anywhere is
  // the start — which also happens to be the gesture Web Audio needs before the
  // first cue can sound.
  frame = requestAnimationFrame(tick)

  return {
    // The host puts a sheet over the frame — a transition, a parent gate — and
    // sends `pause` with the pack still mounted. The clock has to stop dead:
    // see Round.pause().
    pause(): void {
      round.pause()
    },
    resume(): void {
      round.resume()
    },
    unmount(): void {
      running = false
      guide.destroy()
      stopInsets()
      cancelAnimationFrame(frame)
      canvas.removeEventListener("pointerdown", press)
      globalThis.removeEventListener("keydown", key)
      globalThis.removeEventListener("resize", resize)
      observer?.disconnect()
      audio.dispose()
      canvas.remove()
    },
  }
}
