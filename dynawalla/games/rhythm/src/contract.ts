/**
 * The Dynawalla game contract. Verbatim from the pack spec:
 *
 *   export type Question = { id: string; prompt: string; answer: string; distractors: string[]; domain: string; difficulty: number }
 *   export type Host = {
 *     next(opts?: { domain?: string; difficulty?: number }): Question
 *     report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void
 *     haptic(k: "light"|"medium"|"heavy"|"success"|"failure"): void
 *     prefersReducedMotion(): boolean
 *   }
 *   export function mount(el: HTMLElement, host: Host): { unmount(): void }
 *
 * `Question` and `Host` below are byte-identical to the spec. `mount` is a
 * signature, not a value, so it lives here as the `Mount` type and is
 * implemented in `src/index.ts` — `export const mount: Mount` there pins the
 * implementation to exactly this shape at compile time.
 */

export type Question = { id: string; prompt: string; answer: string; distractors: string[]; domain: string; difficulty: number }
export type Host = {
  next(opts?: { domain?: string; difficulty?: number }): Question
  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void
  haptic(k: "light"|"medium"|"heavy"|"success"|"failure"): void
  prefersReducedMotion(): boolean
}
export type Mount = (el: HTMLElement, host: Host) => { unmount(): void }
