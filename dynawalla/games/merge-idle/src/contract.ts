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
  next(opts?: { domain?: string; difficulty?: number }): Question
  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void
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
