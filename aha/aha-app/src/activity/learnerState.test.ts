import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createLearner, recordAttempt } from '../learning/engine';
import { generatePractice } from '../learning/practice';
import { expectedAnswer } from '../learning/tasks';
import { buildLearnerSummary, specHash, suggestDifficulty, type ActivityAttemptRecord } from './learnerState';
import { fixtures } from './fixtures';

const rec = (over: Partial<ActivityAttemptRecord>, i: number): ActivityAttemptRecord => ({
  activityId: `a${i}`, specHash: 'h', skillIds: ['3.NF.A.1'], difficulty: 4, responseType: 'fraction', correct: true, hintsUsed: 0, activeMs: 20000,
  at: new Date(Date.UTC(2026, 9, 1, 10, i)).toISOString(), ...over,
});

describe('learner summary', () => {
  it('suggests difficulty from recent rated attempts', () => {
    assert.equal(suggestDifficulty([]), 3);
    assert.equal(suggestDifficulty([{ correct: true, hints: 0, difficulty: 4 }, { correct: true, hints: 0, difficulty: 4 }]), 5);
    assert.equal(suggestDifficulty([{ correct: true, hints: 0, difficulty: 4 }, { correct: true, hints: 1, difficulty: 4 }]), 4);
    assert.equal(suggestDifficulty([{ correct: true, hints: 0, difficulty: 4 }, { correct: false, hints: 0, difficulty: 5 }]), 4);
    assert.equal(suggestDifficulty([{ correct: false, hints: 0, difficulty: 1 }]), 1);
    assert.equal(suggestDifficulty([{ correct: true, hints: 0, difficulty: 10 }, { correct: true, hints: 0, difficulty: 10 }]), 10);
  });
  it('flags wantsHarder only when the learner asked for it (#877)', () => {
    assert.equal('wantsHarder' in buildLearnerSummary({ gradeHint: 3, now: '2026-10-04T00:00:00Z' }), false);
    assert.equal(buildLearnerSummary({ gradeHint: 3, now: '2026-10-04T00:00:00Z', wantsHarder: true }).wantsHarder, true);
  });
  it('cold-starts with one skill per domain of the hinted grade', () => {
    const s = buildLearnerSummary({ gradeHint: 3, now: '2026-10-04T00:00:00Z' });
    assert.ok(s.frontier.length >= 5);
    assert.ok(s.frontier.every(f => f.grade === 3 && f.state === 'new'));
    assert.equal(new Set(s.frontier.map(f => f.id.split('.')[1])).size, s.frontier.length);
    assert.equal(s.recent.attempts, 0);
    assert.equal(s.recent.accuracy, null);
  });
  it('summarizes activity attempts: states, streaks, misconceptions, timing', () => {
    const records = [
      rec({ correct: true }, 1), rec({ correct: true }, 2), rec({ correct: true }, 3),
      rec({ skillIds: ['4.NF.B.3'], correct: false, misconceptionTag: 'added_denominators', difficulty: 5, activeMs: 40000 }, 4),
      rec({ skillIds: ['4.NF.B.3'], correct: false, misconceptionTag: 'added_denominators', difficulty: 4, hintsUsed: 1 }, 5),
    ];
    const s = buildLearnerSummary({ gradeHint: 4, activityAttempts: records, now: '2026-10-03T12:00:00Z' });
    const nf3 = s.frontier.find(f => f.id === '4.NF.B.3')!;
    assert.equal(nf3.state, 'developing');
    assert.equal(nf3.suggestedDifficulty, 3);
    assert.equal(s.frontier[0]!.id, '4.NF.B.3', 'developing work comes first');
    const nf1 = s.frontier.find(f => f.id === '3.NF.A.1');
    assert.equal(nf1?.state, 'secure');
    assert.deepEqual(s.misconceptions, [{ tag: 'added_denominators', count: 2, lastSeenDaysAgo: 2 }]);
    assert.equal(s.recent.streak, -2);
    assert.equal(s.recent.accuracy, 0.6);
    assert.equal(s.recent.hintRate, 0.2);
    assert.equal(s.recent.medianActiveSec, 20);
    assert.equal(s.recentActivities.length, 5);
  });
  it('folds in the existing evidence ledger and never includes identifiers', () => {
    let state = createLearner('learner-secret-id', 2);
    const activity = generatePractice('2.OA.B.2', 7);
    state = recordAttempt(state, activity, { id: 'x1', answer: expectedAnswer(activity.task), at: '2026-10-01T10:00:00Z', hintsUsed: 1, activeMs: 3000 });
    const s = buildLearnerSummary({ gradeHint: 2, ledger: state, now: '2026-10-04T10:00:00Z' });
    const text = JSON.stringify(s);
    assert.ok(!text.includes('learner-secret-id'));
    assert.ok(!text.includes('x1'));
    assert.ok(s.frontier.some(f => f.id === '2.OA.B.2'));
    assert.ok(s.dueReviews.includes('2.OA.B.2'), 'an assisted answer schedules a next-day review');
    assert.equal(s.frontier.find(f => f.id === '2.OA.B.2')!.state, 'review_due');
  });
  it('marks fluency targets: secure skills still building timed fact fluency', () => {
    const state = createLearner('learner', 3);
    state.progress['3.OA.C.7'] = { skillId: '3.OA.C.7', concept: 'provisional', fluency: 'developing', retention: 'unconfirmed', independentSuccesses: 3, distinctVariants: [], reviewStage: 1, nextReviewAt: null, lastAttemptAt: '2026-10-01T10:00:00Z' };
    state.progress['3.NF.A.1'] = { ...state.progress['3.OA.C.7'], skillId: '3.NF.A.1', fluency: 'not-applicable' };
    assert.deepEqual(buildLearnerSummary({ gradeHint: 3, ledger: state, now: '2026-10-04T10:00:00Z' }).fluency, ['3.OA.C.7']);
    assert.equal('fluency' in buildLearnerSummary({ gradeHint: 3, now: '2026-10-04T10:00:00Z' }), false);
  });
  it('hashes specs stably regardless of key order', () => {
    const f = fixtures[0]!;
    const reordered = Object.fromEntries(Object.entries(f).reverse()) as typeof f;
    assert.equal(specHash(f), specHash(reordered));
    assert.notEqual(specHash(f), specHash(fixtures[1]!));
    assert.match(specHash(f), /^[0-9a-f]{16}$/);
  });
});

describe('forgiving retry (#872) in the learner summary', () => {
  it('reports first-try correctness: a correct answer after the nudge is assisted, not a clean correct', () => {
    let state = createLearner('learner', 2);
    const activity = generatePractice('2.OA.B.2', 7);
    const right = expectedAnswer(activity.task);
    const wrong = String(Number(right) + 1);
    state = recordAttempt(state, activity, { id: 'r1', answer: right, firstAnswer: wrong, at: '2026-10-01T10:00:00Z', hintsUsed: 1, activeMs: 3000 });
    const s = buildLearnerSummary({ gradeHint: 2, ledger: state, now: '2026-10-01T12:00:00Z' });
    assert.equal(s.recent.accuracy, 0, 'first-try accuracy');
    assert.equal(s.recent.streak, -1);
    assert.equal(s.recent.independentRate, 0);
    assert.deepEqual(s.recentActivities[0], { skills: ['2.OA.B.2'], difficulty: null, type: 'task:arithmetic', correct: false, hints: 1, retryCorrect: true });
    assert.equal(s.frontier.find(f => f.id === '2.OA.B.2')!.missStreak, 1);
  });
});
