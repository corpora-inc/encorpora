import { mountRunner } from "./game/mount.ts";

export type Question = { id: string; prompt: string; answer: string; distractors: string[]; domain: string; difficulty: number }
export type Host = {
  next(opts?: { domain?: string; difficulty?: number }): Question
  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void
  haptic(k: "light"|"medium"|"heavy"|"success"|"failure"): void
  prefersReducedMotion(): boolean
}
export function mount(el: HTMLElement, host: Host): { unmount(): void } {
  return mountRunner(el, host);
}
