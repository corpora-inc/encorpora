/**
 * Readiness: the chance a learner passes a full mock exam, from their practice evidence.
 *
 * Evidence is the per-skill belief of `evidence.ts`: ability θ ~ N(mu, sigma²) per skill,
 * decayed to `now` (forgetting). A blueprint form draws `count` items per domain from the
 * domain's skills; an item of difficulty d sits at b = (d - 0.5)·4 and is answered correctly
 * with P = c + (1 - c - s)·sigmoid(θ - b) (guessing floor c, slip s), the same model practice
 * updates with.
 *
 * Skills are pooled per learner. Each skill's belief (as of its last attempt) was updated from a
 * population prior N(priorMu, priorSigma²); dividing that prior out leaves the skill's own
 * likelihood. Forgetting is applied to the likelihood, not by dividing the prior out of a decayed
 * belief: its variance grows by MODEL.driftPerDay per idle day and its weight halves every
 * MODEL.meanHalfLifeDays, so an idle skill's evidence fades smoothly toward nothing. A learner
 * level m is estimated from all of them (a skill's likelihood ~ N(m, 1/precision + τ²), τ the
 * spread of one learner's skills), and each skill's ability is its likelihood combined with
 * N(m, τ²). An unpracticed skill therefore sits at the learner's own level, not the population's,
 * and m's uncertainty is shared across skills (drawn once per Monte Carlo draw).
 *
 * Each Monte Carlo draw samples m, then every skill's θ given m. Given the draw, a domain's
 * items are exchangeable (skill and difficulty drawn uniformly), so the domain score is
 * Binomial(count, p_d) with p_d the mean success over the domain's skills and the exam's
 * difficulty mix; the total is the convolution of the domain binomials. Averaging the total's
 * distribution over draws gives the pass probability, the expected score and its interval,
 * with the uncertainty in the learner's beliefs carried through.
 *
 * Skills with no evidence keep the prior, which is wide: `evidence.coverage` says what share
 * of the exam rests on skills with at least `minAttempts` attempts, and `confident` is false
 * until it reaches `minCoverage`, so the app can say "not enough evidence yet" instead of a
 * number it cannot back. (Belief width is reported but not used for this: a learner who gets
 * everything right keeps a wide upper tail while being clearly ready.)
 */

import { MODEL, decayed, itemLocation, newEvidence, pCorrect, type EvidenceBook } from "./evidence.ts";
import { createRng, type Rng } from "./rng.ts";
import { validateBlueprint, type ExamBlueprint } from "./exam.ts";
import { DAY_MS } from "./types.ts";

export interface ReadinessOptions {
  /** Difficulties (0..1) a real form draws from, equally likely. Default [0.5, 0.65, 0.8]. */
  examDifficulties?: readonly number[];
  /** Guessing floor for the exam's items. Default 1/4 (four options). */
  guess?: number;
  /**
   * Population prior on a learner's level m: mean and sd. Default MODEL.priorMu / priorSigma.
   * Fit it to real learners' histories (see crane/eval/READINESS.md); a mismatched population
   * prior shrinks capable learners' predictions toward the population.
   */
  populationMu?: number;
  populationSigma?: number;
  /** Spread τ of one learner's skill abilities around their level. Default 0.7. */
  /**
   * Relative chance a domain's item comes from each skill, e.g. its count of distinct facts in the
   * bank (how `buildExam` fills a form). Default: every skill in a domain equally likely.
   */
  skillWeights?: Readonly<Record<string, number>>;
  skillSpread?: number;
  /** Monte Carlo draws over the beliefs. Default 1000. */
  draws?: number;
  seed?: string;
  /**
   * Attempts a skill needs before it counts as covered. A skill also stops counting once
   * forgetting has removed more than half of its evidence. Default 5.
   */
  minAttempts?: number;
  /** Share of the exam's items that must rest on covered skills before `confident`. Default 0.9. */
  minCoverage?: number;
}

export interface DomainReadiness {
  domainId: string;
  count: number;
  /** Expected share of this domain's items answered correctly. */
  expected: number;
}

export interface SkillShortfall {
  skillId: string;
  /** The first domain that lists the skill (its items count in every domain that does). */
  domainId: string;
  /** Expected chance of answering this skill's exam items. */
  expected: number;
  /** Expected exam items lost to this skill: (1 - expected) x items it is expected to fill. */
  expectedItemsLost: number;
}

