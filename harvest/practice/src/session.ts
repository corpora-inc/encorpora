/**
 * Adaptive practice across several skill frontiers.
 *
 * Skills are grouped by topic. Each topic has its own frontier: the first
 * skills, in blueprint order, that are unlocked (prerequisites mastered) and
 * not yet mastered. Practice draws from every topic's frontier at once, so a
 * learner moves forward on load charts, signals and rigging in parallel
 * instead of finishing one book chapter before starting the next.
 *
 * Each pick, in order:
 *   1. a due review of an earlier miss (spaced; at most two in a row while
 *      frontier work exists);
 *   2. otherwise a frontier skill, drawn with weight for importance,
 *      uncertainty and need, damped for skills and topics just practiced
 *      (interleaving);
 *   3. otherwise, when everything is mastered, a refresh of the skill the
 *      model is least sure about.
 * Inside a skill the engine shows the item whose predicted success is closest
 * to the target (harder when going well, easier when struggling), charging
 * for earlier showings so unseen items come first, and never a family shown
 * in the last few items.
 */

import { estimate, newEvidence, predictItem, recordAttempt, type EvidenceBook, type Estimate } from "./evidence.ts";
import { dueCards, emptyDeck, pickReviewItem, reviewAfter, type ReviewDeck } from "./review.ts";
import { weightedIndex, type Rng } from "./rng.ts";
import { baseOf, type Item, type Skill } from "./types.ts";

export const SESSION = Object.freeze({
  /** Families shown this recently are not repeated. */
  noRepeatWindow: 3,
  /** How many unmastered skills per topic are open at once. */
  frontierWidth: 2,
  /** A prerequisite counts as met at this expected success. */
  unlockAt: 0.7,
  maxReviewsInARow: 2,
  targetSuccess: 0.75,
  targetSuccessStruggling: 0.85,
  /** Added to an item's fit cost for each time it was already shown. */
  seenCost: 0.2,
  /** Added for a family already waiting in the review deck. */
  pendingCost: 0.1,
  historyLength: 30,
});

export interface Bank {
  items: readonly Item[];
  /** Blueprint order matters: it orders each topic's frontier. */
  skills: readonly Skill[];
}

export interface IndexedBank {
  bank: Bank;
  skillById: ReadonlyMap<string, Skill>;
  itemById: ReadonlyMap<string, Item>;
  itemsBySkill: ReadonlyMap<string, readonly Item[]>;
  itemsByBase: ReadonlyMap<string, readonly Item[]>;
  topics: readonly string[];
}

export function indexBank(bank: Bank): IndexedBank {
  const skillById = new Map<string, Skill>();
  const topics: string[] = [];
  for (const s of bank.skills) {
    if (skillById.has(s.id)) throw new Error(`Duplicate skill ${s.id}`);
    skillById.set(s.id, s);
    if (!topics.includes(s.topicId)) topics.push(s.topicId);
  }
  for (const s of bank.skills) for (const p of s.prereqs ?? []) if (!skillById.has(p)) throw new Error(`Skill ${s.id} needs unknown ${p}`);
  const itemById = new Map<string, Item>();
  const itemsBySkill = new Map<string, Item[]>();
  const itemsByBase = new Map<string, Item[]>();
  for (const it of bank.items) {
    if (itemById.has(it.id)) throw new Error(`Duplicate item ${it.id}`);
    if (!skillById.has(it.skillId)) throw new Error(`Item ${it.id} has unknown skill ${it.skillId}`);
    itemById.set(it.id, it);
    (itemsBySkill.get(it.skillId) ?? itemsBySkill.set(it.skillId, []).get(it.skillId)!).push(it);
    const base = baseOf(it);
    (itemsByBase.get(base) ?? itemsByBase.set(base, []).get(base)!).push(it);
  }
  return { bank, skillById, itemById, itemsBySkill, itemsByBase, topics };
}

export type PickReason = "review" | "frontier" | "refresh";

export interface Pick {
  item: Item;
  reason: PickReason;
  /** Predicted chance of a correct answer, 0..1. */
  predicted: number;
}

export interface HistoryEntry {
  itemId: string;
  base: string;
  skillId: string;
  topicId: string;
  reason: PickReason;
  correct: boolean;
}

export interface PracticeState {
  book: EvidenceBook;
  deck: ReviewDeck;
  /** Items answered so far (the in-session clock for review spacing). */
  step: number;
  /** Most recent last, capped. */
  history: readonly HistoryEntry[];
  /** Times each item has been shown. */
  seen: Readonly<Record<string, number>>;
}

