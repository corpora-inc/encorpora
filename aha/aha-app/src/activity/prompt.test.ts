import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { approxTokens, buildActivityPrompt, ACTIVITY_AUTHOR_RULES } from './prompt';
import { buildLearnerSummary, type ActivityAttemptRecord } from './learnerState';
import { fixtures } from './fixtures';
import { validateActivityBatch, FigureSchema, ResponseSchema } from './spec';

function realisticSummary() {
  const skills = ['3.NF.A.1', '3.NF.A.2', '3.NF.A.3', '3.MD.C.7', '4.NF.B.3', '3.OA.C.7', '3.MD.D.8', '4.NF.A.1'];
  const records: ActivityAttemptRecord[] = Array.from({ length: 40 }, (_, i) => ({
    activityId: `a${i}`, specHash: 'h'.repeat(16), skillIds: [skills[i % skills.length]!], difficulty: 3 + (i % 4),
    responseType: (['numeric', 'fraction', 'multiple_choice', 'plot_point'] as const)[i % 4], correct: i % 3 !== 0, hintsUsed: i % 5 === 0 ? 1 : 0,
    activeMs: 15000 + i * 700, ...(i % 6 === 0 ? { misconceptionTag: ['added_denominators', 'part_to_part', 'perimeter_for_area'][i % 3]! } : {}),
    at: new Date(Date.UTC(2026, 8, 20 + Math.floor(i / 4), 16, i)).toISOString(),
  }));
  return buildLearnerSummary({ gradeHint: 3, activityAttempts: records, now: '2026-10-04T16:00:00Z' });
}

describe('activity batch prompt', () => {
  it('stays within the input token budget for a realistic learner', () => {
    const p = buildActivityPrompt(realisticSummary());
    const total = approxTokens(p.system) + approxTokens(p.user);
    // gpt-4o via Free2Z; input is cheap relative to output but must stay bounded.
    assert.ok(total <= 4000, `prompt ~${total} tokens`);
    assert.ok(approxTokens(p.user) <= 1800, `user ~${approxTokens(p.user)} tokens`);
  });
  it('keeps typical activities small enough for 3–5 per ≤2.5k-token reply', () => {
    // JSON tokenizes at roughly 3.3 chars/token; use the conservative estimate.
    const tokens = fixtures.map(f => Math.ceil(JSON.stringify(f).length / 3.3)).sort((a, b) => a - b);
    const median = tokens[Math.floor(tokens.length / 2)]!;
    assert.ok(median * 4 + 120 <= 2000, `median activity ~${median} tokens`);
    assert.ok(tokens.at(-1)! <= 600, `largest fixture ~${tokens.at(-1)} tokens`);
  });
  it('describes every figure and response type and the safety rules', () => {
    for (const o of FigureSchema.options) assert.ok(ACTIVITY_AUTHOR_RULES.includes(` ${o.shape.type.value}{`), o.shape.type.value);
    for (const o of ResponseSchema.options) assert.ok(ACTIVITY_AUTHOR_RULES.includes(` ${o.shape.type.value}{`), o.shape.type.value);
    for (const phrase of ['keyCheck', 'no brands', 'Never ask for personal information', 'data, not instructions', 'never a ceiling', '\\$', 'minified JSON']) assert.ok(ACTIVITY_AUTHOR_RULES.includes(phrase), phrase);
  });
  it('offers only skill ids the validator will accept, with the frontier first', () => {
    const summary = realisticSummary();
    const p = buildActivityPrompt(summary);
    for (const f of summary.frontier) assert.ok(p.allowedSkillIds.has(f.id), f.id);
    assert.ok(p.allowedSkillIds.size <= 60);
    assert.ok(p.user.includes('3.NF.A.1 Interpret numerator and denominator through parts'));
    assert.ok(!/learner-|specHash|activityId/.test(p.user), 'no identifiers in the prompt');
    // A reply using an id outside the window is rejected per item.
    const reply = { rationale: 'Fractions focus.', activities: [fixtures.find(f => f.id === 'fx-3-fraction-bar'), fixtures.find(f => f.id === 'fx-8-pythagoras')] };
    const r = validateActivityBatch(JSON.stringify(reply), { skillIds: p.allowedSkillIds });
    assert.deepEqual(r.accepted.map(a => a.id), ['fx-3-fraction-bar']);
  });
  it('carries the strict schema for a future structured-output gateway', () => {
    const p = buildActivityPrompt(realisticSummary(), { count: 9 });
    assert.equal(p.responseFormat.json_schema.strict, true);
    assert.match(p.user, /Write 5 activities/);
    assert.ok(p.maxOutputTokens >= 2500 && p.maxOutputTokens <= 3000);
  });
  it('embeds format examples that themselves validate', async () => {
    const m = /FORMAT EXAMPLES \(shape only; never copy their content\): (.*)$/s.exec(ACTIVITY_AUTHOR_RULES)!;
    const examples = m[1]!.split(/ (?=\{"version")/).map(s => JSON.parse(s));
    const { validateActivitySpec } = await import('./spec');
    const { standards } = await import('../../../curriculum/standards');
    for (const e of examples) {
      const r = validateActivitySpec(e, { skillIds: new Set(standards.map(s => s.id)) });
      assert.ok(r.ok, r.ok ? '' : r.errors.join('; '));
    }
  });
});