export interface Readiness {
  /** Probability the score reaches the pass mark. */
  pPass: number;
  /** Expected percent correct, 0..100. */
  expectedPercent: number;
  /** 80% interval of the percent score (belief uncertainty plus the exam's own chance). */
  low: number;
  high: number;
  passMark: number;
  items: number;
  byDomain: DomainReadiness[];
  /** Skills ordered by expected exam items lost, largest first. */
  weakest: SkillShortfall[];
  evidence: {
    /** Share of the exam's expected items whose skill has at least `minAttempts` attempts. */
    coverage: number;
    /** Weighted mean belief sigma over the exam's skills. */
    meanSigma: number;
    attempts: number;
    skillsPracticed: number;
    skillsInExam: number;
    /** Pooled learner level m (logit scale) and its standard deviation. */
    learnerLevel: number;
    learnerLevelSd: number;
  };
  /** True when coverage reaches `minCoverage`. */
  confident: boolean;
}

function normal(rng: Rng): number {
  // Box-Muller from the engine's seeded generator.
  let u = 0;
  while (u === 0) u = rng.next();
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function binomial(n: number, p: number): number[] {
  const out = new Array<number>(n + 1).fill(0);
  let c = 1;
  for (let k = 0; k <= n; k++) {
    out[k] = c * Math.pow(p, k) * Math.pow(1 - p, n - k);
    c = (c * (n - k)) / (k + 1);
  }
  return out;
}

function convolve(a: number[], b: number[]): number[] {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    if (a[i]! === 0) continue;
    const ai = a[i]!;
    for (let j = 0; j < b.length; j++) out[i + j]! += ai * b[j]!;
  }
  return out;
}

