/**
 * The host contract. This shape is fixed by the Dynawalla runtime; do not drift it.
 * The runtime lands underneath us later — until then `stubHost.ts` implements it.
 */

export type Question = {
  id: string
  prompt: string
  answer: string
  distractors: string[]
  domain: string
  difficulty: number
}

export type Host = {
  next(opts?: { domain?: string; difficulty?: number; maxDifficulty?: number }): Question
  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void
  /**
   * Close a question the child never saw an answer for.
   *
   * ABYSSAL BLOOM refuses a number it cannot build — see `core/ask.ts` — and this
   * is how it closes the item honestly. It is explicitly NOT a wrong answer:
   * `packs/shared/game-host` records nothing, produces no `Outcome`, and does not
   * move the ladder. Reporting `{ correct: false, answered: "" }` instead would
   * file a MISS against a child who was never asked.
   *
   * Optional, because the standalone stub and older hosts may not have it.
   */
  skip?(questionId: string): void
  /**
   * Bias the question stream so its ANSWERS land in a set the game can express.
   *
   * The reason this pack needs it is the whole subject of `core/ask.ts`: the
   * board's answer surface is three polyps wide, so the game tells the host which
   * numbers those three polyps can make. Up to 32 values; best effort.
   *
   * Optional, and feature-detected.
   */
  focus?(spec: { key: number; wanted: number[] }): void
  haptic(k: 'light' | 'medium' | 'heavy' | 'success' | 'failure'): void
  prefersReducedMotion(): boolean
}

export function mount(el: HTMLElement, host: Host): { unmount(): void } {
  // Re-exported from ./index.ts; this declaration exists so the contract file
  // states the whole shape in one place. The real implementation is in game.ts.
  return mountImpl(el, host)
}

// Late-bound to avoid a cycle: index.ts installs the implementation at load.
let mountImpl: (el: HTMLElement, host: Host) => { unmount(): void } = () => {
  throw new Error('merge-idle: mount() called before the game module was loaded')
}

export function __installMount(fn: (el: HTMLElement, host: Host) => { unmount(): void }): void {
  mountImpl = fn
}
