import type { FacadeSpec } from "./facadePaint"
import type { PaintRequest, PaintResult } from "./painter.worker"

/**
 * world/facadePainter.ts — the main-thread side of the OffscreenCanvas façade
 * painter (Stage 3). Owns ONE Web Worker for the whole city; `paintFacade`
 * returns a Promise<ImageBitmap> the caller uploads into a texture. The painting
 * runs in the worker — the main thread only does the cheap GPU upload.
 *
 * FEATURE-DETECTED, with a clean fallback. If the WebView lacks OffscreenCanvas,
 * module workers, `transferToImageBitmap`, or `transferControlToOffscreen`-class
 * support (older WKWebView < iOS 16.4), `supported` is false and the caller
 * paints on the main thread exactly as before. We NEVER hard-depend on the worker.
 *
 * The worker is created lazily on first use so a city that never paints a façade
 * (or a non-supporting WebView) spins up nothing.
 */

/** Feature-detect the whole worker+OffscreenCanvas+ImageBitmap path. */
export function offscreenPaintSupported(): boolean {
  try {
    if (typeof Worker === "undefined") return false
    if (typeof OffscreenCanvas === "undefined") return false
    // need transferToImageBitmap (the zero-copy hand-off the worker uses).
    const probe = new OffscreenCanvas(1, 1)
    if (typeof probe.getContext !== "function") return false
    if (typeof (probe as unknown as { transferToImageBitmap?: unknown }).transferToImageBitmap !== "function")
      return false
    if (typeof createImageBitmap === "undefined") return false
    return true
  } catch {
    return false
  }
}

export interface FacadePainter {
  /** true when the off-thread path is live (else the caller paints main-thread). */
  readonly supported: boolean
  /** paint a façade off-thread; resolves to a bitmap, or null on any failure
   *  (caller then falls back to a main-thread paint). */
  paintFacade: (w: number, h: number, spec: FacadeSpec) => Promise<ImageBitmap | null>
  dispose: () => void
}

/**
 * Create the city's façade painter. `supported` reflects the live feature check;
 * when false, `paintFacade` always resolves null so the caller paints inline.
 */
export function createFacadePainter(): FacadePainter {
  const supported = offscreenPaintSupported()
  let worker: Worker | null = null
  let nextId = 1
  const pending = new Map<number, (r: ImageBitmap | null) => void>()
  let broken = false // a worker error trips this → permanent main-thread fallback.

  const ensureWorker = (): Worker | null => {
    if (broken) return null
    if (worker) return worker
    try {
      // Vite worker support: bundles painter.worker.ts as a module worker.
      worker = new Worker(new URL("./painter.worker.ts", import.meta.url), { type: "module" })
      worker.onmessage = (ev: MessageEvent<PaintResult & { bitmap: ImageBitmap | null }>) => {
        const { id, bitmap } = ev.data
        const resolve = pending.get(id)
        if (resolve) {
          pending.delete(id)
          resolve(bitmap ?? null)
        }
      }
      worker.onerror = (e) => {
        // NOISY (per repo rule — never swallow): log, then fall back forever.
        console.error("[world-plaza/facadePainter] worker error → main-thread fallback", e.message || e)
        broken = true
        // reject every in-flight paint to null so callers fall back.
        for (const [, resolve] of pending) resolve(null)
        pending.clear()
        try {
          worker?.terminate()
        } catch {
          /* already gone */
        }
        worker = null
      }
    } catch (e) {
      console.error("[world-plaza/facadePainter] worker init failed → main-thread fallback", e)
      broken = true
      worker = null
    }
    return worker
  }

  const paintFacade = (w: number, h: number, spec: FacadeSpec): Promise<ImageBitmap | null> => {
    if (!supported) return Promise.resolve(null)
    const wk = ensureWorker()
    if (!wk) return Promise.resolve(null)
    const id = nextId++
    return new Promise<ImageBitmap | null>((resolve) => {
      pending.set(id, resolve)
      const req: PaintRequest = { id, w, h, spec }
      try {
        wk.postMessage(req)
      } catch (e) {
        console.error("[world-plaza/facadePainter] postMessage failed → main-thread fallback", e)
        pending.delete(id)
        resolve(null)
      }
    })
  }

  return {
    supported,
    paintFacade,
    dispose: () => {
      for (const [, resolve] of pending) resolve(null)
      pending.clear()
      try {
        worker?.terminate()
      } catch {
        /* already gone */
      }
      worker = null
    },
  }
}
