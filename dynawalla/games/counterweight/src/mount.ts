// THE COUNTERWEIGHT.
//
// The wiring, and nothing else: the rules are in `game/bout.ts`, the physics in
// `sim/beam.ts`, the yard in `render/scene.ts`. This file owns the frame, the
// input, the host calls and the clock — and the clock is the part with teeth,
// because a clock that runs behind a sheet costs the child a round they never
// saw.

import type { Handle, Host } from "./contract.ts"
import { Audio } from "./audio.ts"
import { Bout, type BoutEvent, TIMING, TIMING_REDUCED } from "./game/bout.ts"
import { loadTally, recordTally } from "./game/best.ts"
import { splitPrompt, type Column } from "./game/column.ts"
import type { Place } from "./game/places.ts"
import { Beam, MAX_TILT, TUNING, TUNING_REDUCED } from "./sim/beam.ts"
import { PALETTE } from "./render/palette.ts"
import { Scene } from "./render/scene.ts"

/**
 * The largest step the clock is allowed to take in one frame.
 *
 * A backgrounded tab hands back a delta of minutes. Letting that through would
 * spend a press window and seat the beam wherever it stood. Clamping means time
 * nearly stops when frames stop, which is the only fair reading of "they were
 * not here".
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
  const bout = new Bout(() => host.next({ domain: "add" }), reduced ? TIMING_REDUCED : TIMING)

  let tally = loadTally()
  let running = true
  let frame = 0
  let last = 0
  /** Set by the host's `pause`. Blocks the clock *and* the input, separately. */
  let sheeted = false
  let column: Column | null = null
  let promptRaw = ""
  /**
   * When the current window opened, on the wall clock. Latency the child is
   * billed for is measured from here, and a pause shifts it forward so a sheet
   * is not charged as thinking time.
   */
  let openedAt = 0
  let pausedAt = 0
  let holdRun = 0
  const pressed = new Set<string>()
  let seatHeld = false
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
          audio.clang(event.strike.place, event.impulse)
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
        case "sag": {
          beam.aim(bout.margin)
          audio.sag()
          break
        }
        case "seat": {
          report(event.seat.question.id, event.seat.verdict === "true", event.seat.asserted)
          beam.aim(bout.margin)
          if (event.seat.verdict === "true") {
            holdRun += 1
            audio.held()
            host.haptic("success")
            scene.flash(PALETTE.seat, 200)
          } else {
            holdRun = 0
            if (event.seat.verdict === "shear") {
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
          tally = recordTally(bout.match.won, Math.max(tally.hold, holdRun))
          break
        }
        case "won": {
          audio.fanfare()
          host.haptic("success")
          scene.flash(PALETTE.brassBright, 240)
          tally = recordTally(bout.match.won, Math.max(tally.hold, holdRun))
          // The one call site. A Turk going over is a thing the child *reached*;
          // being pinned is not, and a purchase surface next to a defeat is
          // forbidden outright.
          host.transition?.("boss", `Turk ${event.bout}`)
          break
        }
        case "pinned": {
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

  const report = (questionId: string, correct: boolean, asserted: number): void => {
    if (questionId === "" || reported.has(questionId)) return
    reported.add(questionId)
    // The host judges. What crosses is the value the beam asserted his column to
    // be — which, when the child ran a broken column procedure, is exactly the
    // mal-rule output, so the diagnosis routes with nothing else to write.
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
      seatHeld,
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
    if (target.kind === "seat") {
      seatHeld = true
      handle(bout.seatNow())
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
    seatHeld = false
  }

  const key = (event: KeyboardEvent): void => {
    if (event.repeat || sheeted) return
    const k = event.key.toLowerCase()
    if (k === " " || k === "enter") {
      event.preventDefault()
      act({ kind: "seat" })
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
     * Both halves matter. The clock stops, so a press window cannot open and
     * close behind the sheet and seat the beam on a column the child never saw.
     * And input stops, so a tap meant for the sheet is not a blow on the rack.
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
      audio.dispose()
      canvas.remove()
    },
  }
}
