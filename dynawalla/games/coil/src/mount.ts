// THE COIL OF NINETY-SIX — the game.
//
// A brass coil descends the alley. It is a number, written in place value with
// the positions made physical: a bead is one, a ribbed drum is ten, a pierced
// ring is a hundred, a notched tower is a thousand. The wall carves the problem
// and lights one operand.
//
//   > **Shear off the glowing number. The machine does the rest.**
//
// `72 − 25`: the coil *is* seventy-two. Shear twenty-five off it and what
// crawls on is forty-seven — you never subtracted, you regrouped and took, and
// the answer came out of the machine. `47 + 25`: the coil is stock, and the
// piece you shear off is welded to an ingot of forty-seven sitting in the wall.
//
// The whole of the mathematics is in the cut, because the shear makes **one**
// cut, at one joint, and takes the tail. Twenty-five is two tens and five ones,
// and a coil of seven tens and two ones has only two ones on its tail — so you
// crack a ten open into ten ones, right where the jaws are, and walk the cut
// back through them. That is the borrow, and there is no other way to do it.
//
// Nothing here has a timer. Aiming is free, cracking is free, and hesitating is
// free. What a careless cut costs is **space**: the piece falls in the lane as
// slag, slag takes cells away, and a coil with nowhere to lie is buried
// head-first — which takes away exactly the big links you borrow from. An exact
// cut smashes two lumps on its way to the wall. The board you have to play on
// is the board you made.

import type { Host } from "./contract.ts"
import { Audio } from "./audio/audio.ts"
import { SLAG_CELLS, buried as buriedCount } from "./game/board.ts"
import { breaksNeeded, coilOf } from "./game/place.ts"
import { REACTIONS, type Tier, tierFor } from "./game/reactions.ts"
import { COURSE, createSession } from "./game/session.ts"
import { cellAt, cellNear, inside } from "./render/layout.ts"
import { type SceneState, Scene } from "./render/scene.ts"

/** Hesitation before the hint offers itself. Long, and it never hurries. */
const HINT_AFTER_MS = 9_000

