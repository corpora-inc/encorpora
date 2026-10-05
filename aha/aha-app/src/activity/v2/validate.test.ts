import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { areaActivity, check, clone, codesOf, equalGroupsActivity, shadeActivity, shadedFractionActivity } from './testkit';
import { validateBatch } from './validate';
import { formatPlain } from './quantity';
import type { WireActivity } from './wire';

const valid = (a: unknown, band?: Parameters<typeof check>[1]) => { const v = check(a, band); assert.ok(v.ok, JSON.stringify(!v.ok && v.problems)); return v.activity; };
const rejects = (a: unknown, code: string, band?: Parameters<typeof check>[1]) => { const v = check(a, band); assert.ok(!v.ok, `expected ${code}`); assert.ok(codesOf(v).includes(code), `expected ${code}, got ${JSON.stringify(!v.ok && v.problems)}`); };
const edit = (base: () => WireActivity, f: (a: WireActivity) => void) => { const a = clone(base()); f(a); return a; };
const key = (a: WireActivity) => { const c = valid(a); return formatPlain(c.ask!.value.q); };

describe('the live failures in v2', () => {
  it('live 1: the text, picture and key come from one structure', () => {
    const c = valid(equalGroupsActivity());
    assert.deepEqual(c.rendered.prompt.flatMap(b => b.type === 'text' ? [b.text] : []), ['Ana fills 3 baskets with 4 apples each.', 'How many apples are there in all?']);
    assert.equal(formatPlain(c.ask!.value.q), '12');
    assert.equal(c.ask!.target?.key, 's.total');
    assert.deepEqual(c.drawings.get('s'), { type: 'picture', layout: 'row', groups: [{ icon: 'apple', count: 4, repeat: 3, arrangement: 'row', label: 'basket' }] });
    assert.equal(c.rendered.explanation, '3 groups of 4 make 12 apples.');
    assert.deepEqual(c.rendered.hints, ['How many apples are in each basket?']);
  });
  it('live 1: the prose cannot restate the binding by quantity id', () => {
    rejects(edit(equalGroupsActivity, a => { a.prompt[0] = { text: 'Ana fills {{g}} with {{n}} each.', type: 'text' }; }), 'role_by_id');
    rejects(edit(equalGroupsActivity, a => { a.prompt[0] = { text: 'Ana fills 3 baskets with 4 apples each.', type: 'text' }; }), 'numeral');
    rejects(edit(equalGroupsActivity, a => { a.prompt[0] = { text: 'Ana fills three baskets with {{s.size}} each.', type: 'text' }; }), 'number_word');
  });
  it('live 2: "rectangle" comes from the view, and the prose cannot name a shape', () => {
    const c = valid(shadeActivity());
    assert.deepEqual(c.rendered.prompt[0], { type: 'text', text: 'Shade $\\frac{1}{4}$ of the rectangle.' });
    rejects(edit(shadeActivity, a => { a.prompt[0] = { text: 'Shade {{u}} of the rectangle.', type: 'text' }; }), 'view_word');
    const circle = valid(edit(shadeActivity, a => { a.model.structures[0]!.show = 'circle'; }));
    assert.deepEqual(circle.rendered.prompt[0], { type: 'text', text: 'Shade $\\frac{1}{4}$ of the circle.' });
  });
  it('live 3: area has no chart view, so a pie is inexpressible at decode time', () => {
    assert.equal(key(areaActivity()), '20');
    rejects(edit(areaActivity, a => { (a.model.structures[0] as { show: string }).show = 'pie'; }), 'schema');
  });
  it('live 4: an area ask over a view that reveals neither side is unanswerable', () => {
    const bare = edit(areaActivity, a => {
      a.model.structures[0]!.show = null;
      a.prompt = [{ text: 'What is the area in square units?', type: 'text' }];
      a.support.explanation = 'The area is {{r.area}}.';
    });
    rejects(bare, 'ask_unanswerable');
    const told = edit(areaActivity, a => {
      a.model.structures[0]!.show = null;
      a.prompt = [{ text: 'A garden is {{r.w}} by {{r.h}}. What is its area in square units?', type: 'text' }];
      a.support.explanation = 'The area is {{r.area}}.';
    });
    assert.equal(key(told), '20', 'the same ask is answerable when the prose gives the sides');
    const labeled = valid(edit(areaActivity, a => { a.model.structures[0]!.show = 'labeled'; }));
    assert.deepEqual(labeled.reveals.get('r'), { w: 'shown', h: 'shown', area: 'hidden', perimeter: 'hidden' });
  });
});

