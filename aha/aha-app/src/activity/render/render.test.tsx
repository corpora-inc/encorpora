import React from 'react';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { fixtures } from '../fixtures';
import { ActivityView, displayOrder } from './ActivityView';
import { RichText } from './RichText';
import { correctResponse } from '../grade';

const render = (el: React.ReactElement) => renderToStaticMarkup(el);
const noop = () => {};

describe('Activity renderer', () => {
  it('renders every fixture with accessible figures and no unsafe output', () => {
    for (const spec of fixtures) {
      const html = render(<ActivityView spec={spec} onSubmit={noop} />);
      assert.match(html, /class="aha-activity"/, spec.id);
      assert.doesNotMatch(html, /<(script|iframe|img|object|embed|a)\b/, spec.id);
      assert.doesNotMatch(html, /\son[a-z]+=/i, `${spec.id}: no inline handlers`);
      assert.doesNotMatch(html.replace(/xmlns="http:\/\/www\.w3\.org\/[^"]+"/g, ''), /(https?|javascript):/, spec.id);
      for (const f of spec.figures ?? []) {
        assert.ok(html.includes(`data-figure-id="${f.id}"`), `${spec.id}/${f.id} rendered`);
        const alt = f.alt.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');
        assert.ok(html.includes(alt), `${spec.id}/${f.id} exposes alt text`);
      }
      assert.ok(html.includes('Check my answer'));
    }
  });
  it('draws geometry graph paper with stronger lines every 5 units, and unit squares clipped to the shape', () => {
    const small = render(<ActivityView spec={fixtures.find(f => f.id === 'fx-3-area-graph-paper')!} onSubmit={noop} />);
    assert.equal((small.match(/class="ax-graph-minor"/g) ?? []).length, 9 + 7, '8×6 paper: 9 vertical + 7 horizontal lines');
    assert.equal((small.match(/class="ax-graph-major"/g) ?? []).length, 0, 'no major lines on small paper');
    assert.match(small, /<clipPath id="ax-clip\d+-0"><polygon/);
    assert.equal((small.match(/<g clip-path="url\(#ax-clip\d+-0\)" class="ax-unit-squares"[^>]*>(.*?)<\/g>/)?.[1]!.match(/<line/g) ?? []).length, 4 + 2, '5×3 rectangle: 4 inner vertical + 2 inner horizontal lines');
    assert.match(small, /class="ax-graph-paper" aria-hidden="true"/);
    const large = render(<ActivityView spec={fixtures.find(f => f.id === 'fx-3-composite-area-grid')!} onSubmit={noop} />);
    assert.equal((large.match(/class="ax-graph-major"/g) ?? []).length, 3 + 2, '14×9 paper: x = 0, 5, 10 and y = 0, 5');
    const plain = render(<ActivityView spec={fixtures.find(f => f.id === 'fx-3-garden-perimeter')!} onSubmit={noop} />);
    assert.doesNotMatch(plain, /ax-graph|ax-unit-squares/, 'no grid unless asked');
  });
  it('draws a repeated picture group as that many identical groups', async () => {
    const spec = fixtures.find(f => f.id === 'fx-3-equal-groups')!;
    const html = render(<ActivityView spec={spec} onSubmit={noop} />);
    assert.equal((html.match(/class="ax-pic-group"/g) ?? []).length, 4);
    assert.equal((html.match(/class="ax-pic-icon/g) ?? []).length, 12);
    const { pictureGroups } = await import('../spec');
    assert.deepEqual(pictureGroups(spec.figures![0] as any).map(g => g.count), [3, 3, 3, 3]);
  });
  it('draws any named object from the broad icon vocabulary, and a neutral counter for unknown names', async () => {
    const { resolveIcon, hasIcon, ICONS } = await import('./icons');
    assert.ok(Object.keys(ICONS).length >= 200);
    for (const name of ['apple', 'apples', 'strawberries', 'buses', 'puppy', 'traffic_cone', 'violin', 'umbrella']) assert.ok(resolveIcon(name), name);
    assert.ok(hasIcon('apples') && hasIcon('puppy') && hasIcon('umbrella') && hasIcon('traffic_cone'));
    assert.equal(hasIcon('pinecone'), false);
    assert.equal(resolveIcon('pinecone'), resolveIcon('zzz'), 'unknown names share the neutral counter');
    for (const proto of ['constructor', 'constructors', 'tostring', 'hasownproperty', 'valueof', '__proto__']) assert.equal(resolveIcon(proto), resolveIcon('zzz'), proto);
    const spec = structuredClone(fixtures.find(f => (f.figures ?? []).some(x => x.type === 'picture'))!);
    const picture = spec.figures!.find(x => x.type === 'picture')! as any;
    picture.groups[0].icon = 'pinecone';
    const html = render(<ActivityView spec={spec} onSubmit={noop} />);
    assert.equal((html.match(/class="ax-pic-icon/g) ?? []).length >= picture.groups[0].count, true, 'every object is still drawn and countable');
    picture.groups[0].icon = 'constructor';
    assert.doesNotThrow(() => render(<ActivityView spec={spec} onSubmit={noop} />), 'prototype names draw the counter, never crash');
  });
  it('uses <title>/<desc> on SVG figures and labelled groups for interactive ones', () => {
    const chart = render(<ActivityView spec={fixtures.find(f => f.id === 'fx-2-fruit-graph')!} onSubmit={noop} />);
    assert.match(chart, /<svg[^>]*role="img"[^>]*aria-labelledby="ax-t\d+"[^>]*aria-describedby="ax-d\d+"/);
    assert.match(chart, /<title id="ax-t\d+">Favorite fruit<\/title><desc id="ax-d\d+">Bar graph of votes/);
    const tap = render(<ActivityView spec={fixtures.find(f => f.id === 'fx-6-pie-tap')!} onSubmit={noop} />);
    assert.match(tap, /role="group"/);
    assert.match(tap, /role="button" tabindex="0" aria-label="Blue" aria-pressed="false"/);
    const plot = render(<ActivityView spec={fixtures.find(f => f.id === 'fx-5-plant-the-tree')!} onSubmit={noop} />);
    assert.match(plot, /tabindex="0"/);
    assert.match(plot, /aria-label="Increase x"/);
  });
  it('renders response widgets per type with mobile-friendly inputs', () => {
    const numeric = render(<ActivityView spec={fixtures.find(f => f.id === 'fx-2-coins')!} onSubmit={noop} />);
    assert.match(numeric, /inputMode="decimal"/);
    const fraction = render(<ActivityView spec={fixtures.find(f => f.id === 'fx-3-fraction-bar')!} onSubmit={noop} />);
    assert.equal((fraction.match(/inputMode="numeric"/g) ?? []).length, 2);
    const expr = render(<ActivityView spec={fixtures.find(f => f.id === 'fx-6-write-expression')!} onSubmit={noop} />);
    assert.match(expr, /autoCapitalize="off"/);
    const ordering = render(<ActivityView spec={fixtures.find(f => f.id === 'fx-2-order-numbers')!} onSubmit={noop} />);
    assert.equal((ordering.match(/aria-label="Move (up|down)/g) ?? []).length, 8);
    const multi = render(<ActivityView spec={fixtures.find(f => f.id === 'fx-6-common-factors')!} onSubmit={noop} />);
    assert.equal((multi.match(/type="checkbox"/g) ?? []).length, 7);
    const mc = render(<ActivityView spec={fixtures.find(f => f.id === 'fx-1-half-hour')!} onSubmit={noop} />);
    assert.equal((mc.match(/type="radio"/g) ?? []).length, 4);
  });
  it('shuffles deterministically and never presents ordering items already solved', () => {
    assert.deepEqual(displayOrder(5, 'seed', true), displayOrder(5, 'seed', true));
    assert.deepEqual(displayOrder(4, 'x', false), [0, 1, 2, 3]);
    for (let i = 0; i < 50; i++) assert.notDeepEqual(displayOrder(2, `s${i}`, true, true), [0, 1]);
  });
  it('shows feedback, explanation and progressive hints', () => {
    const spec = fixtures.find(f => f.id === 'fx-2-fruit-graph')!;
    const right = render(<ActivityView spec={spec} onSubmit={noop} result={{ correct: true, normalized: '5' }} initialResponse={correctResponse(spec)} />);
    assert.ok(right.includes('Yes — that’s it.'));
    assert.ok(right.includes('so 5 more students chose apples'));
    const wrong = render(<ActivityView spec={spec} onSubmit={noop} result={{ correct: false, normalized: '13' }} initialHintsShown={1} />);
    assert.ok(wrong.includes('Not quite yet.'));
    assert.ok(wrong.includes('See how it works'));
    assert.ok(wrong.includes('Find the top of the apples bar'));
  });
  it('typesets math with KaTeX but never trusts commands or HTML in text', () => {
    const html = render(<RichText text={'Tom has \\$3 and <b>$\\frac{1}{2}$</b> $\\href{javascript:alert(1)}{x}$'} />);
    assert.ok(html.includes('class="katex"'));
    assert.ok(html.includes('$3'));
    assert.ok(html.includes('&lt;b&gt;'), 'markup in text is inert text');
    assert.doesNotMatch(html, /<a\b|javascript:alert/);
  });
  it('supports explicit dark and auto themes', () => {
    const spec = fixtures[0]!;
    assert.match(render(<ActivityView spec={spec} onSubmit={noop} theme="dark" />), /data-theme="dark"/);
    assert.match(render(<ActivityView spec={spec} onSubmit={noop} theme="auto" />), /data-theme-auto=""/);
  });
});
