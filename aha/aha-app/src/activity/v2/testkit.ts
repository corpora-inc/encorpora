/**
 * TEST-ONLY builders for v2 activities: valid baselines per intent that tests mutate one field at a
 * time. Hand-authored, never shipped as AI output. (The curated gold set lives in gold/.)
 */
import type { Band } from './registry';
import type { WireActivity } from './wire';
import { validateActivity, type Validation } from './validate';

export const OFFERED = new Set([
  '2.OA.C.4', '2.G.A.2', '2.G.A.3', '1.G.A.3', '3.OA.A.1', '3.OA.A.2', '3.OA.A.3', '3.OA.A.4', '3.MD.C.5', '3.MD.C.6', '3.MD.C.7',
  '3.MD.D.8', '3.NF.A.1', '3.NF.A.2', '3.NF.A.3', '3.G.A.2', '4.MD.A.3', '4.NF.A.1', '4.NF.B.4', '5.NF.B.4', '6.G.A.1',
]);
export const check = (a: unknown, band: Band = 'g35'): Validation => validateActivity(a, { band, skillIds: OFFERED });
export const codesOf = (v: Validation) => v.ok ? [] : v.problems.map(p => p.code);
export const clone = <T>(v: T): T => structuredClone(v);

/** Live 1, expressed in v2 (README §13). */
export const equalGroupsActivity = (): WireActivity => ({
  aim: { skills: ['3.OA.A.1'], theme: 'orchard', why: 'Frontier skill; start with a countable picture.' },
  level: 3,
  model: {
    quantities: [
      { id: 'g', kind: 'count', noun: { icon: 'basket', one: 'basket', other: 'baskets' }, unit: null, value: '3' },
      { id: 'n', kind: 'count', noun: { icon: 'apple', one: 'apple', other: 'apples' }, unit: null, value: '4' },
    ],
    structures: [{ id: 's', kind: 'equal_groups', roles: { groups: 'g', size: 'n' }, show: 'objects' }],
  },
  prompt: [
    { text: 'Ana fills {{s.groups}} with {{s.size}} each.', type: 'text' }, { of: 's', type: 'view' },
    { text: 'How many {{s.total.other}} are there in all?', type: 'text' },
  ],
  response: { ask: 's.total', distractors: [{ expr: 'g+n', tag: 'added_instead' }], form: 'number' },
  support: { explanation: '{{s.groups.n}} groups of {{s.size.n}} make {{s.total}}.', hints: ['How many {{s.size.other}} are in each {{s.groups.one}}?'] },
});

/** Live 3, expressed in v2. */
export const areaActivity = (): WireActivity => ({
  aim: { skills: ['3.MD.C.6'], theme: 'school', why: 'Count unit squares to find area.' },
  level: 2,
  model: {
    quantities: [
      { id: 'w', kind: 'length', noun: null, unit: 'unit', value: '5' },
      { id: 'h', kind: 'length', noun: null, unit: 'unit', value: '4' },
    ],
    structures: [{ id: 'r', kind: 'rect_area', roles: { h: 'h', w: 'w' }, show: 'unit_squares' }],
  },
  prompt: [{ text: 'How many square units cover this {{r.view}}?', type: 'text' }, { of: 'r', type: 'view' }],
  response: { ask: 'r.area', distractors: [{ expr: '2*(w+h)', tag: 'perimeter_for_area' }], form: 'number' },
  support: { explanation: 'The {{r.view}} is covered by {{r.area}}.', hints: ['Count the squares in one row.'] },
});

/** Live 2, expressed in v2: shade a quarter. */
export const shadeActivity = (): WireActivity => ({
  aim: { skills: ['3.NF.A.1'], theme: 'art', why: 'Unit fractions by partitioning.' },
  level: 2,
  model: {
    quantities: [
      { id: 'p', kind: 'count', noun: null, unit: null, value: '4' },
      { id: 'u', kind: 'fraction', noun: null, unit: null, value: '1/4' },
    ],
    structures: [{ id: 'f', kind: 'fraction', roles: { parts: 'p', selected: null, wholes: null }, show: 'rect' }],
  },
  prompt: [{ text: 'Shade {{u}} of the {{f.view}}.', type: 'text' }, { of: 'f', type: 'view' }],
  response: { ask: 'u', form: 'shade', on: 'f' },
  support: { explanation: 'The {{f.view}} has {{f.parts.n}} equal parts; one of them is {{u}}.', hints: ['How many equal parts are there?'] },
});

/** What fraction is shaded (answer form over a fraction view). */
export const shadedFractionActivity = (): WireActivity => ({
  aim: { skills: ['3.NF.A.1'], theme: 'bakery', why: 'Read a fraction from a model.' },
  level: 3,
  model: {
    quantities: [
      { id: 'p', kind: 'count', noun: null, unit: null, value: '8' },
      { id: 'k', kind: 'count', noun: null, unit: null, value: '3' },
    ],
    structures: [{ id: 'f', kind: 'fraction', roles: { parts: 'p', selected: 'k', wholes: null }, show: 'circle' }],
  },
  prompt: [{ of: 'f', type: 'view' }, { text: 'What fraction of the {{f.view}} is shaded?', type: 'text' }],
  response: { ask: 'f.fraction', distractors: [{ expr: 'f.complement', tag: 'counted_unshaded' }, { expr: 'k/(p-k)', tag: 'part_to_part' }], exactness: 'any', form: 'fraction' },
  support: { explanation: '{{f.selected.n}} of {{f.parts.n}} equal parts are shaded: {{f.fraction}}.', hints: ['Count all the equal parts first.'] },
});
