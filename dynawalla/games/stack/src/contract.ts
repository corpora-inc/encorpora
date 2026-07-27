// The host↔game contract. Kept verbatim; the runtime lands underneath it.
//
// `mount` is declared here as the contract's callable surface and re-exported
// from the implementation, so `import { mount } from "./contract.ts"` resolves
// to the real function rather than to an ambient declaration that is undefined
// at runtime.

export type Question = { id: string; prompt: string; answer: string; distractors: string[]; domain: string; difficulty: number }
export type Host = {
  next(opts?: { domain?: string; difficulty?: number }): Question
  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void
  haptic(k: "light"|"medium"|"heavy"|"success"|"failure"): void
  prefersReducedMotion(): boolean

  /**
   * A natural stopping point the child *reached*: a level cleared, a run
   * completed, a boss down.
   *
   * OPTIONAL and feature-detected — a stub host does not implement it and the
   * game must not care. Fire and forget: nothing is returned, nothing may be
   * awaited, and the game must not branch on it.
   *
   * **Never after a failure.** Not a defeat, not a breach, not a wrong answer,
   * not a timer. This is the call the host may put a sheet on top of, and a
   * purchase surface next to a failure is the thing that is forbidden outright.
   */
  transition?(kind: "level" | "run" | "boss", label?: string): void
}
export type Mount = (el: HTMLElement, host: Host) => { unmount(): void }

export { mount } from "./game/mount.ts";