describe('L0 and skills', () => {
  it('rejects unknown fields, wrong types and oversized input as schema problems', () => {
    rejects({ ...equalGroupsActivity(), version: 2 }, 'schema');
    rejects(edit(equalGroupsActivity, a => { (a as { level: unknown }).level = '3'; }), 'schema');
    rejects(edit(equalGroupsActivity, a => { a.support.hints = ['x'.repeat(201)]; }), 'schema');
    rejects(edit(equalGroupsActivity, a => { a.model.quantities[0]!.id = 'G'; }), 'schema');
    rejects('not an object', 'schema');
    rejects({ aim: { skills: Array.from({ length: 60 }, () => '3.OA.A.1') } }, 'size');
  });
  it('rejects skills that were not offered, duplicates, and grades outside the band', () => {
    rejects(edit(equalGroupsActivity, a => { a.aim.skills = ['3.OA.B.6']; }), 'skill_unknown');
    rejects(edit(equalGroupsActivity, a => { a.aim.skills = ['3.OA.A.1', '3.OA.A.1']; }), 'skill_duplicate');
    rejects(equalGroupsActivity(), 'off_band', 'k2');
  });
  it('makes off-band intents and views inexpressible', () => {
    rejects(edit(areaActivity, a => { a.aim.skills = ['6.G.A.1']; a.model.structures[0]!.show = 'unit_squares'; }), 'schema', 'g68');
    rejects(edit(equalGroupsActivity, a => { a.aim.skills = ['6.G.A.1']; }), 'schema', 'g68');
    const sixth = edit(areaActivity, a => { a.aim.skills = ['6.G.A.1']; a.model.structures[0]!.show = 'labeled'; });
    assert.ok(check(sixth, 'g68').ok, JSON.stringify(codesOf(check(sixth, 'g68'))));
  });
  it('holds each structure and view to its grades', () => {
    rejects(edit(equalGroupsActivity, a => { a.aim.skills = ['5.NF.B.4']; a.model.quantities[1]!.value = '4'; }), 'off_grade');
    rejects(edit(shadedFractionActivity, a => { a.aim.skills = ['1.G.A.3']; a.model.quantities[0]!.value = '4'; a.model.structures[0]!.show = 'strip'; a.response = { ask: 'f.fraction', candidates: null, distractors: [], form: 'choose' }; }), 'off_grade', 'k2');
  });
});

describe('model binding', () => {
  it('rejects duplicate and reserved ids, unknown and mistyped roles', () => {
    rejects(edit(equalGroupsActivity, a => { a.model.quantities[1]!.id = 'g'; }), 'id_duplicate');
    rejects(edit(equalGroupsActivity, a => { a.model.quantities[0]!.id = 'min'; a.model.structures[0]!.roles = { groups: 'min', size: 'n' }; }), 'id_reserved');
    rejects(edit(equalGroupsActivity, a => { a.model.structures[0]!.roles = { groups: 'x', size: 'n' }; }), 'ref_unknown');
    rejects(edit(areaActivity, a => { a.model.quantities[0]!.kind = 'count'; a.model.quantities[0]!.unit = null; }), 'role_kind');
    rejects(edit(equalGroupsActivity, a => { a.model.structures[0]!.roles = { groups: 'g', size: null }; }), 'schema');
  });
  it('rejects bad values, cycles, unit mixes and magnitudes outside the grade', () => {
    rejects(edit(equalGroupsActivity, a => { a.model.quantities[0]!.value = '3^2'; }), 'expr_syntax');
    rejects(edit(equalGroupsActivity, a => { a.model.quantities[1]!.value = 's.total/g'; }), 'ref_cycle');
    rejects(edit(areaActivity, a => { a.model.quantities[1]!.unit = 'cm'; }), 'unit_mismatch');
    rejects(edit(equalGroupsActivity, a => { a.model.quantities[0]!.value = '11'; }), 'magnitude');
    rejects(edit(shadedFractionActivity, a => { a.model.quantities[0]!.value = '5'; }), 'magnitude');
    rejects(edit(shadedFractionActivity, a => { a.model.quantities[1]!.value = '9'; }), 'magnitude');
    rejects(edit(areaActivity, a => { a.model.quantities[0]!.value = '5/2'; }), 'magnitude');
    rejects(edit(equalGroupsActivity, a => { a.model.quantities[0]!.noun = { icon: null, one: 'basket2', other: 'baskets' }; }), 'noun_form');
  });
  it('binds derived quantities: division as a missing size', () => {
    const division = edit(equalGroupsActivity, a => {
      a.aim.skills = ['3.OA.A.2'];
      a.model.quantities = [
        { id: 'g', kind: 'count', noun: { icon: 'basket', one: 'basket', other: 'baskets' }, unit: null, value: '3' },
        { id: 't', kind: 'count', noun: { icon: 'apple', one: 'apple', other: 'apples' }, unit: null, value: '12' },
        { id: 'n', kind: 'count', noun: { icon: 'apple', one: 'apple', other: 'apples' }, unit: null, value: 't/g' },
      ];
      a.model.structures[0]!.show = null;
      a.prompt = [{ text: 'Ana shares {{t}} equally among {{s.groups}}. How many {{s.size.other}} go in each {{s.groups.one}}?', type: 'text' }];
      a.response = { ask: 's.size', distractors: [{ expr: 't-g', tag: 'subtracted_instead' }], form: 'number' };
      a.support = { explanation: '{{t.n}} shared by {{s.groups.n}} is {{s.size}} each.', hints: [] };
    });
    const c = valid(division);
    assert.equal(formatPlain(c.ask!.value.q), '4');
    rejects(edit(() => division, a => { a.model.quantities[1]!.value = '13'; }), 'count_not_whole');
  });
  it('flags quantities and structures that nothing uses', () => {
    rejects(edit(equalGroupsActivity, a => { a.model.quantities.push({ id: 'x', kind: 'count', noun: null, unit: null, value: '2' }); }), 'unused');
  });
});

