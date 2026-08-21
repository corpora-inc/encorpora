export type Question = { id: string; prompt: string; answer: string; distractors: string[]; domain: string; difficulty: number }
export type Host = {
  /**
   * `maxDifficulty` is a standing ceiling on the host's stream, not a per-call
   * hint: it stands until a different one is named. DEEPSWARM names the rung
   * the run has EARNED, so the pool can be spread downward for variety without
   * a pooled question from a previous, higher request leaking back up. See
   * `packs/shared/game-host/index.ts`.
   */
  next(opts?: { domain?: string; difficulty?: number; maxDifficulty?: number }): Question
  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void
  haptic(k: "light" | "medium" | "heavy" | "success" | "failure"): void
  prefersReducedMotion(): boolean
}
export function mount(el: HTMLElement, host: Host): { unmount(): void } {
  // Real implementation lives in ./index.ts — this file exists so the contract
  // shape is checked in isolation and stays byte-identical across every game.
  void el
  void host
  throw new Error("horde: import mount from './index.ts'")
}
