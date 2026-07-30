// THE STEELYARD.
//
// The wiring, and nothing else: the rules are in `game/bout.ts`, the physics in
// `sim/beam.ts`, the room in `render/scene.ts`. This file owns the frame, the
// input, the host calls and the frame clock — and the frame clock is still the
// part with teeth. There is no longer a limit on the round, but the abandonment
// guard, the strain bleed and the beam all run on it, and a rAF that keeps
// ticking behind a sheet racks a lot the child never saw.

import { createInstructions } from "../../../packs/shared/game-chrome/index.ts"
import type { Handle, Host } from "./contract.ts"
import { Audio } from "./audio.ts"
import { Bout, type BoutEvent, TIMING, TIMING_REDUCED } from "./game/bout.ts"
import { loadTally, recordTally } from "./game/best.ts"
import { splitPrompt, type Column } from "./game/column.ts"
import { requestFor } from "./game/ladder.ts"
import type { Place } from "./game/places.ts"
import { Beam, MAX_TILT, TUNING, TUNING_REDUCED } from "./sim/beam.ts"
import { PALETTE } from "./render/palette.ts"
import { Scene } from "./render/scene.ts"

/**
 * The largest step the clock is allowed to take in one frame.
 *
 * A backgrounded tab hands back a delta of minutes. Letting that through would
 * burn the whole abandonment guard in one frame and rack a lot the child was
 * mid-way through. Clamping means time nearly stops when frames stop, which is
 * the only fair reading of "they were not here".
 */
const MAX_STEP_MS = 120

/** Keys, for the dev harness and for anybody on a keyboard. */
const KEY_FACE: Record<string, { place: Place; dir: 1 | -1 }> = {
  q: { place: 1000, dir: 1 },
  a: { place: 1000, dir: -1 },
  w: { place: 100, dir: 1 },
  s: { place: 100, dir: -1 },
  e: { place: 10, dir: 1 },
  d: { place: 10, dir: -1 },
  r: { place: 1, dir: 1 },
  f: { place: 1, dir: -1 },
}

