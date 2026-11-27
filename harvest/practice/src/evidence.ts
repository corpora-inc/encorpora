/**
 * Evidence model per skill.
 *
 * Each skill has a latent ability θ on the logit scale with a Gaussian belief
 * N(mu, sigma²). An item of baked difficulty d (0..1) sits at b = (d - 0.5)·4.
 * The chance of a correct answer is
 *
 *     P = c + (1 - c - s) · sigmoid(θ - b)
 *
 * with a guessing floor c (1/choices for multiple choice, 0 otherwise) and a
 * small slip s. Each attempt is an exact Bayesian update on a fixed grid,
 * refit to a Gaussian, so the state stays two numbers per skill. Belief widens
 * and relaxes toward the prior with time since the last evidence
 * (forgetting), which is what brings a mastered skill back for review.
 *
 * The mastery estimate is the expected chance of answering a typical item
 * (d = 0.5, no guessing), with an 80% interval. A skill counts as mastered
 * when the belief puts at least 80% probability on θ above the point where a
 * typical item is answered correctly 80% of the time.
 */

import { DAY_MS, type Item } from "./types.ts";

export const MODEL = Object.freeze({
  priorMu: 0,
  priorSigma: 1.5,
  minSigma: 0.25,
  /** Variance added per day without evidence. */
  driftPerDay: 0.02,
  /** The mean relaxes toward the prior with this half-life (forgetting). */
  meanHalfLifeDays: 90,
  slip: 0.05,
  defaultChoices: 4,
  /** θ at which a typical item is answered correctly 80% of the time. */
  masteryTheta: Math.log(0.8 / 0.2),
  masteryConfidence: 0.8,
  struggleBelow: 0.4,
  gridMin: -6,
  gridMax: 6,
  gridStep: 0.05,
});

export type SkillStatus = "new" | "learning" | "struggling" | "mastered" | "review";

export interface SkillEvidence {
  skillId: string;
  mu: number;
  sigma: number;
  /** Attempts and correct attempts counted, for display. */
  n: number;
  correct: number;
  /** Epoch ms of the last attempt; null before any. */
  lastAt: number | null;
  /** Set once the skill first reaches mastered; drives the "review" status after decay. */
  everMastered: boolean;
}

export interface Estimate {
  skillId: string;
  /** Expected chance of answering a typical item, 0..1. */
  mastery: number;
  /** 80% interval for that chance. */
  low: number;
  high: number;
  /** Probability the skill is mastered. */
  pMastered: number;
  mu: number;
  sigma: number;
  n: number;
  correct: number;
  status: SkillStatus;
}

export type EvidenceBook = Readonly<Record<string, SkillEvidence>>;

export function newEvidence(skillId: string): SkillEvidence {
  return { skillId, mu: MODEL.priorMu, sigma: MODEL.priorSigma, n: 0, correct: 0, lastAt: null, everMastered: false };
}

export function itemLocation(difficulty: number): number {
  if (!Number.isFinite(difficulty)) throw new RangeError("difficulty must be finite");
  const d = Math.min(1, Math.max(0, difficulty));
  return (d - 0.5) * 4;
}

export function guessFloor(item: Pick<Item, "kind" | "choiceCount">): number {
  if (item.kind !== "mc") return 0;
  const k = item.choiceCount ?? MODEL.defaultChoices;
  return k >= 2 ? 1 / k : 0;
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Probability of a correct answer at ability θ. */
export function pCorrect(theta: number, b: number, guess: number): number {
  return guess + (1 - guess - MODEL.slip) * sigmoid(theta - b);
}

const GRID: readonly number[] = (() => {
  const g: number[] = [];
  const steps = Math.round((MODEL.gridMax - MODEL.gridMin) / MODEL.gridStep);
  for (let i = 0; i <= steps; i++) g.push(MODEL.gridMin + i * MODEL.gridStep);
  return g;
})();

function normalPdf(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z);
}

/** Widen the belief for time passed since the last evidence. */
export function decayed(e: SkillEvidence, now: number): SkillEvidence {
  if (e.lastAt === null || now <= e.lastAt) return e;
  const days = (now - e.lastAt) / DAY_MS;
  const variance = Math.min(MODEL.priorSigma ** 2, e.sigma ** 2 + MODEL.driftPerDay * days);
  const keep = Math.pow(0.5, days / MODEL.meanHalfLifeDays);
  return { ...e, mu: MODEL.priorMu + (e.mu - MODEL.priorMu) * keep, sigma: Math.max(e.sigma, Math.sqrt(variance)) };
}

