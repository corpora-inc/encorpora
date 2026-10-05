import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { correctResponseFor, gradeResponse, type AnyLearnerResponse } from '../grade';
import { areaActivity, check, clone, codesOf, equalGroupsActivity, shadeActivity, shadedFractionActivity } from './testkit';
import type { WireActivity, WireQuantity } from './wire';

const edit = (base: () => WireActivity, f: (a: WireActivity) => void) => { const a = clone(base()); f(a); return a; };
const compiled = (a: WireActivity) => { const v = check(a); assert.ok(v.ok, JSON.stringify(!v.ok && v.problems)); return v.activity.response; };
const rejects = (a: WireActivity, code: string) => { const v = check(a); assert.ok(codesOf(v).includes(code), `expected ${code}, got ${JSON.stringify(!v.ok ? v.problems : 'valid')}`); };
const grade = (a: WireActivity, r: AnyLearnerResponse) => { const c = compiled(a); return gradeResponse(c.spec, r, 'seed'); };
const q = (id: string, kind: WireQuantity['kind'], value: string, extra: Partial<WireQuantity> = {}): WireQuantity => ({ id, kind, noun: null, unit: null, value, ...extra });

/** Two fraction models side by side: tap the one that shows the target. */
const twoModels = (selectedB: string, partsB = '4') => edit(shadedFractionActivity, a => {
  a.model.quantities = [q('p', 'count', '4'), q('k', 'count', '3'), q('pb', 'count', partsB), q('kb', 'count', selectedB), q('u', 'fraction', '3/4')];
  a.model.structures = [
    { id: 'f', kind: 'fraction', roles: { parts: 'p', selected: 'k', wholes: null }, show: 'rect' },
    { id: 'g', kind: 'fraction', roles: { parts: 'pb', selected: 'kb', wholes: null }, show: 'rect' },
  ];
  a.prompt = [{ text: 'Tap the {{f.view}} that shows {{u}}.', type: 'text' }, { of: 'f', type: 'view' }, { of: 'g', type: 'view' }];
  a.response = { ask: 'u', form: 'tap', on: null };
  a.support = { explanation: 'It has {{f.selected.n}} of {{f.parts.n}} parts shaded.', hints: [] };
});

describe('number', () => {
  it('computes the key, names the answer, and maps distractor rules to tags', () => {
    const c = compiled(equalGroupsActivity());
    assert.deepEqual(c.spec, { type: 'numeric', answer: 12, label: 'apples', misconceptionAnswers: [{ answer: 7, tag: 'added_instead' }] });
    assert.equal(c.key, '12');
    assert.equal(c.verification, 'computed');
    assert.deepEqual(grade(equalGroupsActivity(), { type: 'numeric', value: '12' }).correct, true);
    assert.equal(grade(equalGroupsActivity(), { type: 'numeric', value: '7' }).misconceptionTag, 'added_instead');
  });
  it('gives measures their unit symbol, and drops rules equal to the key or to each other', () => {
    const c = compiled(edit(areaActivity, a => { a.response = { ask: 'r.area', distractors: [{ expr: '2*(w+h)', tag: 'perimeter_for_area' }, { expr: 'w*h', tag: 'added_two_sides' }, { expr: '2*w+2*h', tag: 'area_for_perimeter' }], form: 'number' }; }));
    assert.deepEqual(c.spec, { type: 'numeric', answer: 20, unit: 'square units', misconceptionAnswers: [{ answer: 18, tag: 'perimeter_for_area' }] });
  });
  it('refuses a key a learner cannot type as a number', () => {
    rejects(edit(shadedFractionActivity, a => { a.model.quantities[1]!.value = '1'; a.model.quantities[0]!.value = '3'; a.aim.skills = ['3.NF.A.1']; a.response = { ask: 'f.fraction', distractors: [], form: 'number' }; }), 'form_value');
  });
  it('marks a derived ask as derived', () => {
    const c = compiled(edit(equalGroupsActivity, a => {
      a.model.quantities.push(q('e', 'count', '2', { noun: { icon: 'apple', one: 'apple', other: 'apples' } }));
      a.prompt[2] = { text: 'Then {{e}} fall. How many {{s.total.other}} are left?', type: 'text' };
      a.response = { ask: 's.total-e', distractors: [], form: 'number' };
      a.support.hints = [];
    }));
    assert.equal(c.key, '10');
    assert.equal(c.verification, 'derived');
  });
});