describe('views and prompt', () => {
  it('requires exactly one view block per structure with a view, and none for one without', () => {
    rejects(edit(equalGroupsActivity, a => { a.prompt.splice(1, 1); }), 'view_unshown');
    rejects(edit(equalGroupsActivity, a => { a.prompt.push({ of: 's', type: 'view' }); }), 'view_duplicate');
    rejects(edit(equalGroupsActivity, a => { a.model.structures[0]!.show = null; }), 'view_none');
    rejects(edit(equalGroupsActivity, a => { a.prompt = [{ of: 's', type: 'view' }]; }), 'prompt_no_text');
    rejects(edit(equalGroupsActivity, a => { a.prompt[1] = { of: 'zz', type: 'view' }; }), 'ref_unknown');
  });
  it('resolves placeholders and rejects unknown members', () => {
    rejects(edit(equalGroupsActivity, a => { a.prompt[0] = { text: 'Ana fills {{s.bags}}.', type: 'text' }; }), 'ref_member');
    rejects(edit(equalGroupsActivity, a => { a.prompt[0] = { text: 'Ana fills {{s}}.', type: 'text' }; }), 'ref_structure');
    rejects(edit(equalGroupsActivity, a => { a.prompt[0] = { text: 'Ana fills {{s.groups.colour}}.', type: 'text' }; }), 'placeholder_member');
    rejects(edit(equalGroupsActivity, a => { a.prompt[0] = { text: 'Ana fills {{s.groups.constructor}}.', type: 'text' }; }), 'placeholder_member');
    rejects(edit(equalGroupsActivity, a => { a.prompt[0] = { text: 'Ana fills {{s.constructor}}.', type: 'text' }; }), 'ref_member');
    rejects(edit(equalGroupsActivity, a => { a.prompt[0] = { text: 'Ana fills {{zz}}.', type: 'text' }; }), 'ref_unknown');
  });
});

