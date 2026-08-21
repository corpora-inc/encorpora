export type Question = { id: string; prompt: string; answer: string; distractors: string[]; domain: string; difficulty: number }
export type Host = {
  /**
   * `maxDifficulty` is a CAPABILITY, not a preference: "I cannot draw a question
   * harder than this." `packs/shared/game-host` holds it as a standing ceiling
   * once sent and puts it on the wire on every request after, and the host
   * honours it absolutely — above the child's band as well as below it. ARENA
   * sends it only after meeting a numeral it cannot print; see
   * `lowerDrawCeiling` in `sim/world.ts`.
   */
  next(opts?: { domain?: string; difficulty?: number; maxDifficulty?: number }): Question
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
