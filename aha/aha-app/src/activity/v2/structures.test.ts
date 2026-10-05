import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rational } from '../../learning/rational';
import { drawingProblems, type DrawFigure } from '../draw';
import { formatPlain, type QuantityKind, type UnitId, type Value } from './quantity';
import { FORM_GRADES, NOTHING_ASKED, RESPONSE_FORMS, isIssue, type BoundRole, type Roles } from './registry';
import { STRUCTURES, STRUCTURE_KINDS, structureDef } from './structures';

const role = (id: string, kind: QuantityKind, q: bigint | [bigint, bigint], unit: UnitId | null = null, noun: BoundRole['decl']['noun'] = null): BoundRole => {
  const value: Value = { q: Array.isArray(q) ? rational(q[0], q[1]) : rational(q), power: kind === 'length' ? 1 : kind === 'area' ? 2 : 0, unit };
  return { id, decl: { id, kind, noun, unit, value: '' }, value };
};
const measure = (kind: keyof typeof STRUCTURES, name: string, roles: Roles<string>) => {
  const v = structureDef(kind).measures[name]!.value(roles);
  assert.ok(!isIssue(v));
  return v;
};
const drawn = (kind: keyof typeof STRUCTURES, view: string, roles: Roles<string>, grade = 3, asked: readonly string[] = []) => {
  const d = structureDef(kind).views[view]!.lower(roles, { grade, asked: new Set(asked) });
  const fig = { ...d, id: 'f', alt: 'drawing' } as DrawFigure;
  assert.deepEqual(drawingProblems(fig), [], `${kind}/${view} lowers to a valid drawing`);
  return fig;
};
const apples = { icon: 'apple', one: 'apple', other: 'apples' };

describe('registry', () => {
  it('declares roles in alphabetical (authoring) order, a primary measure, and views inside the intent grades', () => {
    for (const kind of STRUCTURE_KINDS) {
      const def = structureDef(kind);
      const roles = Object.keys(def.roles);
      assert.deepEqual(roles, [...roles].sort(), `${kind} roles`);
      assert.ok(Object.hasOwn(def.measures, def.primary), `${kind} primary`);
      for (const [name, v] of Object.entries(def.views)) {
        assert.ok(v.grades[0] >= def.grades[0] && v.grades[1] <= def.grades[1], `${kind}.${name} grades`);
        for (const f of v.accepts) assert.ok(RESPONSE_FORMS.includes(f) && FORM_GRADES[f], `${kind}.${name} accepts ${f}`);
        if (v.accepts.includes('tap')) assert.ok(v.regions, `${kind}.${name} hosts tap, so it declares regions`);
      }
      for (const m of Object.values(def.measures)) for (const input of m.inputs) assert.ok(roles.includes(input as string), `${kind} measure input ${String(input)}`);
    }
  });
  it('every view says what it reveals about every role and measure', () => {
    const roles = {
      equal_groups: { groups: role('g', 'count', 3n), size: role('n', 'count', 4n) },
      array: { cols: role('c', 'count', 4n), rows: role('r', 'count', 3n) },
      rect_area: { h: role('h', 'length', 4n, 'cm'), w: role('w', 'length', 5n, 'cm') },
      fraction: { parts: role('p', 'count', 4n), selected: role('k', 'count', 1n), wholes: null },
    } as const;
    for (const kind of STRUCTURE_KINDS) {
      const def = structureDef(kind);
      for (const [name, v] of Object.entries(def.views)) {
        const rv = v.reveals(roles[kind as keyof typeof roles] as never, NOTHING_ASKED);
        assert.deepEqual(Object.keys(rv).sort(), [...Object.keys(def.roles), ...Object.keys(def.measures)].sort(), `${kind}.${name}`);
      }
    }
  });
});

