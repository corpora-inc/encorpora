// FOUNDRY STREET.
//
// The night shift comes up the street in a mob. You have two verbs and both of
// them are claims about a number.
//
//   **STRIKE a stud.** "This number goes into them." If it does, the crack runs
//   the length of the block at 2400 px/s and the mob comes apart into that many
//   to a rank — the same bodies, rearranged into a rectangle the child made. If
//   it does not, the crack rings off, the mob stands in groups with the
//   remainder left over, and closes back up.
//
//   **SWING.** "They are solid." Fists work on a rank whose size is prime and
//   bounce off one that is not, because a composite rank has something to hold
//   on to and a prime rank has nothing.
//
// Nobody is told what a prime is. Thirteen refuses every stud on the bar, and
// then goes down in one punch.
//
// The shutter between waves is the other half: a problem chalked on steel, four
// rivets, and the host is the judge of which one opens it.

import { StreetAudio } from "./audio/audio.ts"
import { MAX_STEP_MS, TIMING, TIMING_REDUCED } from "./core/feel.ts"
import { Rng } from "./core/rng.ts"
import type { Host } from "./contract.ts"
import { blocksCleared, recordBlocks } from "./game/best.ts"
import { HAPTIC } from "./game/energy.ts"
import { pressure } from "./game/push.ts"
import { Street, type StreetEvent } from "./game/street.ts"
import { WAVES_PER_BLOCK } from "./game/wave.ts"
import { Scene, hit, type Frame } from "./render/scene.ts"

export function mountStreet(
  el: HTMLElement,
  host: Host,
): { unmount(): void; pause(): void; resume(): void } {
  const canvas = document.createElement("canvas")
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none"
  el.appendChild(canvas)

  const reduced = host.prefersReducedMotion()
  const scene = new Scene(canvas)
  const audio = new StreetAudio()
  const rng = new Rng((Date.now() ^ 0x57ee7) >>> 0)

  const street = new Street({
    rng,
    timing: reduced ? TIMING_REDUCED : TIMING,
    deal: () => {
      const q = host.next({ domain: "add" })
      return { id: q.id, prompt: q.prompt, answer: q.answer, distractors: q.distractors }
    },
  })
  street.setStreetWidth(scene.width)

  let best = blocksCleared()
  let running = true
  let frameId = 0
  let last = 0
  let lastSeam = 0
  let lastRemainder = 0
  let clean = false

  const handle = (events: readonly StreetEvent[]): void => {
    for (const event of events) {
      switch (event.kind) {
        case "report": {
          // The host is the judge. What crosses is the numeral on the rivet the
          // child struck — and a wrong one is a mal-rule output, so the
          // misconception routes itself with no extra wiring.
          host.report({
            questionId: event.questionId,
            correct: event.correct,
            ms: event.ms,
            answered: event.answered,
          })
          audio.rivet(event.correct)
          if (event.correct) audio.shutter(true)
          break
        }
        case "wave": {
          audio.hum(event.size)
          break
        }
        case "crack": {
          lastSeam = event.seam
          audio.crack(event.crowd.size)
          audio.hum(event.crowd.size)
          break
        }
        case "ringoff": {
          lastSeam = event.seam
          lastRemainder = event.remainder
          audio.ringoff()
          break
        }
        case "bounce": {
          audio.bounce()
          break
        }
        case "down": {
          audio.down(event.felled)
          break
        }
        case "cleared": {
          clean = event.clean
          audio.cleared(event.solid)
          audio.hum(0)
          break
        }
        case "shove": {
          audio.shove()
          break
        }
        case "shutter": {
          audio.hum(0)
          audio.shutter(false)
          break
        }
        case "block": {
          audio.block()
          if (recordBlocks(event.blocks)) best = event.blocks
          // A block finished is a thing the child *reached*, which is the only
          // kind of moment this call is allowed to mark. It is never fired on a
          // shove-back, and the host may answer it by putting a sheet over a
          // still-running pack — which is what `pause()` below exists for.
          host.transition?.("level")
          break
        }
        case "beat": {
          const cue = HAPTIC[event.beat]
          host.haptic(cue)
          if (event.beat === "ringoff" || event.beat === "bounce") {
            audio.lean(street.push.marks)
          }
          break
        }
      }
    }
  }

  const frameOf = (): Frame => ({
    phase: street.phase,
    progress: street.progress,
    crowd: street.crowd,
    shutter: street.shutter,
    pressure: pressure(street.push),
    pushMarks: street.push.marks,
    blocks: street.blocks,
    best,
    waveOfBlock: street.waveOfBlock,
    wavesPerBlock: WAVES_PER_BLOCK,
    hintSeam: street.hintSeam,
    lastSeam,
    lastRemainder,
    clean,
    reduced,
  })

  const tick = (now: number): void => {
    if (!running) return
    frameId = requestAnimationFrame(tick)
    const dt = last === 0 ? 16 : Math.min(MAX_STEP_MS, now - last)
    last = now
    handle(street.advance(dt))
    scene.draw(frameOf())
  }

  const press = (event: PointerEvent): void => {
    event.preventDefault()
    // Web Audio needs a gesture, and the first tap in the game is the first one.
    audio.resume()
    const layout = scene.lastLayout
    if (!layout) return
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    if (street.phase === "shutter") {
      for (const rivet of layout.rivets) {
        if (hit(rivet.rect, x, y)) {
          handle(street.hitRivet(rivet.index))
          return
        }
      }
      return
    }
    for (const stud of layout.studs) {
      if (hit(stud.rect, x, y)) {
        handle(street.strikeStud(stud.k))
        return
      }
    }
    if (hit(layout.mob, x, y)) handle(street.swing())
  }

  const resize = (): void => {
    scene.resize()
    street.setStreetWidth(scene.width)
  }

  canvas.addEventListener("pointerdown", press)
  globalThis.addEventListener("resize", resize)

  const observer =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          resize()
        })
      : null
  observer?.observe(el)

  handle(street.begin())
  frameId = requestAnimationFrame(tick)

  return {
    // The host puts a sheet over the frame — a transition, a parent gate — and
    // sends `pause` with the pack still mounted and its rAF still firing. The
    // clock has to stop dead and input has to stop counting: see `Street`.
    pause(): void {
      street.pause()
    },
    resume(): void {
      street.resume()
    },
    unmount(): void {
      running = false
      cancelAnimationFrame(frameId)
      canvas.removeEventListener("pointerdown", press)
      globalThis.removeEventListener("resize", resize)
      observer?.disconnect()
      audio.dispose()
      canvas.remove()
    },
  }
}
