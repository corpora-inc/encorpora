/**
 * `fraction`: wholes cut into `parts` equal parts, of which `selected` are shaded (or marked). The
 * view names the whole: a rectangle, a circle, a strip, a set of objects, or a number line
 * (1.G.A.3, 2.G.A.3, 3.G.A.2, 3.NF.A.1–3, 4.NF.A–B, 5.NF.B). `selected` may be null for a view the
 * learner shades or marks. The prose names the whole through {{f.view}}, so it cannot say
 * "rectangle" over a circle (live failure 2), and a tap over equal parts is computed to be
 * ill-posed.
 */
import { multiply, rational } from '../../../learning/rational';
import type { Roles, StructureDef, ViewDef } from '../registry';
import { issue } from '../registry';
import { formatPlain, type Value } from '../quantity';
import { n, req, within } from './common';

type R = 'parts' | 'selected' | 'wholes';
type V = 'rect' | 'circle' | 'strip' | 'set' | 'line';
/** Denominators each grade works with (CCSS: halves and fourths in grade 1; thirds join in grade 2; 2, 3, 4, 6, 8 in grade 3). */
const DENOMINATORS: Record<number, readonly number[]> = {
  1: [2, 4], 2: [2, 3, 4], 3: [2, 3, 4, 6, 8], 4: [2, 3, 4, 5, 6, 8, 10, 12], 5: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12],
};
const wholesOf = (r: Roles<R>) => r.wholes ? n(r.wholes) : 1;
const fractionValue = (num: bigint, den: bigint): Value => ({ q: rational(num, den), power: 0, unit: null, form: { kind: 'fraction', n: num, d: den } });
const partsReveal = () => ({ parts: 'countable', selected: 'countable', wholes: 'countable', fraction: 'countable', complement: 'countable', unit: 'countable' } as const);
/** Every part of every whole is a region worth one unit fraction, so a tap among them is always tied. */
const partRegions = (r: Roles<R>) => {
  const p = n(r.parts), unit = fractionValue(1n, BigInt(p));
  return Array.from({ length: p * wholesOf(r) }, (_, i) => ({ id: `part${i + 1}`, value: unit, label: `Part ${i + 1}` }));
};
/** The tick or part a target fraction lands on: target × parts must be a whole number within the drawing. */
function landing(r: Roles<R>, target: Value, verb: string, lo: number): { total: number; at: number } | ReturnType<typeof issue> {
  if (r.selected) return issue(verb === 'shade' ? 'shade_preshaded' : 'place_premarked', `To ${verb} ${formatPlain(target.q)}, the view must start empty: set selected to null.`);
  const p = n(r.parts), total = p * wholesOf(r);
  const at = multiply(target.q, rational(BigInt(p)));
  if (at.d !== 1n || Number(at.n) < lo || Number(at.n) > total) return issue(verb === 'shade' ? 'shade_unreachable' : 'place_unreachable', `${formatPlain(target.q)} does not land on ${verb === 'shade' ? 'a whole number of the parts' : 'a tick'} of a view with ${p} parts per whole and ${wholesOf(r)} whole(s).`);
  return { total, at: Number(at.n) };
}
function areaView(model: 'area' | 'circle' | 'bar', noun: string, grades: readonly [number, number], draws: string): ViewDef<R> {
  return {
    grades, accepts: ['shade', 'tap'], draws, noun: () => noun,
    reveals: partsReveal, regions: partRegions,
    shade(r, target) { const l = landing(r, target, 'shade', 1); return 'code' in l ? l : { parts: l.total, target: l.at }; },
    lower: r => ({ type: 'fraction_model', model, parts: n(r.parts), shaded: n(r.selected), ...(wholesOf(r) > 1 ? { wholes: wholesOf(r) } : {}) }),
  };
}

export const fraction: StructureDef<'fraction', R, V> = {
  kind: 'fraction',
  grades: [1, 5],
  roles: { parts: { kinds: ['count'] }, selected: { kinds: ['count'], nullable: true }, wholes: { kinds: ['count'], nullable: true } },
  measures: {
    fraction: {
      kind: 'fraction', inputs: ['parts', 'selected'], means: 'selected / parts',
      value: r => fractionValue(req(r, 'selected').value.q.n, req(r, 'parts').value.q.n), noun: () => null,
    },
    complement: {
      kind: 'fraction', inputs: ['parts', 'selected'], means: 'the unselected parts / parts',
      value: r => { const p = req(r, 'parts').value.q.n; return fractionValue(p * BigInt(wholesOf(r)) - req(r, 'selected').value.q.n, p); }, noun: () => null,
    },
    unit: { kind: 'fraction', inputs: ['parts'], means: '1 / parts', value: r => fractionValue(1n, req(r, 'parts').value.q.n), noun: () => null },
  },
  primary: 'fraction',
  invariants(r, grade) {
    const out = [];
    const p = r.parts ? n(r.parts) : null;
    const dens = DENOMINATORS[grade] ?? DENOMINATORS[5]!;
    if (p !== null && !dens.includes(p)) out.push(issue('magnitude', `parts must be one of ${dens.join(', ')} in grade ${grade}.`));
    out.push(...within(r.wholes, 'wholes', 1, grade <= 2 ? 1 : 4, `in grade ${grade}`));
    if (p !== null && r.selected && n(r.selected) > p * wholesOf(r)) out.push(issue('magnitude', `selected (${n(r.selected)}) is more than the ${p * wholesOf(r)} parts drawn.`));
    return out;
  },
  views: {
    rect: areaView('area', 'rectangle', [1, 5], 'a rectangle cut into equal parts, the selected ones shaded'),
    circle: areaView('circle', 'circle', [1, 5], 'a circle cut into equal parts, the selected ones shaded'),
    strip: areaView('bar', 'strip', [2, 5], 'a strip cut into equal parts, the selected ones shaded'),
    set: {
      grades: [3, 5], accepts: ['tap'], draws: 'a set of the objects, the selected ones highlighted (parts = how many objects)',
      noun: () => 'group',
      reveals: partsReveal, regions: partRegions,
      fits: r => wholesOf(r) > 1 ? [issue('view_fit', 'A set is one whole; set wholes to null.')] : [],
      lower(r) {
        const noun = req(r, 'parts').decl.noun;
        return {
          type: 'picture',
          groups: [{ icon: noun?.icon ?? noun?.one.toLowerCase().replace(/[^a-z]+/g, '_') ?? 'counter', count: n(r.parts), arrangement: n(r.parts) > 6 ? 'grid' : 'row', ...(r.selected ? { shaded: n(r.selected) } : {}) }],
        };
      },
    },
    line: {
      grades: [3, 5], accepts: ['place'], draws: 'a number line from 0 to wholes with a tick at every part, whole numbers labeled; a point at selected/parts when selected is set',
      noun: () => 'number line',
      reveals: () => ({ parts: 'countable', selected: 'countable', wholes: 'shown', fraction: 'countable', complement: 'countable', unit: 'countable' }),
      place(r, target) { const l = landing(r, target, 'place', 0); return 'code' in l ? l : { ticks: l.total, target: l.at }; },
      lower(r) {
        const p = n(r.parts), w = wholesOf(r);
        return { type: 'number_line', min: 0, max: w, step: 1 / p, labelEvery: p, ...(r.selected ? { marks: [{ value: n(r.selected) / p }] } : {}) };
      },
    },
  },
  use: 'fractions as equal parts of a whole, of a set, or as points on a number line; shade or place a given fraction',
};