export const newPractice = (): PracticeState => ({ book: {}, deck: emptyDeck, step: 0, history: [], seen: {} });

export interface Focus {
  topicIds?: readonly string[];
  skillIds?: readonly string[];
}

export interface NextOptions {
  now: number;
  rng: Rng;
  focus?: Focus;
}

function inFocus(skill: Skill, focus?: Focus): boolean {
  if (!focus) return true;
  if (focus.topicIds && focus.topicIds.length > 0 && !focus.topicIds.includes(skill.topicId)) return false;
  if (focus.skillIds && focus.skillIds.length > 0 && !focus.skillIds.includes(skill.id)) return false;
  return true;
}

function est(state: PracticeState, skillId: string, now: number): Estimate {
  return estimate(state.book[skillId] ?? newEvidence(skillId), now);
}

function isMet(e: Estimate): boolean {
  return e.status === "mastered" || e.status === "review" || e.mastery >= SESSION.unlockAt;
}

/** The open skills of each topic, in blueprint order. */
export function frontiers(ix: IndexedBank, state: PracticeState, now: number, focus?: Focus): Map<string, Skill[]> {
  const out = new Map<string, Skill[]>();
  for (const topic of ix.topics) out.set(topic, []);
  for (const skill of ix.bank.skills) {
    if (!inFocus(skill, focus) || !(ix.itemsBySkill.get(skill.id)?.length)) continue;
    const e = est(state, skill.id, now);
    if (e.status === "mastered") continue;
    const unlocked = (skill.prereqs ?? []).every((p) => isMet(est(state, p, now)));
    if (!unlocked) continue;
    const list = out.get(skill.topicId)!;
    // Decayed skills always rejoin the frontier; new ground is limited per topic.
    if (e.status === "review" || list.filter((s) => est(state, s.id, now).status !== "review").length < SESSION.frontierWidth) {
      list.push(skill);
    }
  }
  for (const [topic, list] of out) if (list.length === 0) out.delete(topic);
  return out;
}

function recentFamilies(state: PracticeState, window: number): Set<string> {
  return new Set(state.history.slice(-window).map((h) => h.base));
}

function chooseItem(
  ix: IndexedBank,
  state: PracticeState,
  skillId: string,
  opts: NextOptions,
  struggling: boolean,
): Item | null {
  const all = ix.itemsBySkill.get(skillId) ?? [];
  if (all.length === 0) return null;
  // Families waiting in the review deck cost a little more, so the review
  // path usually brings them back, but a struggling learner still gets the
  // easy facts rather than only the untouched hard ones.
  const pending = (it: Item) => (state.deck.cards[baseOf(it)] !== undefined ? SESSION.pendingCost : 0);
  const target = struggling ? SESSION.targetSuccessStruggling : SESSION.targetSuccess;
  for (let window = SESSION.noRepeatWindow; window >= 0; window--) {
    const recent = recentFamilies(state, window);
    const pool = all.filter((it) => !recent.has(baseOf(it)));
    if (pool.length > 0) {
      // Cost: distance from the target success, plus a charge per earlier
      // showing. Unseen items win unless a seen one fits much better.
      let bestCost = Number.POSITIVE_INFINITY;
      let best: Item[] = [];
      for (const it of pool) {
        const cost =
          Math.abs(predictItem(state.book, it, opts.now) - target) + SESSION.seenCost * (state.seen[it.id] ?? 0) + pending(it);
        if (cost < bestCost - 1e-9) {
          bestCost = cost;
          best = [it];
        } else if (Math.abs(cost - bestCost) <= 1e-9) best.push(it);
      }
      return best[Math.floor(opts.rng.next() * best.length)] ?? null;
    }
  }
  return null;
}

function skillWeight(ix: IndexedBank, state: PracticeState, skill: Skill, e: Estimate): number {
  const statusFactor = { new: 1, learning: 1.1, struggling: 1.25, review: 1.3, mastered: 0.5 }[e.status];
  const uncertainty = 0.5 + e.sigma / 1.5;
  const recent = state.history.slice(-3);
  let recency = 1;
  if (recent.at(-1)?.skillId === skill.id) recency = 0.15;
  else if (recent.some((h) => h.skillId === skill.id)) recency = 0.5;
  const topicFresh = recent.some((h) => h.topicId === skill.topicId) ? 1 : 1.3;
  return (skill.weight ?? 1) * statusFactor * uncertainty * recency * topicFresh;
}