export interface Observation {
  correct: boolean;
  difficulty: number;
  guess: number;
  at: number;
}

/** Exact grid update of one attempt, refit to a Gaussian. Pure. */
export function update(e: SkillEvidence, obs: Observation): SkillEvidence {
  if (!(obs.guess >= 0 && obs.guess < 1 - MODEL.slip)) throw new RangeError("bad guess floor");
  const prior = decayed(e, obs.at);
  const b = itemLocation(obs.difficulty);
  let total = 0;
  let m1 = 0;
  let m2 = 0;
  for (const theta of GRID) {
    const p = pCorrect(theta, b, obs.guess);
    const w = normalPdf(theta, prior.mu, prior.sigma) * (obs.correct ? p : 1 - p);
    total += w;
    m1 += w * theta;
  }
  const mu = m1 / total;
  for (const theta of GRID) {
    const p = pCorrect(theta, b, obs.guess);
    const w = normalPdf(theta, prior.mu, prior.sigma) * (obs.correct ? p : 1 - p);
    m2 += w * (theta - mu) ** 2;
  }
  const sigma = Math.max(MODEL.minSigma, Math.sqrt(m2 / total));
  const next: SkillEvidence = {
    ...prior,
    mu,
    sigma,
    n: prior.n + 1,
    correct: prior.correct + (obs.correct ? 1 : 0),
    lastAt: Math.max(obs.at, prior.lastAt ?? obs.at),
  };
  if (!next.everMastered && probabilityAbove(next.mu, next.sigma, MODEL.masteryTheta) >= MODEL.masteryConfidence) {
    next.everMastered = true;
  }
  return next;
}

/** P(θ > t) for θ ~ N(mu, sigma²). */
export function probabilityAbove(mu: number, sigma: number, t: number): number {
  return 1 - normalCdf((t - mu) / sigma);
}

/** Abramowitz-Stegun 7.1.26 via erf; max error ~1.5e-7. */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** E[sigmoid(θ)] for θ ~ N(mu, sigma²), by quadrature on the grid. */
export function expectedSuccess(mu: number, sigma: number, b = 0): number {
  let total = 0;
  let acc = 0;
  for (const theta of GRID) {
    const w = normalPdf(theta, mu, sigma);
    total += w;
    acc += w * sigmoid(theta - b);
  }
  return acc / total;
}

export function estimate(e: SkillEvidence, now: number): Estimate {
  const d = decayed(e, now);
  const mastery = expectedSuccess(d.mu, d.sigma);
  const pMastered = probabilityAbove(d.mu, d.sigma, MODEL.masteryTheta);
  const z = 1.2815515655446004; // 80% two-sided
  let status: SkillStatus;
  if (d.n === 0) status = "new";
  else if (pMastered >= MODEL.masteryConfidence) status = "mastered";
  else if (d.everMastered) status = "review";
  else if (d.n >= 3 && mastery < MODEL.struggleBelow) status = "struggling";
  else status = "learning";
  return {
    skillId: d.skillId,
    mastery,
    low: sigmoid(d.mu - z * d.sigma),
    high: sigmoid(d.mu + z * d.sigma),
    pMastered,
    mu: d.mu,
    sigma: d.sigma,
    n: d.n,
    correct: d.correct,
    status,
  };
}

/** Record one attempt in the book. Returns a new book. */
export function recordAttempt(
  book: EvidenceBook,
  item: Pick<Item, "skillId" | "difficulty" | "kind" | "choiceCount">,
  correct: boolean,
  at: number,
): EvidenceBook {
  const prev = book[item.skillId] ?? newEvidence(item.skillId);
  return { ...book, [item.skillId]: update(prev, { correct, difficulty: item.difficulty, guess: guessFloor(item), at }) };
}

export function estimateOf(book: EvidenceBook, skillId: string, now: number): Estimate {
  return estimate(book[skillId] ?? newEvidence(skillId), now);
}

/** Predicted chance of a correct answer on a specific item, integrating over the belief. */
export function predictItem(
  book: EvidenceBook,
  item: Pick<Item, "skillId" | "difficulty" | "kind" | "choiceCount">,
  now: number,
): number {
  const e = decayed(book[item.skillId] ?? newEvidence(item.skillId), now);
  const guess = guessFloor(item);
  return guess + (1 - guess - MODEL.slip) * expectedSuccess(e.mu, e.sigma, itemLocation(item.difficulty));
}