export function mountCoil(el: HTMLElement, host: Host): { unmount(): void } {
  const container = document.createElement("div")
  container.style.cssText = "position:absolute;inset:0;overflow:hidden;background:#0b0906"
  el.appendChild(container)

  const scene = new Scene(container)
  const audio = new Audio()
  let reduced = host.prefersReducedMotion()

  const session = createSession({
    nextQuestion: () => {
      try {
        return host.next()
      } catch (error) {
        console.error("[coil] the host could not serve a question", error)
        return null
      }
    },
    report: (r) => {
      host.report(r)
    },
    now: () => performance.now(),
    capacity: scene.layout.lane.capacity,
    transition: (kind, label) => {
      host.transition?.(kind, label)
    },
  })

  // Animated quantities. Every one of them is decayed in `frame`, and every one
  // of them is pinned at rest under reduced motion — which is why that setting
  // is a branch in one place rather than a second renderer.
  const fx = {
    aimPulse: 0,
    crackPulse: 0,
    seatPulse: 0,
    missPulse: 0,
    furnaceGlow: 0,
    shearPress: 0,
    whip: 0,
    hint: 0,
  }

  let flight: SceneState["flight"] = null
  let breaksThisRound = 0
  let lastInputAt = performance.now()
  let running = true
  let raf = 0
  let last = performance.now()
  let clock = 0

  // ------------------------------------------------------------------ input

  const linkAt = (px: number, py: number): number => {
    const lane = scene.layout.lane
    const board = session.board
    const cell = cellNear(lane, px, py, lane.capacity)
    if (cell < 0) return -1
    const index = buriedCount(board) + (cell - board.slag * SLAG_CELLS)
    if (index < buriedCount(board) || index > board.links.length - 1) return -1
    return index
  }

  const linkCentre = (index: number): { x: number; y: number } => {
    const lane = scene.layout.lane
    const cell = Math.max(
      0,
      Math.min(lane.capacity - 1, session.board.slag * SLAG_CELLS + (index - buriedCount(session.board))),
    )
    return cellAt(lane, cell)
  }

  // How fast `seatPulse` fades. Set from the tier's own budget, so a 260 ms
  // slip cannot linger on screen for as long as a 900 ms course.
  const decayFor = { current: 0.3 }

  const react = (tier: Tier): void => {
    const r = REACTIONS[tier]
    const scale = reduced ? 0 : 1
    switch (tier) {
      case "slip":
        fx.missPulse = 1
        fx.whip = 0.35 * scale
        break
      case "seat":
        fx.seatPulse = 1
        fx.whip = 0.5 * scale
        break
      case "engage":
        fx.seatPulse = 1
        fx.whip = 0.85 * scale
        break
      case "illuminate":
        fx.seatPulse = 1
        fx.whip = 1 * scale
        break
    }
    // The budget is honoured by the decay rate: a tier that owns 260 ms decays
    // four times faster than one that owns 900.
    decayFor.current = r.budgetMs / 1000
  }

  const commit = (): void => {
    const round = session.round
    if (!round || flight) return
    const preview = session.preview()
    const centre = linkCentre(session.board.cut)
    const outcome = session.commit()
    if (!outcome) return

    const closed = outcome.exact && session.exactCuts % COURSE === 0
    const tier = tierFor({ exact: outcome.exact, courseClosed: closed, breaks: breaksThisRound })
    react(tier)

    audio.shear()
    if (!reduced) audio.partition(preview.piece, preview.rest, 0.12)
    if (outcome.exact) {
      audio.seat()
      if (closed) audio.course()
      host.haptic(closed ? "heavy" : "success")
    } else {
      audio.slag()
      host.haptic("light")
    }

    flight = {
      links: preview.piece,
      exact: outcome.exact,
      fromX: centre.x,
      fromY: centre.y,
      t: 0,
    }
    if (!reduced) {
      if (outcome.exact) scene.burstSeat(centre.x, centre.y)
      else scene.burstSlag(centre.x, centre.y)
    }
    breaksThisRound = 0
  }

  const crack = (): void => {
    const centre = linkCentre(session.board.cut)
    if (!session.crack()) {
      // A bead cannot be cracked open. Nothing happens, quietly: a refusal that
      // makes a noise teaches a child to fear the control.
      return
    }
    breaksThisRound += 1
    fx.crackPulse = 1
    audio.crack(session.board.links[session.board.cut] as number)
    host.haptic("medium")
    if (!reduced) scene.burstCrack(centre.x, centre.y)
  }

  const stoke = (): void => {
    if (flight) return
    fx.furnaceGlow = 1
    audio.furnace()
    host.haptic("heavy")
    const f = scene.layout.furnace
    if (!reduced) scene.burstFurnace(f.x + f.w / 2, f.y)
    session.stoke()
    breaksThisRound = 0
    lastInputAt = performance.now()
    fx.hint = 0
  }

  let pointer = -1
  let downIndex = -1
  let movedIndex = -1
  let cutOnDown = -1
  let onShear = false

  const local = (e: PointerEvent): { x: number; y: number } => {
    const rect = scene.canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onDown = (e: PointerEvent): void => {
    if (pointer !== -1) return
    pointer = e.pointerId
    void audio.start()
    lastInputAt = performance.now()
    fx.hint = 0
    const { x, y } = local(e)

    if (inside(scene.layout.shear, x, y)) {
      onShear = true
      fx.shearPress = 1
      return
    }
    if (inside(scene.layout.furnace, x, y)) {
      stoke()
      return
    }
    const index = linkAt(x, y)
    if (index < 0) return
    cutOnDown = session.board.cut
    downIndex = index
    movedIndex = index
    session.aim(index)
    fx.aimPulse = 1
    if (index !== cutOnDown) audio.aim(session.board.links[index] as number)
  }

  const onMove = (e: PointerEvent): void => {
    if (e.pointerId !== pointer || onShear || downIndex < 0) return
    const { x, y } = local(e)
    const index = linkAt(x, y)
    if (index < 0 || index === movedIndex) return
    movedIndex = index
    session.aim(index)
    fx.aimPulse = 1
    audio.aim(session.board.links[session.board.cut] as number)
  }

  const onUp = (e: PointerEvent): void => {
    if (e.pointerId !== pointer) return
    pointer = -1
    if (onShear) {
      onShear = false
      const { x, y } = local(e)
      if (inside(scene.layout.shear, x, y)) commit()
      return
    }
    // A second tap on the link the jaws are already parked on cracks it open.
    // Aiming first is what makes that safe: there is no gesture that breaks a
    // link you were not already looking at.
    if (downIndex >= 0 && movedIndex === downIndex && cutOnDown === downIndex) crack()
    downIndex = -1
    movedIndex = -1
    cutOnDown = -1
  }

  const onCancel = (): void => {
    pointer = -1
    onShear = false
    downIndex = -1
    movedIndex = -1
    cutOnDown = -1
  }

  /** Keyboard, for a desk. Same three verbs, nothing extra. */
  const onKey = (e: KeyboardEvent): void => {
    const board = session.board
    lastInputAt = performance.now()
    fx.hint = 0
    switch (e.key) {
      case "ArrowLeft":
        session.aim(board.cut - 1)
        fx.aimPulse = 1
        break
      case "ArrowRight":
        session.aim(board.cut + 1)
        fx.aimPulse = 1
        break
      case "b":
      case "B":
        void audio.start()
        crack()
        break
      case "Enter":
      case " ":
        void audio.start()
        fx.shearPress = 1
        commit()
        break
      default:
        return
    }
    e.preventDefault()
  }

  scene.canvas.addEventListener("pointerdown", onDown)
  scene.canvas.addEventListener("pointermove", onMove)
  globalThis.addEventListener("pointerup", onUp)
  globalThis.addEventListener("pointercancel", onCancel)
  globalThis.addEventListener("keydown", onKey)

  const media =
    typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null
  const onMedia = (): void => {
    reduced = host.prefersReducedMotion()
  }
  media?.addEventListener("change", onMedia)

  const resize = (): void => {
    const l = scene.resize(container.clientWidth, container.clientHeight)
    session.resize(l.lane.capacity)
  }
  const observer =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          resize()
        })
      : null
  observer?.observe(container)
  globalThis.addEventListener("resize", resize)
  resize()

  // ------------------------------------------------------------------ frame

  const decay = (v: number, dt: number, seconds: number): number =>
    Math.max(0, v - dt / Math.max(0.05, seconds))

  const frame = (now: number): void => {
    if (!running) return
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
    last = now
    clock += dt

    fx.aimPulse = decay(fx.aimPulse, dt, 0.22)
    fx.crackPulse = decay(fx.crackPulse, dt, 0.36)
    fx.seatPulse = decay(fx.seatPulse, dt, decayFor.current)
    fx.missPulse = decay(fx.missPulse, dt, 0.26)
    fx.furnaceGlow = decay(fx.furnaceGlow, dt, 0.9)
    fx.shearPress = decay(fx.shearPress, dt, 0.12)
    fx.whip = decay(fx.whip, dt, reduced ? 0.001 : 0.5)
    if (!reduced) scene.particles.step(dt)

    if (flight) {
      flight.t += dt / (reduced ? 0.18 : 0.52)
      if (flight.t >= 1) {
        flight = null
        session.advance()
        breaksThisRound = 0
        lastInputAt = now
      }
    }

    // The hint arrives on its own after a long stillness, and only when the
    // demand actually costs a regrouping — telling a child the shape of a cut
    // they could already reach is noise, not help.
    const idle = now - lastInputAt
    const round = session.round
    const costly = round ? breaksNeeded(session.board.links, round.demand) > 0 : false
    fx.hint =
      idle > HINT_AFTER_MS && costly && !flight
        ? Math.min(1, fx.hint + dt * 1.4)
        : decay(fx.hint, dt, 0.4)

    const board = session.board
    const state: SceneState = {
      round,
      links: board.links,
      cut: board.cut,
      buried: buriedCount(board),
      slag: board.slag,
      ingot: round && round.mode === "fill" && round.ingot > 0 ? coilOf(round.ingot) : [],
      wall: session.wall,
      exactCuts: session.exactCuts,
      reduced,
      t: clock,
      aimPulse: reduced ? 0 : fx.aimPulse,
      crackPulse: reduced ? 0 : fx.crackPulse,
      seatPulse: fx.seatPulse,
      missPulse: fx.missPulse,
      furnaceGlow: fx.furnaceGlow,
      shearPress: fx.shearPress,
      whip: reduced ? 0 : fx.whip,
      hint: fx.hint,
      flight,
    }
    scene.draw(state)
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return {
    unmount(): void {
      running = false
      cancelAnimationFrame(raf)
      scene.canvas.removeEventListener("pointerdown", onDown)
      scene.canvas.removeEventListener("pointermove", onMove)
      globalThis.removeEventListener("pointerup", onUp)
      globalThis.removeEventListener("pointercancel", onCancel)
      globalThis.removeEventListener("keydown", onKey)
      globalThis.removeEventListener("resize", resize)
      observer?.disconnect()
      media?.removeEventListener("change", onMedia)
      audio.dispose()
      scene.destroy()
      container.remove()
    },
  }
}