/** The next item to show, or null when the focus has no items at all. */
export function nextPick(ix: IndexedBank, state: PracticeState, opts: NextOptions): Pick | null {
  const { now, focus } = opts;
  const open = frontiers(ix, state, now, focus);
  const frontierSkills = [...open.values()].flat();

  // 1. Due reviews.
  const recentReviews = state.history.slice(-SESSION.maxReviewsInARow);
  const reviewCapped =
    frontierSkills.length > 0 &&
    recentReviews.length === SESSION.maxReviewsInARow &&
    recentReviews.every((h) => h.reason === "review");
  if (!reviewCapped) {
    const recent = recentFamilies(state, 1);
    for (const card of dueCards(state.deck, state.step, now)) {
      const skill = ix.skillById.get(card.skillId);
      if (!skill || !inFocus(skill, focus) || recent.has(card.base)) continue;
      const item = pickReviewItem(card, ix.itemsByBase.get(card.base) ?? []);
      if (item) return { item, reason: "review", predicted: predictItem(state.book, item, now) };
    }
  }

  // 2. Frontier work across every topic.
  if (frontierSkills.length > 0) {
    const ests = frontierSkills.map((s) => est(state, s.id, now));
    const weights = frontierSkills.map((s, i) => skillWeight(ix, state, s, ests[i]!));
    const order = [...frontierSkills.keys()];
    // Try skills in sampled order until one yields an item.
    while (order.length > 0) {
      const k = weightedIndex(opts.rng, order.map((i) => weights[i]!));
      const i = order[k]!;
      order.splice(k, 1);
      const e = ests[i]!;
      const item = chooseItem(ix, state, frontierSkills[i]!.id, opts, e.status === "struggling");
      if (item) return { item, reason: "frontier", predicted: predictItem(state.book, item, now) };
    }
  }

  // 3. Everything in focus is mastered (or locked): refresh the least certain skill.
  const candidates = ix.bank.skills.filter((s) => inFocus(s, focus) && (ix.itemsBySkill.get(s.id)?.length ?? 0) > 0);
  if (candidates.length === 0) return null;
  const ranked = candidates
    .map((s) => ({ s, e: est(state, s.id, now) }))
    .sort((a, b) => a.e.pMastered - b.e.pMastered || a.s.id.localeCompare(b.s.id));
  for (const { s, e } of ranked) {
    const item = chooseItem(ix, state, s.id, opts, e.status === "struggling");
    if (item) return { item, reason: "refresh", predicted: predictItem(state.book, item, now) };
  }
  return null;
}

/** Fold a graded attempt into the state. Pure. */
export function answer(
  ix: IndexedBank,
  state: PracticeState,
  pick: Pick | { item: Item; reason: PickReason },
  correct: boolean,
  now: number,
): PracticeState {
  const item = pick.item;
  const skill = ix.skillById.get(item.skillId);
  if (!skill) throw new Error(`Unknown skill ${item.skillId}`);
  const entry: HistoryEntry = {
    itemId: item.id,
    base: baseOf(item),
    skillId: item.skillId,
    topicId: skill.topicId,
    reason: pick.reason,
    correct,
  };
  return {
    book: recordAttempt(state.book, item, correct, now),
    deck: reviewAfter(state.deck, item, correct, state.step, now),
    step: state.step + 1,
    history: [...state.history, entry].slice(-SESSION.historyLength),
    seen: { ...state.seen, [item.id]: (state.seen[item.id] ?? 0) + 1 },
  };
}

export interface SkillReport extends Estimate {
  topicId: string;
  dueReviews: number;
}

/** Results by skill, in blueprint order. */
export function skillReport(ix: IndexedBank, state: PracticeState, now: number): SkillReport[] {
  const due = dueCards(state.deck, state.step, now);
  return ix.bank.skills.map((s) => ({
    ...est(state, s.id, now),
    topicId: s.topicId,
    dueReviews: due.filter((c) => c.skillId === s.id).length,
  }));
}

/**
 * Fold a scored exam into practice: every item is evidence for its skill, and
 * every miss opens a spaced review. History is left alone so the next practice
 * pick is not damped by ninety exam items.
 */
export function absorbExam(
  ix: IndexedBank,
  state: PracticeState,
  results: readonly { itemId: string; correct: boolean }[],
  at: number,
): PracticeState {
  let book = state.book;
  let deck = state.deck;
  const seen: Record<string, number> = { ...state.seen };
  for (const r of results) {
    const item = ix.itemById.get(r.itemId);
    if (!item) throw new Error(`Item ${r.itemId} missing from the bank`);
    book = recordAttempt(book, item, r.correct, at);
    deck = reviewAfter(deck, item, r.correct, state.step, at);
    seen[item.id] = (seen[item.id] ?? 0) + 1;
  }
  return { ...state, book, deck, seen };
}