describe('equal_groups', () => {
  const r = { groups: role('g', 'count', 3n, null, { icon: 'basket', one: 'basket', other: 'baskets' }), size: role('n', 'count', 4n, null, apples) };
  it('computes the total in the size noun', () => {
    assert.equal(formatPlain(measure('equal_groups', 'total', r).q), '12');
    assert.deepEqual(STRUCTURES.equal_groups.measures.total.noun(r), apples);
  });
  it('draws one group repeated, so the group count is structural', () => {
    assert.deepEqual(drawn('equal_groups', 'objects', r), { type: 'picture', layout: 'row', groups: [{ icon: 'apple', count: 4, repeat: 3, arrangement: 'row', label: 'basket' }], id: 'f', alt: 'drawing' });
  });
  it('draws jumps on a number line and hides their size when it is asked', () => {
    const line = drawn('equal_groups', 'jumps', r) as Extract<DrawFigure, { type: 'number_line' }>;
    assert.deepEqual(line.jumps, [{ from: 0, to: 4, label: '+4' }, { from: 4, to: 8, label: '+4' }, { from: 8, to: 12, label: '+4' }]);
    assert.equal(line.labelEvery, 4, 'labels on the landing points');
    const asked = drawn('equal_groups', 'jumps', r, 3, ['size']) as Extract<DrawFigure, { type: 'number_line' }>;
    assert.ok(asked.jumps!.every(j => j.label === undefined));
    assert.equal(asked.labelEvery, 12, 'only the ends are labeled when the size is asked');
    assert.equal(STRUCTURES.equal_groups.views.jumps.reveals(r, new Set(['size'])).size, 'countable');
    assert.equal(STRUCTURES.equal_groups.views.jumps.reveals(r, NOTHING_ASKED).total, 'shown');
  });
  it('holds groups and size to the grade', () => {
    assert.deepEqual(STRUCTURES.equal_groups.invariants(r, 3), []);
    assert.ok(STRUCTURES.equal_groups.invariants({ ...r, groups: role('g', 'count', 6n) }, 2).length);
    assert.ok(STRUCTURES.equal_groups.invariants({ ...r, groups: role('g', 'count', 1n) }, 3).length, 'one group is not equal groups');
    assert.ok(STRUCTURES.equal_groups.invariants({ groups: r.groups, size: r.groups }, 3).some(i => i.code === 'role_reused'));
  });
  it('has tied regions: tapping one group can never be the unique answer', () => {
    const regions = STRUCTURES.equal_groups.views.objects.regions!(r);
    assert.equal(regions.length, 3);
    assert.ok(regions.every(x => formatPlain(x.value.q) === '4'));
  });
});

describe('array', () => {
  const r = { cols: role('c', 'count', 4n, null, { icon: 'chair', one: 'chair', other: 'chairs' }), rows: role('r', 'count', 3n, null, { icon: null, one: 'row', other: 'rows' }) };
  it('computes the total in the noun of the objects in a row', () => {
    assert.equal(formatPlain(measure('array', 'total', r).q), '12');
    assert.equal(STRUCTURES.array.measures.total.noun(r)?.other, 'chairs');
  });
  it('draws dots, or the objects themselves', () => {
    assert.deepEqual(drawn('array', 'dots', r), { type: 'array_grid', rows: 3, cols: 4, style: 'dots', id: 'f', alt: 'drawing' });
    assert.deepEqual(drawn('array', 'objects', r), { type: 'array_grid', rows: 3, cols: 4, style: 'icons', icon: 'chair', id: 'f', alt: 'drawing' });
    assert.equal((drawn('array', 'objects', { ...r, cols: role('c', 'count', 4n) }) as { style: string }).style, 'dots', 'no noun: dots');
  });
});

describe('rect_area', () => {
  const r = { h: role('h', 'length', 4n, 'cm'), w: role('w', 'length', 5n, 'cm') };
  it('computes area in square units of the sides and perimeter in their unit', () => {
    assert.deepEqual(measure('rect_area', 'area', r), { q: rational(20n), power: 2, unit: 'cm' });
    assert.deepEqual(measure('rect_area', 'perimeter', r), { q: rational(18n), power: 1, unit: 'cm' });
  });
  it('draws graph paper with the rectangle tiled in unit squares', () => {
    const g = drawn('rect_area', 'unit_squares', r) as Extract<DrawFigure, { type: 'geometry' }>;
    assert.deepEqual(g.grid, { unit: 1 });
    assert.equal(g.width, 7);
    assert.deepEqual(g.shapes[0], { kind: 'polygon', points: [{ x: 1, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 5 }, { x: 1, y: 5 }], color: 'teal', unitSquares: true });
    assert.equal(g.caption, 'Each small square is 1 square centimeter.');
  });
  it('labels both sides, shows "?" for an asked side, and marks extreme shapes not to scale', () => {
    const g = drawn('rect_area', 'labeled', r) as Extract<DrawFigure, { type: 'geometry' }>;
    assert.deepEqual(g.shapes.filter(s => s.kind === 'dimension').map(s => (s as { label: string }).label), ['5 cm', '4 cm']);
    const asked = drawn('rect_area', 'labeled', r, 3, ['h']) as Extract<DrawFigure, { type: 'geometry' }>;
    assert.deepEqual(asked.shapes.filter(s => s.kind === 'dimension').map(s => (s as { label: string }).label), ['5 cm', '?']);
    const square = drawn('rect_area', 'labeled', { h: role('s', 'length', 6n, 'm'), w: role('s', 'length', 6n, 'm') }, 4, ['h', 'w']) as Extract<DrawFigure, { type: 'geometry' }>;
    assert.deepEqual(square.shapes.filter(s => s.kind === 'dimension').map(s => (s as { label: string }).label), ['?', '?'], 'a square asks both sides at once');
    assert.equal(STRUCTURES.rect_area.views.labeled.reveals(r, new Set(['h'])).h, 'hidden');
    const long = drawn('rect_area', 'labeled', { h: role('h', 'length', 2n, 'm'), w: role('w', 'length', 30n, 'm') }, 5) as Extract<DrawFigure, { type: 'geometry' }>;
    assert.equal(long.notToScale, true);
    const decimal = drawn('rect_area', 'labeled', { h: role('h', 'length', [5n, 2n], 'm'), w: role('w', 'length', [3n, 4n], 'm') }, 5) as Extract<DrawFigure, { type: 'geometry' }>;
    assert.deepEqual(decimal.shapes.filter(s => s.kind === 'dimension').map(s => (s as { label: string }).label), ['0.75 m', '2.5 m']);
  });
  it('needs whole sides of at most 12 for unit squares, and whole sides through grade 4', () => {
    assert.deepEqual(STRUCTURES.rect_area.views.unit_squares.fits!(r, 3), []);
    assert.equal(STRUCTURES.rect_area.views.unit_squares.fits!({ ...r, w: role('w', 'length', 13n, 'cm') }, 3).length, 1);
    assert.ok(STRUCTURES.rect_area.invariants({ ...r, w: role('w', 'length', [5n, 2n], 'cm') }, 4).length);
    assert.deepEqual(STRUCTURES.rect_area.invariants({ ...r, w: role('w', 'length', [5n, 2n], 'cm') }, 5), []);
    assert.ok(STRUCTURES.rect_area.invariants({ ...r, h: role('h', 'length', 4n, 'm') }, 3).some(i => i.code === 'unit_mismatch'));
  });
});

