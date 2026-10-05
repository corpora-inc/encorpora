import React from 'react';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { FigureView } from './Figure';
import { ICONS, hasIcon, resolveIcon } from './icons';
import { drawingProblems, pictureGroups, type DrawFigure } from '../draw';
import { fixtures } from '../fixtures';

const render = (figure: DrawFigure) => renderToStaticMarkup(<FigureView figure={figure} />);
const rect = (x0: number, y0: number, w: number, h: number) => [{ x: x0, y: y0 }, { x: x0 + w, y: y0 }, { x: x0 + w, y: y0 + h }, { x: x0, y: y0 + h }];

describe('drawing IR renderers', () => {
  it('draws graph paper with stronger lines every 5 units, and unit squares clipped to the shape', () => {
    const small = render({ type: 'geometry', id: 'g', alt: 'a', width: 8, height: 6, grid: { unit: 1 }, shapes: [{ kind: 'polygon', points: rect(1, 1, 5, 3), unitSquares: true }] });
    assert.equal((small.match(/class="ax-graph-minor"/g) ?? []).length, 9 + 7, '8×6 paper: 9 vertical + 7 horizontal lines');
    assert.equal((small.match(/class="ax-graph-major"/g) ?? []).length, 0, 'no major lines on small paper');
    assert.match(small, /<clipPath id="ax-clip\d+-0"><polygon/);
    assert.equal((small.match(/<g clip-path="url\(#ax-clip\d+-0\)" class="ax-unit-squares"[^>]*>(.*?)<\/g>/)?.[1]!.match(/<line/g) ?? []).length, 4 + 2, '5×3 rectangle: 4 inner vertical + 2 inner horizontal lines');
    assert.match(small, /class="ax-graph-paper" aria-hidden="true"/);
    const large = render({ type: 'geometry', id: 'g', alt: 'a', width: 14, height: 9, grid: { unit: 1 }, shapes: [{ kind: 'polygon', points: rect(1, 1, 6, 4) }] });
    assert.equal((large.match(/class="ax-graph-major"/g) ?? []).length, 3 + 2, '14×9 paper: x = 0, 5, 10 and y = 0, 5');
    const plain = render({ type: 'geometry', id: 'g', alt: 'a', width: 8, height: 6, shapes: [{ kind: 'polygon', points: rect(1, 1, 5, 3) }] });
    assert.doesNotMatch(plain, /ax-graph|ax-unit-squares/, 'no grid unless asked');
  });
  it('draws a repeated picture group as that many identical groups', () => {
    const fig: DrawFigure = { type: 'picture', id: 'p', alt: 'a', groups: [{ icon: 'apple', count: 4, repeat: 3, label: 'basket' }] };
    const html = render(fig);
    assert.equal((html.match(/class="ax-pic-group"/g) ?? []).length, 3);
    assert.equal((html.match(/class="ax-pic-icon/g) ?? []).length, 12);
    assert.equal((html.match(/>basket</g) ?? []).length, 3);
    assert.deepEqual(pictureGroups(fig as Extract<DrawFigure, { type: 'picture' }>).map(g => g.count), [4, 4, 4]);
  });
  it('highlights the first `shaded` icons of a set', () => {
    const html = render({ type: 'picture', id: 'p', alt: 'a', groups: [{ icon: 'marble', count: 6, shaded: 2 }] });
    assert.equal((html.match(/ax-pic-icon is-shaded/g) ?? []).length, 2);
    assert.equal((html.match(/ax-pic-icon is-unshaded/g) ?? []).length, 4);
  });
  it('draws any named object from the broad icon vocabulary, and a neutral counter for unknown names', () => {
    assert.ok(Object.keys(ICONS).length >= 200);
    for (const name of ['apple', 'apples', 'cherries', 'buses', 'puppy', 'traffic_cone', 'umbrella', 'basket']) assert.ok(hasIcon(name), name);
    assert.equal(hasIcon('pinecone'), false);
    assert.equal(resolveIcon('rates'), resolveIcon('zzz'), 'singular by spelling rules: "rates" is not a rat');
    assert.equal(resolveIcon('cares'), resolveIcon('zzz'));
    assert.equal(resolveIcon('boxes'), resolveIcon('box'));
    assert.equal(resolveIcon('cherries'), resolveIcon('cherry'));
    assert.equal(resolveIcon('pinecone'), resolveIcon('zzz'), 'unknown names share the neutral counter');
    for (const proto of ['constructor', 'constructors', 'tostring', 'hasownproperty', 'valueof', '__proto__']) assert.equal(resolveIcon(proto), resolveIcon('zzz'), proto);
    const html = render({ type: 'picture', id: 'p', alt: 'a', groups: [{ icon: 'constructor', count: 3 }] });
    assert.equal((html.match(/class="ax-pic-icon/g) ?? []).length, 3, 'every object is still drawn and countable');
    assert.match(render({ type: 'array_grid', id: 'a', alt: 'a', rows: 2, cols: 3, style: 'icons', icon: 'chair' }), /ax-icon-grid/);
  });
  it('still draws every v1 fixture figure (a v1 figure is a drawing as it is)', () => {
    for (const f of fixtures.flatMap(x => x.figures ?? [])) assert.match(render(f), /data-figure-id=/, f.id);
  });
});

describe('drawing invariants', () => {
  it('accepts every v1 fixture figure', () => {
    for (const f of fixtures.flatMap(x => x.figures ?? [])) assert.deepEqual(drawingProblems(f), [], f.id);
  });
  it('holds IR-only fields to their own rules and the rest to v1', () => {
    const geo = (over: object): DrawFigure => ({ type: 'geometry', id: 'g', alt: 'a', width: 8, height: 6, grid: { unit: 1 }, shapes: [{ kind: 'polygon', points: rect(1, 1, 5, 3), unitSquares: true }], ...over });
    assert.deepEqual(drawingProblems(geo({})), []);
    assert.ok(drawingProblems(geo({ shapes: [{ kind: 'polygon', points: rect(1.5, 1, 5, 3), unitSquares: true }] })).some(p => /whole number of grid units/.test(p)));
    assert.ok(drawingProblems(geo({ width: 60, height: 6, shapes: [{ kind: 'polygon', points: rect(1, 1, 5, 3) }] })).some(p => /more than 50 lines/.test(p)));
    assert.ok(drawingProblems(geo({ shapes: [{ kind: 'polygon', points: rect(1, 1, 9, 3) }] })).some(p => /fit inside/.test(p)), 'v1 rule: shapes fit');
    const pic = (groups: object[]): DrawFigure => ({ type: 'picture', id: 'p', alt: 'a', groups } as DrawFigure);
    assert.deepEqual(drawingProblems(pic([{ icon: 'apple', count: 10, repeat: 10 }])), []);
    assert.ok(drawingProblems(pic([{ icon: 'apple', count: 10, repeat: 11 }])).some(p => /100 icons/.test(p)));
    assert.ok(drawingProblems(pic([{ icon: 'apple', count: 1, repeat: 13 }])).some(p => /12 groups/.test(p)));
    assert.ok(drawingProblems(pic([{ icon: 'apple', count: 3, repeat: 2, id: 'a' }])).some(p => /repeated group/.test(p)));
    assert.ok(drawingProblems(pic([{ icon: 'apple', count: 3, shaded: 4 }])).some(p => /shaded exceeds/.test(p)));
    assert.ok(drawingProblems({ type: 'number_line', id: 'n', alt: 'a', min: 0, max: 50, step: 1 }).some(p => /40 ticks/.test(p)), 'v1 rule');
  });
});