describe('the answer is never named, and leaks are referential', () => {
  it('masks the ask in prompt math and refuses it in prompt text', () => {
    const masked = valid(edit(equalGroupsActivity, a => { a.prompt.push({ tex: '{{s.groups.n}} \\times {{s.size.n}} = {{s.total.n}}', type: 'math' }); }));
    assert.deepEqual(masked.rendered.prompt.at(-1), { type: 'math', tex: '3 \\times 4 = \\square ' });
    rejects(edit(equalGroupsActivity, a => { a.prompt[2] = { text: 'There are {{s.total}} in all.', type: 'text' }; }), 'answer_in_text');
    rejects(edit(equalGroupsActivity, a => { a.support.hints = ['There are {{s.total.n}} in all.']; }), 'answer_in_text');
    rejects(edit(equalGroupsActivity, a => { a.prompt[2] = { text: 'How many {{s.total.noun}} are there?', type: 'text' }; }), 'answer_inflected');
    assert.ok(check(edit(equalGroupsActivity, a => { a.support.explanation = 'There are {{s.total}}.'; })).ok, 'the explanation may name the answer');
  });
  it('rejects a quantity of the same kind, noun and value as the key, but not a coincidence', () => {
    rejects(edit(equalGroupsActivity, a => {
      a.model.quantities.push({ id: 't', kind: 'count', noun: { icon: 'apple', one: 'apple', other: 'apples' }, unit: null, value: '12' });
      a.prompt[0] = { text: 'Ana fills {{s.groups}} with {{s.size}} each, {{t}} in all.', type: 'text' };
    }), 'answer_stated');
    const missingFactor = edit(equalGroupsActivity, a => {
      a.aim.skills = ['3.OA.A.4'];
      a.model.quantities = [
        { id: 'g', kind: 'count', noun: { icon: 'basket', one: 'basket', other: 'baskets' }, unit: null, value: '4' },
        { id: 't', kind: 'count', noun: { icon: 'apple', one: 'apple', other: 'apples' }, unit: null, value: '16' },
        { id: 'n', kind: 'count', noun: { icon: 'apple', one: 'apple', other: 'apples' }, unit: null, value: 't/g' },
      ];
      a.model.structures[0]!.show = null;
      a.prompt = [{ tex: '{{s.groups.n}} \\times {{s.size.n}} = {{t.n}}', type: 'math' }, { text: 'Find the missing number of {{s.size.other}} in each {{s.groups.one}}.', type: 'text' }];
      a.response = { ask: 's.size', distractors: [], form: 'number' };
      a.support = { explanation: '{{t.n}} split into {{s.groups.n}} groups is {{s.size.n}}.', hints: [] };
    });
    const c = valid(missingFactor);
    assert.deepEqual(c.rendered.prompt[0], { type: 'math', tex: '4 \\times \\square  = 16' }, '4 × □ = 16: the 4 of another kind is not a leak');
  });
  it('rejects a view that prints the answer', () => {
    rejects(edit(equalGroupsActivity, a => { a.model.structures[0]!.show = 'jumps'; }), 'answer_shown');
  });
  it('rejects an asserted key: a given literal no view makes countable', () => {
    rejects(edit(equalGroupsActivity, a => {
      a.model.structures[0]!.show = null;
      a.prompt = [{ text: 'Ana has some {{s.groups.other}} of {{s.total.other}}. How many {{s.groups.other}}?', type: 'text' }];
      a.response = { ask: 'g', distractors: [], form: 'number' };
      a.support.hints = [];
    }), 'ask_asserted');
  });
  it('accepts a role the view makes countable', () => {
    const rows = edit(equalGroupsActivity, a => {
      a.prompt[2] = { text: 'How many {{s.groups.other}} are there?', type: 'text' };
      a.prompt[0] = { text: 'Ana fills some {{s.groups.other}} with {{s.size}} each.', type: 'text' };
      a.response = { ask: 's.groups', distractors: [], form: 'number' };
      a.support.hints = [];
    });
    assert.equal(key(rows), '3');
  });
});

describe('act forms', () => {
  it('requires the target in the prose', () => {
    rejects(edit(shadeActivity, a => { a.prompt[0] = { text: 'Shade part of the {{f.view}}.', type: 'text' }; a.support.explanation = 'One part is {{u}}.'; }), 'target_not_given');
  });
  it('requires the hosting view to accept the form and to be shown', () => {
    rejects(edit(shadeActivity, a => { a.model.structures[0]!.show = 'set'; a.model.quantities[0]!.noun = { icon: 'marble', one: 'marble', other: 'marbles' }; }), 'form_view');
    rejects(edit(shadeActivity, a => { a.response = { ask: 'u', form: 'shade', on: 'zz' }; }), 'ref_unknown');
    rejects(edit(shadeActivity, a => { a.response = { ask: 'u', form: 'tap', on: null }; }), 'tap_views');
  });
});

describe('L2', () => {
  it('rejects models whose drawing exceeds the drawing limits', () => {
    rejects(edit(equalGroupsActivity, a => { a.aim.skills = ['4.NF.B.4']; a.model.quantities[0]!.value = '12'; a.model.quantities[1]!.value = '12'; }), 'draw');
    assert.ok(check(edit(equalGroupsActivity, a => { a.model.quantities[0]!.value = '10'; a.model.quantities[1]!.value = '10'; })).ok, '100 icons is the cap, not over it');
    rejects(edit(equalGroupsActivity, a => { a.aim.skills = ['4.NF.B.4']; a.model.quantities[0]!.value = '11'; a.model.quantities[1]!.value = '10'; }), 'draw');
  });
});

describe('batches', () => {
  it('keeps valid activities and drops invalid ones on their own', () => {
    const r = validateBatch(JSON.stringify({ activities: [equalGroupsActivity(), { nope: 1 }, areaActivity()] }), { band: 'g35', skillIds: new Set(['3.OA.A.1', '3.MD.C.6']) });
    assert.equal(r.accepted.length, 2);
    assert.deepEqual(r.rejected.map(x => x.index), [1]);
    assert.deepEqual(validateBatch({ activities: [], rationale: 'x' }, { band: 'g35', skillIds: new Set() }).errors, ['Unknown field(s): rationale']);
    assert.deepEqual(validateBatch('garbage', { band: 'g35', skillIds: new Set() }).errors.length, 1);
  });
});
