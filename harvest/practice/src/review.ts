/**
 * Spaced review of misses.
 *
 * A miss opens a review card for the item's variant family (the base). The
 * card comes back after a few other items in the same session, then on a
 * widening schedule of days. A correct review moves it up a box; a miss sends
 * it back to the start. After the last box the card retires. Reviews prefer an
 * unseen sibling variant, so the learner meets the fact again rather than a
 * remembered answer position.
 */

import { DAY_MS, MINUTE_MS, baseOf, type Item } from "./types.ts";

export const REVIEW = Object.freeze({
  /** Items to wait in-session after a miss before the first review. */
  firstGapSteps: 3,
  /** Or this much time, whichever comes first. */
  firstGapMs: 10 * MINUTE_MS,
  /** Interval after each correct review, by box (1-based). */
  intervalsMs: [1 * DAY_MS, 3 * DAY_MS, 7 * DAY_MS, 21 * DAY_MS] as readonly number[],
});

export interface ReviewCard {
  /** Variant family id (`variant_of`, or the item id). */
  base: string;
  skillId: string;
  /** 0 = just missed; retires after the last interval. */
  box: number;
  /** Due when the session step reaches this (null: time only, JSON-safe), or ... */
  dueStep: number | null;
  /** ... when the clock reaches this. */
  dueAt: number;
  misses: number;
  /** Item ids of this family already shown, oldest first. */
  seen: string[];
}

export interface ReviewDeck {
  cards: Readonly<Record<string, ReviewCard>>;
}

export const emptyDeck: ReviewDeck = { cards: {} };

/**
 * Apply one graded attempt to the deck.
 * `step` is the session's running item counter, `at` the clock.
 */
export function reviewAfter(
  deck: ReviewDeck,
  item: Pick<Item, "id" | "skillId" | "variantOf">,
  correct: boolean,
  step: number,
  at: number,
): ReviewDeck {
  const base = baseOf(item);
  const card = deck.cards[base];
  const seen = card ? [...card.seen.filter((id) => id !== item.id), item.id] : [item.id];
  if (!correct) {
    const next: ReviewCard = {
      base,
      skillId: item.skillId,
      box: 0,
      dueStep: step + REVIEW.firstGapSteps,
      dueAt: at + REVIEW.firstGapMs,
      misses: (card?.misses ?? 0) + 1,
      seen,
    };
    return { cards: { ...deck.cards, [base]: next } };
  }
  if (!card) return deck;
  // A correct answer only promotes a card that is due; answering an undue
  // family correctly (e.g. in an exam) keeps the schedule.
  if (!isDue(card, step, at)) return { cards: { ...deck.cards, [base]: { ...card, seen } } };
  const box = card.box + 1;
  if (box > REVIEW.intervalsMs.length) {
    const rest = { ...deck.cards };
    delete rest[base];
    return { cards: rest };
  }
  const interval = REVIEW.intervalsMs[box - 1] as number;
  const next: ReviewCard = { ...card, box, dueStep: null, dueAt: at + interval, seen };
  return { cards: { ...deck.cards, [base]: next } };
}

export function isDue(card: ReviewCard, step: number, at: number): boolean {
  return (card.dueStep !== null && step >= card.dueStep) || at >= card.dueAt;
}

/** Due cards, most overdue first (by time, then by step). */
export function dueCards(deck: ReviewDeck, step: number, at: number): ReviewCard[] {
  return Object.values(deck.cards)
    .filter((c) => isDue(c, step, at))
    .sort((a, b) => a.dueAt - b.dueAt || (a.dueStep ?? Infinity) - (b.dueStep ?? Infinity) || (a.base < b.base ? -1 : a.base > b.base ? 1 : 0));
}

/** Next due time strictly after `at`, or null when nothing is scheduled. */
export function nextDueAt(deck: ReviewDeck, at: number): number | null {
  let best: number | null = null;
  for (const c of Object.values(deck.cards)) if (c.dueAt > at && (best === null || c.dueAt < best)) best = c.dueAt;
  return best;
}

/**
 * Choose which member of a family to show for a review: the first never-seen
 * variant in bank order, else the one seen longest ago.
 */
export function pickReviewItem<T extends Pick<Item, "id" | "variantOf">>(card: ReviewCard, family: readonly T[]): T | null {
  if (family.length === 0) return null;
  const unseen = family.find((it) => !card.seen.includes(it.id));
  if (unseen) return unseen;
  let best: T | null = null;
  let bestIdx = Number.POSITIVE_INFINITY;
  for (const it of family) {
    const idx = card.seen.indexOf(it.id);
    if (idx < bestIdx) {
      bestIdx = idx;
      best = it;
    }
  }
  return best;
}
