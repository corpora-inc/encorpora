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

import { Audio } from "./audio/audio.ts"
import type { Host } from "./contract.ts"
import { bestCalls, recordCalls } from "./game/best.ts"
import { Dealer } from "./game/dealer.ts"
import { HAPTIC } from "./game/energy.ts"
import { isCorrect, responseFor } from "./game/response.ts"
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

export function mountTrueDraw(el: HTMLElement, host: Host): { unmount(): void } {
  const canvas = document.createElement("canvas")
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none"
  el.appendChild(canvas)

  const reduced = host.prefersReducedMotion()
  const scene = new Scene(canvas)
  const audio = new Audio()
  const rng = new Rng((Date.now() ^ 0x51ed) >>> 0)
  const dealer = new Dealer(host, rng)
  const round = new Round(() => dealer.deal(), reduced ? TIMING_REDUCED : TIMING)

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
          host.report({
            questionId: event.statement.questionId,
            correct: isCorrect(event.outcome),
            ms: event.reactionMs,
            answered: responseFor(event.outcome, event.statement),
          })
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
    handle(round.advance(dt))
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
    if (event.key !== " " && event.key !== "Enter") return
    press(event)
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

  // No start screen and no start button. The street stands empty with three
  // loaded shots breathing under a lowered slate, and the first tap anywhere is
  // the start — which also happens to be the gesture Web Audio needs before the
  // first cue can sound.
  frame = requestAnimationFrame(tick)

  return {
    unmount(): void {
      running = false
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
