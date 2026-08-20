// Linear view, bars mode. Left to right, one cycle across the width, playhead
// sweeping. This is the default view.
//
// The animation runs on requestAnimationFrame and reads the audio clock every
// frame, writing straight to a 2D canvas. It never drives motion from React
// state and never uses a CSS transition for the playhead, because neither is
// synchronized to the audio clock. Cycle edits arrive through a ref, so the loop
// picks them up without being torn down and restarted.

import { useEffect, useRef } from "react"
import type { Cycle } from "../core"
import { activeAt } from "../core"
import { barsModel } from "../notation"
import { THEME, roleColor } from "../theme"
import type { Clock } from "../audio"

type Props = {
  cycle: Cycle
  clock: Clock
}

const PAD_X = 28
const BAND_RATIO = 0.62 // band height as a fraction of canvas height

export function LinearView({ cycle, clock }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cycleRef = useRef(cycle)
  cycleRef.current = cycle

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
      const usableW = Math.max(0, W - PAD_X * 2)
      const bandH = H * BAND_RATIO
      const bandTop = (H - bandH) / 2

      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = THEME.ground
      ctx.fillRect(0, 0, W, H)

      const model = barsModel(c)
      if (model.groups.length === 0) {
        ctx.fillStyle = THEME.textDim
        ctx.font = `500 ${Math.round(H * 0.11)}px "Spline Sans", system-ui, sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText("Add a group to begin", W / 2, H / 2)
        raf = requestAnimationFrame(draw)
        return
      }

      const active = activeAt(clock.positionPulses(), c)
      const x = (frac: number) => PAD_X + frac * usableW
      const radius = Math.min(bandH / 3, (usableW / model.groups.length) / 2)
      const gap = 4

      // Bars.
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

        // Group length digit, large enough to read across a room.
        ctx.fillStyle = color
        ctx.font = `600 ${Math.round(bandH * 0.44)}px "Fraunces", Georgia, serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(String(g.length), gx + Math.max(0, gw) / 2, bandTop + bandH / 2)
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

        // A downbeat pip so the top of the cycle is unmistakable.
        ctx.fillStyle = THEME.playhead
        ctx.beginPath()
        ctx.moveTo(px, bandTop - 10)
        ctx.lineTo(px - 6, bandTop - 20)
        ctx.lineTo(px + 6, bandTop - 20)
        ctx.closePath()
        ctx.fill()
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
