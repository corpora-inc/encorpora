import React from 'react';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActivityView } from '../render/ActivityView';
import { goldResolved } from './gold/resolved';

const render = (el: React.ReactElement) => renderToStaticMarkup(el);
const noop = () => {};
const spec = (id: string) => goldResolved().find(s => s.id === id)!;
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');

describe('v2 activities render through ActivityView', () => {
  it('renders every gold spec safely, with each figure and its app-written alt', () => {
    for (const s of goldResolved()) {
      for (const compact of [false, true]) {
        const html = render(<ActivityView spec={s} onSubmit={noop} compact={compact} />);
        assert.match(html, /class="aha-activity/, s.id);
        assert.doesNotMatch(html, /<(script|iframe|img|object|embed|a)\b/, s.id);
        assert.doesNotMatch(html, /\son[a-z]+=/i, `${s.id}: no inline handlers`);
        for (const f of s.figures ?? []) {
          assert.ok(html.includes(`data-figure-id="${f.id}"`), `${s.id}/${f.id} rendered`);
          assert.ok(html.includes(escape(f.alt)), `${s.id}/${f.id} exposes its alt`);
        }
      }
    }
  });
  it('draws the live-1 picture as three groups of four apples', () => {
    const html = render(<ActivityView spec={spec('g3-equal-groups-orchard')} onSubmit={noop} />);
    assert.equal((html.match(/class="ax-pic-group"/g) ?? []).length, 3);
    assert.equal((html.match(/class="ax-pic-icon/g) ?? []).length, 12);
    assert.match(html, /Ana fills 3 baskets with 4 apples each\./);
  });
  it('draws live 3 as graph paper with unit squares, never a chart', () => {
    const html = render(<ActivityView spec={spec('g3-rect-unit-squares')} onSubmit={noop} />);
    assert.match(html, /ax-graph-paper/);
    assert.match(html, /ax-unit-squares/);
    assert.doesNotMatch(html, /ax-slice|pie/);
    assert.match(html, /Each small square is 1 square unit\./);
  });
  it('makes every part of a fraction model a shading toggle, with matching chips', () => {
    const html = render(<ActivityView spec={spec('g3-fraction-rect-shade')} onSubmit={noop} />);
    assert.equal((html.match(/role="button" tabindex="0" aria-label="Part \d"/g) ?? []).length, 4);
    assert.equal((html.match(/>Part \d<\/button>/g) ?? []).length, 4);
    const shaded = render(<ActivityView spec={spec('g3-fraction-rect-shade')} onSubmit={noop} initialResponse={{ type: 'shade', shaded: [2] }} />);
    assert.equal((shaded.match(/aria-pressed="true"/g) ?? []).length, 2, 'the part and its chip are pressed');
  });
  it('places a point on a number line with steppers that never say the value', () => {
    const html = render(<ActivityView spec={spec('g3-fraction-line-place')} onSubmit={noop} compact />);
    assert.match(html, /aria-label="Move the point right one tick"/);
    assert.match(html, /ax-place-hit/);
    const placed = render(<ActivityView spec={spec('g3-fraction-line-place')} onSubmit={noop} compact initialResponse={{ type: 'place', tick: 3 }} />);
    assert.match(placed, /class="ax-placed"/);
    assert.match(placed, /Tick 3 of 4, counting from 0/);
    assert.doesNotMatch(placed.replace(/<annotation[^]*?<\/annotation>/g, ''), /3\/4|three fourths/, 'the controls never name the value');
  });
  it('makes each view a choice when the learner taps one of them', () => {
    const html = render(<ActivityView spec={spec('g3-fraction-tap-model')} onSubmit={noop} />);
    assert.equal((html.match(/role="button" tabindex="0" aria-pressed="false" aria-label="Picture \d"/g) ?? []).length, 2);
    assert.equal((html.match(/>Picture \d<\/button>/g) ?? []).length, 2);
  });
  it('writes grade 1–2 fractions in words, in the prompt and in the options', () => {
    assert.match(render(<ActivityView spec={spec('g1-fraction-rect-shade-half')} onSubmit={noop} />), /Shade one half of the rectangle\./);
    const thirds = render(<ActivityView spec={spec('g2-fraction-circle-thirds')} onSubmit={noop} />);
    assert.match(thirds, /one third/);
    assert.match(thirds, /two thirds/);
  });
});

describe('review regressions: descriptions and options never give the answer away', () => {
  it('describes a role equal to a derived answer countably, never as a number', async () => {
    const { check, equalGroupsActivity, clone } = await import('./testkit');
    const { resolveActivity } = await import('./resolve');
    const a = clone(equalGroupsActivity());
    a.aim.skills = ['3.OA.A.2'];
    a.model.quantities.push({ id: 'x', kind: 'count', noun: { icon: 'apple', one: 'apple', other: 'apples' }, unit: null, value: 's.total/g' });
    a.prompt = [{ text: 'Ana fills some {{s.groups.other}}.', type: 'text' }, { of: 's', type: 'view' }, { text: 'How many {{x.other}} are in each {{s.groups.one}}?', type: 'text' }];
    a.response = { ask: 'x', distractors: [], form: 'number' };
    a.support = { explanation: 'Each has {{x}}.', hints: [] };
    const v = check(a);
    assert.ok(v.ok, JSON.stringify(!v.ok && v.problems));
    assert.equal(resolveActivity(v.activity, 'x').figures![0]!.alt, '3 baskets. In each basket: apple, apple, apple, apple.');
  });
  it('rejects K–2 options that mix fraction words with numerals', async () => {
    const { gold } = await import('./gold');
    const { checkGold } = await import('./gold/resolved');
    const g = structuredClone(gold.find(x => x.id === 'g2-fraction-circle-thirds')!);
    (g.activity.response as { distractors: unknown[] }).distractors.push({ expr: 'p/k', tag: 'numerator_denominator_swapped' });
    const v = checkGold(g);
    assert.ok(!v.ok && v.problems.some(p => p.code === 'choose_notation'), JSON.stringify(!v.ok ? v.problems : 'valid'));
  });
});