describe('fraction', () => {
  it('compiles the key with its exactness, and grades equivalents by it', () => {
    const any = compiled(shadedFractionActivity());
    assert.deepEqual(any.spec, { type: 'fraction', numerator: 3, denominator: 8, form: 'any', misconceptionAnswers: [{ numerator: 5, denominator: 8, tag: 'counted_unshaded' }, { numerator: 3, denominator: 5, tag: 'part_to_part' }] });
    assert.equal(grade(shadedFractionActivity(), { type: 'fraction', numerator: '6', denominator: '16' }).correct, true);
    assert.equal(grade(shadedFractionActivity(), { type: 'fraction', numerator: '5', denominator: '8' }).misconceptionTag, 'counted_unshaded');
    const twoFourths = (exactness: 'any' | 'simplest' | 'exact') => edit(shadedFractionActivity, a => { a.model.quantities[0]!.value = '4'; a.model.quantities[1]!.value = '2'; a.response = { ask: 'f.fraction', distractors: [], exactness, form: 'fraction' }; });
    assert.deepEqual(compiled(twoFourths('exact')).spec, { type: 'fraction', numerator: 2, denominator: 4, form: 'exact' });
    assert.deepEqual(compiled(twoFourths('simplest')).spec, { type: 'fraction', numerator: 1, denominator: 2, form: 'simplest' });
    assert.equal(grade(twoFourths('simplest'), { type: 'fraction', numerator: '2', denominator: '4' }).misconceptionTag, 'not_simplified');
  });
});

describe('choose', () => {
  it('offers the key and the surviving rules, formatted alike', () => {
    const c = compiled(edit(areaActivity, a => { a.response = { ask: 'r.area', candidates: null, distractors: [{ expr: '2*(w+h)', tag: 'perimeter_for_area' }, { expr: 'w+h', tag: 'added_two_sides' }], form: 'choose' }; }));
    assert.deepEqual(c.spec, { type: 'multiple_choice', shuffle: true, options: [
      { text: '20 square units', correct: true }, { text: '18 square units', correct: false, misconception: 'perimeter_for_area' }, { text: '9 square units', correct: false, misconception: 'added_two_sides' },
    ] });
  });
  it('treats 0.5 and 1/2 as the same value, so the rule is dropped, not marked wrong', () => {
    const half = edit(shadedFractionActivity, a => { a.model.quantities[1]!.value = '4'; a.response = { ask: 'f.fraction', candidates: null, distractors: [{ expr: '0.5', tag: 'whole_number_bias' }], form: 'choose' }; });
    rejects(half, 'choose_options');
    const ok = compiled(edit(() => half, a => { (a.response as { distractors: unknown[] }).distractors.push({ expr: 'f.unit', tag: 'denominator_as_count' }); }));
    assert.deepEqual((ok.spec as { options: { text: string }[] }).options.map(o => o.text), ['$\\frac{4}{8}$', '$\\frac{1}{8}$']);
  });
  it('chooses among candidates with exactly one equal to the key', () => {
    const compare = (gParts: string, gSelected: string) => edit(shadedFractionActivity, a => {
      a.aim.skills = ['3.NF.A.3'];
      a.model.quantities = [q('p', 'count', '3'), q('k', 'count', '2'), q('pb', 'count', gParts), q('kb', 'count', gSelected)];
      a.model.structures = [
        { id: 'f', kind: 'fraction', roles: { parts: 'p', selected: 'k', wholes: null }, show: 'strip' },
        { id: 'g', kind: 'fraction', roles: { parts: 'pb', selected: 'kb', wholes: null }, show: 'strip' },
      ];
      a.prompt = [{ of: 'f', type: 'view' }, { of: 'g', type: 'view' }, { text: 'Which fraction is greater?', type: 'text' }];
      a.response = { ask: 'max(f.fraction, g.fraction)', candidates: ['f.fraction', 'g.fraction'], distractors: [{ expr: 'min(f.fraction, g.fraction)', tag: 'larger_denominator_larger_fraction' }], form: 'choose' };
      a.support = { explanation: 'Compare {{f.fraction}} with {{g.fraction}}.', hints: [] };
    });
    const c = compiled(compare('4', '3'));
    assert.deepEqual(c.spec, { type: 'multiple_choice', shuffle: true, options: [
      { text: '$\\frac{2}{3}$', correct: false, misconception: 'larger_denominator_larger_fraction' }, { text: '$\\frac{3}{4}$', correct: true },
    ] });
    assert.equal(c.verification, 'derived');
    rejects(compare('6', '4'), 'choose_ambiguous');
  });
  it('lets the prose name the candidates without counting it as a leak', () => {
    const c = compiled(edit(shadedFractionActivity, a => {
      a.aim.skills = ['3.NF.A.3'];
      a.model.quantities = [q('p', 'count', '8'), q('a', 'fraction', '2/3'), q('b', 'fraction', '3/4')];
      a.model.structures = [{ id: 'f', kind: 'fraction', roles: { parts: 'p', selected: null, wholes: null }, show: null }];
      a.prompt = [{ text: 'Which is greater, {{a}} or {{b}}? Think of a whole cut into {{f.parts.n}}.', type: 'text' }];
      a.response = { ask: 'max(a, b)', candidates: ['a', 'b'], distractors: [], form: 'choose' };
      a.support = { explanation: 'Compare {{a}} and {{b}}.', hints: [] };
    }));
    assert.equal(c.key, '3/4');
  });
});

