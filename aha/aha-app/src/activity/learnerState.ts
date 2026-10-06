/**
 * The compact, pseudonymous learner summary sent to the model so it can navigate the
 * curriculum. No names, ids, free text or timestamps finer than a day — only levels,
 * recent accuracy/assistance/time signals, active misconception tags and due reviews.
 */
import type { AttemptEvidence, Grade, LearnerState } from '../learning/types';
import { getSkill, skills } from '../learning/curriculum';
import type { ActivitySpec, ResponseType } from './spec';
import { isSpecLike, recentContentOf, RECENT_CONTENT_WINDOW, type RecentContent } from './variety';

/** What a later PR appends to the evidence ledger for each graded Activity Spec. */
export interface ActivityAttemptRecord {
  activityId: string;
  /** Stable hash of the validated spec JSON, so disputes and audits refer to exact content. */
  specHash: string;
  skillIds: string[];
  difficulty: number;
  responseType: ResponseType;
  correct: boolean;
  hintsUsed: number;
  /** Foreground active time only; null when unreliable. */
  activeMs: number | null;
  misconceptionTag?: string;
  at: string;
}

export type SkillState = 'new' | 'developing' | 'secure' | 'retained' | 'review_due';
export interface SkillSummary {
  id: string;
  title: string;
  grade: Grade;
  state: SkillState;
  attempts: number;
  correct: number;
  independent: number;
  /** Consecutive misses at the end of this skill's history: 2+ means change the approach (#860). */
  missStreak: number;
  /** Difficulty (1–10) the model should aim for next on this skill. */
  suggestedDifficulty: number;
}
export interface LearnerSummary {
  version: 1;
  gradeHint: Grade;
  suggestedDifficulty: number;
  frontier: SkillSummary[];
  recent: { attempts: number; accuracy: number | null; independentRate: number | null; hintRate: number | null; medianActiveSec: number | null; streak: number };
  misconceptions: { tag: string; count: number; lastSeenDaysAgo: number }[];
  dueReviews: string[];
  /** Secure skills still building timed fact fluency: deliberate repetition is the point for these. */
  fluency?: string[];
  /** Digest of the last ~40 AI activities (closed vocabulary and numbers, no answers): what not to repeat. */
  recentContent?: RecentContent;
  /** The evidence behind the batch mix (prompt.ts `batchMix`): what to re-drill, review, retire and use for confidence. */
  plan?: BatchPlan;
  /** correct = right on the first try; retryCorrect = right only after the forgiving retry. */
  /** The learner tapped "Try something harder" and no queued activity was harder (#877): aim higher. */
  wantsHarder?: true;
  recentActivities: { skills: string[]; difficulty: number | null; type: string; correct: boolean; hints: number; retryCorrect?: true }[];
}

/**
 * Evidence for a batch's adaptive mix. Skill ids only (plus the misconception tag of a miss); prompt.ts turns it into
 * explicit slots. Empty lists are left out.
 */
export interface BatchPlan {
  /** Missed recently and not yet put right twice unassisted since: re-drill with a fresh surface. Most recent first. */
  redrill?: { id: string; tag?: string }[];
  /** Due reviews, then skills taking root (developing, last answer right): a spaced check. */
  review?: string[];
  /**
   * Answered right, unassisted and fast `RETIRE_STREAK` times in a row: the learner does not need this practice any
   * more. Kept out of the frontier and offered only as an occasional confidence item.
   */
  retired?: string[];
  /** Secure or retired skills for a quick confidence-building win. */
  confident?: string[];
}
/** Consecutive right, unassisted, fast answers that retire a skill. */
export const RETIRE_STREAK = 3;
/**
 * A fast answer: at most this share of the learner's median active time over recent timed answers, clamped to
 * [FAST_FLOOR_MS, FAST_CEILING_MS]. With fewer than 6 timed answers the floor alone applies.
 */
export const FAST_SHARE = 0.75, FAST_FLOOR_MS = 15_000, FAST_CEILING_MS = 30_000;

/** `correct` is first-try correctness: an answer that was right only after the forgiving retry (#872) is a miss, and assisted. */
interface NormalizedAttempt { skillIds: string[]; correct: boolean; hints: number; activeMs: number | null; at: number; difficulty: number | null; type: string; tag?: string; retryCorrect?: true }

