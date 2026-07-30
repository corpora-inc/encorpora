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
import { createInstructions } from "../../../packs/shared/game-chrome/index.ts"

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

  /** Did the manual stop the street? Only then may closing it start again. */
  let heldForManual = false

  // How to play. Nothing on the street says what a stud is, and nothing is
  // going to: primeness here is a wall you walk into, not a fact you are given.
  // But the two verbs are not discoverable — a child who does not know that a
  // stud is a claim about the number is tapping brass at random. The manual
  // stays reachable during play, because the moment a child needs the rules is
  // never the title.
  //
  // Built after the street rather than before it because it stops the street:
  // `onOpen`/`onClose` below are the only part of pausing this game has to opt
  // into, and they need something to pause.
  const guide = createInstructions(el, {
    title: "FOUNDRY STREET",
    summary: [
      "A crowd blocks the street. Break it into equal rows, then knock the rows down.",
      "Some crowds cannot be broken into rows at all. Those are the ones you punch.",
    ],
    sections: [
      {
        heading: "Breaking a crowd",
        lines: [
          "The crowd is a number. The big number at the top left is how many are standing. Say there are twelve of them.",
          "There is a bar of small numbers. Tap one of them to try it.",
          "Tap 3 and the twelve split into 4 rows of 3, made of the same people. The top left then reads 4 x 3.",
          "That only works if the number goes in evenly. If it does not, nothing breaks and the crowd closes back up.",
          "When the crowd is down to one single row the top left says IN THE STREET.",
        ],
      },
      {
        heading: "Crowds you cannot break",
        lines: [
          "Some crowds will not split into equal rows however hard you try. Thirteen is one.",
          "So are 2, 3, 5, 7 and 11.",
          "If every number on the bar bounces off, that is your answer: this crowd cannot be broken.",
          "Then you swing. One punch and the whole row goes down.",
        ],
      },
      {
        heading: "Swinging",
        lines: [
          "Tap the crowd itself to swing your fists at them.",
          "Your fists only work on a row that cannot be broken into smaller rows.",
          "Swing at a row that could still be split and your fists bounce off it.",
          "So the fast way through is to break the crowd down first, then punch the rows one at a time.",
        ],
      },
      {
        heading: "Getting it wrong",
        lines: [
          "There is no clock. Standing still and looking at the crowd costs you nothing.",
          "A wrong tap makes the crowd lean on you. Enough of them in a row and it shoves you back a block.",
          "A block is three crowds. BLOCKS at the top right counts the blocks you have cleared, and being shoved back never takes one away. You just start the crowd you were on again.",
          "Even then you keep everything you already built.",
        ],
      },
      {
        heading: "Between crowds",
        lines: [
          "Before each crowd, a steel shutter rolls down across the street. A shutter is a rolling metal door.",
          "There is a problem chalked on it and four rivets. Rivets are the round metal bolts in the door, and each one has a number.",
          "Work out the answer and tap the rivet it is on.",
          "Get it wrong and that rivet goes dark. Try another one — the crowd does not lean on you for this.",
          "Get it right and the shutter rolls up, and the next crowd comes.",
        ],
      },
    ],
    reducedMotion: reduced,
    // The manual only lifts a pause it put on itself. A street the host had
    // already stopped — a transition sheet, a parent gate — must not be handed
    // back running because the child closed the rules.
    onOpen: () => {
      if (street.paused) return
      heldForManual = true
      street.pause()
    },
    onClose: () => {
      if (!heldForManual) return
      heldForManual = false
      street.resume()
    },
  })

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
    // clock has to stop dead and input has to stop counting: see `Street`. The
    // game's own how-to-play sheet takes the same pause, above.
    pause(): void {
      street.pause()
    },
    resume(): void {
      // The rules are still up. Whoever asked for this — the host taking its
      // own sheet down over the top of the manual — the child is still reading,
      // and the only thing allowed to start the street again is the rules going
      // down. Without this the host's resume hands back a running street behind
      // a scrim, which is the whole defect wearing a different hat.
      if (guide.isOpen) {
        heldForManual = true
        return
      }
      street.resume()
    },
    unmount(): void {
      running = false
      guide.destroy()
      cancelAnimationFrame(frameId)
      canvas.removeEventListener("pointerdown", press)
      globalThis.removeEventListener("resize", resize)
      observer?.disconnect()
      audio.dispose()
      canvas.remove()
    },
  }
}