export function mountCounterweight(el: HTMLElement, host: Host): Handle {
  const canvas = document.createElement("canvas")
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none"
  el.appendChild(canvas)

  const reduced = host.prefersReducedMotion()
  const scene = new Scene(canvas)
  const audio = new Audio()
  const beam = new Beam(reduced ? TUNING_REDUCED : TUNING)

  /**
   * The deal reads the day *at the moment the lot comes on*, which is why it goes
   * through a mutable handle rather than closing over a rung.
   *
   * `Bout.hang()` runs inside the same event batch that carries the `won` or
   * `sentBack` that caused it, and it runs FIRST — so a rung updated from those
   * events in `handle()` below would always be one round stale. Reading
   * `bout.day` lazily is what makes the scale just cleared the reason the next
   * lot is heavier.
   */
  let table: Bout | null = null
  const bout = new Bout(
    () => host.next(requestFor(table?.day)),
    reduced ? TIMING_REDUCED : TIMING,
  )
  table = bout

  const guide = createInstructions(el, {
    title: "THE STEELYARD",
    summary: [
      "You weigh goods for the market. Nothing is sold here until you have weighed it.",
      "A card comes with each load. Add the two numbers up yourself — nobody tells you the total.",
      "Put brass on your pan until it is one more than that total, then press STAMP.",
      "There is no timer. Take all day if you want to.",
    ],
    sections: [
      {
        heading: "Why one more, and not the same",
        lines: [
          "A flat beam has not told you anything. It could tip either way.",
          "So you add brass until the beam just dips to your side.",
          "One more than the goods is the smallest amount that makes it dip.",
          "Then you know what the goods weigh, and you write it down.",
          "Two more is too much. You have only shown the goods are lighter than a big number.",
        ],
      },
      {
        heading: "Putting brass on",
        lines: [
          "There are four pillars: thousands, hundreds, tens and ones.",
          "The top face of a pillar adds one of that size. The bottom face takes one off.",
          "Your brass stays on the pan. Each load you only change the difference.",
          "If the loads change size a lot, the weigh-master lays out a fresh set for you.",
        ],
      },
      {
        heading: "A short cut",
        lines: [
          "To add 8, hit the tens face once and take the ones off twice.",
          "Ten less two is eight, and that is three taps instead of eight.",
        ],
      },
      {
        heading: "The day",
        lines: [
          "A good weight moves the bar at the top one step your way.",
          "A wrong one moves it one step back. Nothing else is lost.",
          "Five steps your way and that scale is done. A bigger one is wheeled in.",
          "Five steps the other way and the load goes back, and they send you lighter goods.",
        ],
      },
      {
        heading: "Do not hammer the plates",
        lines: [
          "The beam is a bar of steel. Hit it again while it is still ringing and the ring grows.",
          "Ring it too hard and the beam shears. The lot goes back and the bar moves one step against you.",
          "Leave a beat between blows and that never happens.",
        ],
      },
      {
        heading: "Nothing is counting",
        lines: [
          "No clock runs while you think. Nothing on your pan moves on its own.",
          "Stop halfway and check your adding. It will all still be there.",
          "If you walk away and nobody touches the rack for a long time, the load goes back.",
          "That costs nothing at all, and it is not a wrong answer.",
        ],
      },
    ],
    reducedMotion: reduced,
    // This is the game the complaint was about: "I can hear counterweight
    // playing in the background while I'm reading the instructions." The sound
    // is held for us; the abandonment guard is not, and a guard that runs out
    // behind the scrim racks a lot the child never saw.
    //
    // The manual only lifts a pause it put on itself. The host can already have
    // a sheet over the frame, and the tab can already be in the background —
    // a child who opens and closes the rules underneath either of those must
    // not be handed back a running yard.
    onOpen: () => {
      if (sheeted) return
      heldForManual = true
      pauseAll()
    },
    onClose: () => {
      if (!heldForManual) return
      heldForManual = false
      resumeAll()
    },
  })

  let tally = loadTally()
  let running = true
  let frame = 0
  let last = 0
  /** Set by the host's `pause`. Blocks the clock *and* the input, separately. */
  let sheeted = false
  /** True only while the pause in force is the one the manual raised. */
  let heldForManual = false
  let column: Column | null = null
  let promptRaw = ""
  /**
   * When the current round opened, on the wall clock. The latency reported to the
   * host is measured from here — **measured, never limited** — and a pause shifts
   * it forward so a sheet is not charged as thinking time.
   */
  let openedAt = 0
  let pausedAt = 0
  let holdRun = 0
  const pressed = new Set<string>()
  let stampHeld = false
  /** Item ids already reported. One report per item, ever. */
  const reported = new Set<string>()

  const now = (): number =>
    typeof performance === "object" && typeof performance.now === "function"
      ? performance.now()
      : Date.now()

  const handle = (events: readonly BoutEvent[]): void => {
    for (const event of events) {
      switch (event.kind) {
        case "hang": {
          promptRaw = event.question.prompt
          column = splitPrompt(event.question.prompt)
          beam.aim(bout.margin)
          break
        }
        case "open": {
          openedAt = now()
          audio.bow()
          break
        }
        case "strike": {
          beam.aim(bout.margin)
          beam.hit(event.impulse, event.strike.dir)
          audio.clang(event.strike, event.impulse)
          host.haptic(event.impulse >= 6 ? "medium" : "light")
          if (!reduced) {
            const at = scene.faceCentre(event.strike.place, event.strike.dir)
            scene.sparks.strike(at.x, at.y, 1, event.impulse, PALETTE.brassBright)
          }
          break
        }
        case "refused": {
          if (event.reason === "cooldown") audio.refuse()
          break
        }
        case "rerack": {
          beam.aim(bout.margin)
          audio.slide()
          host.haptic("light")
          scene.flash(PALETTE.brassDim, 200)
          break
        }
        case "stamp": {
          const docket = event.docket
          // **Only a stamped docket is an answer.** `declared` is the whole test,
          // and there are two ways for it to be false: the guard decided nobody
          // was there, and the beam sheared. In both cases the brass on the pan is
          // where the child had *got to*, not something they said — reporting it
          // would file a number they never asserted against a sum they were still
          // working, and walk the host's ladder down for it.
          if (docket.declared) {
            report(docket.question.id, docket.verdict === "true", docket.asserted)
          } else {
            skip(docket.question.id)
          }
          beam.aim(bout.margin)
          if (docket.verdict === "lapsed") {
            // Nobody was there. Nothing is lost, so nothing is even reset.
            audio.slide()
            break
          }
          if (docket.verdict === "true") {
            holdRun += 1
            audio.held()
            host.haptic("success")
            scene.flash(PALETTE.seat, 200)
          } else {
            holdRun = 0
            if (docket.verdict === "shear") {
              audio.shear()
              host.haptic("failure")
              beam.slam(-1)
              scene.shake(reduced ? 0 : 7, 220)
              if (!reduced) {
                scene.sparks.shear(scene.layout.fulcrum.x, scene.layout.fulcrum.y, PALETTE.strain)
              }
            } else {
              audio.lost()
              host.haptic("heavy")
            }
          }
          tally = recordTally(bout.day.won, Math.max(tally.hold, holdRun))
          break
        }
        case "won": {
          audio.fanfare()
          host.haptic("success")
          scene.flash(PALETTE.brassBright, 240)
          tally = recordTally(bout.day.won, Math.max(tally.hold, holdRun))
          // The one call site. A scale cleared is a thing the child *reached*; a
          // barrow going back is not, and a purchase surface next to a setback is
          // forbidden outright.
          host.transition?.("boss", `Scale ${event.scale}`)
          break
        }
        case "sentBack": {
          audio.lost()
          host.haptic("heavy")
          holdRun = 0
          break
        }
        default:
          break
      }
    }
  }

  /**
   * Close an item nobody answered.
   *
   * Shares the `reported` set with `report`, which is what makes the two endings
   * mutually exclusive: an item the child never declared can never also be
   * reported, and an item they stamped can never also be skipped.
   */
  const skip = (questionId: string): void => {
    if (questionId === "" || reported.has(questionId)) return
    reported.add(questionId)
    host.skip?.(questionId)
  }

  const report = (questionId: string, correct: boolean, asserted: number): void => {
    if (questionId === "" || reported.has(questionId)) return
    reported.add(questionId)
    // The host judges. What crosses is the weight the child wrote on the docket
    // — which, when they ran a broken column procedure, is exactly the mal-rule
    // output, so the diagnosis routes with nothing else to write.
    host.report({
      questionId,
      correct,
      ms: Math.max(0, Math.round(now() - openedAt)),
      answered: String(asserted),
    })
  }

  const tick = (t: number): void => {
    if (!running) return
    frame = requestAnimationFrame(tick)
    const dt = last === 0 ? 16 : Math.min(MAX_STEP_MS, t - last)
    last = t
    // One place where the simulation is frozen, rather than a guard in each
    // subsystem. `Bout` stops its own clock too — `pause.test.ts` is written
    // against that — and this is what stops the beam and the drone with it.
    if (!sheeted) {
      handle(bout.advance(dt))
      beam.advance(dt)
      audio.track(beam.angle / MAX_TILT, beam.ring)
    }
    scene.advance(dt, reduced)
    scene.draw({
      bout,
      beam,
      reduced,
      best: tally,
      pressed,
      stampHeld,
      paused: sheeted,
      column,
      promptRaw,
    })
  }

  const pointAt = (event: { clientX?: number; clientY?: number }): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect()
    return { x: (event.clientX ?? 0) - rect.left, y: (event.clientY ?? 0) - rect.top }
  }

  const act = (target: ReturnType<Scene["pick"]>): void => {
    if (!target) return
    audio.resume()
    if (target.kind === "stamp") {
      stampHeld = true
      handle(bout.stamp())
      return
    }
    pressed.add(`${target.place}:${target.dir}`)
    handle(bout.strike({ place: target.place, dir: target.dir }))
  }

  const down = (event: Event): void => {
    event.preventDefault()
    // A press that lands while the host's sheet is up is a press on the sheet.
    // `Bout` refuses it anyway — that is where the rules live — but the refusal
    // comes back after this handler has already lit the plate up and woken the
    // audio context. Stopping it here is what keeps the rack from answering a
    // tap the child aimed somewhere else.
    if (sheeted) return
    const at = pointAt(event as PointerEvent)
    act(scene.pick(at.x, at.y))
  }

  const up = (): void => {
    pressed.clear()
    stampHeld = false
  }

  const key = (event: KeyboardEvent): void => {
    if (event.repeat || sheeted) return
    const k = event.key.toLowerCase()
    if (k === " " || k === "enter") {
      event.preventDefault()
      act({ kind: "stamp" })
      globalThis.setTimeout(up, 90)
      return
    }
    const face = KEY_FACE[k]
    if (!face) return
    event.preventDefault()
    act({ kind: "face", place: face.place, dir: face.dir })
    globalThis.setTimeout(up, 90)
  }

  const resize = (): void => {
    scene.resize()
  }

  canvas.addEventListener("pointerdown", down)
  canvas.addEventListener("pointerup", up)
  canvas.addEventListener("pointercancel", up)
  globalThis.addEventListener("keydown", key)
  globalThis.addEventListener("keyup", up)
  globalThis.addEventListener("resize", resize)

  const observer =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          scene.resize()
        })
      : null
  observer?.observe(el)

  // A hidden tab is the same situation as a sheet, and it arrives far more
  // often. `MAX_STEP_MS` alone would still spend 120 ms a frame on a throttled
  // timer; this stops the world outright.
  const visibility = (): void => {
    const doc = globalThis.document as Document | undefined
    if (!doc) return
    if (doc.visibilityState === "hidden") pauseAll()
    else resumeAll()
  }

  const pauseAll = (): void => {
    if (sheeted) return
    sheeted = true
    pausedAt = now()
    bout.pause()
    audio.release()
  }

  const resumeAll = (): void => {
    if (!sheeted) return
    sheeted = false
    // The sheet is not the child's thinking time. Shift the mark forward by
    // exactly how long it was up, so the latency this round reports is the time
    // they actually had the beam in front of them.
    if (pausedAt > 0) openedAt += now() - pausedAt
    pausedAt = 0
    last = 0
    if (bout.phase === "press") audio.bow()
    bout.resume()
  }

  globalThis.document?.addEventListener("visibilitychange", visibility)

  handle(bout.begin())
  beam.settleTo(bout.margin)
  frame = requestAnimationFrame(tick)

  return {
    /**
     * The host has raised a sheet over a still-mounted, still-running pack.
     *
     * Both halves matter. The clock stops, so the abandonment guard cannot run
     * out behind the sheet and rack a lot the child never saw. And input stops,
     * so a tap meant for the sheet is not a blow on the rack.
     */
    pause(): void {
      pauseAll()
    },
    resume(): void {
      resumeAll()
    },
    unmount(): void {
      running = false
      cancelAnimationFrame(frame)
      canvas.removeEventListener("pointerdown", down)
      canvas.removeEventListener("pointerup", up)
      canvas.removeEventListener("pointercancel", up)
      globalThis.removeEventListener("keydown", key)
      globalThis.removeEventListener("keyup", up)
      globalThis.removeEventListener("resize", resize)
      globalThis.document?.removeEventListener("visibilitychange", visibility)
      observer?.disconnect()
      guide.destroy()
      audio.dispose()
      canvas.remove()
    },
  }
}
