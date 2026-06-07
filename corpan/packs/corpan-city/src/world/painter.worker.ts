/// <reference lib="webworker" />
/**
 * world/painter.worker.ts — the OffscreenCanvas façade PAINTER worker (Stage 3).
 *
 * The main thread posts a `FacadeSpec` + canvas size; this worker paints the
 * façade into an `OffscreenCanvas` (off the main thread, so the paint never
 * blocks a frame), rasterises it to an `ImageBitmap`, and TRANSFERS that bitmap
 * back. The main thread does only the cheap GPU upload (drawImage into a texture
 * + update), never the canvas2D paint — this is what kills the remaining startup
 * spike and buys mobile headroom.
 *
 * The painter itself is the SAME pure `drawFacade` the main-thread fallback uses
 * (facadePaint.ts), so a worker-painted façade is pixel-identical to a
 * main-thread-painted one.
 */
import { drawFacade, type FacadeSpec } from "./facadePaint"

export interface PaintRequest {
  id: number
  w: number
  h: number
  spec: FacadeSpec
}
export interface PaintResult {
  id: number
  bitmap: ImageBitmap
}

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope

ctx.onmessage = (ev: MessageEvent<PaintRequest>) => {
  const { id, w, h, spec } = ev.data
  // paint into an OffscreenCanvas (worker-side, never touches the main thread).
  const canvas = new OffscreenCanvas(w, h)
  const c2d = canvas.getContext("2d")
  if (!c2d) {
    // can't paint here → tell the main thread to fall back (no bitmap).
    ctx.postMessage({ id, bitmap: null })
    return
  }
  c2d.clearRect(0, 0, w, h)
  drawFacade(c2d, w, h, spec)
  const bitmap = canvas.transferToImageBitmap()
  // transfer the bitmap (zero-copy) back to the main thread.
  ctx.postMessage({ id, bitmap } as PaintResult, [bitmap])
}
