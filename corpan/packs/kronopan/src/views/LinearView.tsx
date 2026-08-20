// Linear view. Left to right, one cycle across the width, playhead sweeping.
// This is the default view. It renders whichever notation mode is active (bars
// or dots) and reads the audio clock every animation frame, writing straight to
// a 2D canvas. Motion is never driven from React state and never from a CSS
// transition, because neither is synchronized to the audio clock. The cycle,
// label mode, and notation mode arrive through refs so a change does not tear
// down and restart the loop, and switching notation never perturbs the clock.

import { useEffect, useRef } from "react"
import type { Cycle } from "../core"
import { activeAt, type ActivePosition } from "../core"
import { barsModel, dotsModel } from "../notation"
import { THEME, roleColor } from "../theme"
import type { Clock } from "../audio"

// Whether bars are labeled with the group length or the short-long letter (a 2
// is short, a 3 is long). Dots mode is numberless by nature and ignores this.
export type LabelMode = "number" | "shortlong"

// Which notation is drawn. Both read the same geometry.
export type NotationMode = "bars" | "dots"

const barLabel = (length: number, mode: LabelMode): string => {
  if (mode === "number") return String(length)
  if (length === 2) return "S"
  if (length === 3) return "L"
  return String(length)
}

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
const BAND_RATIO = 0.62 // band height as a fraction of canvas height

export function LinearView({ cycle, clock, labelMode, notationMode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cycleRef = useRef(cycle)
  cycleRef.current = cycle
  const labelRef = useRef(labelMode)
  labelRef.current = labelMode
  const modeRef = useRef(notationMode)
  modeRef.current = notationMode

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf = 0
    let widthCss = 0
    let heightCss = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      const rect = canvas.getBoundingClientRect()
      widthCss = rect.width
      heightCss = rect.height
      canvas.width = Math.round(widthCss * dpr)
      canvas.height = Math.round(heightCss * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const draw = () => {
      const c = cycleRef.current
      const W = widthCss
      const H = heightCss
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

      if (c.groups.length === 0) {
        ctx.fillStyle = THEME.textDim
        ctx.font = `500 ${Math.round(H * 0.11)}px "Spline Sans", system-ui, sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText("Add a group to begin", W / 2, H / 2)
        raf = requestAnimationFrame(draw)
        return
      }

      const active = activeAt(clock.positionPulses(), c)
      if (modeRef.current === "dots") {
        drawDots(ctx, c, active, geom)
      } else {
        drawBars(ctx, c, active, labelRef.current, geom)
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [clock])

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

  // Interior pulse hairlines.
  ctx.lineWidth = 1
  ctx.strokeStyle = THEME.hairline
  for (const f of model.hairlines) {
    const hx = x(f)
    ctx.beginPath()
    ctx.moveTo(hx, bandTop + bandH * 0.16)
    ctx.lineTo(hx, bandTop + bandH * 0.84)
    ctx.stroke()
  }

  // Playhead.
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
  // Keep dots clear of each other: the within-cluster step is one unit wide.
  const pxPerUnit = model.span > 0 ? usableW / model.span : usableW
  const r = Math.max(4, Math.min(bandH * 0.3, pxPerUnit * 0.36))
  // Inset the row by one radius on each side so the first and last dots do not
  // spill past the edges of the canvas.
  const drawW = Math.max(0, usableW - 2 * r)
  const x = (pos: number) =>
    model.span > 0 ? padX + r + (pos / model.span) * drawW : padX + usableW / 2

  for (const d of model.dots) {
    const dx = x(d.pos)
    const color = roleColor(d.role)
    // The active dot fills on its hit; that filled dot is the playhead in this
    // mode, so there is no separate sweeping line.
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

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

// Expand a #rrggbb color to rgba with the given alpha.
function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
