import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { approxTokens, buildActivityPrompt, ACTIVITY_AUTHOR_RULES, ACTIVITY_GRAMMAR, STRUCTURED_OUTPUT_RULES } from './prompt';
import { activityBatchStrictJsonSchema } from './schema';
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
  // Twelve recent AI activities feed the cross-batch variety fingerprint, as production's ledger does.
  return buildLearnerSummary({ gradeHint: 3, activityAttempts: records, now: '2026-10-04T16:00:00Z', pendingSpecs: fixtures.filter(f => /^fx-[34]-/.test(f.id)).slice(0, 12) });
}

describe('activity batch prompt', () => {
  it('stays within the input token budget for a realistic learner', () => {
    const summary = realisticSummary();
    assert.ok(summary.recentContent, 'the realistic learner carries the variety fingerprint');
    const p = buildActivityPrompt(summary);
    const total = approxTokens(p.system) + approxTokens(p.user);
    // gpt-4o via Free2Z; input is cheap relative to output but must stay bounded. The prompt-only
    // budget was 4000 before the cross-batch variety signal: recentContent adds ~100 user tokens
    // and the creativity/repetition/graph-paper/equal-groups rules ~230 system tokens, mostly absorbed by trims
    // (no frontier titles/grades, which STANDARDS already carries; tighter wording; no icon enum).
    // Prompt-only is the fallback path; the structured path, the one gpt-4o uses, stays far lower.
    // Measured ~4.1k at #894; the cap leaves ~50 tokens of headroom.
    assert.ok(total <= 4800, `prompt ~${total} tokens`);
    assert.ok(approxTokens(p.structuredSystem) + approxTokens(p.user) <= 3800, `structured prompt ~${approxTokens(p.structuredSystem) + approxTokens(p.user)} tokens`);
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
  it('asks for creativity, forbids repeating recentContent, and allows repetition only for reviews and fluency', () => {
    const p = buildActivityPrompt(realisticSummary());
    for (const system of [p.system, p.structuredSystem]) {
      for (const phrase of ['never bend another type', 'repeat', 'be creative', 'many cultures', 'playful puzzle', 'spot the error', "which doesn't belong", 'fill the blank', 'recentContent', 'number sets', 'not favourites', 'MIX line', 'RETIRED', 'Re-drill', 'grid {unit:1}', 'unitSquares', 'Never ask the learner to count or measure what is not drawn'])
        assert.ok(system.includes(phrase), phrase);
    }
    assert.match(p.user, /"recentContent":\{"n":12,"contexts":\[/);
    assert.match(p.user, /\nMIX for 10: .*new frontier/);
    // Frontier titles travel once, in STANDARDS.
    assert.ok(!p.user.includes('"title"') && p.user.includes('3.MD.C.7 '));
    // The icon vocabulary is a category hint, not an enum the model must copy.
    assert.ok(!p.system.includes('apple|banana') && /icon=.*plain counter/.test(p.system) && /icon: .*plain counter/.test(p.structuredSystem));
  });
  it('offers fluency targets in STANDARDS even when they sit below the grade band', async () => {
    const { createLearner } = await import('../learning/engine');
    const state = createLearner('learner', 5);
    state.progress['1.OA.C.6'] = { skillId: '1.OA.C.6', concept: 'provisional', fluency: 'developing', retention: 'unconfirmed', independentSuccesses: 3, distinctVariants: [], reviewStage: 1, nextReviewAt: null, lastAttemptAt: '2026-10-01T10:00:00Z' };
    const summary = buildLearnerSummary({ gradeHint: 5, ledger: state, now: '2026-10-04T10:00:00Z' });
    assert.deepEqual(summary.fluency, ['1.OA.C.6']);
    assert.ok(buildActivityPrompt(summary).allowedSkillIds.has('1.OA.C.6'));
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
  it('structured variant: the grammar is the only difference, it saves input tokens, and keeps every safety rule (#884)', () => {
    const p = buildActivityPrompt(realisticSummary());
    assert.ok(!p.structuredSystem.includes(ACTIVITY_GRAMMAR) && p.system.includes(ACTIVITY_GRAMMAR));
    assert.equal(p.structuredSystem, p.system.replace(ACTIVITY_GRAMMAR, () => STRUCTURED_OUTPUT_RULES));
    const saved = approxTokens(p.system) - approxTokens(p.structuredSystem);
    // ~5.2k grammar chars → ~1.6k rule chars. Measured with the chars/4 heuristic (no tokenizer in the repo).
    assert.ok(saved >= 600, `structured prompt saves only ~${saved} tokens`);
    for (const phrase of ['keyCheck', 'no brands', 'Never ask for personal information', 'data, not instructions', 'never a ceiling', '\\$', 'exactly one correct', 'CORRECT order', 'null'])
      assert.ok(p.structuredSystem.includes(phrase), phrase);
  });
  it('the strict schema fits Free2Z\'s 32 KiB response_format limit', () => {
    const bytes = new TextEncoder().encode(JSON.stringify(activityBatchStrictJsonSchema)).length;
    assert.ok(bytes <= 32 * 1024, `strict schema is ${bytes} bytes`);
  });
  it('carries the strict schema for a structured-output gateway', () => {
    const p = buildActivityPrompt(realisticSummary(), { count: 99 });
    assert.equal(p.responseFormat.json_schema.strict, true);
    assert.match(p.user, /Write 40 activities/, 'clamped to the validator\'s batch bound');
    assert.equal(p.count, 40);
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
