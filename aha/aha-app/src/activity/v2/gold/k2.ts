/** Gold specs for grades K–2 (HAND-AUTHORED; see types.ts). Fractions are named in words, as CCSS grades 1–2 do. */
import { noun, q } from './build';
import type { GoldSpec } from './types';

export const k2Gold: GoldSpec[] = [
  {
    id: 'g2-array-objects-garden', note: 'array of objects; total by counting or repeated addition (2.OA.C.4)',
    activity: {
      aim: { skills: ['2.OA.C.4'], theme: 'garden', why: 'Equal rows as repeated addition, with a countable picture.' },
      level: 3,
      model: {
        quantities: [q('r', 'count', '3', noun('row', 'rows', null)), q('c', 'count', '4', noun('flower', 'flowers'))],
        structures: [{ id: 'a', kind: 'array', roles: { cols: 'c', rows: 'r' }, show: 'objects' }],
      },
      prompt: [{ text: 'Maya plants {{a.rows}} of flowers, with {{a.cols}} in each row.', type: 'text' }, { of: 'a', type: 'view' }, { text: 'How many {{a.total.other}} did she plant?', type: 'text' }],
      response: { ask: 'a.total', distractors: [{ expr: 'r+c', tag: 'added_instead' }, { expr: 'c', tag: 'counted_one_group' }], form: 'number' },
      support: { explanation: '{{a.rows.n}} rows of {{a.cols.n}} make {{a.total}}.', hints: ['Count the {{a.cols.other}} in one row, then add a row at a time.'] },
    },
    expect: { key: '12', prompt: ['Maya plants 3 rows of flowers, with 4 flowers in each row.', 'How many flowers did she plant?'], alt: '3 rows of 4 flowers.' },
  },
  {
    id: 'g2-array-dots-choose', note: 'array of dots; choose the total (2.OA.C.4)',
    activity: {
      aim: { skills: ['2.OA.C.4'], theme: 'games', why: 'Arrays up to 5 by 5; a choice keeps it quick.' },
      level: 2,
      model: {
        quantities: [q('r', 'count', '4', noun('row', 'rows', null)), q('c', 'count', '5', noun('dot', 'dots', null))],
        structures: [{ id: 'a', kind: 'array', roles: { cols: 'c', rows: 'r' }, show: 'dots' }],
      },
      prompt: [{ text: 'Look at the {{a.view}}.', type: 'text' }, { of: 'a', type: 'view' }, { text: 'How many {{a.total.other}} are there?', type: 'text' }],
      response: { ask: 'a.total', candidates: null, distractors: [{ expr: 'r+c', tag: 'added_instead' }, { expr: 'c', tag: 'counted_one_group' }], form: 'choose' },
      support: { explanation: '{{a.rows.n}} rows of {{a.cols.n}} make {{a.total}}.', hints: ['How many {{a.cols.other}} are in each row?'] },
    },
    expect: { key: '20', prompt: ['Look at the array.', 'How many dots are there?'], alt: '4 rows of 5 dots.' },
  },
  {
    id: 'g2-equal-groups-bags', note: 'equal groups; choose the total (2.OA.C.4, grade-2 sizes)',
    activity: {
      aim: { skills: ['2.OA.C.4'], theme: 'market', why: 'Equal groups as a bridge to multiplication.' },
      level: 2,
      model: {
        quantities: [q('g', 'count', '4', noun('bag', 'bags', 'backpack')), q('n', 'count', '2', noun('orange', 'oranges'))],
        structures: [{ id: 's', kind: 'equal_groups', roles: { groups: 'g', size: 'n' }, show: 'objects' }],
      },
      prompt: [{ text: 'Leo packs {{s.groups}} with {{s.size}} in each.', type: 'text' }, { of: 's', type: 'view' }, { text: 'How many {{s.total.other}} is that?', type: 'text' }],
      response: { ask: 's.total', candidates: null, distractors: [{ expr: 'g+n', tag: 'added_instead' }, { expr: 'g', tag: 'counted_groups_only' }], form: 'choose' },
      support: { explanation: '{{s.groups.n}} groups of {{s.size.n}} make {{s.total}}.', hints: ['Count the {{s.size.other}} in each {{s.groups.one}}.'] },
    },
    expect: { key: '8', prompt: ['Leo packs 4 bags with 2 oranges in each.', 'How many oranges is that?'], alt: '4 bags with 2 oranges in each.' },
  },
  {
    id: 'g2-rect-unit-squares-tiles', note: 'tiled rectangle; count the squares (2.G.A.2)',
    activity: {
      aim: { skills: ['2.G.A.2'], theme: 'building', why: 'Rows and columns of same-size squares.' },
      level: 2,
      model: {
        quantities: [q('w', 'length', '4', null, 'unit'), q('h', 'length', '3', null, 'unit')],
        structures: [{ id: 'r', kind: 'rect_area', roles: { h: 'h', w: 'w' }, show: 'unit_squares' }],
      },
      prompt: [{ text: 'Tiles cover this {{r.view}}.', type: 'text' }, { of: 'r', type: 'view' }, { text: 'How many square tiles are there?', type: 'text' }],
      response: { ask: 'r.area', candidates: null, distractors: [{ expr: 'r.perimeter', tag: 'perimeter_for_area' }, { expr: 'w+h', tag: 'added_two_sides' }], form: 'choose' },
      support: { explanation: '{{r.h.n}} rows of {{r.w.n}} squares make {{r.area.n}} squares.', hints: ['Count the squares in one row.'] },
    },
    expect: { key: '12', prompt: ['Tiles cover this rectangle.', 'How many square tiles are there?'], alt: 'A rectangle on graph paper, filled with unit squares, 4 squares wide and 3 squares tall.' },
  },
  {
    id: 'g1-fraction-rect-shade-half', note: 'shade one half (1.G.A.3); the fraction is named in words',
    activity: {
      aim: { skills: ['1.G.A.3'], theme: 'art', why: 'Halves as two equal shares.' },
      level: 2,
      model: {
        quantities: [q('p', 'count', '2'), q('u', 'fraction', '1/2')],
        structures: [{ id: 'f', kind: 'fraction', roles: { parts: 'p', selected: null, wholes: null }, show: 'rect' }],
      },
      prompt: [{ text: 'Shade {{u.word}} of the {{f.view}}.', type: 'text' }, { of: 'f', type: 'view' }],
      response: { ask: 'u', form: 'shade', on: 'f' },
      support: { explanation: 'The {{f.view}} has {{f.parts.n}} equal parts. One part is {{u.word}}.', hints: ['How many equal parts are there?'] },
    },
    expect: { key: '1/2', prompt: ['Shade one half of the rectangle.'], alt: 'A rectangle cut into 2 equal parts; none are shaded.' },
  },
  {
    id: 'g2-fraction-circle-thirds', note: 'name the shaded share of a circle in words (2.G.A.3)',
    activity: {
      aim: { skills: ['2.G.A.3'], theme: 'bakery', why: 'Thirds join halves and fourths in grade 2.' },
      level: 3,
      model: {
        quantities: [q('p', 'count', '3'), q('k', 'count', '1')],
        structures: [{ id: 'f', kind: 'fraction', roles: { parts: 'p', selected: 'k', wholes: null }, show: 'circle' }],
      },
      prompt: [{ text: 'A cake is cut into equal parts.', type: 'text' }, { of: 'f', type: 'view' }, { text: 'What part of the {{f.view}} is shaded?', type: 'text' }],
      response: { ask: 'f.fraction', candidates: null, distractors: [{ expr: 'f.complement', tag: 'counted_unshaded' }], form: 'choose' },
      support: { explanation: '{{f.selected.n}} of {{f.parts.n}} equal parts is {{f.fraction.word}}.', hints: ['Count all the equal parts.'] },
    },
    expect: { key: '1/3', prompt: ['A cake is cut into equal parts.', 'What part of the circle is shaded?'], alt: 'A circle cut into 3 equal parts; 1 part is shaded.' },
  },
];
