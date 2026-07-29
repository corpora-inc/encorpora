// The host contract. Keep this EXACTLY this shape: a shared package will
// replace this file later and the swap must be mechanical (delete the file,
// change the import specifier).

export type Question = {
  id: string;
  prompt: string; // "15 − 8"
  answer: string; // "7"  — exact, canonical
  distractors: string[]; // plausible wrong answers, ideally real mal-rule outputs
  domain: string; // "add-sub" | "fractions" | ...
  difficulty: number; // 0..1
};

/**
 * What the game asks for when it pulls a question. Every field is optional and
 * a host that ignores all of them behaves exactly as it did before this type
 * existed. Structurally identical to `DifficultyRequest` in
 * `packs/shared/game-host`, which is what the real host implements.
 */
export type DifficultyRequest = {
  readonly domain?: string;
  /** 0..1 position on the host's whole ladder. */
  readonly difficulty?: number;
  /** A standing ceiling on the stream, same scale. */
  readonly maxDifficulty?: number;
};

export type Host = {
  next(request?: DifficultyRequest): Question; // pull the next question
  report(r: {
    questionId: string;
    correct: boolean;
    ms: number;
    answered: string;
  }): void;
  haptic(kind: "light" | "medium" | "heavy" | "success" | "failure"): void;
  prefersReducedMotion(): boolean;
  /**
   * Optional host extension: put a floor under the stream that never falls
   * again. Feature-detected, because a stub or an older host has no such thing.
   */
  raiseFloor?(difficulty: number): void;
};

export type Mounted = { unmount(): void };
