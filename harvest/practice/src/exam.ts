/**
 * Timed written-exam simulator.
 *
 * A blueprint names the time limit, the pass mark and how many items each
 * domain contributes. `buildExam` draws a form: the exact count per domain,
 * no item twice, no two variants of the same fact, items interleaved across
 * domains, choices optionally shuffled. A session records answers against the
 * clock and refuses them after time runs out; unanswered items score wrong.
 * `scoreExam` reports the total, pass or fail, and results by domain and by
 * skill, with the key for every item so the review can show rationales.
 */

import { grade, type Response } from "./grade.ts";
import { randInt, shuffle, createRng, type Rng } from "./rng.ts";
import { MINUTE_MS, baseOf, type Item } from "./types.ts";

export interface ExamDomain {
  id: string;
  /** Items from these skills fill this domain. */
  skillIds: readonly string[];
  count: number;
}

export interface ExamBlueprint {
  id: string;
  minutes: number;
  /** Percent correct needed to pass, 0..100. */
  passPercent: number;
  domains: readonly ExamDomain[];
  /** Shuffle multiple-choice options per form. Default true. */
  shuffleChoices?: boolean;
}

export interface FormItem {
  itemId: string;
  domainId: string;
  skillId: string;
  /** Display order of choices: shown position -> original index. Empty for non-mc. */
  order: number[];
}

export interface ExamForm {
  blueprintId: string;
  seed: string;
  minutes: number;
  passPercent: number;
  items: FormItem[];
}

export class ExamShortfall extends Error {
  readonly domainId: string;
  readonly needed: number;
  readonly available: number;
  constructor(domainId: string, needed: number, available: number) {
    super(`Domain ${domainId} needs ${needed} items from distinct facts; the bank has ${available}`);
    this.name = "ExamShortfall";
    this.domainId = domainId;
    this.needed = needed;
    this.available = available;
  }
}

export function validateBlueprint(bp: ExamBlueprint): void {
  if (!(bp.minutes > 0)) throw new RangeError("minutes must be positive");
  if (!(bp.passPercent >= 0 && bp.passPercent <= 100)) throw new RangeError("passPercent must be 0..100");
  if (bp.domains.length === 0) throw new RangeError("blueprint needs domains");
  const ids = new Set<string>();
  for (const d of bp.domains) {
    if (ids.has(d.id)) throw new RangeError(`duplicate domain ${d.id}`);
    ids.add(d.id);
    if (!Number.isInteger(d.count) || d.count < 1) throw new RangeError(`domain ${d.id} count must be a positive integer`);
    if (d.skillIds.length === 0) throw new RangeError(`domain ${d.id} needs skills`);
  }
}

/** Number of distinct facts (variant families) a bank can supply to each domain. */
export function domainCapacity(bp: ExamBlueprint, items: readonly Item[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of bp.domains) {
    const bases = new Set(items.filter((it) => d.skillIds.includes(it.skillId)).map(baseOf));
    out[d.id] = bases.size;
  }
  return out;
}

/**
 * Draw a form. Deterministic for a given seed and bank. Throws ExamShortfall
 * when a domain cannot be filled with distinct facts.
 * `prefer` ranks items to favour (e.g. never-seen ones) before random order.
 */
export function buildExam(
  bp: ExamBlueprint,
  items: readonly Item[],
  seed: string,
  prefer?: (item: Item) => number,
): ExamForm {
  validateBlueprint(bp);
  const rng = createRng(`${bp.id}:${seed}`);
  const usedBases = new Set<string>();
  const usedItems = new Set<string>();
  const perDomain: FormItem[][] = [];
  for (const d of bp.domains) {
    const pool = shuffle(rng, items.filter((it) => d.skillIds.includes(it.skillId) && !usedItems.has(it.id)));
    if (prefer) pool.sort((a, b) => prefer(b) - prefer(a)); // stable: random order within a rank
    const chosen: FormItem[] = [];
    for (const it of pool) {
      if (chosen.length === d.count) break;
      const base = baseOf(it);
      if (usedBases.has(base)) continue;
      usedBases.add(base);
      usedItems.add(it.id);
      chosen.push({ itemId: it.id, domainId: d.id, skillId: it.skillId, order: choiceOrder(rng, it, bp.shuffleChoices ?? true) });
    }
    if (chosen.length < d.count) throw new ExamShortfall(d.id, d.count, chosen.length);
    perDomain.push(chosen);
  }
  return { blueprintId: bp.id, seed, minutes: bp.minutes, passPercent: bp.passPercent, items: interleave(rng, perDomain) };
}

function choiceOrder(rng: Rng, item: Item, doShuffle: boolean): number[] {
  if (item.kind !== "mc") return [];
  const k = item.choiceCount ?? 4;
  const identity = Array.from({ length: k }, (_, i) => i);
  return doShuffle ? shuffle(rng, identity) : identity;
}