describe('select and order', () => {
  const equivalents = () => edit(shadedFractionActivity, a => {
    a.aim.skills = ['3.NF.A.3'];
    a.model.quantities = [q('h', 'fraction', '1/2'), q('a', 'fraction', '2/4'), q('b', 'fraction', '3/8'), q('c', 'fraction', '4/8')];
    a.model.structures = [{ id: 'f', kind: 'fraction', roles: { parts: 'p', selected: null, wholes: null }, show: null }];
    a.model.quantities.push(q('p', 'count', '8'));
    a.prompt = [{ text: 'Select every fraction equal to {{h}}. The whole has {{f.parts}}.', type: 'text' }];
    a.response = { ask: 'h', candidates: ['a', 'b', 'c'], form: 'select' };
    a.support = { explanation: 'Each names the same amount as {{h}}.', hints: [] };
  });
  it('selects by value, showing each candidate in its own form', () => {
    const c = compiled(equivalents());
    assert.deepEqual(c.spec, { type: 'multi_select', shuffle: true, options: [{ text: '$\\frac{2}{4}$', correct: true }, { text: '$\\frac{3}{8}$', correct: false }, { text: '$\\frac{4}{8}$', correct: true }] });
    assert.equal(c.key, 'select:0,2');
    rejects(edit(equivalents, a => { a.model.quantities[2]!.value = '3/6'; }), 'select_split');
  });
  it('orders by value and rejects ties', () => {
    const order = (direction: 'ascending' | 'descending', values: [string, string, string]) => edit(equivalents, a => {
      values.forEach((v, i) => { a.model.quantities[i + 1]!.value = v; });
      a.prompt = [{ text: 'Order {{a}}, {{b}} and {{c}}. Think of {{h}} and {{f.parts}}.', type: 'text' }];
      a.response = { candidates: ['a', 'b', 'c'], direction, form: 'order' };
    });
    rejects(order('ascending', ['2/4', '3/8', '4/8']), 'order_tie');
    const c = compiled(order('ascending', ['2/4', '1/8', '5/8']));
    assert.equal(c.key, 'order:1,0,2');
    assert.deepEqual(compiled(order('descending', ['2/4', '1/8', '5/8'])).key, 'order:2,0,1');
    assert.deepEqual(c.spec, { type: 'ordering', items: ['$\\frac{1}{8}$', '$\\frac{2}{4}$', '$\\frac{5}{8}$'] });
  });
});

