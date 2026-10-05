/** More gold specs for grades K–2 (HAND-AUTHORED; see types.ts). */
import { noun, q } from './build';
import type { GoldSpec } from './types';

export const k2MoreGold: GoldSpec[] = [
  {
    id: 'g2-equal-groups-skip', note: 'skip-count jumps on a number line; how many jumps (2.NBT.A.2, 2.OA.C.4)',
    activity: {
      aim: { skills: ['2.OA.C.4'], theme: 'animals', why: 'Repeated addition as equal jumps.' },
      level: 3,
      model: {
        quantities: [q('g', 'count', '4', noun('jump', 'jumps', null)), q('n', 'count', '5', noun('step', 'steps', null))],
        structures: [{ id: 's', kind: 'equal_groups', roles: { groups: 'g', size: 'n' }, show: 'jumps' }],
      },
      prompt: [{ text: 'A rabbit jumps {{s.size}} at a time and lands on {{s.total.n}}.', type: 'text' }, { of: 's', type: 'view' }, { text: 'How many {{s.groups.other}} did it make?', type: 'text' }],
      response: { ask: 's.groups', distractors: [{ expr: 'n', tag: 'counted_one_group' }], form: 'number' },
      support: { explanation: '{{s.groups.n}} jumps of {{s.size.n}} reach {{s.total.n}}.', hints: ['Count the jumps from the start.'] },
    },
    expect: { key: '4', prompt: ['A rabbit jumps 5 steps at a time and lands on 20.', 'How many jumps did it make?'], alt: 'A number line from 0 to 20 with jumps of 5: jump, jump, jump, jump.' },
  },
  {
    id: 'g2-array-rows', note: 'count the rows of an array: a role the picture makes countable (2.OA.C.4)',
    activity: {
      aim: { skills: ['2.OA.C.4'], theme: 'farm', why: 'Read the structure of an array.' },
      level: 1,
      model: {
        quantities: [q('r', 'count', '4', noun('row', 'rows', null)), q('c', 'count', '3', noun('egg', 'eggs'))],
        structures: [{ id: 'a', kind: 'array', roles: { cols: 'c', rows: 'r' }, show: 'objects' }],
      },
      prompt: [{ text: 'Eggs sit in rows of {{a.cols.n}}.', type: 'text' }, { of: 'a', type: 'view' }, { text: 'How many {{a.rows.other}} are there?', type: 'text' }],
      response: { ask: 'a.rows', distractors: [{ expr: 'c', tag: 'counted_one_group' }], form: 'number' },
      support: { explanation: 'There are {{a.rows}} of {{a.cols.n}}.', hints: ['Count down the side.'] },
    },
    expect: { key: '4', prompt: ['Eggs sit in rows of 3.', 'How many rows are there?'], alt: 'Rows of 3 eggs: row, row, row, row.' },
  },
  {
    id: 'g2-rect-unit-squares-count', note: 'count the squares that tile a rectangle (2.G.A.2)',
    activity: {
      aim: { skills: ['2.G.A.2'], theme: 'art', why: 'Same-size squares in rows and columns.' },
      level: 2,
      model: {
        quantities: [q('w', 'length', '5', null, 'unit'), q('h', 'length', '2', null, 'unit')],
        structures: [{ id: 'r', kind: 'rect_area', roles: { h: 'h', w: 'w' }, show: 'unit_squares' }],
      },
      prompt: [{ text: 'Sam covers a card with paper squares.', type: 'text' }, { of: 'r', type: 'view' }, { text: 'How many squares did Sam use?', type: 'text' }],
      response: { ask: 'r.area', distractors: [{ expr: 'w+h', tag: 'added_two_sides' }], form: 'number' },
      support: { explanation: '{{r.h.n}} rows of {{r.w.n}} squares make {{r.area.n}} squares.', hints: ['Count one row, then count the rows.'] },
    },
    expect: { key: '10', prompt: ['Sam covers a card with paper squares.', 'How many squares did Sam use?'], alt: 'A rectangle on graph paper, filled with unit squares, 5 squares wide and 2 squares tall.' },
  },
  {
    id: 'g1-fraction-circle-shade-fourth', note: 'shade one fourth of a circle; words, not notation (1.G.A.3)',
    activity: {
      aim: { skills: ['1.G.A.3'], theme: 'party', why: 'Fourths as four equal shares.' },
      level: 3,
      model: {
        quantities: [q('p', 'count', '4'), q('u', 'fraction', '1/4')],
        structures: [{ id: 'f', kind: 'fraction', roles: { parts: 'p', selected: null, wholes: null }, show: 'circle' }],
      },
      prompt: [{ text: 'Color {{u.word}} of the {{f.view}}.', type: 'text' }, { of: 'f', type: 'view' }],
      response: { ask: 'u', form: 'shade', on: 'f' },
      support: { explanation: 'The {{f.view}} has {{f.parts.n}} equal parts. One part is {{u.word}}.', hints: ['Pick one equal part.'] },
    },
    expect: { key: '1/4', prompt: ['Color one fourth of the circle.'], alt: 'A circle cut into 4 equal parts; none are shaded.' },
  },
  {
    id: 'g2-fraction-strip-thirds', note: 'name the shaded share of a strip in words (2.G.A.3)',
    activity: {
      aim: { skills: ['2.G.A.3'], theme: 'cooking', why: 'Equal shares of a strip.' },
      level: 3,
      model: {
        quantities: [q('p', 'count', '3'), q('k', 'count', '2')],
        structures: [{ id: 'f', kind: 'fraction', roles: { parts: 'p', selected: 'k', wholes: null }, show: 'strip' }],
      },
      prompt: [{ text: 'Kim eats part of a fruit bar.', type: 'text' }, { of: 'f', type: 'view' }, { text: 'What part of the {{f.view}} is shaded?', type: 'text' }],
      response: { ask: 'f.fraction', candidates: null, distractors: [{ expr: 'f.complement', tag: 'counted_unshaded' }, { expr: 'f.unit', tag: 'denominator_as_count' }], form: 'choose' },
      support: { explanation: '{{f.selected.n}} of {{f.parts.n}} equal parts is {{f.fraction.word}}.', hints: ['How many equal parts in all?'] },
    },
    expect: { key: '2/3', prompt: ['Kim eats part of a fruit bar.', 'What part of the strip is shaded?'], alt: 'A strip cut into 3 equal parts; 2 parts are shaded.' },
  },
];