export function readiness(book: EvidenceBook, bp: ExamBlueprint, now: number, opts: ReadinessOptions = {}): Readiness {
  validateBlueprint(bp);
  if (!Number.isFinite(now)) throw new RangeError("now must be a finite time");
  const diffs = opts.examDifficulties ?? [0.5, 0.65, 0.8];
  if (!diffs.length) throw new RangeError("examDifficulties must not be empty");
  if (!diffs.every((d) => Number.isFinite(d))) throw new RangeError("examDifficulties must be finite");
  const bs = diffs.map(itemLocation);
  const guess = opts.guess ?? 0.25;
  const draws = opts.draws ?? 1000;
  if (!Number.isInteger(draws) || draws < 1) throw new RangeError("draws must be a positive integer");
  if (!(guess >= 0 && guess < 1 - MODEL.slip)) throw new RangeError("guess must be in [0, 1 - slip)");
  const spread = opts.skillSpread ?? 0.7;
  if (!(spread > 0 && Number.isFinite(spread))) throw new RangeError("skillSpread must be positive");
  const weight = (s: string): number => {
    const w = opts.skillWeights?.[s] ?? 1;
    if (!(w > 0 && Number.isFinite(w))) throw new RangeError(`skill weight for ${s} must be positive`);
    return w;
  };
  const rng = createRng(opts.seed ?? "readiness");
  const items = bp.domains.reduce((s, d) => s + d.count, 0);
  if (items === 0) throw new RangeError("blueprint has no items");
  const passMark = Math.ceil((bp.passPercent / 100) * items - 1e-9);

  // Beliefs at `now`, and how many exam items each skill is expected to fill.
  const skillShare = new Map<string, { domainId: string; share: number }[]>();
  const domainWeight = new Map<string, number>();
  for (const d of bp.domains) {
    const wsum = d.skillIds.reduce((x, s) => x + weight(s), 0);
    domainWeight.set(d.id, wsum);
    for (const s of d.skillIds) {
      const list = skillShare.get(s) ?? [];
      list.push({ domainId: d.id, share: (d.count * weight(s)) / wsum });
      skillShare.set(s, list);
    }
  }
  const beliefs = new Map<string, { sigma: number; n: number; lp: number; lm: number; kept: number }>();
  const tau2 = spread ** 2;
  const p0 = 1 / MODEL.priorSigma ** 2;
  const pm = 1 / (opts.populationSigma ?? MODEL.priorSigma) ** 2;
  let precM = pm;
  let sumM = (opts.populationMu ?? MODEL.priorMu) * pm;
  for (const s of skillShare.keys()) {
    const e0 = book[s] ?? newEvidence(s);
    if (!Number.isFinite(e0.mu) || !(e0.sigma > 0) || !Number.isFinite(e0.sigma)) {
      throw new RangeError(`skill ${s} has an invalid belief`);
    }
    // The skill's own likelihood at its last attempt, the population prior divided out
    // (Gaussian approximation), then faded for the days since.
    const lp0 = Math.max(0, 1 / e0.sigma ** 2 - p0);
    const lm = lp0 > 1e-9 ? (e0.mu / e0.sigma ** 2 - MODEL.priorMu * p0) / lp0 : 0;
    let lp = lp0;
    if (lp0 > 1e-9 && e0.lastAt !== null && now > e0.lastAt) {
      const days = (now - e0.lastAt) / DAY_MS;
      lp = Math.pow(0.5, days / MODEL.meanHalfLifeDays) / (1 / lp0 + MODEL.driftPerDay * days);
    }
    beliefs.set(s, { sigma: decayed(e0, now).sigma, n: e0.n, lp, lm, kept: lp0 > 1e-9 ? lp / lp0 : 0 });
    if (lp > 1e-9) {
      const w = 1 / (1 / lp + tau2);
      precM += w;
      sumM += w * lm;
    }
  }
  const mHat = sumM / precM;
  const mSd = Math.sqrt(1 / precM);

  const totalDist = new Array<number>(items + 1).fill(0);
  const domainSum = new Map<string, number>(bp.domains.map((d) => [d.id, 0]));
  const skillSum = new Map<string, number>([...skillShare.keys()].map((s) => [s, 0]));
  for (let t = 0; t < draws; t++) {
    const success = new Map<string, number>();
    const m = mHat + mSd * normal(rng);
    for (const [s, b] of beliefs) {
      const prec = b.lp + 1 / tau2;
      const theta = (b.lp * b.lm + m / tau2) / prec + normal(rng) / Math.sqrt(prec);
      let p = 0;
      for (const loc of bs) p += pCorrect(theta, loc, guess);
      success.set(s, p / bs.length);
    }
    let dist = [1];
    for (const d of bp.domains) {
      let pd = 0;
      for (const s of d.skillIds) pd += weight(s) * success.get(s)!;
      pd /= domainWeight.get(d.id)!;
      domainSum.set(d.id, domainSum.get(d.id)! + pd);
      dist = convolve(dist, binomial(d.count, pd));
    }
    for (let k = 0; k <= items; k++) totalDist[k]! += dist[k]! / draws;
    for (const [s, p] of success) skillSum.set(s, skillSum.get(s)! + p);
  }

  let pPass = 0;
  let mean = 0;
  for (let k = 0; k <= items; k++) {
    const pk = totalDist[k]!;
    if (k >= passMark) pPass += pk;
    mean += k * pk;
  }
  const quantile = (q: number): number => {
    let c = 0;
    for (let k = 0; k <= items; k++) {
      c += totalDist[k]!;
      if (c >= q) return k;
    }
    return items;
  };

  let covered = 0;
  let sigmaW = 0;
  let attempts = 0;
  let practiced = 0;
  const weakest: SkillShortfall[] = [];
  for (const [s, shares] of skillShare) {
    const b = beliefs.get(s)!;
    const share = shares.reduce((x, y) => x + y.share, 0);
    if (b.n > 0) practiced++;
    if (b.n >= (opts.minAttempts ?? 5) && b.kept >= 0.5) covered += share;
    attempts += b.n;
    sigmaW += b.sigma * share;
    const expected = skillSum.get(s)! / draws;
    weakest.push({ skillId: s, domainId: shares[0]!.domainId, expected, expectedItemsLost: (1 - expected) * share });
  }
  weakest.sort((a, b) => b.expectedItemsLost - a.expectedItemsLost);
  const coverage = covered / items;
  const meanSigma = sigmaW / items;
  return {
    pPass,
    expectedPercent: (100 * mean) / items,
    low: (100 * quantile(0.1)) / items,
    high: (100 * quantile(0.9)) / items,
    passMark,
    items,
    byDomain: bp.domains.map((d) => ({ domainId: d.id, count: d.count, expected: domainSum.get(d.id)! / draws })),
    weakest,
    evidence: { coverage, meanSigma, attempts, skillsPracticed: practiced, skillsInExam: skillShare.size,
                learnerLevel: mHat, learnerLevelSd: mSd },
    confident: coverage >= (opts.minCoverage ?? 0.9) - 1e-9,
  };
}
