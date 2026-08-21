// Linear view. Left to right, one cycle across the width, playhead sweeping.
// The default view. Renders whichever notation mode is active (bars or dots).

import type { Cycle } from "../core"
import { activeAt, type ActivePosition } from "../core"
import { barsModel, dotsModel } from "../notation"
import { THEME, roleColor } from "../theme"
import type { Clock } from "../audio"
import { useCanvasScene } from "./useCanvasScene"
import { roundedRect, withAlpha } from "./paint"
import { barLabel, type LabelMode, type NotationMode } from "./types"

type Geom = {
  padX: number
  usableW: number
  bandTop: number
  bandH: number
}

type Props = {
  cycle: Cycle
  clock: Clock
  labelMode: LabelMode
  notationMode: NotationMode
}

const PAD_X = 28
const BAND_RATIO = 0.62

export function LinearView({ cycle, clock, labelMode, notationMode }: Props) {
  const canvasRef = useCanvasScene((ctx, W, H) => {
    const bandH = H * BAND_RATIO
    const geom: Geom = {
      padX: PAD_X,
      usableW: Math.max(0, W - PAD_X * 2),
      bandTop: (H - bandH) / 2,
      bandH,
    }

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = THEME.ground
    ctx.fillRect(0, 0, W, H)

    if (cycle.groups.length === 0) {
      ctx.fillStyle = THEME.textDim
      ctx.font = `500 ${Math.round(H * 0.11)}px "Spline Sans", system-ui, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("Add a group to begin", W / 2, H / 2)
      return
    }

    const active = activeAt(clock.positionPulses(), cycle)
    if (notationMode === "dots") {
      drawDots(ctx, cycle, active, geom)
    } else {
      drawBars(ctx, cycle, active, labelMode, geom)
    }
  })

  return <canvas ref={canvasRef} className="kp-canvas" />
}

function drawBars(
  ctx: CanvasRenderingContext2D,
  c: Cycle,
  active: ActivePosition | null,
  labelMode: LabelMode,
  geom: Geom,
) {
  const { padX, usableW, bandTop, bandH } = geom
  const model = barsModel(c)
  const x = (frac: number) => padX + frac * usableW
  const radius = Math.min(bandH / 3, usableW / model.groups.length / 2)
  const gap = 4

  for (const g of model.groups) {
    const gx = x(g.startFraction) + gap / 2
    const gw = g.widthFraction * usableW - gap
    const color = roleColor(g.role)
    const isActive = active !== null && active.groupIndex === g.index

    roundedRect(ctx, gx, bandTop, Math.max(0, gw), bandH, radius)
    ctx.fillStyle = withAlpha(color, isActive ? 0.32 : 0.16)
    ctx.fill()
    ctx.lineWidth = isActive ? 3 : 2
    ctx.strokeStyle = withAlpha(color, isActive ? 1 : 0.85)
    ctx.stroke()

    ctx.fillStyle = color
    ctx.font = `600 ${Math.round(bandH * 0.44)}px "Fraunces", Georgia, serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(barLabel(g.length, labelMode), gx + Math.max(0, gw) / 2, bandTop + bandH / 2)
  }

  ctx.lineWidth = 1
  ctx.strokeStyle = THEME.hairline
  for (const f of model.hairlines) {
    const hx = x(f)
    ctx.beginPath()
    ctx.moveTo(hx, bandTop + bandH * 0.16)
    ctx.lineTo(hx, bandTop + bandH * 0.84)
    ctx.stroke()
  }

  if (active !== null) {
    const px = x(active.phaseFraction)
    ctx.save()
    ctx.shadowColor = THEME.playhead
    ctx.shadowBlur = 16
    ctx.strokeStyle = THEME.playhead
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(px, bandTop - 10)
    ctx.lineTo(px, bandTop + bandH + 10)
    ctx.stroke()
    ctx.restore()

    ctx.fillStyle = THEME.playhead
    ctx.beginPath()
    ctx.moveTo(px, bandTop - 10)
    ctx.lineTo(px - 6, bandTop - 20)
    ctx.lineTo(px + 6, bandTop - 20)
    ctx.closePath()
    ctx.fill()
  }
}

function drawDots(
  ctx: CanvasRenderingContext2D,
  c: Cycle,
  active: ActivePosition | null,
  geom: Geom,
) {
  const { padX, usableW, bandTop, bandH } = geom
  const model = dotsModel(c)
  const cy = bandTop + bandH / 2
  const pxPerUnit = model.span > 0 ? usableW / model.span : usableW
  const r = Math.max(4, Math.min(bandH * 0.3, pxPerUnit * 0.36))
  const drawW = Math.max(0, usableW - 2 * r)
  const x = (pos: number) =>
    model.span > 0 ? padX + r + (pos / model.span) * drawW : padX + usableW / 2

  for (const d of model.dots) {
    const dx = x(d.pos)
    const color = roleColor(d.role)
    const isActive = active !== null && active.pulseIndex === d.pulseIndex

    ctx.beginPath()
    ctx.arc(dx, cy, isActive ? r * 1.15 : r, 0, Math.PI * 2)
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
