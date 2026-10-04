/**
 * The compact, pseudonymous learner summary sent to the model so it can navigate the
 * curriculum. No names, ids, free text or timestamps finer than a day — only levels,
 * recent accuracy/assistance/time signals, active misconception tags and due reviews.
 */
import type { AttemptEvidence, Grade, LearnerState } from '../learning/types';
import { getSkill, skills } from '../learning/curriculum';
import type { ActivitySpec, ResponseType } from './spec';

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
  recentActivities: { skills: string[]; difficulty: number | null; type: string; correct: boolean; hints: number }[];
}

interface NormalizedAttempt { skillIds: string[]; correct: boolean; hints: number; activeMs: number | null; at: number; difficulty: number | null; type: string; tag?: string }

const DAY = 86400000;
const DEFAULT_DIFFICULTY = 3;
const clampDifficulty = (d: number) => Math.max(1, Math.min(10, Math.round(d)));
const ratio = (n: number, d: number) => d ? Math.round((n / d) * 100) / 100 : null;

function normalize(ledger: LearnerState | undefined, records: readonly ActivityAttemptRecord[]): NormalizedAttempt[] {
  const fromLedger = (ledger?.attempts ?? []).filter((a: AttemptEvidence) => !a.excluded).map(a => ({
    skillIds: [a.skillId], correct: a.correct, hints: a.hintsUsed, activeMs: a.interrupted ? null : a.activeMs,
    at: Date.parse(a.at), difficulty: null, type: `task:${a.task.kind}`,
  }));
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
}

export function buildLearnerSummary({ gradeHint, ledger, activityAttempts = [], now = new Date().toISOString(), frontierLimit = 10 }: SummaryInput): LearnerSummary {
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
    let independentStreak = 0;
    for (let i = history.length - 1; i >= 0 && history[i]!.correct && history[i]!.hints === 0; i--) independentStreak++;
    let state: SkillState = !history.length ? 'new' : independentStreak >= 3 ? 'secure' : 'developing';
    if (progress?.concept === 'provisional') state = progress.retention === 'retained' ? 'retained' : 'secure';
    if (progress?.concept === 'developing') state = 'developing';
    if (due.has(id)) state = 'review_due';
    return {
      id, title: skill.title, grade: skill.grade, state, attempts: history.length,
      correct: history.filter(h => h.correct).length, independent: history.filter(h => h.correct && h.hints === 0).length,
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
  return {
    version: 1,
    gradeHint,
    suggestedDifficulty: suggestDifficulty(attempts),
    frontier,
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
    recentActivities: attempts.slice(-6).map(a => ({ skills: a.skillIds, difficulty: a.difficulty, type: a.type, correct: a.correct, hints: a.hints })),
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