const DAY = 86400000;
const DEFAULT_DIFFICULTY = 3;
const clampDifficulty = (d: number) => Math.max(1, Math.min(10, Math.round(d)));
const ratio = (n: number, d: number) => d ? Math.round((n / d) * 100) / 100 : null;

function normalize(ledger: LearnerState | undefined, records: readonly ActivityAttemptRecord[]): NormalizedAttempt[] {
  const fromLedger = (ledger?.attempts ?? []).filter((a: AttemptEvidence) => !a.excluded).map((a): NormalizedAttempt => a.source === 'ai-spec' ? {
    skillIds: a.spec.skillIds, correct: a.correct, hints: a.hintsUsed, activeMs: a.interrupted ? null : a.activeMs,
    at: Date.parse(a.at), difficulty: a.spec.difficulty, type: a.spec.responseType, ...(a.spec.misconceptionTag ? { tag: a.spec.misconceptionTag } : {}),
  } : {
    skillIds: [a.skillId], correct: a.correct && a.firstAnswer === undefined,
    hints: a.firstAnswer === undefined ? a.hintsUsed : Math.max(1, a.hintsUsed), activeMs: a.interrupted ? null : a.activeMs,
    at: Date.parse(a.at), difficulty: null, type: `task:${a.task.kind}`, ...(a.correct && a.firstAnswer !== undefined ? { retryCorrect: true as const } : {}),
  });
  const fromSpecs = records.map(r => ({
    skillIds: r.skillIds, correct: r.correct, hints: r.hintsUsed, activeMs: r.activeMs, at: Date.parse(r.at),
    difficulty: r.difficulty, type: r.responseType, ...(r.misconceptionTag ? { tag: r.misconceptionTag } : {}),
  }));
  return [...fromLedger, ...fromSpecs].filter(a => Number.isFinite(a.at)).sort((a, b) => a.at - b.at);
}

/**
 * Next difficulty from the most recent rated attempts: two independent successes in a row
 * step up, an error steps down, an assisted success holds. Speed never lowers difficulty.
 */
export function suggestDifficulty(history: readonly { correct: boolean; hints: number; difficulty: number | null }[], fallback = DEFAULT_DIFFICULTY): number {
  const rated = history.filter(h => h.difficulty !== null);
  const last = rated.at(-1);
  if (!last) return clampDifficulty(fallback);
  const base = last.difficulty!;
  if (!last.correct) return clampDifficulty(base - 1);
  const previous = rated.at(-2);
  if (last.hints === 0 && previous && previous.correct && previous.hints === 0) return clampDifficulty(base + 1);
  return clampDifficulty(base);
}

const median = (values: number[]) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export interface SummaryInput {
  gradeHint: Grade;
  ledger?: LearnerState;
  activityAttempts?: readonly ActivityAttemptRecord[];
  now?: string;
  frontierLimit?: number;
  wantsHarder?: boolean;
  /**
   * Activities already fetched but not yet answered (queued or on screen), oldest first. They join the
   * ledger's AI activities in `recentContent`, so the next batch does not repeat them either.
   */
  pendingSpecs?: readonly ActivitySpec[];
  /** Skills put right on the forgiving retry this session: a fresh-variant re-drill slot in the next batch, first. */
  redrillSkills?: readonly string[];
}

/** The validated specs of the most recent AI attempts in the ledger, oldest first, one per spec. */
function recentLedgerSpecs(ledger: LearnerState | undefined): ActivitySpec[] {
  const out: ActivitySpec[] = [];
  const seen = new Set<string>();
  const attempts = ledger?.attempts ?? [];
  for (let i = attempts.length - 1; i >= 0 && out.length < RECENT_CONTENT_WINDOW; i--) {
    const a = attempts[i]!;
    if (a.excluded || a.source !== 'ai-spec' || seen.has(a.spec.hash) || !isSpecLike(a.spec.content)) continue;
    seen.add(a.spec.hash);
    out.push(a.spec.content);
  }
  return out.reverse();
}

