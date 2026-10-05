/**
 * `rect_area`: one rectangle `w` wide and `h` tall, in one length unit. Area by tiling and by
 * multiplying, and perimeter (2.G.A.2, 3.MD.C.5–7, 3.MD.D.8, 4.MD.A.3, 5.NF.B.4b, 6.G.A.1). There is no
 * chart view, so area can never be bent into a pie (live failure 3), and no view hides both sides
 * while the area is asked (live failure 4).
 */
import { add, multiply, rational } from '../../../learning/rational';
import type { StructureDef } from '../registry';
import { issue } from '../registry';
import { exactDecimal, formatPlain, isInteger, toNumber, unitName, unitSymbol, type Value } from '../quantity';
import { req } from './common';

type R = 'h' | 'w';
const MAX_UNIT_SQUARES = 12;
/** A side as plain text for a dimension label: a written fraction keeps its terms, a decimal prints as one. */
function plainNumber(v: Value): string {
  if (v.form?.kind === 'fraction') return `${v.form.n}/${v.form.d}`;
  const d = exactDecimal(v.q, v.form?.kind === 'decimal' ? v.form.places : 0);
  return d ? `${d.negative ? '-' : ''}${d.int}${d.frac ? `.${d.frac}` : ''}` : formatPlain(v.q);
}
const sideText = (v: Value) => `${plainNumber(v)} ${unitSymbol(v.unit!, 1)}`;

export const rectArea: StructureDef<'rect_area', R, 'unit_squares' | 'labeled'> = {
  kind: 'rect_area',
  grades: [2, 7],
  roles: { h: { kinds: ['length'] }, w: { kinds: ['length'] } },
  measures: {
    area: {
      kind: 'area', inputs: ['h', 'w'], means: 'w × h, in square units',
      value: r => { const w = req(r, 'w').value, h = req(r, 'h').value; return { q: multiply(w.q, h.q), power: 2, unit: w.unit }; },
      noun: () => null,
    },
    perimeter: {
      kind: 'length', inputs: ['h', 'w'], means: '2 × (w + h)',
      value: r => { const w = req(r, 'w').value, h = req(r, 'h').value; return { q: multiply(rational(2n), add(w.q, h.q)), power: 1, unit: w.unit }; },
      noun: () => null,
    },
  },
  primary: 'area',
  invariants(r, grade) {
    const out = [];
    const w = r.w?.value, h = r.h?.value;
    if (!w || !h) return [];
    if (w.unit !== h.unit) out.push(issue('unit_mismatch', `w is in ${w.unit} but h is in ${h.unit}; a rectangle's sides share one unit.`));
    for (const [name, v] of [['w', w], ['h', h]] as const) {
      if (v.q.n <= 0n) out.push(issue('magnitude', `${name} must be greater than 0.`));
      if (grade <= 4 && !isInteger(v.q)) out.push(issue('magnitude', `${name} must be a whole number in grade ${grade}.`));
      if (v.q.d > 12n) out.push(issue('magnitude', `${name} has a denominator above 12.`));
      const max = grade <= 2 ? 6 : grade === 3 ? 12 : 1000;
      if (toNumber(v.q) > max) out.push(issue('magnitude', `${name} must be at most ${max} in grade ${grade}.`));
    }
    if (grade === 3 && toNumber(w.q) * toNumber(h.q) > 100) out.push(issue('magnitude', 'In grade 3 the area stays within 100.'));
    return out;
  },
  views: {
    unit_squares: {
      grades: [2, 5], accepts: [], draws: 'graph paper with the rectangle tiled in unit squares (sides, area and perimeter countable)',
      noun: () => 'rectangle',
      reveals: () => ({ w: 'countable', h: 'countable', area: 'countable', perimeter: 'countable' }),
      fits(r) {
        const w = r.w?.value, h = r.h?.value;
        if (!w || !h) return [];
        return [w, h].some(v => !isInteger(v.q) || toNumber(v.q) > MAX_UNIT_SQUARES)
          ? [issue('view_fit', `unit_squares needs whole sides of at most ${MAX_UNIT_SQUARES}; use labeled.`)] : [];
      },
      lower(r) {
        const w = toNumber(req(r, 'w').value.q), h = toNumber(req(r, 'h').value.q), unit = req(r, 'w').value.unit!;
        return {
          type: 'geometry', width: w + 2, height: h + 2, grid: { unit: 1 },
          shapes: [{ kind: 'polygon', points: [{ x: 1, y: 1 }, { x: 1 + w, y: 1 }, { x: 1 + w, y: 1 + h }, { x: 1, y: 1 + h }], color: 'teal', unitSquares: true }],
          caption: `Each small square is 1 ${unitName(unit, 2, 'one')}.`,
        };
      },
    },
    labeled: {
      grades: [3, 7], accepts: [], draws: 'the rectangle with each side labeled; an asked side shows "?" (area and perimeter must be computed)',
      noun: () => 'rectangle',
      reveals: (_r, asked) => ({ w: asked.has('w') ? 'hidden' : 'shown', h: asked.has('h') ? 'hidden' : 'shown', area: 'hidden', perimeter: 'hidden' }),
      lower(r, { asked }) {
        const w = req(r, 'w').value, h = req(r, 'h').value;
        // Drawn to scale when the sides are within 1:4; otherwise squeezed and marked not to scale.
        const ratio = toNumber(w.q) / toNumber(h.q), clamped = Math.min(4, Math.max(1 / 4, ratio));
        const W = clamped >= 1 ? 10 : 10 * clamped, H = clamped >= 1 ? 10 / clamped : 10;
        return {
          type: 'geometry', width: W, height: H, ...(clamped !== ratio ? { notToScale: true } : {}),
          shapes: [
            { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }], color: 'teal' },
            { kind: 'dimension', from: { x: 0, y: 0 }, to: { x: W, y: 0 }, label: asked.has('w') ? '?' : sideText(w) },
            { kind: 'dimension', from: { x: 0, y: 0 }, to: { x: 0, y: H }, label: asked.has('h') ? '?' : sideText(h) },
          ],
        };
      },
    },
  },
  use: 'area (tiling or w × h) and perimeter of one rectangle; a missing side is a derived quantity (h = a/w)',
};
