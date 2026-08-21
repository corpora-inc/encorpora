// Spiral view. A vinyl groove: the cycle starts as a small circle near the
// center and winds outward, one turn per cycle, lighting up as it plays. When it
// reaches the rim it resets to the center.
//
// The turns are kept few and wide so each loop is visibly larger than the last
// and the motion reads as a spiral rather than a point circling a ring. The
// groove is drawn as a continuous line so the spiral shape is unmistakable, with
// the pattern shown as colored pulse dots laid along it.

import type { Cycle } from "../core"
import { activeAt, pulseMarks, totalPulses } from "../core"
import { colorRoleForLength } from "../notation"
import { THEME, roleColor } from "../theme"
import type { Clock } from "../audio"
import { useCanvasScene } from "./useCanvasScene"
import { polar, withAlpha, prefersReducedMotion, drawStars, TOP } from "./paint"

const TAU = Math.PI * 2

// Turns from the center to the rim before the groove resets. Few and wide, so
// the outward spiral is obvious. Tunable to taste.
const TURNS = 6

type Props = {
  cycle: Cycle
  clock: Clock
  // When true the groove spins like a record under a fixed top playhead; when
  // false the groove stays put and the playhead travels along it.
  spin?: boolean
}

export function SpiralView({ cycle, clock, spin = false }: Props) {
  const canvasRef = useCanvasScene((ctx, W, H) => {
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = THEME.ground
    ctx.fillRect(0, 0, W, H)
    if (THEME.sparkle) drawStars(ctx, W, H, THEME.text)

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
    // Progress within the current outward run, resetting to the center at TURNS.
    const run = ((cyclesElapsed % TURNS) + TURNS) % TURNS

    const minDim = Math.min(W, H)
    const r0 = minDim * 0.08
    const rMax = minDim * 0.46
    const radialStep = (rMax - r0) / TURNS

    // In spin mode, rotate so the current position sits under the top and the
    // whole groove turns beneath it, the playhead climbing outward from the
    // center like a record. Reduced motion (or the static Spiral view) keeps the
    // groove still and lets the playhead travel along it.
    const reduced = prefersReducedMotion()
    const rot = spin && !reduced ? -run * TAU : 0
    const spiral = (c: number) => {
      const a = TOP + c * TAU + rot
      const rr = r0 + c * radialStep
      return polar(cx, cy, rr, a)
    }

    // 1) Faint full-run guide so the shape is anticipated.
    strokeSpiral(ctx, spiral, 0, TURNS, withAlpha(THEME.text, 0.05), 1)

    // 2) The groove laid down so far, brighter, a soft warm line.
    strokeSpiral(ctx, spiral, 0, run, withAlpha(THEME.accent, 0.4), Math.max(2, radialStep * 0.12))

    // 3) Pulse dots along the played groove, colored by group length, brighter
    // toward the playhead. The active pulse blooms.
    const marks = pulseMarks(cycle)
    const dotR = Math.max(3, Math.min(radialStep * 0.22, 12))
    const currentTurn = Math.floor(run)
    const active = activeAt(position, cycle)

    for (let k = 0; k <= currentTurn; k++) {
      for (const m of marks) {
        const c = k + m.startFraction
        if (c > run) break
        const p = spiral(c)
        const color = roleColor(colorRoleForLength(cycle.groups[m.groupIndex]))
        const isActive = active !== null && k === currentTurn && m.index === active.pulseIndex

        if (isActive) {
          ctx.save()
          ctx.shadowColor = color
          ctx.shadowBlur = 26
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(p.x, p.y, dotR * 1.7, 0, TAU)
          ctx.fill()
          ctx.restore()
        } else {
          const behind = run - c
          const bright = Math.max(0.18, 1 - behind / TURNS)
          ctx.fillStyle = withAlpha(color, 0.3 + 0.6 * bright)
          ctx.beginPath()
          ctx.arc(p.x, p.y, dotR, 0, TAU)
          ctx.fill()
        }
      }
    }

    // Center hub.
    ctx.fillStyle = THEME.panel
    ctx.beginPath()
    ctx.arc(cx, cy, r0 * 0.6, 0, TAU)
    ctx.fill()
  })

  return <canvas ref={canvasRef} className="kp-canvas" />
}

// Stroke the spiral between two cycle-progress values by sampling points along
// it. Fine enough steps keep the curve smooth even on the wide outer turns.
function strokeSpiral(
  ctx: CanvasRenderingContext2D,
  spiral: (c: number) => { x: number; y: number },
  from: number,
  to: number,
  color: string,
  width: number,
) {
  if (to <= from) return
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = "round"
  ctx.beginPath()
  const step = 0.01
  let first = true
  for (let c = from; c <= to; c += step) {
    const p = spiral(c)
    if (first) {
      ctx.moveTo(p.x, p.y)
      first = false
    } else {
      ctx.lineTo(p.x, p.y)
    }
  }
  const end = spiral(to)
  ctx.lineTo(end.x, end.y)
  ctx.stroke()
}