export function buildLearnerSummary({ gradeHint, ledger, activityAttempts = [], now = new Date().toISOString(), frontierLimit = 10, wantsHarder = false, pendingSpecs = [], redrillSkills = [] }: SummaryInput): LearnerSummary {
  const time = Date.parse(now);
  if (!Number.isFinite(time)) throw new Error('Use a valid timestamp.');
  const attempts = normalize(ledger, activityAttempts);
  const bySkill = new Map<string, NormalizedAttempt[]>();
  for (const a of attempts) for (const id of a.skillIds) if (getSkill(id)) (bySkill.get(id) ?? bySkill.set(id, []).get(id)!).push(a);

  const due = new Set(Object.values(ledger?.progress ?? {}).filter(p => p.nextReviewAt && Date.parse(p.nextReviewAt) <= time).map(p => p.skillId));
  const summarize = (id: string): SkillSummary => {
    const skill = getSkill(id)!;
    const history = bySkill.get(id) ?? [];
    const progress = ledger?.progress[id];
    let independentStreak = 0, missStreak = 0;
    for (let i = history.length - 1; i >= 0 && history[i]!.correct && history[i]!.hints === 0; i--) independentStreak++;
    for (let i = history.length - 1; i >= 0 && !history[i]!.correct; i--) missStreak++;
    let state: SkillState = !history.length ? 'new' : independentStreak >= 3 ? 'secure' : 'developing';
    if (progress?.concept === 'provisional') state = progress.retention === 'retained' ? 'retained' : 'secure';
    if (progress?.concept === 'developing') state = 'developing';
    if (due.has(id)) state = 'review_due';
    return {
      id, title: skill.title, grade: skill.grade, state, attempts: history.length,
      correct: history.filter(h => h.correct).length, independent: history.filter(h => h.correct && h.hints === 0).length, missStreak,
      suggestedDifficulty: suggestDifficulty(history),
    };
  };

  // Frontier: work in progress first, then due reviews, then the next skills after secure ones.
  const lastSeen = (id: string) => bySkill.get(id)?.at(-1)?.at ?? 0;
  const touched = [...bySkill.keys()].sort((a, b) => lastSeen(b) - lastSeen(a)).map(summarize);
  const frontier: SkillSummary[] = [];
  const add = (s: SkillSummary) => { if (frontier.length < frontierLimit && !frontier.some(f => f.id === s.id)) frontier.push(s); };
  touched.filter(s => s.state === 'developing').forEach(add);
  [...due].filter(id => getSkill(id)).map(summarize).forEach(add);
  const secure = touched.filter(s => s.state === 'secure' || s.state === 'retained');
  for (const s of secure) skills.filter(n => n.prerequisites.includes(s.id) && !bySkill.has(n.id)).forEach(n => add(summarize(n.id)));
  secure.slice(0, 3).forEach(add);
  if (!frontier.length) {
    // Cold start: a spread of the hinted grade's domains; the grade is a placement hint, never a ceiling.
    const seenDomains = new Set<string>();
    for (const s of skills) if (s.grade === gradeHint && !seenDomains.has(s.domain)) { seenDomains.add(s.domain); add(summarize(s.id)); }
  }

  const recentWindow = attempts.slice(-20);
  const timed = recentWindow.flatMap(a => a.activeMs === null ? [] : [a.activeMs]);
  let streak = 0;
  for (let i = recentWindow.length - 1; i >= 0; i--) {
    const c = recentWindow[i]!.correct;
    if (streak === 0) streak = c ? 1 : -1;
    else if ((streak > 0) === c) streak += c ? 1 : -1;
    else break;
  }
  const tagCounts = new Map<string, { count: number; last: number }>();
  for (const a of attempts.slice(-30)) if (a.tag) {
    const t = tagCounts.get(a.tag) ?? { count: 0, last: 0 };
    tagCounts.set(a.tag, { count: t.count + 1, last: Math.max(t.last, a.at) });
  }
  // Most recently practised first; prompt.ts adds these ids to the STANDARDS window so the model may use them.
  // Batch mix evidence (#929).
  const timedMedian = timed.length >= 6 ? median(timed)! : null;
  const fastMs = timedMedian === null ? FAST_FLOOR_MS : Math.min(FAST_CEILING_MS, Math.max(FAST_FLOOR_MS, FAST_SHARE * timedMedian));
  const isRetired = (id: string) => {
    if (due.has(id)) return false;
    const tail = (bySkill.get(id) ?? []).slice(-RETIRE_STREAK);
    return tail.length === RETIRE_STREAK && tail.every(a => a.correct && a.hints === 0 && a.activeMs !== null && a.activeMs <= fastMs);
  };
  const byRecency = [...bySkill.keys()].sort((a, b) => lastSeen(b) - lastSeen(a));
  const retired = byRecency.filter(isRetired).slice(0, 6);
  const flagged = [...new Set(redrillSkills)].filter(id => bySkill.has(id) && getSkill(id)).map(id => ({ id }));
  const redrill = [...flagged, ...byRecency.filter(id => !flagged.some(f => f.id === id)).flatMap(id => {
    const history = bySkill.get(id)!;
    let lastMiss = history.length - 1;
    while (lastMiss >= 0 && history[lastMiss]!.correct) lastMiss--;
    if (lastMiss < 0 || lastMiss < history.length - 3) return [];
    const after = history.slice(lastMiss + 1);
    if (after.filter(a => a.correct && a.hints === 0).length >= 2) return [];
    const tag = history[lastMiss]!.tag;
    return [{ id, ...(tag ? { tag } : {}) }];
  })].slice(0, 3);
  const redrillIds = new Set(redrill.map(r => r.id));
  const review = [...[...due].filter(id => getSkill(id) && !redrillIds.has(id)),
    ...byRecency.filter(id => !due.has(id) && !redrillIds.has(id) && !isRetired(id) && summarize(id).state === 'developing' && bySkill.get(id)!.at(-1)!.correct)].slice(0, 4);
  const confident = [...retired, ...byRecency.filter(id => !retired.includes(id) && !due.has(id) && ['secure', 'retained'].includes(summarize(id).state))].slice(0, 3);
  const plan: BatchPlan = {
    ...(redrill.length ? { redrill } : {}), ...(review.length ? { review } : {}),
    ...(retired.length ? { retired } : {}), ...(confident.length ? { confident } : {}),
  };
  // Retired skills leave the frontier: the next batch moves on to new ground (they return only as a confidence item).
  const retiredSet = new Set(retired);
  const activeFrontier = frontier.filter(f => !retiredSet.has(f.id));
  const fluency = Object.values(ledger?.progress ?? {}).filter(p => p.concept === 'provisional' && p.fluency === 'developing' && getSkill(p.skillId))
    .sort((a, b) => b.lastAttemptAt.localeCompare(a.lastAttemptAt)).map(p => p.skillId).slice(0, 4);
  const pending = pendingSpecs.filter(isSpecLike);
  const pendingKeys = new Set(pending.map(s => specHash(s)));
  const recentContent = recentContentOf([...recentLedgerSpecs(ledger).filter(s => !pendingKeys.has(specHash(s))), ...pending]);
  return {
    version: 1,
    gradeHint,
    suggestedDifficulty: suggestDifficulty(attempts),
    frontier: activeFrontier.length ? activeFrontier : frontier,
    recent: {
      attempts: recentWindow.length,
      accuracy: ratio(recentWindow.filter(a => a.correct).length, recentWindow.length),
      independentRate: ratio(recentWindow.filter(a => a.correct && a.hints === 0).length, recentWindow.length),
      hintRate: ratio(recentWindow.filter(a => a.hints > 0).length, recentWindow.length),
      medianActiveSec: timed.length ? Math.round(median(timed)! / 100) / 10 : null,
      streak,
    },
    misconceptions: [...tagCounts].sort((a, b) => b[1].count - a[1].count || b[1].last - a[1].last).slice(0, 6)
      .map(([tag, t]) => ({ tag, count: t.count, lastSeenDaysAgo: Math.max(0, Math.floor((time - t.last) / DAY)) })),
    dueReviews: [...due].slice(0, 6),
    ...(fluency.length ? { fluency } : {}),
    ...(recentContent ? { recentContent } : {}),
    ...(Object.keys(plan).length ? { plan } : {}),
    ...(wantsHarder ? { wantsHarder: true as const } : {}),
    recentActivities: attempts.slice(-6).map(a => ({ skills: a.skillIds, difficulty: a.difficulty, type: a.type, correct: a.correct, hints: a.hints, ...(a.retryCorrect ? { retryCorrect: true as const } : {}) })),
  };
}

const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`
  : JSON.stringify(v);
/** Stable content identifier (two FNV-1a lanes over sorted-key JSON). An audit id, not a security hash. */
export function specHash(spec: ActivitySpec): string {
  const text = canonical(spec);
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}
