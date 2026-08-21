// THE TRUE DRAW.
//
// Two gestures, and that is the whole of the input.
//
//   swipe DOWN   keep the claim  — "this sum is right"
//   swipe UP     throw it away   — "this sum is wrong"
//
//   * A statement is cut into the slate — `47 + 25 = 72`, or `47 + 25 = 62`. The
//     wrong ones are not `answer ± 1`; they are what a child who drops the carry
//     actually writes, so rejecting one means doing the arithmetic.
//   * Correct keeps build the bag. A wrong keep or a wrong throw takes coins out
//     of it, and takes strictly more than the best call can put in — so swiping at
//     random empties the bag rather than filling it.
//   * A window that closes untouched is neither verdict. No coins, no shot, and it
//     goes to the host as `skip` — never as an empty answer, which the SDK files as
//     a miss and which steps the ladder DOWN for a child who was still thinking.
//   * Both gestures are timed, from the instant the statement became answerable, so
//     the ladder can move on speed. It could not before: one of the two verdicts
//     was "wait" and a wait has no moment in it.

import { createInstructions, onInsetsChange } from "../../../packs/shared/game-chrome/index.ts"
import { Audio } from "./audio/audio.ts"
import type { Host } from "./contract.ts"
import { bestBag, recordBag } from "./game/best.ts"
import { Dealer } from "./game/dealer.ts"
import { HAPTIC } from "./game/energy.ts"
import { commitDistance, Gesture } from "./game/gesture.ts"
import { reportSettled } from "./game/report.ts"
import { isCorrect } from "./game/response.ts"
import { MAX_STEP_MS, Round, TIMING, TIMING_REDUCED, type RoundEvent } from "./game/round.ts"
import { Rng } from "./core/rng.ts"
import { Flourishes, type Flourish } from "./render/flourish.ts"
import { Scene, type Drag } from "./render/scene.ts"

/** A milestone the child *reached*. Never fired when a run ends. */
const TRANSITION_EVERY = 10

