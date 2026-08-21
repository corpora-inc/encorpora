// src/journey/celebration/effects/dom.ts — tiny DOM helpers shared by the CSS-3D
// effects. Keeps each effect terse and guarantees a uniform teardown: every node
// an effect creates goes through `spawn`, every animation through `track`, and
// the returned disposer cancels + removes everything (no leaks on skip).

/** A scoped element+animation bag with one-shot teardown. */
export interface EffectScope {
  /** Create a positioned child of the host and register it for cleanup. */
  spawn(tag?: keyof HTMLElementTagNameMap): HTMLElement
  /** Register a WAAPI animation for cancellation on teardown. */
  track(a: Animation | null | undefined): void
  /** Cancel every tracked animation + remove every spawned node. Idempotent. */
  dispose(): void
}

export function createScope(host: HTMLElement): EffectScope {
  const nodes: HTMLElement[] = []
  const anims: Animation[] = []
  let disposed = false
  return {
    spawn(tag = "div") {
      const el = document.createElement(tag)
      el.style.position = "absolute"
      el.style.pointerEvents = "none"
      el.style.willChange = "transform, opacity"
      host.appendChild(el)
      nodes.push(el)
      return el
    },
    track(a) {
      if (a) anims.push(a)
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const a of anims) {
        try {
          a.cancel()
        } catch {
          /* animation already finished/detached */
        }
      }
      for (const n of nodes) n.remove()
    },
  }
}

/** WAAPI available? (jsdom/SSR lack element.animate.) */
export function canAnimate(el: HTMLElement): boolean {
  return typeof (el as unknown as { animate?: unknown }).animate === "function"
}

/** Position an element centered on (cx, cy) via a translate baseline. */
export function centerAt(el: HTMLElement, cx: number, cy: number): void {
  el.style.left = "0px"
  el.style.top = "0px"
  el.style.transform = `translate(${cx}px, ${cy}px)`
}

/** Spring-ish overshoot easing for a punchy pop. */
export const OVERSHOOT = "cubic-bezier(0.34, 1.56, 0.64, 1)"
