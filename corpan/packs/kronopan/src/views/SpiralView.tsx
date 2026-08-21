// Spiral view. A vinyl groove: the cycle starts as a small circle near the
// center and winds outward, one turn per cycle, lighting up as it plays. When it
// reaches the rim it resets to the center. The groove fills as the pattern
// repeats, so a class can watch the rhythm accumulate.

import type { Cycle } from "../core"
import { activeAt, pulseMarks, totalPulses } from "../core"
import { colorRoleForLength } from "../notation"
import { THEME, roleColor } from "../theme"
import type { Clock } from "../audio"
import { useCanvasScene } from "./useCanvasScene"
import { polar, withAlpha, TOP } from "./paint"

const TAU = Math.PI * 2

// How many cycles the groove winds outward before it resets to the center. A
// higher number is a tighter, longer-filling groove. Tunable to taste.
const RESET_CYCLES = 16

type Props = {
  cycle: Cycle
  clock: Clock
}

export function SpiralView({ cycle, clock }: Props) {
  const canvasRef = useCanvasScene((ctx, W, H) => {
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = THEME.ground
    ctx.fillRect(0, 0, W, H)

    const cx = W / 2
    const cy = H / 2

    if (cycle.groups.length === 0) {
      ctx.fillStyle = THEME.textDim
      ctx.font = `500 ${Math.round(H * 0.06)}px "Spline Sans", system-ui, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("Add a group to begin", cx, cy)
      return
    }

    const total = totalPulses(cycle)
    const position = clock.positionPulses()
    const cyclesElapsed = position / total
    // Progress within the current outward run, resetting to the center every
    // RESET_CYCLES cycles.
    const run = ((cyclesElapsed % RESET_CYCLES) + RESET_CYCLES) % RESET_CYCLES

    const minDim = Math.min(W, H)
    const r0 = minDim * 0.06
    const rMax = minDim * 0.46
    const radialStep = (rMax - r0) / RESET_CYCLES

    // Point on the groove at cycle-progress c (turns from the center).
    const spiral = (c: number) => {
      const a = TOP + c * TAU
      const rr = r0 + c * radialStep
      return polar(cx, cy, rr, a)
    }

    // Faint guide for the whole run so the shape is anticipated.
    ctx.strokeStyle = withAlpha(THEME.text, 0.05)
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let c = 0; c <= RESET_CYCLES; c += 0.02) {
      const p = spiral(c)
      if (c === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    }
    ctx.stroke()

    // Pulse marks along the played part of the groove, colored by group length,
    // brighter toward the playhead so the recent turns glow and older ones fade.
    const marks = pulseMarks(cycle)
    const dotR = Math.max(2.5, Math.min(radialStep * 0.34, 9))
    const currentTurn = Math.floor(run)
    const activePulse = activeAt(position, cycle)

    for (let k = 0; k <= currentTurn; k++) {
      for (const m of marks) {
        const c = k + m.startFraction
        if (c > run) break
        const p = spiral(c)
        const color = roleColor(colorRoleForLength(cycle.groups[m.groupIndex]))
        const isActive =
          activePulse !== null && k === currentTurn && m.index === activePulse.pulseIndex

        if (isActive) {
          ctx.save()
          ctx.shadowColor = color
          ctx.shadowBlur = 22
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(p.x, p.y, dotR * 1.7, 0, TAU)
          ctx.fill()
          ctx.restore()
        } else {
          // Fade with distance behind the playhead.
          const trail = run > 0 ? Math.max(0.12, 1 - (run - c) / RESET_CYCLES) : 1
          ctx.fillStyle = withAlpha(color, 0.25 + 0.55 * trail)
          ctx.beginPath()
          ctx.arc(p.x, p.y, dotR, 0, TAU)
          ctx.fill()
        }
      }
    }

    // Center hub.
    ctx.fillStyle = THEME.panel
    ctx.beginPath()
    ctx.arc(cx, cy, r0 * 0.7, 0, TAU)
    ctx.fill()
  })

  return <canvas ref={canvasRef} className="kp-canvas" />
}
