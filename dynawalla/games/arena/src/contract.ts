export type Question = { id: string; prompt: string; answer: string; distractors: string[]; domain: string; difficulty: number }
export type Host = {
  next(opts?: { domain?: string; difficulty?: number }): Question
  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void
  haptic(k: "light" | "medium" | "heavy" | "success" | "failure"): void
  prefersReducedMotion(): boolean
}
export type MountOptions = {
  /**
   * Seed for the WORLD — mote values and positions, rival sizes, the option
   * shuffle, resonance timing. Omit for a fresh run every time.
   *
   * Seeding the Host alone reproduces the question stream and nothing else,
   * which is what `?seed=` used to do while the README claimed it reproduced
   * a run.
   */
  seed?: number
}
export function mount(el: HTMLElement, host: Host, opts?: MountOptions): { unmount(): void } {
  // Re-exported from ./mount.ts at build time; this declaration exists so the
  // contract file is literally the shape the runtime lands underneath.
  return mountArena(el, host, opts)
}

import { mountArena } from "./mount.ts"
