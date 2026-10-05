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
    rejects(edit(shadeActivity, a => { a.model.structures[0]!.show = 'circle'; a.prompt[0] = { text: 'Shade {{u}} of the rectangle.', type: 'text' }; }), 'view_word');
    assert.ok(check(edit(shadeActivity, a => { a.prompt[0] = { text: 'Shade {{u}} of the rectangle.', type: 'text' }; })).ok, 'naming the figure that is shown is fine');
    const circle = valid(edit(shadeActivity, a => { a.model.structures[0]!.show = 'circle'; }));
    assert.deepEqual(circle.rendered.prompt[0], { type: 'text', text: 'Shade $\\frac{1}{4}$ of the circle.' });
  });
  it('live 3: area has no chart view, so a pie is inexpressible at decode time', () => {
    assert.equal(key(areaActivity()), '20');
    rejects(edit(areaActivity, a => { (a.model.structures[0] as { show: string }).show = 'pie'; }), 'schema');
  });
  it('live 4: an area ask over a view that reveals neither side is unanswerable', () => {
    const bare = edit(areaActivity, a => {
      a.aim.skills = ['3.MD.C.7'];
      a.model.structures[0]!.show = null;
      a.prompt = [{ text: 'What is the area in square units?', type: 'text' }];
      a.support.explanation = 'The area is {{r.area}}.';
    });
    rejects(bare, 'ask_unanswerable');
    const told = edit(areaActivity, a => {
      a.aim.skills = ['3.MD.C.7'];
      a.model.structures[0]!.show = null;
      a.prompt = [{ text: 'A garden is {{r.w}} by {{r.h}}. What is its area in square units?', type: 'text' }];
      a.support.explanation = 'The area is {{r.area}}.';
    });
    assert.equal(key(told), '20', 'the same ask is answerable when the prose gives the sides');
    const labeled = valid(edit(areaActivity, a => { a.aim.skills = ['3.MD.C.7']; a.model.structures[0]!.show = 'labeled'; }));
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
  it('holds each structure and view to its grades and to the skill\'s representation set', () => {
    rejects(edit(equalGroupsActivity, a => { a.aim.skills = ['5.NF.B.4']; a.model.quantities[1]!.value = '4'; }), 'representation');
    rejects(edit(equalGroupsActivity, a => { a.response = { ask: 's.total', distractors: [], exactness: 'any', form: 'fraction' }; }), 'representation');
    rejects(edit(equalGroupsActivity, a => { a.aim.skills = ['3.OA.B.6']; }), 'skill_unknown');
    rejects(edit(shadedFractionActivity, a => { a.aim.skills = ['1.G.A.3']; a.model.quantities[0]!.value = '4'; a.model.structures[0]!.show = 'strip'; a.response = { ask: 'f.fraction', candidates: null, distractors: [], form: 'choose' }; }), 'representation', 'k2');
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
    // The ask's noun reads in the question form (plural) whatever the hidden value, exactly as .other does.
    const byNoun = check(edit(equalGroupsActivity, a => { a.prompt[2] = { text: 'How many {{s.total.noun}} are there?', type: 'text' }; }));
    const byOther = check(edit(equalGroupsActivity, a => { a.prompt[2] = { text: 'How many {{s.total.other}} are there?', type: 'text' }; }));
    assert.ok(byNoun.ok && byOther.ok);
    assert.deepEqual(byNoun.activity.rendered.prompt[2], byOther.activity.rendered.prompt[2]);
    assert.ok(check(edit(equalGroupsActivity, a => { a.support.explanation = 'There are {{s.total}}.'; })).ok, 'the explanation may name the answer');
  });
  it('rejects a printed number the question does not use when it equals the answer, but allows story numbers', () => {
    rejects(edit(equalGroupsActivity, a => {
      a.model.quantities.push({ id: 't', kind: 'count', noun: { icon: 'apple', one: 'apple', other: 'apples' }, unit: null, value: '12' });
      a.prompt[0] = { text: 'Ana fills {{s.groups}} with {{s.size}} each, {{t}} in all.', type: 'text' };
    }), 'answer_stated');
    assert.ok(check(edit(equalGroupsActivity, a => {
      a.model.quantities.push({ id: 'd', kind: 'count', noun: { icon: null, one: 'day', other: 'days' }, unit: null, value: '5' });
      a.prompt[0] = { text: 'In {{d}} Ana fills {{s.groups}} with {{s.size}} each.', type: 'text' };
    })).ok, 'a story number the question does not use is context');
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

describe('review regressions: no path around the answer checks', () => {
  it('requires the ask to be one reference, so a bare number or expression can never be the key', () => {
    rejects(edit(equalGroupsActivity, a => { a.response = { ask: '13', distractors: [], form: 'number' }; }), 'ask_not_ref');
    rejects(edit(equalGroupsActivity, a => { a.response = { ask: 's.groups*s.size', distractors: [], form: 'number' }; }), 'ask_not_ref');
  });
  it('declares every number: a given is a written number, a derived value has no number of its own and is no alias', () => {
    const add = (value: string) => edit(equalGroupsActivity, a => { a.model.quantities.push({ id: 't', kind: 'count', noun: null, unit: null, value }); a.prompt[2] = { text: 'There are {{t.n}} in all.', type: 'text' }; });
    rejects(add('s.total'), 'alias');
    rejects(add('s.total*1'), 'derived_number');
    rejects(add('s.total+10'), 'derived_number');
    rejects(add('0*s.groups+13'), 'derived_number');
    rejects(add('3*4+1'), 'given_arithmetic');
  });
  it('rejects a printed value that recomputes the answer, whatever its noun or kind', () => {
    rejects(edit(equalGroupsActivity, a => { a.model.quantities.push({ id: 't', kind: 'count', noun: null, unit: null, value: 's.groups*s.size' }); a.prompt[2] = { text: 'There are {{t.n}} in all. How many {{s.total.other}}?', type: 'text' }; }), 'answer_stated');
    rejects(edit(shadedFractionActivity, a => { a.model.quantities.push({ id: 'x', kind: 'number', noun: null, unit: null, value: 'f.selected/f.parts' }); a.prompt[1] = { text: 'It is {{x}}. What fraction of the {{f.view}} is shaded?', type: 'text' }; }), 'answer_stated');
    rejects(edit(equalGroupsActivity, a => {
      a.model.quantities.push({ id: 't', kind: 'count', noun: null, unit: null, value: 's.groups*s.size' }, { id: 'e', kind: 'count', noun: null, unit: null, value: '0' }, { id: 'left', kind: 'count', noun: null, unit: null, value: 't-e' });
      a.prompt[2] = { text: 'That is {{t.n}}; none are eaten ({{e.n}}). How many are left?', type: 'text' };
      a.response = { ask: 'left', distractors: [], form: 'number' }; a.support.hints = [];
    }), 'answer_stated');
    rejects(edit(equalGroupsActivity, a => {
      a.aim.skills = ['3.OA.A.2'];
      a.model.quantities = [
        { id: 'g', kind: 'count', noun: { icon: 'basket', one: 'basket', other: 'baskets' }, unit: null, value: '3' },
        { id: 't', kind: 'count', noun: null, unit: null, value: '12' },
        { id: 'n', kind: 'count', noun: { icon: 'apple', one: 'apple', other: 'apples' }, unit: null, value: 't/g' },
      ];
      a.model.structures[0]!.show = null;
      a.prompt = [{ text: 'There are {{t.n}} in {{s.groups}}. How many {{s.total.other}} are there in all?', type: 'text' }];
      a.support = { explanation: '{{s.total}}.', hints: [] };
    }), 'answer_stated'); // the answer IS the given 12, whatever nouns it carries
    rejects(edit(equalGroupsActivity, a => { a.model.quantities.push({ id: 't', kind: 'count', noun: null, unit: null, value: '12' }); a.prompt[2] = { text: 'There are {{t.n}} in all. How many {{s.total.other}}?', type: 'text' }; }), 'answer_stated');
  });
  it('keeps legitimate equal values: a square fact, and a story whose answer equals a given', () => {
    const square = edit(equalGroupsActivity, a => {
      a.aim.skills = ['3.OA.A.4'];
      a.model.quantities = [
        { id: 'g', kind: 'count', noun: null, unit: null, value: '3' }, { id: 't', kind: 'count', noun: null, unit: null, value: '9' },
        { id: 'n', kind: 'count', noun: null, unit: null, value: 't/g' },
      ];
      a.model.structures[0]!.show = null;
      a.prompt = [{ tex: '{{s.groups.n}} \\times {{s.size.n}} = {{t.n}}', type: 'math' }, { text: 'Find the missing factor.', type: 'text' }];
      a.response = { ask: 's.size', distractors: [], form: 'number' };
      a.support = { explanation: 'It is {{s.size.n}}.', hints: [] };
    });
    assert.equal(key(square), '3', '3 × □ = 9 with no nouns');
    const eaten = edit(equalGroupsActivity, a => {
      a.model.quantities.push({ id: 'e', kind: 'count', noun: { icon: 'apple', one: 'apple', other: 'apples' }, unit: null, value: '8' }, { id: 'left', kind: 'count', noun: { icon: 'apple', one: 'apple', other: 'apples' }, unit: null, value: 's.total-e' });
      a.prompt[2] = { text: 'Ana eats {{e}}. How many {{left.other}} are left?', type: 'text' };
      a.response = { ask: 'left', distractors: [], form: 'number' };
      a.support.hints = [];
    });
    assert.equal(key(eaten), '4', 'the answer equals the size of a basket, an input');
  });
  it('rejects a view that is not part of the math asked', () => {
    rejects(edit(equalGroupsActivity, a => {
      a.model.quantities.push({ id: 'a', kind: 'count', noun: null, unit: null, value: '2' }, { id: 'b', kind: 'count', noun: null, unit: null, value: '6' });
      a.model.structures.push({ id: 'z', kind: 'equal_groups', roles: { groups: 'a', size: 'b' }, show: 'jumps' });
      a.prompt.push({ of: 'z', type: 'view' });
    }), 'view_unrelated');
  });
  it('lets the prompt name the correct option only among all of them, and never in a hint', () => {
    const choose = (prompt: string, hints: string[] = []) => edit(equalGroupsActivity, a => {
      a.model.quantities.push({ id: 't', kind: 'count', noun: null, unit: null, value: 's.groups*s.size' }, { id: 'u', kind: 'count', noun: null, unit: null, value: 's.groups+s.size' });
      a.prompt[2] = { text: prompt, type: 'text' };
      a.response = { ask: 's.total', candidates: ['t', 'u'], distractors: [], form: 'choose' };
      a.support.hints = hints;
    });
    rejects(choose('There are {{t.n}} in all. How many {{s.total.other}}?'), 'candidates_partial');
    assert.ok(check(choose('Is it {{t.n}} or {{u.n}} {{s.total.other}} in all?')).ok, JSON.stringify(codesOf(check(choose('Is it {{t.n}} or {{u.n}} {{s.total.other}} in all?')))));
    rejects(choose('How many {{s.total.other}} are there?', ['It is {{t.n}}.']), 'candidate_in_hint');
    rejects(choose('How many {{s.total.other}} are there?', ['Is it {{u.n}}?']), 'candidate_in_hint');
    rejects(edit(equalGroupsActivity, a => { a.prompt[2] = { text: 'How many {{s.total.other}}?', type: 'text' }; a.response = { ask: 's.total', candidates: ['s.total', '7'], distractors: [], form: 'choose' }; }), 'candidate_not_ref');
  });
  it('rejects a second view of the same quantities, and a decoy that shares an input', () => {
    rejects(edit(equalGroupsActivity, a => { a.model.structures.push({ id: 't', kind: 'equal_groups', roles: { groups: 'g', size: 'n' }, show: 'jumps' }); a.prompt.push({ of: 't', type: 'view' }); }), 'view_unrelated');
    const decoy = (show: 'jumps' | null, prompt?: string) => edit(equalGroupsActivity, a => {
      a.model.quantities.push({ id: 'c', kind: 'count', noun: null, unit: null, value: '4' });
      a.model.structures.push({ id: 'z', kind: 'equal_groups', roles: { groups: 'g', size: 'c' }, show });
      if (show) a.prompt.push({ of: 'z', type: 'view' });
      if (prompt) a.prompt[2] = { text: prompt, type: 'text' };
    });
    rejects(decoy('jumps'), 'view_unrelated');
    // A decoy's number in the prose is rejected when it equals the answer (its total, 2 × 6, beside 3 × 4).
    const equalDecoy = edit(equalGroupsActivity, a => {
      a.model.quantities.push({ id: 'zr', kind: 'count', noun: null, unit: null, value: '2' }, { id: 'zc', kind: 'count', noun: null, unit: null, value: '6' });
      a.model.structures.push({ id: 'z', kind: 'array', roles: { cols: 'zc', rows: 'zr' }, show: null });
      a.prompt[2] = { text: 'A shelf holds {{z.total.n}}. How many {{s.total.other}}?', type: 'text' };
    });
    rejects(equalDecoy, 'answer_stated');
  });
  it('holds select to the candidate rules too', () => {
    const sel = (hint: string) => edit(shadedFractionActivity, a => {
      a.aim.skills = ['3.NF.A.3'];
      a.model.quantities = [{ id: 'p', kind: 'count', noun: null, unit: null, value: '4' }, { id: 'k', kind: 'count', noun: null, unit: null, value: '2' }, { id: 'pb', kind: 'count', noun: null, unit: null, value: '3' }, { id: 'kb', kind: 'count', noun: null, unit: null, value: '1' }, { id: 'u', kind: 'fraction', noun: null, unit: null, value: '1/2' }];
      a.model.structures = [{ id: 'f', kind: 'fraction', roles: { parts: 'p', selected: 'k', wholes: null }, show: 'rect' }, { id: 'g', kind: 'fraction', roles: { parts: 'pb', selected: 'kb', wholes: null }, show: 'circle' }];
      a.prompt = [{ text: 'Select each model that shows {{u}} shaded.', type: 'text' }, { of: 'f', type: 'view' }, { of: 'g', type: 'view' }];
      a.response = { ask: 'u', candidates: ['f.fraction', 'g.fraction'], form: 'select' };
      a.support = { explanation: 'Compare each with {{u}}.', hints: [hint] };
    });
    assert.ok(check(sel('Count the shaded parts.')).ok, JSON.stringify(codesOf(check(sel('Count the shaded parts.')))));
    rejects(sel('Look for {{f.fraction}}.'), 'candidate_in_hint');
  });
  it('knows a fraction complement reads its wholes', () => {
    rejects(edit(shadedFractionActivity, a => {
      a.aim.skills = ['3.NF.A.3'];
      a.model.quantities = [{ id: 'p', kind: 'count', noun: null, unit: null, value: '4' }, { id: 'k', kind: 'count', noun: null, unit: null, value: '3' }, { id: 'w', kind: 'count', noun: null, unit: null, value: '2' }];
      a.model.structures = [{ id: 'f', kind: 'fraction', roles: { parts: 'p', selected: 'k', wholes: 'w' }, show: null }];
      a.prompt = [{ text: 'A cake is cut into {{f.parts}}. Mia eats {{f.selected}}. What fraction is left?', type: 'text' }];
      a.response = { ask: 'f.complement', distractors: [], exactness: 'any', form: 'fraction' };
      a.support = { explanation: '{{f.complement}} is left.', hints: [] };
    }), 'ask_unanswerable');
  });
  it('hides every side bound to the asked quantity (a square)', () => {
    const square = edit(areaActivity, a => {
      a.aim.skills = ['4.MD.A.3'];
      a.model.quantities = [{ id: 'p', kind: 'length', noun: null, unit: 'm', value: '24' }, { id: 'k', kind: 'count', noun: { icon: null, one: 'side', other: 'sides' }, unit: null, value: '4' }, { id: 's', kind: 'length', noun: null, unit: 'm', value: 'p/k' }];
      a.model.structures = [{ id: 'r', kind: 'rect_area', roles: { h: 's', w: 's' }, show: 'labeled' }];
      a.prompt = [{ text: 'A square garden has {{k}} equal sides and a fence of {{p}} around it.', type: 'text' }, { of: 'r', type: 'view' }, { text: 'How long is each side?', type: 'text' }];
      a.response = { ask: 'r.h', distractors: [], form: 'number' };
      a.support = { explanation: 'Each side is {{r.h}}.', hints: [] };
    });
    const c = valid(square);
    const labels = (c.drawings.get('r') as { shapes: { kind: string; label?: string }[] }).shapes.filter(x => x.kind === 'dimension').map(x => x.label);
    assert.deepEqual(labels, ['?', '?']);
  });
  it('allows hundredths with no figure, and the drawing limits reject a view that cannot draw them', () => {
    const hundredths = (show: 'rect' | null) => edit(shadedFractionActivity, a => {
      a.aim.skills = ['4.NF.A.1']; a.model.quantities[0]!.value = '100'; a.model.quantities[1]!.value = '37'; a.model.structures[0]!.show = show;
      a.prompt = show ? [{ of: 'f', type: 'view' }, { text: 'What fraction is shaded?', type: 'text' }] : [{ text: 'A sheet has {{f.parts}} squares and {{f.selected}} are shaded. What fraction is shaded?', type: 'text' }];
      a.support.explanation = '{{f.fraction}} is shaded.';
    });
    assert.ok(check(hundredths(null)).ok, JSON.stringify(codesOf(check(hundredths(null)))));
    rejects(hundredths('rect'), 'draw');
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
    assert.ok(check(edit(equalGroupsActivity, a => { a.model.quantities[0]!.value = '10'; a.model.quantities[1]!.value = '10'; })).ok, '100 icons is the cap, not over it');
    // Grades and representation sets keep equal groups within the cap; a hundred-part rectangle is not drawable.
    rejects(edit(shadedFractionActivity, a => { a.aim.skills = ['4.NF.A.1']; a.model.quantities[0]!.value = '100'; a.model.quantities[1]!.value = '37'; a.model.structures[0]!.show = 'rect'; }), 'draw');
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