/** Spread each domain evenly through the form, in random phase. */
function interleave(rng: Rng, groups: FormItem[][]): FormItem[] {
  const keyed: { key: number; item: FormItem }[] = [];
  for (const g of groups) {
    const phase = g.length > 0 ? randInt(rng, 1000) / 1000 : 0;
    g.forEach((item, i) => keyed.push({ key: (i + phase) / g.length + rng.next() * 1e-6, item }));
  }
  return keyed.sort((a, b) => a.key - b.key).map((k) => k.item);
}

export interface ExamSession {
  form: ExamForm;
  startedAt: number;
  /** itemId -> response (mc: original choice index). */
  answers: Readonly<Record<string, Response>>;
  flagged: readonly string[];
  submittedAt: number | null;
}

export function startExam(form: ExamForm, now: number): ExamSession {
  return { form, startedAt: now, answers: {}, flagged: [], submittedAt: null };
}

export function deadline(s: ExamSession): number {
  return s.startedAt + s.form.minutes * MINUTE_MS;
}

export function remainingMs(s: ExamSession, now: number): number {
  return Math.max(0, deadline(s) - now);
}

export function isOpen(s: ExamSession, now: number): boolean {
  return s.submittedAt === null && now < deadline(s);
}

export class ExamClosed extends Error {
  constructor() {
    super("The exam is closed");
    this.name = "ExamClosed";
  }
}

function assertOnForm(s: ExamSession, itemId: string): void {
  if (!s.form.items.some((f) => f.itemId === itemId)) throw new RangeError(`${itemId} is not on this form`);
}

/** Record or change an answer; null clears it. mc responses are ORIGINAL choice indices. */
export function answerExam(s: ExamSession, itemId: string, response: Response | null, now: number): ExamSession {
  if (!isOpen(s, now)) throw new ExamClosed();
  assertOnForm(s, itemId);
  const answers = { ...s.answers };
  if (response === null || response === "") delete answers[itemId];
  else answers[itemId] = response;
  return { ...s, answers };
}

/** Map a shown choice position to the original index for an mc form item. */
export function originalChoice(f: FormItem, shownPosition: number): number {
  const v = f.order[shownPosition];
  if (v === undefined) throw new RangeError("choice position out of range");
  return v;
}

export function toggleFlag(s: ExamSession, itemId: string, now: number): ExamSession {
  if (!isOpen(s, now)) throw new ExamClosed();
  assertOnForm(s, itemId);
  const flagged = s.flagged.includes(itemId) ? s.flagged.filter((id) => id !== itemId) : [...s.flagged, itemId];
  return { ...s, flagged };
}

/** Submit. After the deadline the submission time is the deadline. Idempotent. */
export function submitExam(s: ExamSession, now: number): ExamSession {
  if (s.submittedAt !== null) return s;
  return { ...s, submittedAt: Math.min(now, deadline(s)) };
}

export interface Tally {
  id: string;
  correct: number;
  total: number;
  percent: number;
}

export interface ItemResult {
  itemId: string;
  domainId: string;
  skillId: string;
  response: Response | null;
  correct: boolean;
}

export interface ExamResult {
  correct: number;
  total: number;
  percent: number;
  passed: boolean;
  answered: number;
  durationMs: number;
  timedOut: boolean;
  byDomain: Tally[];
  bySkill: Tally[];
  items: ItemResult[];
}

const pct = (c: number, t: number) => (t === 0 ? 0 : Math.round((c / t) * 1000) / 10);

/** Score a submitted (or timed-out) session. `now` closes a session that ran out of time. */
export function scoreExam(s: ExamSession, items: readonly Item[], now: number): ExamResult {
  const closed = s.submittedAt !== null ? s : now >= deadline(s) ? submitExam(s, now) : null;
  if (!closed) throw new Error("Submit the exam before scoring");
  const byId = new Map(items.map((it) => [it.id, it]));
  const results: ItemResult[] = s.form.items.map((f) => {
    const item = byId.get(f.itemId);
    if (!item) throw new Error(`Item ${f.itemId} missing from the bank`);
    const response = s.answers[f.itemId] ?? null;
    return { itemId: f.itemId, domainId: f.domainId, skillId: f.skillId, response, correct: grade(item, response).correct };
  });
  const tally = (key: (r: ItemResult) => string): Tally[] => {
    const m = new Map<string, { c: number; t: number }>();
    for (const r of results) {
      const k = key(r);
      const v = m.get(k) ?? { c: 0, t: 0 };
      v.t += 1;
      if (r.correct) v.c += 1;
      m.set(k, v);
    }
    return [...m].map(([id, v]) => ({ id, correct: v.c, total: v.t, percent: pct(v.c, v.t) }));
  };
  const correct = results.filter((r) => r.correct).length;
  const total = results.length;
  const percent = pct(correct, total);
  const submittedAt = closed.submittedAt as number;
  return {
    correct,
    total,
    percent,
    // Compare on exact counts, not the rounded percent.
    passed: correct * 100 >= s.form.passPercent * total,
    answered: results.filter((r) => r.response !== null).length,
    durationMs: submittedAt - s.startedAt,
    timedOut: submittedAt >= deadline(s),
    byDomain: tally((r) => r.domainId),
    bySkill: tally((r) => r.skillId),
    items: results,
  };
}
