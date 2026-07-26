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
}
export type Mount = (el: HTMLElement, host: Host) => { unmount(): void }

export { mount } from "./game/mount.ts";
