/**
 * Shared shapes. These mirror the `question` and `skill` tables of the pack
 * (harvest/CONTRACT.md) but carry only what practice needs, so any corpus can
 * feed the engine from plain objects.
 */

export type ItemKind = "mc" | "numeric" | "free_text";

export interface Item {
  /** `question.q_id`. */
  id: string;
  /** `question.skill_id`. */
  skillId: string;
  /** `question.variant_of`: items sharing a base test the same fact. */
  variantOf?: string | null;
  kind: ItemKind;
  /** mc: number of choices (drives the guessing floor). */
  choiceCount?: number;
  /**
   * The key. mc: the correct choice index as text ("2"). numeric: the value
   * as text, optionally with a tolerance as `value±tol` ("25±0.5"). free_text:
   * a rubric (see `grade.ts`).
   */
  answer: string;
  /** 0..1 prior difficulty from the bake. 0.5 is a typical item. */
  difficulty: number;
}

export interface Skill {
  id: string;
  /** A frontier is tracked per topic (domain). */
  topicId: string;
  /** Skills that should be mastered before this one is on the frontier. */
  prereqs?: readonly string[];
  /** Relative importance, default 1 (e.g. exam weight). */
  weight?: number;
}

/** One graded attempt. `at` is epoch milliseconds, always supplied by the caller. */
export interface Attempt {
  itemId: string;
  skillId: string;
  correct: boolean;
  at: number;
}

/** The base a variant family shares. */
export function baseOf(item: Pick<Item, "id" | "variantOf">): string {
  return item.variantOf ?? item.id;
}

export const DAY_MS = 86_400_000;
export const MINUTE_MS = 60_000;