export function mountTrueDraw(
  el: HTMLElement,
  host: Host,
): { unmount(): void; pause(): void; resume(): void } {
  const canvas = document.createElement("canvas")
  // `touch-action: none` is what stops a vertical flick on the canvas becoming a
  // page scroll or a rubber-band. The manual sheet sets `touch-action: pan-y` on
  // its own body so it can still be finger-scrolled; it is a DOM overlay above this
  // canvas, so a drag that lands on it never reaches these listeners at all — and
  // `guide.isOpen` is checked anyway, because a game that answers a question while
  // a child is reading the rules has punished them for asking.
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none"
  el.appendChild(canvas)

  const reduced = host.prefersReducedMotion()
  const scene = new Scene(canvas)
  const audio = new Audio()
  const seed = (Date.now() ^ 0x51ed) >>> 0
  const rng = new Rng(seed)
  // A SEPARATE stream from the dealer's, on purpose. Sharing one would make which
  // celebration a child sees a function of how many falsehoods the dealer happened
  // to build — so a replay of the same seed would diverge the moment the host
  // served a question with one usable distractor instead of two, and neither the
  // animation nor the arithmetic would be reproducible.
  const flourishes = new Flourishes(new Rng((seed ^ 0x9e3779b9) >>> 0))
  const dealer = new Dealer(host, rng)
  const round = new Round(() => dealer.deal(), reduced ? TIMING_REDUCED : TIMING)

  let gesture = new Gesture(commitDistance(el.clientWidth || 390, el.clientHeight || 844))
  let drag: Drag | null = null
  /** The pointer the gesture belongs to. A second finger is not a second verdict. */
  let pointer: number | null = null

  // How to play. Two gestures, and a child who has not been told which way is which
  // will spend a shot finding out. The manual stays reachable during play, because
  // the moment a child needs the rules is never the title.
  const guide = createInstructions(el, {
    title: "THE TRUE DRAW",
    summary: [
      "A sum lights up on the slate. Swipe DOWN to keep it. Swipe UP to throw it away.",
      "Keep the sums that are right. Throw away the ones that are wrong. Right calls fill your bag.",
    ],
    sections: [
      {
        heading: "The two moves",
        lines: [
          "Read the slate. It says something like 47 + 25 = 62.",
          "There is an = at the bottom of the screen and a ≠ at the top. Those are the two answers.",
          "If the sum is right, swipe DOWN to the =. The slate lands on your pile and you get coins.",
          "If it is not, swipe UP to the ≠. The slate is thrown away, and you get coins for spotting it.",
          "As soon as your finger moves, the mark you are heading for lights up.",
        ],
      },
      {
        heading: "Your bag",
        lines: [
          "Every call you get right puts coins in the bag. Getting it right is most of the coins.",
          "Being quick adds a few more on top — but never as many as being right is worth.",
          "Get one wrong, either way, and it costs you more coins than any one call can earn.",
          "So swiping without reading empties your bag. There is no way round that.",
        ],
      },
      {
        heading: "Take as long as you like",
        lines: [
          "There is no rush and there is no bar counting down. A big sum keeps the slate lit much longer than a small one.",
          "If the light goes out before you decide, nothing happens at all. No coins, no shot lost.",
          "Waiting is free — it just never earns you anything.",
        ],
      },
      {
        heading: "Your three shots",
        lines: [
          "Keeping a wrong sum costs a shot. Throwing away a right one costs a shot too.",
          "Running out of time costs nothing.",
          "When all three shots are gone, the street clears and the run is over.",
        ],
      },
      {
        heading: "The sums get harder when you are quick",
        lines: [
          "Get them right and the slate asks for more. Get them right FAST and it asks for a lot more.",
          "Get one wrong and it eases off again.",
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

  let best = bestBag()
  let running = true
  let last = 0
  let frame = 0
  let milestones = 0
  let coins = 0
  /** The celebration or reveal the current verdict drew. One decision, two senses. */
  let flourish: Flourish | null = null

  const handle = (events: readonly RoundEvent[]): void => {
    for (const event of events) {
      switch (event.kind) {
        case "cue": {
          audio.cue()
          break
        }
        case "settled": {
          coins = event.coins
          // Four of the five outcomes go to `report`; a lapse goes to `skip`.
          // `report.ts` owns that branch and is tested against a host for a whole
          // run — it is the most consequential line in the pack and it is not a
          // line this file is able to prove anything about.
          reportSettled(host, event)
          // And the request for the NEXT question moves. This is the other half of
          // the two-gesture design: every verdict now carries an honest latency, so
          // fast-and-right climbs nearly four times as fast as slow-and-right, and
          // a lapse moves nothing at all.
          dealer.settle(event.outcome, event.quickness)
          // ONE draw, for the picture and the sound together. Two independent
          // picks would drift and hand the child a bloom with a bank's chime
          // under it.
          flourish = flourishes.next(event.outcome)
          audio.outcome(event.outcome, flourish?.voice ?? 0)
          const cue = HAPTIC[event.outcome]
          if (cue) host.haptic(cue)
          // A run of ten calls is a thing the child finished. A run that ended is
          // not, and `transition` is never called there: a purchase surface must
          // not sit next to a failure.
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
          if (recordBag(event.run.bag)) best = event.run.bag
          break
        }
        case "begin": {
          milestones = 0
          coins = 0
          flourish = null
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
    // Reading the rules is not playing. The manual opens over a live street, and a
    // window that ran while a child was reading would lapse every question they
    // looked away for — which would teach them that asking how to play is punished.
    if (guide.isOpen) {
      // The manual swallows every pointer event aimed at the game, including the
      // release. A latch held across that is a latch held forever — see
      // `releasePointer`.
      releasePointer()
    } else {
      handle(round.advance(dt))
    }
    scene.draw({
      phase: round.phase,
      progress: round.progress,
      elapsedMs: round.elapsedMs,
      statement: round.statement,
      outcome: round.outcome,
      run: round.run,
      coins,
      best,
      reduced,
      drag,
      flourish,
      // The slate goes blank behind the sheet. It is blurred and dimmed by the
      // manual's own scrim, but "mostly illegible" is the wrong standard for a
      // file that argues at length against giving a child readable, unanswerable
      // thinking time — the whole reason the statement is not drawn during the
      // lead-in. The clock is stopped, so nothing is lost by hiding it.
      masked: guide.isOpen,
    })
  }

  const liveDrag = (): Drag | null =>
    gesture.down ? { dy: gesture.dy, pull: gesture.pull, heading: gesture.heading } : null

  const down = (event: PointerEvent): void => {
    if (guide.isOpen) return
    // One finger owns the gesture. A second is not a second verdict.
    if (pointer !== null) return
    if (!event.isPrimary) return
    event.preventDefault()
    // Web Audio needs a gesture, and the first touch in the game is the first
    // gesture there is.
    audio.resume()
    pointer = event.pointerId
    try {
      canvas.setPointerCapture(event.pointerId)
    } catch {
      // A browser that will not capture still delivers moves to the canvas while
      // the finger is on it, which is enough. Not worth a console line per touch.
    }
    gesture.begin(event.clientX, event.clientY)
    drag = liveDrag()
  }

  const move = (event: PointerEvent): void => {
    if (pointer !== event.pointerId) return
    event.preventDefault()
    const call = gesture.move(event.clientX, event.clientY)
    drag = liveDrag()
    // The verdict fires HERE — mid-motion, the frame the threshold is crossed —
    // not on release. A card you have thrown is gone before your hand stops, and
    // the timestamp taken here is the one reported. See `gesture.ts` for why every
    // other anchor is either unknowable or exploitable.
    if (call !== null) {
      handle(round.verdict(call))
      drag = null
    }
  }

  const up = (event: PointerEvent): void => {
    if (pointer !== event.pointerId) return
    event.preventDefault()
    const release = gesture.end()
    pointer = null
    drag = null
    try {
      canvas.releasePointerCapture(event.pointerId)
    } catch {
      // Already released, or never captured. Either way there is nothing to do.
    }
    // A tap starts a run and is never an answer. A tap that answered would put the
    // whole game back where it started: a child would be voting "keep" without
    // knowing they had voted.
    if (release === "tap") handle(round.tap())
  }

  /**
   * Forget whatever finger we thought was down. Idempotent, and the ONE way out.
   *
   * ── why this is not just `cancel`'s body ─────────────────────────────────────
   *
   * The mount latches one pointer id so that a second finger cannot be a second
   * verdict, and a latch needs a guaranteed release. `pointerup` is not one.
   * `packs/shared/game-chrome/instructions.ts` installs its pointer swallower as a
   * CAPTURE-phase listener on `globalThis` and calls `stopPropagation()` on every
   * event whose target is not one of its own nodes while the sheet is open — so
   * while the manual is up, `pointerup` never reaches this canvas at all. That
   * module documents the trade deliberately: "a game holding a drag when the sheet
   * opens does not get the release that ends it."
   *
   * Which is a real sequence and not a corner: a child holds the phone with one
   * finger resting mid-flick on the glass and taps how-to-play with the other. The
   * release is swallowed, the latch is never cleared, and from then on EVERY
   * `pointerdown` returns at the `pointer !== null` guard. The game goes
   * permanently deaf to touch — no verdict, no tap to start — and `resize` stops
   * rebuilding the commit distance too, because that is gated on `!gesture.down`.
   * Keyboard would still work, which on an iPad is no help at all.
   *
   * So the latch is released from three more places than `pointerup`: a cancel, a
   * lost capture, and the frame loop the moment the manual is open.
   */
  const releasePointer = (): void => {
    if (pointer !== null) {
      try {
        canvas.releasePointerCapture(pointer)
      } catch {
        // Already released, or never captured. Either way there is nothing to do.
      }
    }
    gesture.cancel()
    pointer = null
    drag = null
  }

  const cancel = (event: PointerEvent): void => {
    if (pointer !== event.pointerId) return
    releasePointer()
  }

  /**
   * The browser took the capture away — the element moved, a system gesture won,
   * the sheet went up. Whatever the reason, this sequence is over as far as we can
   * tell, and holding the latch on the strength of a `pointerup` that may never
   * arrive is how the game goes deaf.
   */
  const lostCapture = (event: PointerEvent): void => {
    if (pointer !== event.pointerId) return
    releasePointer()
  }

  const key = (event: KeyboardEvent): void => {
    if (event.repeat) return
    // The manual takes the keyboard while it is up: space is how it is dismissed,
    // not a verdict on a slate nobody can see.
    if (guide.isOpen) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      audio.resume()
      handle(round.verdict("keep"))
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      audio.resume()
      handle(round.verdict("toss"))
      return
    }
    if (event.key !== " " && event.key !== "Enter") return
    event.preventDefault()
    audio.resume()
    handle(round.tap())
  }

  const resize = (): void => {
    scene.resize()
    // The commit distance is a function of the viewport, so a rotation or a Split
    // View resize changes it. A gesture in flight keeps the threshold it started
    // with — changing it mid-flick could commit a verdict the child had not yet
    // committed to — so this only lands when nothing is down.
    if (!gesture.down) {
      gesture = new Gesture(commitDistance(el.clientWidth || 390, el.clientHeight || 844))
    }
  }

  // Rotation swaps the insets top-for-left, and iPadOS changes them when the pack
  // is resized in Split View. A layout derived from them once at mount is correct
  // until the first rotation and wrong after it.
  const stopInsets = onInsetsChange(resize)

  canvas.addEventListener("pointerdown", down)
  canvas.addEventListener("pointermove", move)
  canvas.addEventListener("pointerup", up)
  canvas.addEventListener("pointercancel", cancel)
  canvas.addEventListener("lostpointercapture", lostCapture)
  globalThis.addEventListener("keydown", key)
  globalThis.addEventListener("resize", resize)

  const observer =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          resize()
        })
      : null
  observer?.observe(el)

  // No start screen and no start button. The street stands empty with three loaded
  // shots breathing under a lowered slate, and the first tap anywhere is the start —
  // which also happens to be the gesture Web Audio needs before the first cue.
  frame = requestAnimationFrame(tick)

  return {
    // The host puts a sheet over the frame — a transition, a parent gate — and sends
    // `pause` with the pack still mounted. The clock has to stop dead: see
    // Round.pause().
    pause(): void {
      round.pause()
      releasePointer()
    },
    resume(): void {
      round.resume()
    },
    unmount(): void {
      running = false
      guide.destroy()
      stopInsets()
      cancelAnimationFrame(frame)
      canvas.removeEventListener("pointerdown", down)
      canvas.removeEventListener("pointermove", move)
      canvas.removeEventListener("pointerup", up)
      canvas.removeEventListener("pointercancel", cancel)
      canvas.removeEventListener("lostpointercapture", lostCapture)
      globalThis.removeEventListener("keydown", key)
      globalThis.removeEventListener("resize", resize)
      observer?.disconnect()
      audio.dispose()
      canvas.remove()
    },
  }
}