describe('fraction', () => {
  const r = { parts: role('p', 'count', 4n), selected: role('k', 'count', 1n), wholes: null };
  it('computes fraction, complement and unit fraction, keeping their terms', () => {
    assert.deepEqual(measure('fraction', 'fraction', r).form, { kind: 'fraction', n: 1n, d: 4n });
    assert.deepEqual(measure('fraction', 'complement', r).form, { kind: 'fraction', n: 3n, d: 4n });
    assert.deepEqual(measure('fraction', 'unit', r).form, { kind: 'fraction', n: 1n, d: 4n });
    const two = { ...r, selected: role('k', 'count', 2n) };
    assert.equal(formatPlain(measure('fraction', 'fraction', two).q), '1/2');
    assert.deepEqual(measure('fraction', 'fraction', two).form, { kind: 'fraction', n: 2n, d: 4n }, '2/4 stays 2/4 for display');
    const improper = { parts: role('p', 'count', 4n), selected: role('k', 'count', 5n), wholes: role('w', 'count', 2n) };
    assert.equal(formatPlain(measure('fraction', 'fraction', improper).q), '5/4');
    assert.equal(formatPlain(measure('fraction', 'complement', improper).q), '3/4');
  });
  it('draws the whole the view names', () => {
    assert.equal((drawn('fraction', 'rect', r) as { model: string }).model, 'area');
    assert.equal((drawn('fraction', 'circle', r) as { model: string }).model, 'circle');
    assert.equal((drawn('fraction', 'strip', r) as { model: string }).model, 'bar');
    assert.deepEqual(drawn('fraction', 'set', { ...r, parts: role('p', 'count', 6n, null, { icon: 'marble', one: 'marble', other: 'marbles' }), selected: role('k', 'count', 2n) }),
      { type: 'picture', groups: [{ icon: 'marble', count: 6, arrangement: 'row', shaded: 2 }], id: 'f', alt: 'drawing' });
    const line = drawn('fraction', 'line', { parts: role('p', 'count', 4n), selected: role('k', 'count', 3n), wholes: role('w', 'count', 2n) }) as Extract<DrawFigure, { type: 'number_line' }>;
    assert.deepEqual([line.min, line.max, line.step, line.labelEvery, line.marks], [0, 2, 0.25, 4, [{ value: 0.75 }]]);
    assert.equal((drawn('fraction', 'rect', { ...r, selected: null }) as { shaded: number }).shaded, 0, 'nothing shaded for the learner to shade');
    for (const view of ['rect', 'circle', 'strip'] as const) assert.equal(STRUCTURES.fraction.views[view].noun(r), view === 'rect' ? 'rectangle' : view);
  });
  it('uses the denominators of each grade and keeps selected within the parts drawn', () => {
    assert.deepEqual(STRUCTURES.fraction.invariants(r, 1), []);
    assert.ok(STRUCTURES.fraction.invariants({ ...r, parts: role('p', 'count', 3n) }, 1).length, 'no thirds in grade 1');
    assert.ok(STRUCTURES.fraction.invariants({ ...r, parts: role('p', 'count', 5n) }, 3).length, 'no fifths in grade 3');
    assert.ok(STRUCTURES.fraction.invariants({ ...r, selected: role('k', 'count', 5n) }, 3).length);
    assert.ok(STRUCTURES.fraction.invariants({ ...r, wholes: role('w', 'count', 2n) }, 2).length, 'one whole through grade 2');
    assert.equal(STRUCTURES.fraction.views.set.fits!({ ...r, wholes: role('w', 'count', 2n) }, 4).length, 1);
  });
  it('has tied regions: tapping one equal part can never be the unique answer (live 2)', () => {
    const regions = STRUCTURES.fraction.views.rect.regions!(r);
    assert.equal(regions.length, 4);
    assert.ok(regions.every(x => formatPlain(x.value.q) === '1/4'));
  });
});
