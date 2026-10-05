/** Gold specs for grades 3–5 (HAND-AUTHORED; see types.ts). */
import { noun, q } from './build';
import type { GoldSpec } from './types';

const fraction = (id: string, parts: string, selected: string | null, show: 'rect' | 'circle' | 'strip' | 'set' | 'line' | null, wholes: string | null = null) =>
  ({ id, kind: 'fraction' as const, roles: { parts, selected, wholes }, show });

export const g35Gold: GoldSpec[] = [
  {
    id: 'g3-equal-groups-orchard', note: 'live failure 1, expressed in v2: equal groups as a picture, total computed', fixes: 'live-1',
    activity: {
      aim: { skills: ['3.OA.A.1'], theme: 'orchard', why: 'Frontier skill; start with a countable picture.' },
      level: 3,
      model: {
        quantities: [q('g', 'count', '3', noun('basket', 'baskets')), q('n', 'count', '4', noun('apple', 'apples'))],
        structures: [{ id: 's', kind: 'equal_groups', roles: { groups: 'g', size: 'n' }, show: 'objects' }],
      },
      prompt: [{ text: 'Ana fills {{s.groups}} with {{s.size}} each.', type: 'text' }, { of: 's', type: 'view' }, { text: 'How many {{s.total.other}} are there in all?', type: 'text' }],
      response: { ask: 's.total', distractors: [{ expr: 'g+n', tag: 'added_instead' }], form: 'number' },
      support: { explanation: '{{s.groups.n}} groups of {{s.size.n}} make {{s.total}}.', hints: ['How many {{s.size.other}} are in each {{s.groups.one}}?'] },
    },
    expect: { key: '12', prompt: ['Ana fills 3 baskets with 4 apples each.', 'How many apples are there in all?'], alt: '3 baskets with 4 apples in each.' },
  },
  {
    id: 'g3-equal-groups-hops', note: 'measurement division on a number line: how many equal jumps (3.OA.A.2)',
    activity: {
      aim: { skills: ['3.OA.A.2'], theme: 'animals', why: 'Division as how many groups, on a number line.' },
      level: 4,
      model: {
        quantities: [q('g', 'count', '4', noun('hop', 'hops', null)), q('n', 'count', '3', noun('space', 'spaces', null))],
        structures: [{ id: 's', kind: 'equal_groups', roles: { groups: 'g', size: 'n' }, show: 'jumps' }],
      },
      prompt: [{ text: 'A frog hops {{s.size}} at a time and lands on {{s.total.n}}.', type: 'text' }, { of: 's', type: 'view' }, { text: 'How many {{s.groups.other}} does it make?', type: 'text' }],
      response: { ask: 's.groups', distractors: [{ expr: 's.total-n', tag: 'subtracted_instead' }], form: 'number' },
      support: { explanation: '{{s.total.n}} split into hops of {{s.size.n}} is {{s.groups}}.', hints: ['Count the jumps.'] },
    },
    expect: { key: '4', prompt: ['A frog hops 3 spaces at a time and lands on 12.', 'How many hops does it make?'], alt: 'A number line from 0 to 12 with jumps of 3: jump, jump, jump, jump.' },
  },
  {
    id: 'g3-equal-groups-share', note: 'partitive division told in words: the size is a derived quantity (3.OA.A.2)',
    activity: {
      aim: { skills: ['3.OA.A.2'], theme: 'school', why: 'Division as equal sharing.' },
      level: 3,
      model: {
        quantities: [q('g', 'count', '4', noun('friend', 'friends', 'baby')), q('t', 'count', '24', noun('sticker', 'stickers')), q('n', 'count', 't/g', noun('sticker', 'stickers'))],
        structures: [{ id: 's', kind: 'equal_groups', roles: { groups: 'g', size: 'n' }, show: null }],
      },
      prompt: [{ text: '{{t}} are shared equally among {{s.groups}}.', type: 'text' }, { text: 'How many {{s.size.other}} does each {{s.groups.one}} get?', type: 'text' }],
      response: { ask: 's.size', distractors: [{ expr: 't-g', tag: 'subtracted_instead' }, { expr: 't*g', tag: 'multiplied_instead' }], form: 'number' },
      support: { explanation: '{{t.n}} shared by {{s.groups.n}} is {{s.size.n}} each.', hints: ['Give one at a time to each friend.'] },
    },
    expect: { key: '6', prompt: ['24 stickers are shared equally among 4 friends.', 'How many stickers does each friend get?'] },
  },
  {
    id: 'g3-array-chairs', note: 'array of objects; the total of rows of chairs (3.OA.A.1)',
    activity: {
      aim: { skills: ['3.OA.A.1'], theme: 'music', why: 'Products as rows of equal size.' },
      level: 3,
      model: {
        quantities: [q('r', 'count', '3', noun('row', 'rows', null)), q('c', 'count', '6', noun('chair', 'chairs'))],
        structures: [{ id: 'a', kind: 'array', roles: { cols: 'c', rows: 'r' }, show: 'objects' }],
      },
      prompt: [{ text: 'The band sets out {{a.rows}} with {{a.cols}} in each row.', type: 'text' }, { of: 'a', type: 'view' }, { text: 'How many {{a.total.other}} are there?', type: 'text' }],
      response: { ask: 'a.total', distractors: [{ expr: 'r+c', tag: 'added_instead' }], form: 'number' },
      support: { explanation: '{{a.rows.n}} rows of {{a.cols.n}} make {{a.total}}.', hints: ['How many {{a.cols.other}} are in one row?'] },
    },
    expect: { key: '18', prompt: ['The band sets out 3 rows with 6 chairs in each row.', 'How many chairs are there?'], alt: '3 rows of 6 chairs.' },
  },
  {
    id: 'g3-rect-unit-squares', note: 'live failure 3, expressed in v2: area by counting unit squares (3.MD.C.6)', fixes: 'live-3',
    activity: {
      aim: { skills: ['3.MD.C.6'], theme: 'school', why: 'Area as the number of unit squares that cover a shape.' },
      level: 2,
      model: {
        quantities: [q('w', 'length', '5', null, 'unit'), q('h', 'length', '5', null, 'unit')],
        structures: [{ id: 'r', kind: 'rect_area', roles: { h: 'h', w: 'w' }, show: 'unit_squares' }],
      },
      prompt: [{ text: 'How many square units cover this {{r.view}}?', type: 'text' }, { of: 'r', type: 'view' }],
      response: { ask: 'r.area', distractors: [{ expr: 'r.perimeter', tag: 'perimeter_for_area' }], form: 'number' },
      support: { explanation: 'The {{r.view}} is covered by {{r.area}}.', hints: ['Count the squares in one row, then the rows.'] },
    },
    expect: { key: '25', prompt: ['How many square units cover this rectangle?'], alt: 'A rectangle on graph paper, filled with unit squares, 5 squares wide and 5 squares tall.' },
  },
  {
    id: 'g3-rect-labeled-area', note: 'area from labeled sides (3.MD.C.7b)',
    activity: {
      aim: { skills: ['3.MD.C.7'], theme: 'garden', why: 'Area of a rectangle by multiplying its sides.' },
      level: 4,
      model: {
        quantities: [q('w', 'length', '6', null, 'm'), q('h', 'length', '4', null, 'm')],
        structures: [{ id: 'r', kind: 'rect_area', roles: { h: 'h', w: 'w' }, show: 'labeled' }],
      },
      prompt: [{ text: 'A garden bed is a {{r.view}}.', type: 'text' }, { of: 'r', type: 'view' }, { text: 'What is its area?', type: 'text' }],
      response: { ask: 'r.area', distractors: [{ expr: 'r.perimeter', tag: 'perimeter_for_area' }, { expr: 'w+h', tag: 'added_two_sides' }], form: 'number' },
      support: { explanation: '{{r.w.n}} × {{r.h.n}} = {{r.area.n}}, so the area is {{r.area}}.', hints: ['Multiply the width by the height.'] },
    },
    expect: { key: '24', prompt: ['A garden bed is a rectangle.', 'What is its area?'], alt: 'A rectangle, labeled 6 meters wide and 4 meters tall.' },
  },
  {
    id: 'g3-rect-labeled-perimeter', note: 'perimeter from labeled sides (3.MD.D.8)',
    activity: {
      aim: { skills: ['3.MD.D.8'], theme: 'park', why: 'Perimeter as the distance around.' },
      level: 4,
      model: {
        quantities: [q('w', 'length', '8', null, 'cm'), q('h', 'length', '3', null, 'cm')],
        structures: [{ id: 'r', kind: 'rect_area', roles: { h: 'h', w: 'w' }, show: 'labeled' }],
      },
      prompt: [{ text: 'An ant walks all the way around this {{r.view}}.', type: 'text' }, { of: 'r', type: 'view' }, { text: 'How far does it walk?', type: 'text' }],
      response: { ask: 'r.perimeter', distractors: [{ expr: 'r.area', tag: 'area_for_perimeter' }, { expr: 'w+h', tag: 'added_two_sides' }], form: 'number' },
      support: { explanation: 'Add every side: {{r.perimeter}}.', hints: ['Go all the way around and add every side.'] },
    },
    expect: { key: '22', prompt: ['An ant walks all the way around this rectangle.', 'How far does it walk?'], alt: 'A rectangle, labeled 8 centimeters wide and 3 centimeters tall.' },
  },
  {
    id: 'g3-rect-missing-side', note: 'missing side from area: the side is a derived quantity shown as "?" (3.MD.C.7, 3.MD.D.8)',
    activity: {
      aim: { skills: ['3.MD.C.7'], theme: 'building', why: 'Relate area to multiplication and division.' },
      level: 5,
      model: {
        quantities: [q('a', 'area', '24', null, 'm'), q('w', 'length', '6', null, 'm'), q('h', 'length', 'a/w', null, 'm')],
        structures: [{ id: 'r', kind: 'rect_area', roles: { h: 'h', w: 'w' }, show: 'labeled' }],
      },
      prompt: [{ text: 'This {{r.view}} has an area of {{a}}.', type: 'text' }, { of: 'r', type: 'view' }, { text: 'How tall is it?', type: 'text' }],
      response: { ask: 'r.h', distractors: [{ expr: 'w', tag: 'used_one_side' }], form: 'number' },
      support: { explanation: '{{a.n}} ÷ {{r.w.n}} = {{r.h.n}}, so it is {{r.h}} tall.', hints: ['What times {{r.w}} makes {{a}}?'] },
    },
    expect: { key: '4', prompt: ['This rectangle has an area of 24 square meters.', 'How tall is it?'], alt: 'A rectangle, labeled 6 meters wide and a question mark for its height.' },
  },
  {
    id: 'g3-fraction-rect-shade', note: 'live failure 2, expressed in v2: shade a quarter of the rectangle the prose names', fixes: 'live-2',
    activity: {
      aim: { skills: ['3.NF.A.1'], theme: 'art', why: 'Unit fractions by partitioning.' },
      level: 2,
      model: {
        quantities: [q('p', 'count', '4'), q('u', 'fraction', '1/4')],
        structures: [fraction('f', 'p', null, 'rect')],
      },
      prompt: [{ text: 'Shade {{u}} of the {{f.view}}.', type: 'text' }, { of: 'f', type: 'view' }],
      response: { ask: 'u', form: 'shade', on: 'f' },
      support: { explanation: 'The {{f.view}} has {{f.parts.n}} equal parts; one of them is {{u}}.', hints: ['How many equal parts are there?'] },
    },
    expect: { key: '1/4', prompt: ['Shade $\\frac{1}{4}$ of the rectangle.'], alt: 'A rectangle cut into 4 equal parts; none are shaded.' },
  },
  {
    id: 'g3-fraction-circle-read', note: 'name the shaded fraction of a circle (3.NF.A.1)',
    activity: {
      aim: { skills: ['3.NF.A.1'], theme: 'bakery', why: 'Read a fraction from a model.' },
      level: 3,
      model: {
        quantities: [q('p', 'count', '8'), q('k', 'count', '3')],
        structures: [fraction('f', 'p', 'k', 'circle')],
      },
      prompt: [{ text: 'A pizza is cut into equal slices.', type: 'text' }, { of: 'f', type: 'view' }, { text: 'What fraction of the {{f.view}} is shaded?', type: 'text' }],
      response: { ask: 'f.fraction', distractors: [{ expr: 'f.complement', tag: 'counted_unshaded' }, { expr: 'k/(p-k)', tag: 'part_to_part' }], exactness: 'any', form: 'fraction' },
      support: { explanation: '{{f.selected.n}} of {{f.parts.n}} equal parts are shaded: {{f.fraction}}.', hints: ['Count all the equal parts first.'] },
    },
    expect: { key: '3/8', prompt: ['A pizza is cut into equal slices.', 'What fraction of the circle is shaded?'], alt: 'A circle cut into 8 equal parts; 3 parts are shaded.' },
  },
  {
    id: 'g3-fraction-strip-compare', note: 'compare two fractions with the same denominator on strips; choose among the candidates (3.NF.A.3d)',
    activity: {
      aim: { skills: ['3.NF.A.3'], theme: 'sport', why: 'Compare fractions by reasoning about their size.' },
      level: 4,
      model: {
        quantities: [q('p', 'count', '8'), q('a', 'count', '3'), q('pb', 'count', '8'), q('b', 'count', '5'), q('big', 'fraction', 'max(f.fraction, g.fraction)')],
        structures: [fraction('f', 'p', 'a', 'strip'), fraction('g', 'pb', 'b', 'strip')],
      },
      prompt: [{ text: 'Mia and Ben each run part of a track.', type: 'text' }, { of: 'f', type: 'view' }, { of: 'g', type: 'view' }, { text: 'Which fraction is greater?', type: 'text' }],
      response: { ask: 'big', candidates: ['f.fraction', 'g.fraction'], distractors: [{ expr: 'min(f.fraction, g.fraction)', tag: 'whole_number_bias' }], form: 'choose' },
      support: { explanation: 'Each {{f.view}} has {{f.parts.n}} equal parts, so {{g.fraction}} is more than {{f.fraction}}.', hints: ['The parts are the same size; count the shaded ones.'] },
    },
    expect: { key: '5/8', prompt: ['Mia and Ben each run part of a track.', 'Which fraction is greater?'], alt: 'A strip cut into 8 equal parts; 3 parts are shaded.' },
  },
  {
    id: 'g3-fraction-line-place', note: 'place a fraction on a number line (3.NF.A.2)',
    activity: {
      aim: { skills: ['3.NF.A.2'], theme: 'travel', why: 'Fractions as points on the number line.' },
      level: 3,
      model: {
        quantities: [q('p', 'count', '4'), q('u', 'fraction', '3/4')],
        structures: [fraction('f', 'p', null, 'line')],
      },
      prompt: [{ text: 'Put a point at {{u}} on the {{f.view}}.', type: 'text' }, { of: 'f', type: 'view' }],
      response: { ask: 'u', form: 'place', on: 'f' },
      support: { explanation: 'Each whole is cut into {{f.parts.n}} equal parts, each {{f.unit}}. Counting parts from the start of the line reaches {{u}}.', hints: ['Count the equal parts in one whole.'] },
    },
    expect: { key: '3/4', prompt: ['Put a point at $\\frac{3}{4}$ on the number line.'], alt: 'A number line from 0 to 1, each whole cut into 4 equal parts; no point is marked.' },
  },
  {
    id: 'g3-fraction-line-read', note: 'name the fraction a point marks on a number line (3.NF.A.2)',
    activity: {
      aim: { skills: ['3.NF.A.2'], theme: 'science', why: 'Read a point on the line as a fraction.' },
      level: 3,
      model: {
        quantities: [q('p', 'count', '3'), q('k', 'count', '2')],
        structures: [fraction('f', 'p', 'k', 'line')],
      },
      prompt: [{ of: 'f', type: 'view' }, { text: 'What fraction does the point show?', type: 'text' }],
      response: { ask: 'f.fraction', distractors: [{ expr: 'f.complement', tag: 'counted_unshaded' }], exactness: 'any', form: 'fraction' },
      support: { explanation: 'The point is {{f.selected.n}} parts of size {{f.unit}} from the start of the line: {{f.fraction}}.', hints: ['How many equal parts make one whole?'] },
    },
    expect: { key: '2/3', prompt: ['What fraction does the point show?'], alt: 'A number line from 0 to 1, each whole cut into 3 equal parts; a point is marked 2 parts after 0.' },
  },
  {
    id: 'g3-fraction-set-marbles', note: 'a fraction of a set (3.NF.A.1, set model)',
    activity: {
      aim: { skills: ['3.NF.A.1'], theme: 'toys', why: 'The whole can be a set of objects.' },
      level: 4,
      model: {
        quantities: [q('p', 'count', '6', noun('marble', 'marbles', 'circle')), q('k', 'count', '2')],
        structures: [fraction('f', 'p', 'k', 'set')],
      },
      prompt: [{ text: 'Some of the {{f.parts.other}} in the {{f.view}} are shaded.', type: 'text' }, { of: 'f', type: 'view' }, { text: 'What fraction of the {{f.parts.other}} are shaded?', type: 'text' }],
      response: { ask: 'f.fraction', distractors: [{ expr: 'f.complement', tag: 'counted_unshaded' }, { expr: 'k/(p-k)', tag: 'part_to_part' }], exactness: 'any', form: 'fraction' },
      support: { explanation: '{{f.selected.n}} of {{f.parts.n}} marbles: {{f.fraction}}.', hints: ['How many marbles are there in all?'] },
    },
    expect: { key: '1/3', prompt: ['Some of the marbles in the group are shaded.', 'What fraction of the marbles are shaded?'], alt: 'A group of 6 marbles; 2 are shaded.' },
  },
  {
    id: 'g3-fraction-tap-model', note: 'tap the model that shows a fraction: a tap among views, uniqueness computed (3.NF.A.1)',
    activity: {
      aim: { skills: ['3.NF.A.1'], theme: 'cooking', why: 'Match a fraction to its model.' },
      level: 3,
      model: {
        quantities: [q('p', 'count', '4'), q('a', 'count', '3'), q('pb', 'count', '4'), q('b', 'count', '1'), q('u', 'fraction', '3/4')],
        structures: [fraction('f', 'p', 'a', 'circle'), fraction('g', 'pb', 'b', 'circle')],
      },
      prompt: [{ text: 'Tap the {{f.view}} that shows {{u}}.', type: 'text' }, { of: 'f', type: 'view' }, { of: 'g', type: 'view' }],
      response: { ask: 'u', form: 'tap', on: null },
      support: { explanation: '{{u}} means {{f.selected.n}} of {{f.parts.n}} equal parts are shaded.', hints: ['Count the shaded parts in each.'] },
    },
    expect: { key: 'view:f', prompt: ['Tap the circle that shows $\\frac{3}{4}$.'], alt: 'A circle cut into 4 equal parts; 3 parts are shaded.' },
  },
  {
    id: 'g3-fraction-select-equivalent', note: 'select every fraction equal to a target; each shown in its own form (3.NF.A.3b)',
    activity: {
      aim: { skills: ['3.NF.A.3'], theme: 'cooking', why: 'Equivalent fractions name the same amount.' },
      level: 5,
      model: {
        quantities: [q('pa', 'count', '4'), q('ka', 'count', '2'), q('pb', 'count', '8'), q('kb', 'count', '3'), q('x', 'fraction', '4/8'), q('h', 'fraction', '1/2')],
        structures: [fraction('f', 'pa', 'ka', null), fraction('g', 'pb', 'kb', null)],
      },
      prompt: [{ text: 'Select every fraction equal to {{h}}.', type: 'text' }],
      response: { ask: 'h', candidates: ['f.fraction', 'g.fraction', 'x'], form: 'select' },
      support: { explanation: '{{f.fraction}} and {{x}} name the same amount as {{h}}; {{g.fraction}} does not.', hints: ['Which ones name the same amount as {{h}}?'] },
    },
    expect: { key: 'select:0,2', prompt: ['Select every fraction equal to $\\frac{1}{2}$.'] },
  },
];
