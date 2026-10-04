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
