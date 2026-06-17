/**
 * LiquidController — the boundary between the React game and the Canvas-2D
 * liquid renderer. The game calls this imperatively; React MUST NOT drive liquid
 * frames (the stage runs its own requestAnimationFrame loop).
 *
 * This module is a thin, environment-safe facade. The `LiquidStage` is loaded
 * LAZILY (dynamic import) only when we actually have a real DOM with a 2D canvas
 * context. Under tests (happy-dom) or SSR we stay a pure no-op. Every method is
 * safe to call before/after the stage is ready or after dispose().
 */

export interface LiquidController {
  /** Create the Canvas-2D liquid canvas inside `canvasParent`. */
  mount(canvasParent: HTMLElement): void
  /** Set the current fruit's 3-stop gradient (top→mid→bottom). */
  setColor(gradient: [string, string, string]): void
  /** Set the fill height 0..1 (optionally animated). */
  setFill(level01: number, opts?: { animate?: boolean }): void
  /** Satisfying pour + splash + liquid jump + bloom flash + droplets. */
  triggerWin(): void
  /** Bigger overflow + celebratory burst (on the 10th phrase / bottle complete). */
  triggerBottleComplete(): void
  /** Re-read the parent size and resize the renderer. */
  resize(): void
  /** Tear down the canvas + rAF loop fully (no leak). */
  dispose(): void
}

// The subset of the stage we drive. Kept structurally identical to the public
// API so the facade can forward 1:1 once the stage resolves.
type Stage = {
  setColor(gradient: [string, string, string]): void
  setFill(level01: number, opts?: { animate?: boolean }): void
  triggerWin(): void
  triggerBottleComplete(): void
  resize(): void
  dispose(): void
}

/**
 * True only in a real DOM that can give us a 2D canvas context (not SSR; not
 * happy-dom, whose stub canvas yields a null 2d context). Canvas 2D works in any
 * real browser, so this is essentially "are we in a real DOM" — no WebGL probe.
 */
function canRenderLiquid(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false
  try {
    const probe = document.createElement("canvas")
    return !!probe.getContext("2d")
  } catch {
    return false
  }
}

class LiquidControllerImpl implements LiquidController {
  private stage: Stage | null = null
  private parent: HTMLElement | null = null
  private disposed = false

  // Queue the latest desired state so calls made before the stage resolves
  // (the dynamic import is async) aren't lost — we replay them on attach.
  private pendingColor: [string, string, string] | null = null
  private pendingFill: { level01: number; animate?: boolean } | null = null

  mount(canvasParent: HTMLElement): void {
    this.parent = canvasParent
    this.disposed = false
    if (!canRenderLiquid()) {
      console.log("[juice-squeeze-fire] liquid mount skipped (no 2d canvas)")
      return
    }
    // Lazy-load the stage so the no-canvas path never pulls it in.
    void import("./LiquidStage")
      .then(({ createLiquidStage }) => {
        if (this.disposed || !this.parent) return
        this.stage = createLiquidStage(this.parent)
        // Replay any state set before the stage was ready.
        if (this.pendingColor) this.stage.setColor(this.pendingColor)
        if (this.pendingFill)
          this.stage.setFill(this.pendingFill.level01, { animate: false })
        console.log("[juice-squeeze-fire] liquid mounted")
      })
      .catch((err) => {
        console.warn("[juice-squeeze-fire] liquid stage failed to load", err)
      })
  }

  setColor(gradient: [string, string, string]): void {
    this.pendingColor = gradient
    this.stage?.setColor(gradient)
  }

  setFill(level01: number, opts?: { animate?: boolean }): void {
    const lvl = Math.max(0, Math.min(1, level01))
    this.pendingFill = { level01: lvl, animate: opts?.animate }
    console.log("[juice-squeeze-fire] liquid setFill", { level: Number(lvl.toFixed(3)) })
    this.stage?.setFill(lvl, opts)
  }

  triggerWin(): void {
    console.log("[juice-squeeze-fire] liquid triggerWin")
    this.stage?.triggerWin()
  }

  triggerBottleComplete(): void {
    console.log("[juice-squeeze-fire] liquid bottleComplete")
    this.stage?.triggerBottleComplete()
  }

  resize(): void {
    this.stage?.resize()
  }

  dispose(): void {
    this.disposed = true
    this.stage?.dispose()
    this.stage = null
    this.parent = null
  }
}

export function createLiquidController(): LiquidController {
  return new LiquidControllerImpl()
}
