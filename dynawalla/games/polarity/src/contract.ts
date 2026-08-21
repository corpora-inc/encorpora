/**
 * The game <-> runtime contract.
 *
 * A shared package will replace this file. Keep the shape EXACTLY as written so
 * the swap is a one-line import change. `mount` here is the *declaration* only —
 * the real implementation is exported from `./index.ts`, and a test asserts the
 * two stay assignable.
 */

export type Question = {
  id: string;
  prompt: string; // "−9 + 4"
  answer: string; // "−5"  — exact, canonical
  distractors: string[]; // plausible wrong answers, ideally real mal-rule outputs
  domain: string; // "int-add" | "int-sub" | ...
  difficulty: number; // 0..1
};

/**
 * What POLARITY asks for when it asks for a question.
 *
 * Field-for-field a subset of `packs/shared/game-host`'s `DifficultyRequest`,
 * which is the object the real host reads — so this stays assignable and the
 * swap stays a one-line import change.
 *
 * **On the scale.** The host reads a value below 1 as a 0..1 fraction and a
 * value from 1 to 10 as a ladder index, which makes exactly one number
 * ambiguous — `1` — and it resolves it as the BOTTOM of the ladder. POLARITY
 * reaches a difficulty of exactly 1 after fifteen strata and means the top, so
 * it speaks the ladder scale on both fields; see `ladderScale` in `seal.ts`.
 */
export type Ask = {
  domain?: string;
  difficulty?: number;
  /**
   * A ceiling on the same scale. The stream never goes above it.
   *
   * This is how a pack that cannot DRAW a rung tells the host, instead of
   * declining item after item from a rung the host will keep serving. Declining
   * is per-item and the host serves by rung, so without this a level whose every
   * item is unprintable is not a graceful degradation — it is a Seal Bearer that
   * asks nothing, forever, and the child at the top of the ladder is the one it
   * happens to.
   */
  maxDifficulty?: number;
};

export type Host = {
  next(opts?: Ask): Question;
  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void;
  haptic(k: "light" | "medium" | "heavy" | "success" | "failure"): void;
  prefersReducedMotion(): boolean;
  /**
   * Throw away questions prefetched at a difficulty the game has since moved
   * off. Optional and feature-detected, exactly as `trebuchet` and `siege` do
   * with their own host extensions: the stub host has no pool to flush and an
   * older host may not have the method.
   *
   * A lowered ceiling needs it. The pool holds up to sixty-four questions and
   * they were all drawn from the rung that has just been ruled out, so without
   * a flush the ceiling takes sixty-four questions to arrive — which for a
   * Bearer every twenty-six seconds is most of an afternoon.
   */
  flush?(): void;
};

export function mount(_el: HTMLElement, _host: Host): { unmount(): void } {
  throw new Error("contract declaration only — the implementation is ./index.ts");
}
