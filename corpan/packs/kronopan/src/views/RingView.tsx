// Ring view. The cycle wrapped into an annulus with a needle fixed at twelve
// o'clock and the disc rotating under it, turntable posture. The ring is what
// makes the cyclicity obvious. Under reduced motion the disc holds still and a
// marker sweeps instead, since the playhead is content, not decoration.

import type { Cycle } from "../core"
import { activeAt, collapsedSignature, pulseMarks } from "../core"
import { barsModel, dotsModel, CLUSTER_STEP } from "../notation"
import { THEME, roleColor } from "../theme"
import type { Clock } from "../audio"
import { useCanvasScene } from "./useCanvasScene"
import { polar, withAlpha, prefersReducedMotion, drawStars, TOP } from "./paint"
import { barLabel, type LabelMode, type NotationMode } from "./types"

const TAU = Math.PI * 2

type Props = {
  cycle: Cycle
  clock: Clock
  labelMode: LabelMode
  notationMode: NotationMode
}

export function RingView({ cycle, clock, labelMode, notationMode }: Props) {
  const canvasRef = useCanvasScene((ctx, W, H) => {
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = THEME.ground
    ctx.fillRect(0, 0, W, H)
    if (THEME.sparkle) drawStars(ctx, W, H, THEME.text)

    const cx = W / 2
    const cy = H / 2
    const outerR = Math.min(W, H) * 0.42
    const ringW = outerR * 0.3
    const innerR = outerR - ringW
    const midR = (outerR + innerR) / 2

    if (cycle.groups.length === 0) {
      ctx.fillStyle = THEME.textDim
      ctx.font = `500 ${Math.round(H * 0.06)}px "Spline Sans", system-ui, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("Add a group to begin", cx, cy)
      return
    }

    const active = activeAt(clock.positionPulses(), cycle)
    const phase = active ? active.phaseFraction : 0
    const reduced = prefersReducedMotion()
    // Rotate the disc so the current pulse sits under the top needle. Reduced
    // motion keeps the disc still (rot 0) and moves a marker instead.
    const rot = reduced ? 0 : -phase * TAU
    // World angle of a cycle-fraction f, with the disc rotation baked in so
    // labels can be drawn upright rather than spinning.
    const wa = (f: number) => TOP + f * TAU + rot

    if (notationMode === "dots") {
      drawRingDots(ctx, cycle, active, cx, cy, midR, ringW, wa)
    } else {
      drawRingBars(ctx, cycle, active, labelMode, cx, cy, innerR, outerR, midR, wa)
    }

    // Center hub with the collapsed signature, a calm focal point.
    ctx.fillStyle = THEME.panel
    ctx.beginPath()
    ctx.arc(cx, cy, innerR * 0.62, 0, TAU)
    ctx.fill()
    ctx.fillStyle = THEME.text
    ctx.font = `600 ${Math.round(innerR * 0.42)}px "Fraunces", Georgia, serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(collapsedSignature(cycle), cx, cy)

    // Fixed needle at twelve o'clock.
    drawNeedle(ctx, cx, cy, outerR)

    // Reduced motion: the sweeping now-marker, since the disc is not turning.
    if (reduced && active) {
      const a = TOP + phase * TAU
      const p1 = polar(cx, cy, innerR - 4, a)
      const p2 = polar(cx, cy, outerR + 8, a)
      ctx.strokeStyle = THEME.playhead
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.stroke()
    }
  })

  return <canvas ref={canvasRef} className="kp-canvas" />
}

function drawRingBars(
  ctx: CanvasRenderingContext2D,
  c: Cycle,
  active: ReturnType<typeof activeAt>,
  labelMode: LabelMode,
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  midR: number,
  wa: (f: number) => number,
) {
  const model = barsModel(c)
  const gap = 0.012 * TAU // small angular gap between arcs

  for (const g of model.groups) {
    const a0 = wa(g.startFraction) + gap / 2
    const a1 = wa(g.startFraction + g.widthFraction) - gap / 2
    const color = roleColor(g.role)
    const isActive = active !== null && active.groupIndex === g.index

    ctx.beginPath()
    ctx.arc(cx, cy, outerR, a0, a1)
    ctx.arc(cx, cy, innerR, a1, a0, true)
    ctx.closePath()
    ctx.fillStyle = withAlpha(color, isActive ? 0.34 : 0.16)
    ctx.fill()
    ctx.lineWidth = isActive ? 3 : 2
    ctx.strokeStyle = withAlpha(color, isActive ? 1 : 0.85)
    ctx.stroke()

    // Upright label at the arc middle.
    const mid = wa(g.startFraction + g.widthFraction / 2)
    const lp = polar(cx, cy, midR, mid)
    ctx.fillStyle = color
    ctx.font = `600 ${Math.round((outerR - innerR) * 0.5)}px "Fraunces", Georgia, serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(barLabel(g.length, labelMode), lp.x, lp.y)
  }

  // Faint pulse hairlines at interior divisions.
  ctx.strokeStyle = THEME.hairline
  ctx.lineWidth = 1
  for (const m of pulseMarks(c)) {
    if (m.isGroupHead) continue
    const a = wa(m.startFraction)
    const p1 = polar(cx, cy, innerR + 3, a)
    const p2 = polar(cx, cy, outerR - 3, a)
    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.stroke()
  }
}

function drawRingDots(
  ctx: CanvasRenderingContext2D,
  c: Cycle,
  active: ReturnType<typeof activeAt>,
  cx: number,
  cy: number,
  midR: number,
  ringW: number,
  wa: (f: number) => number,
) {
  const model = dotsModel(c)
  // Leave one cluster-step of gap for the wrap between the last and first dot so
  // the ring is not seamless at the top.
  const span = model.span + CLUSTER_STEP
  const r = Math.max(4, Math.min(ringW * 0.32, (midR * TAU) / span / 2.4))

  for (const d of model.dots) {
    const a = wa(span > 0 ? d.pos / span : 0)
    const p = polar(cx, cy, midR, a)
    const color = roleColor(d.role)
    const isActive = active !== null && active.pulseIndex === d.pulseIndex

    ctx.beginPath()
    ctx.arc(p.x, p.y, isActive ? r * 1.2 : r, 0, TAU)
    if (isActive) {
      ctx.save()
      ctx.shadowColor = color
      ctx.shadowBlur = 22
      ctx.fillStyle = color
      ctx.fill()
      ctx.restore()
    } else {
      ctx.fillStyle = withAlpha(color, 0.16)
      ctx.fill()
    }
    ctx.lineWidth = isActive ? 3 : 2
    ctx.strokeStyle = withAlpha(color, isActive ? 1 : 0.8)
    ctx.stroke()
  }
}

function drawNeedle(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number) {
  const tipY = cy - outerR - 2
  const baseY = cy - outerR + 16
  ctx.save()
  ctx.fillStyle = THEME.playhead
  ctx.shadowColor = THEME.playhead
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.moveTo(cx, tipY + 14)
  ctx.lineTo(cx - 9, baseY + 4)
  ctx.lineTo(cx + 9, baseY + 4)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
