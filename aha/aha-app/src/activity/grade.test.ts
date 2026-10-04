import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fixtures } from './fixtures';
import { correctResponse, expressionsEquivalent, gradeActivity, parseNumberInput, type LearnerResponse } from './grade';
import type { ActivitySpec } from './spec';

const fx = (id: string) => fixtures.find(f => f.id === id)!;
const grade = (id: string, r: LearnerResponse) => gradeActivity(fx(id), r);
const withResponse = (id: string, response: ActivitySpec['response']): ActivitySpec => ({ ...fx(id), response });

describe('deterministic grader', () => {
  it('marks every fixture correct for its own key, and is deterministic', () => {
    for (const f of fixtures) {
      const a = gradeActivity(f, correctResponse(f)), b = gradeActivity(f, correctResponse(f));
      assert.equal(a.correct, true, f.id);
      assert.deepEqual(a, b);
      assert.equal(a.invalid, undefined);
    }
  });
  it('rejects a response of the wrong type as invalid, not wrong', () => {
    const r = grade('fx-k-count-apples', { type: 'multiple_choice', choice: 0 });
    assert.equal(r.correct, false);
    assert.ok(r.invalid);
  });
  describe('numeric', () => {
    it('parses friendly number formats', () => {
      assert.equal(parseNumberInput('1,234'), 1234);
      assert.equal(parseNumberInput(' −7 '), -7);
      assert.equal(parseNumberInput('.5'), 0.5);
      assert.equal(parseNumberInput('3/4'), 0.75);
      assert.equal(parseNumberInput('1 1/2'), 1.5);
      assert.equal(parseNumberInput('-2 1/4'), -2.25);
      assert.equal(parseNumberInput('$4.50'), 4.5);
      assert.equal(parseNumberInput('68¢', '¢'), 68);
      assert.equal(parseNumberInput('22 m', 'm'), 22);
      assert.equal(parseNumberInput('1/0'), null);
      assert.equal(parseNumberInput('12,34'), null);
      assert.equal(parseNumberInput('abc'), null);
      assert.equal(parseNumberInput('1e3'), null);
      assert.equal(parseNumberInput('9'.repeat(200)), null);
    });
    it('applies tolerance and recognizes misconception answers', () => {
      assert.equal(grade('fx-7-circle-area', { type: 'numeric', value: '78.54' }).correct, true);
      assert.equal(grade('fx-7-circle-area', { type: 'numeric', value: '78.6' }).correct, true);
      assert.equal(grade('fx-7-circle-area', { type: 'numeric', value: '78.7' }).correct, false);
      assert.equal(grade('fx-7-circle-area', { type: 'numeric', value: '31.4' }).misconceptionTag, 'circumference_for_area');
      assert.deepEqual(grade('fx-2-fruit-graph', { type: 'numeric', value: '13' }), { correct: false, normalized: '13', misconceptionTag: 'added_instead' });
      assert.equal(grade('fx-2-fruit-graph', { type: 'numeric', value: '5.0' }).correct, true);
      assert.equal(grade('fx-2-fruit-graph', { type: 'numeric', value: '10/2' }).correct, true);
      assert.ok(grade('fx-2-fruit-graph', { type: 'numeric', value: 'five' }).invalid);
      assert.equal(grade('fx-2-coins', { type: 'numeric', value: '68 ¢' }).correct, true);
    });
    it('uses exact comparison when no tolerance is given (float noise only)', () => {
      const spec = withResponse('fx-2-fruit-graph', { type: 'numeric', answer: 0.3 });
      assert.equal(gradeActivity(spec, { type: 'numeric', value: '0.3' }).correct, true);
      assert.equal(gradeActivity(spec, { type: 'numeric', value: '0.30000001' }).correct, false);
    });
  });
  describe('fraction', () => {
    const f = (numerator: string, denominator: string, whole?: string): LearnerResponse => ({ type: 'fraction', numerator, denominator, ...(whole !== undefined ? { whole } : {}) });
    it('accepts equivalent fractions with form any', () => {
      assert.equal(grade('fx-3-fraction-bar', f('3', '8')).correct, true);
      assert.equal(grade('fx-3-fraction-bar', f('6', '16')).correct, true);
      assert.equal(grade('fx-3-fraction-bar', f('3', '5')).misconceptionTag, 'part_to_part');
      assert.equal(grade('fx-3-fraction-bar', f('5', '8')).misconceptionTag, 'counted_unshaded');
    });
    it('enforces simplest and exact forms with a form tag', () => {
      const simplest = withResponse('fx-3-fraction-bar', { type: 'fraction', numerator: 3, denominator: 4, form: 'simplest' });
      assert.equal(gradeActivity(simplest, f('3', '4')).correct, true);
      assert.deepEqual(gradeActivity(simplest, f('6', '8')), { correct: false, normalized: '6/8', misconceptionTag: 'not_simplified' });
      const exact = withResponse('fx-3-fraction-bar', { type: 'fraction', numerator: 6, denominator: 8, form: 'exact' });
      assert.equal(gradeActivity(exact, f('6', '8')).correct, true);
      assert.equal(gradeActivity(exact, f('3', '4')).misconceptionTag, 'different_form');
    });
    it('handles mixed numbers, negatives and bad input', () => {
      const mixed = withResponse('fx-3-fraction-bar', { type: 'fraction', numerator: 7, denominator: 4, mixed: true, form: 'simplest' });
      assert.equal(gradeActivity(mixed, f('3', '4', '1')).correct, true);
      assert.equal(gradeActivity(mixed, f('7', '4')).correct, true);
      assert.equal(gradeActivity(mixed, f('6', '8', '1')).misconceptionTag, 'not_simplified');
      assert.equal(gradeActivity(mixed, f('3', '4', '1')).normalized, '1 3/4');
      const negative = withResponse('fx-3-fraction-bar', { type: 'fraction', numerator: -5, denominator: 4, mixed: true });
      assert.equal(gradeActivity(negative, f('1', '4', '-1')).correct, true);
      assert.equal(gradeActivity(negative, f('-5', '4')).correct, true);
      assert.equal(gradeActivity(negative, f('1', '4', '1')).correct, false);
      assert.ok(gradeActivity(negative, f('-1', '4', '1')).invalid);
      assert.ok(grade('fx-3-fraction-bar', f('3', '0')).invalid);
      assert.ok(grade('fx-3-fraction-bar', f('', '8')).invalid);
      assert.ok(grade('fx-3-fraction-bar', f('3.5', '8')).invalid);
    });
  });
  describe('expression', () => {
    const e = (value: string): LearnerResponse => ({ type: 'expression', value });
    it('accepts equivalent forms and rejects non-equivalent ones', () => {
      for (const ok of ['3n+2', '2+3n', 'n*3+2', '3(n)+2', '(6n+4)/2', 'n+n+n+2']) assert.equal(grade('fx-6-write-expression', e(ok)).correct, true, ok);
      for (const bad of ['3n', '3n+3', '2n+3', '3(n+2)', 'n^3+2']) assert.equal(grade('fx-6-write-expression', e(bad)).correct, false, bad);
      assert.ok(grade('fx-6-write-expression', e('3x+2')).invalid);
      assert.ok(grade('fx-6-write-expression', e('3n+')).invalid);
      assert.ok(grade('fx-6-write-expression', e('')).invalid);
    });
    it('enforces expanded and simplified forms', () => {
      assert.equal(grade('fx-6-distribute', e('4x+12')).correct, true);
      assert.equal(grade('fx-6-distribute', e('12+4x')).correct, true);
      assert.deepEqual(grade('fx-6-distribute', e('4(x+3)')), { correct: false, normalized: '4(x+3)', misconceptionTag: 'not_expanded' });
      assert.equal(grade('fx-6-distribute', e('4x+3')).correct, false);
      assert.equal(grade('fx-7-simplify', e('5x+4')).correct, true);
      assert.equal(grade('fx-7-simplify', e('4+5x')).correct, true);
      assert.equal(grade('fx-7-simplify', e('3x+2x+4')).misconceptionTag, 'not_simplified');
      assert.equal(grade('fx-7-simplify', e('3x+5+2x-1')).misconceptionTag, 'not_simplified');
    });
    it('handles domain edge cases by sampling', () => {
      assert.equal(expressionsEquivalent('x', 'x^2/x', ['x'], [-10, 10], 's'), true); // agree wherever both are defined
      assert.equal(expressionsEquivalent('x', 'sqrt(x^2)', ['x'], [-10, 10], 's'), false);
      assert.equal(expressionsEquivalent('x', 'sqrt(x^2)', ['x'], [0.1, 10], 's'), true);
      assert.equal(expressionsEquivalent('x+y', 'y+x', ['x', 'y'], [-10, 10], 's'), true);
      assert.equal(expressionsEquivalent('x^2', '2x', ['x'], [-10, 10], 's'), false); // equal at x=0 and 2, not elsewhere
      assert.equal(expressionsEquivalent('1/(x-2)', '1/(x-2)', ['x'], [-10, 10], 's'), true);
      assert.equal(expressionsEquivalent('x', 'x+0.000001', ['x'], [-10, 10], 's'), false);
      assert.equal(expressionsEquivalent('1000000x', '1000000x+0.001', ['x'], [-10, 10], 's'), true); // relative tolerance
    });
  });
  describe('choice, ordering, plot and tap', () => {
    it('grades multiple choice by original option index with misconception tags', () => {
      assert.equal(grade('fx-1-half-hour', { type: 'multiple_choice', choice: 0 }).correct, true);
      assert.deepEqual(grade('fx-1-half-hour', { type: 'multiple_choice', choice: 1 }), { correct: false, normalized: 'option:1', misconceptionTag: 'swapped_hands' });
      assert.ok(grade('fx-1-half-hour', { type: 'multiple_choice', choice: 9 }).invalid);
      assert.ok(grade('fx-1-half-hour', { type: 'multiple_choice', choice: 0.5 }).invalid);
    });
    it('requires the exact set for multi-select', () => {
      const id = 'fx-6-common-factors';
      assert.equal(grade(id, { type: 'multi_select', choices: [0, 1, 2, 4] }).correct, true);
      assert.equal(grade(id, { type: 'multi_select', choices: [4, 2, 1, 0, 0] }).correct, true);
      assert.equal(grade(id, { type: 'multi_select', choices: [0, 1, 2] }).correct, false);
      assert.equal(grade(id, { type: 'multi_select', choices: [0, 1, 2, 4, 6] }).misconceptionTag, 'multiple_for_factor');
      assert.ok(grade(id, { type: 'multi_select', choices: [] }).invalid);
      assert.ok(grade(id, { type: 'multi_select', choices: [-1] }).invalid);
    });
    it('requires a full permutation in the right order for ordering', () => {
      const id = 'fx-2-order-numbers';
      assert.equal(grade(id, { type: 'ordering', order: [0, 1, 2, 3] }).correct, true);
      assert.equal(grade(id, { type: 'ordering', order: [1, 0, 2, 3] }).correct, false);
      assert.ok(grade(id, { type: 'ordering', order: [0, 0, 2, 3] }).invalid);
      assert.ok(grade(id, { type: 'ordering', order: [0, 1, 2] }).invalid);
    });
    it('applies plot tolerance and tap region tags', () => {
      assert.equal(grade('fx-5-plant-the-tree', { type: 'plot_point', x: 6, y: 4 }).correct, true);
      assert.equal(grade('fx-5-plant-the-tree', { type: 'plot_point', x: 6, y: 5 }).correct, false);
      assert.ok(grade('fx-5-plant-the-tree', { type: 'plot_point', x: NaN, y: 4 }).invalid);
      const tolerant = withResponse('fx-5-plant-the-tree', { type: 'plot_point', figureId: 'map', x: 6, y: 4, tolerance: 0.5 });
      assert.equal(gradeActivity(tolerant, { type: 'plot_point', x: 6.5, y: 3.5 }).correct, true);
      assert.equal(grade('fx-k-which-more', { type: 'tap_region', region: 'fish' }).misconceptionTag, 'compared_size_not_count');
      assert.equal(grade('fx-k-which-more', { type: 'tap_region', region: 'birds' }).correct, true);
    });
  });
});