describe('tap', () => {
  it('rejects a tap over equal parts as ill-posed (live 2)', () => {
    const v = check(edit(shadeActivity, a => { a.response = { ask: 'u', form: 'tap', on: 'f' }; }));
    assert.ok(!v.ok && v.problems.some(p => p.code === 'tap_ambiguous' && /4 regions satisfy/.test(p.message)), JSON.stringify(!v.ok && v.problems));
    rejects(edit(equalGroupsActivity, a => { a.prompt[2] = { text: 'Tap a group of {{s.size}}.', type: 'text' }; a.response = { ask: 's.size', form: 'tap', on: 's' }; a.support.hints = []; }), 'tap_ambiguous');
  });
  it('taps one view among several by its primary measure, and rejects equivalent views', () => {
    const c = compiled(twoModels('2'));
    assert.deepEqual(c.spec, { type: 'tap_view', figureIds: ['f', 'g'], figureId: 'f' });
    assert.equal(c.key, 'view:f');
    assert.equal(grade(twoModels('2'), { type: 'tap_view', figureId: 'g' }).correct, false);
    rejects(twoModels('6', '8'), 'tap_ambiguous');
  });
});

describe('shade and place', () => {
  it('shades any parts that make the target (live 2)', () => {
    const c = compiled(shadeActivity());
    assert.deepEqual(c.spec, { type: 'shade', figureId: 'f', parts: 4, target: 1 });
    assert.equal(c.key, '1/4');
    assert.equal(grade(shadeActivity(), { type: 'shade', shaded: [2] }).correct, true);
    assert.equal(grade(shadeActivity(), { type: 'shade', shaded: [0, 1, 3] }).misconceptionTag, 'counted_unshaded');
    assert.ok(grade(shadeActivity(), { type: 'shade', shaded: [] }).invalid);
    assert.ok(grade(shadeActivity(), { type: 'shade', shaded: [7] }).invalid);
    assert.deepEqual(correctResponseFor(c.spec), { type: 'shade', shaded: [0] });
  });
  it('rejects a target that is already shaded or does not land on whole parts', () => {
    rejects(edit(shadeActivity, a => { a.model.quantities.push(q('k', 'count', '1')); a.model.structures[0]!.roles = { parts: 'p', selected: 'k', wholes: null }; }), 'shade_preshaded');
    rejects(edit(shadeActivity, a => { a.model.quantities[1]!.value = '1/3'; }), 'shade_unreachable');
    rejects(edit(shadeActivity, a => { a.model.quantities[1]!.value = '5/4'; }), 'shade_unreachable');
  });
  const placeActivity = (target = '3/4') => edit(shadeActivity, a => {
    a.aim.skills = ['3.NF.A.2'];
    a.model.quantities[1]!.value = target;
    a.model.structures[0]!.show = 'line';
    a.prompt[0] = { text: 'Put a point at {{u}} on the {{f.view}}.', type: 'text' };
    a.response = { ask: 'u', form: 'place', on: 'f' };
  });
  it('places the target on a tick of the number line', () => {
    const c = compiled(placeActivity());
    assert.deepEqual(c.spec, { type: 'place', figureId: 'f', ticks: 4, target: 3 });
    assert.equal(grade(placeActivity(), { type: 'place', tick: 3 }).correct, true);
    assert.equal(grade(placeActivity(), { type: 'place', tick: 2 }).correct, false);
    assert.ok(grade(placeActivity(), { type: 'place', tick: 5 }).invalid);
    rejects(placeActivity('1/3'), 'place_unreachable');
  });
});
