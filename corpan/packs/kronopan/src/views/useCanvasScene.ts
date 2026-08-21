// A hook that owns the canvas boilerplate shared by every view: device-pixel
// scaling, resize observation, and a requestAnimationFrame loop. The view passes
// a draw function; the hook always calls the latest one (kept in a ref) so the
// loop reads fresh props each frame without being torn down and restarted. This
// is the pattern the whole pack uses: the audio clock is read inside draw every
// frame, never mirrored into React state.

import { useEffect, useRef } from "react"

export type SceneDraw = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void

export function useCanvasScene(draw: SceneDraw) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)
  drawRef.current = draw

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf = 0
    let width = 0
    let height = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const frame = () => {
      drawRef.current(ctx, width, height)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return canvasRef
}
