/** More gold specs for grades 3–5 and 6 (HAND-AUTHORED; see types.ts). */
import { noun, q } from './build';
import type { GoldSpec } from './types';

const fraction = (id: string, parts: string, selected: string | null, show: 'rect' | 'circle' | 'strip' | 'set' | 'line' | null, wholes: string | null = null) =>
  ({ id, kind: 'fraction' as const, roles: { parts, selected, wholes }, show });

export const g35MoreGold: GoldSpec[] = [
  {
    id: 'g3-rect-labeled-area-live4', note: 'live failure 4, expressed in v2: the area ask needs both sides, and the labeled view shows them', fixes: 'live-4',
    activity: {
      aim: { skills: ['3.MD.C.7'], theme: 'school', why: 'Area from side lengths, with the sides shown.' },
      level: 4,
      model: {
        quantities: [q('w', 'length', '4', null, 'unit'), q('h', 'length', '5', null, 'unit')],
        structures: [{ id: 'r', kind: 'rect_area', roles: { h: 'h', w: 'w' }, show: 'labeled' }],
      },
      prompt: [{ text: 'What is the area of the {{r.view}} in square units?', type: 'text' }, { of: 'r', type: 'view' }],
      response: { ask: 'r.area', distractors: [{ expr: 'w+h', tag: 'added_two_sides' }, { expr: 'r.perimeter', tag: 'perimeter_for_area' }], form: 'number' },
      support: { explanation: '{{r.w.n}} × {{r.h.n}} = {{r.area}}.', hints: ['Multiply the width by the height.'] },
    },
    expect: { key: '20', prompt: ['What is the area of the rectangle in square units?'], alt: 'A rectangle, labeled 4 units wide and 5 units tall.' },
  },
  {
    id: 'g3-equal-groups-choose', note: 'equal groups; choose the total among rule-made distractors (3.OA.A.1)',
    activity: {
      aim: { skills: ['3.OA.A.1'], theme: 'ocean', why: 'Products as equal groups; diagnose adding instead.' },
      level: 3,
      model: {
        quantities: [q('g', 'count', '5', noun('boat', 'boats')), q('n', 'count', '3', noun('fish', 'fish'))],
        structures: [{ id: 's', kind: 'equal_groups', roles: { groups: 'g', size: 'n' }, show: 'objects' }],
      },
      prompt: [{ text: '{{s.groups}} each catch {{s.size}}.', type: 'text' }, { of: 's', type: 'view' }, { text: 'How many {{s.total.other}} do they catch in all?', type: 'text' }],
      response: { ask: 's.total', candidates: null, distractors: [{ expr: 'g+n', tag: 'added_instead' }, { expr: 'n', tag: 'counted_one_group' }], form: 'choose' },
      support: { explanation: '{{s.groups.n}} groups of {{s.size.n}} make {{s.total}}.', hints: ['How many {{s.size.other}} in each {{s.groups.one}}?'] },
    },
    expect: { key: '15', prompt: ['5 boats each catch 3 fish.', 'How many fish do they catch in all?'], alt: '5 boats with 3 fish in each.' },
  },
  {
    id: 'g3-equal-groups-jump-size', note: 'how long is each equal jump: the size is countable on the ticks, so its labels are hidden (3.OA.A.2)',
    activity: {
      aim: { skills: ['3.OA.A.2'], theme: 'sport', why: 'Division as the size of equal groups.' },
      level: 4,
      model: {
        quantities: [q('g', 'count', '5', noun('jump', 'jumps', null)), q('n', 'count', '4', noun('step', 'steps', null))],
        structures: [{ id: 's', kind: 'equal_groups', roles: { groups: 'g', size: 'n' }, show: 'jumps' }],
      },
      prompt: [{ text: 'Raj makes {{s.groups}} of the same length and lands on {{s.total.n}}.', type: 'text' }, { of: 's', type: 'view' }, { text: 'How many {{s.size.other}} long is each jump?', type: 'text' }],
      response: { ask: 's.size', distractors: [{ expr: 'g', tag: 'counted_groups_only' }], form: 'number' },
      support: { explanation: '{{s.total.n}} split into {{s.groups.n}} equal jumps is {{s.size}} each.', hints: ['Count the ticks inside one jump.'] },
    },
    expect: { key: '4', prompt: ['Raj makes 5 jumps of the same length and lands on 20.', 'How many steps long is each jump?'], alt: 'A number line from 0 to 20 with 5 equal jumps; the first jump passes tick, tick, tick, tick.' },
  },
  {
    id: 'g3-equal-groups-left', note: 'two-step story: a derived quantity left = total − eaten (3.OA.D.8)',
    activity: {
      aim: { skills: ['3.OA.D.8'], theme: 'bakery', why: 'Two-step problems with equal groups.' },
      level: 5,
      model: {
        quantities: [
          q('g', 'count', '4', noun('tray', 'trays', 'box')), q('n', 'count', '6', noun('muffin', 'muffins')),
          q('e', 'count', '5', noun('muffin', 'muffins')), q('left', 'count', 's.total-e', noun('muffin', 'muffins')),
        ],
        structures: [{ id: 's', kind: 'equal_groups', roles: { groups: 'g', size: 'n' }, show: null }],
      },
      prompt: [{ text: 'A baker fills {{s.groups}} with {{s.size}} each. Then {{e}} are sold.', type: 'text' }, { text: 'How many {{left.other}} are left?', type: 'text' }],
      response: { ask: 'left', distractors: [{ expr: 's.total', tag: 'off_by_one' }, { expr: 'g+n-e', tag: 'added_instead' }], form: 'number' },
      support: { explanation: '{{s.groups.n}} × {{s.size.n}} = {{s.total.n}}, and {{s.total.n}} − {{e.n}} = {{left.n}}.', hints: ['First find how many muffins there were.'] },
    },
    expect: { key: '19', prompt: ['A baker fills 4 trays with 6 muffins each. Then 5 muffins are sold.', 'How many muffins are left?'] },
  },
  {
    id: 'g3-array-missing-factor', note: 'an unknown factor: equal rows, total given, cols derived (3.OA.A.4)',
    activity: {
      aim: { skills: ['3.OA.A.4'], theme: 'garden', why: 'The unknown number in a multiplication equation.' },
      level: 4,
      model: {
        quantities: [q('r', 'count', '6', noun('row', 'rows', null)), q('t', 'count', '42', noun('plant', 'plants', 'sprout')), q('c', 'count', 't/r', noun('plant', 'plants', 'sprout'))],
        structures: [{ id: 'a', kind: 'array', roles: { cols: 'c', rows: 'r' }, show: null }],
      },
      prompt: [{ text: '{{t}} are planted in {{a.rows}} with the same number in each row.', type: 'text' }, { tex: '{{a.rows.n}} \\times \\square = {{t.n}}', type: 'math' }, { text: 'How many {{a.cols.other}} are in each row?', type: 'text' }],
      response: { ask: 'a.cols', distractors: [{ expr: 't-r', tag: 'subtracted_instead' }], form: 'number' },
      support: { explanation: '{{a.rows.n}} × {{a.cols.n}} = {{t.n}}.', hints: ['What times {{a.rows.n}} makes {{t.n}}?'] },
    },
    expect: { key: '7', prompt: ['42 plants are planted in 6 rows with the same number in each row.', 'How many plants are in each row?'] },
  },
  {
    id: 'g3-array-tap-views', note: 'tap the array with a given total: a tap among views by their totals (3.OA.A.1)',
    activity: {
      aim: { skills: ['3.OA.A.1'], theme: 'games', why: 'Match a product to an array.' },
      level: 3,
      model: {
        quantities: [q('r', 'count', '3', noun('row', 'rows', null)), q('c', 'count', '5'), q('rb', 'count', '4', noun('row', 'rows', null)), q('cb', 'count', '4'), q('u', 'count', '15')],
        structures: [{ id: 'a', kind: 'array', roles: { cols: 'c', rows: 'r' }, show: 'dots' }, { id: 'b', kind: 'array', roles: { cols: 'cb', rows: 'rb' }, show: 'dots' }],
      },
      prompt: [{ text: 'Tap the {{a.view}} with {{u.n}} dots.', type: 'text' }, { of: 'a', type: 'view' }, { of: 'b', type: 'view' }],
      response: { ask: 'u', form: 'tap', on: null },
      support: { explanation: '{{a.rows.n}} rows of {{a.cols.n}} make {{a.total.n}}.', hints: ['Find the total of each.'] },
    },
    expect: { key: 'view:a', prompt: ['Tap the array with 15 dots.'], alt: '3 rows of 5 dots.' },
  },
  {
    id: 'g3-rect-unit-squares-perimeter', note: 'perimeter by counting unit edges on graph paper (3.MD.D.8)',
    activity: {
      aim: { skills: ['3.MD.D.8'], theme: 'park', why: 'Perimeter as the length around.' },
      level: 3,
      model: {
        quantities: [q('w', 'length', '6', null, 'unit'), q('h', 'length', '3', null, 'unit')],
        structures: [{ id: 'r', kind: 'rect_area', roles: { h: 'h', w: 'w' }, show: 'unit_squares' }],
      },
      prompt: [{ text: 'A fence goes all the way around this {{r.view}}.', type: 'text' }, { of: 'r', type: 'view' }, { text: 'How many units long is the fence?', type: 'text' }],
      response: { ask: 'r.perimeter', distractors: [{ expr: 'r.area', tag: 'area_for_perimeter' }, { expr: 'w+h', tag: 'added_two_sides' }], form: 'number' },
      support: { explanation: 'Going all the way around adds up to {{r.perimeter}}.', hints: ['Count the unit edges along every side.'] },
    },
    expect: { key: '18', prompt: ['A fence goes all the way around this rectangle.', 'How many units long is the fence?'], alt: 'A rectangle on graph paper, filled with unit squares, 6 squares wide and 3 squares tall.' },
  },
  {
    id: 'g3-rect-labeled-choose', note: 'area of a labeled rectangle, choose among perimeter and side-sum mistakes (3.MD.C.7b)',
    activity: {
      aim: { skills: ['3.MD.C.7'], theme: 'building', why: 'Distinguish area from perimeter.' },
      level: 4,
      model: {
        quantities: [q('w', 'length', '9', null, 'ft'), q('h', 'length', '5', null, 'ft')],
        structures: [{ id: 'r', kind: 'rect_area', roles: { h: 'h', w: 'w' }, show: 'labeled' }],
      },
      prompt: [{ text: 'A rug is shaped like this {{r.view}}.', type: 'text' }, { of: 'r', type: 'view' }, { text: 'How much floor does it cover?', type: 'text' }],
      response: { ask: 'r.area', candidates: null, distractors: [{ expr: 'r.perimeter', tag: 'perimeter_for_area' }, { expr: 'w+h', tag: 'added_two_sides' }], form: 'choose' },
      support: { explanation: '{{r.w.n}} × {{r.h.n}} = {{r.area}}.', hints: ['Area counts the squares inside.'] },
    },
    expect: { key: '45', prompt: ['A rug is shaped like this rectangle.', 'How much floor does it cover?'], alt: 'A rectangle, labeled 9 feet wide and 5 feet tall.' },
  },
  {
    id: 'g4-rect-labeled-area-large', note: 'area with larger sides (4.MD.A.3)',
    activity: {
      aim: { skills: ['4.MD.A.3'], theme: 'sport', why: 'Apply the area formula to real fields.' },
      level: 5,
      model: {
        quantities: [q('w', 'length', '14', null, 'm'), q('h', 'length', '9', null, 'm')],
        structures: [{ id: 'r', kind: 'rect_area', roles: { h: 'h', w: 'w' }, show: 'labeled' }],
      },
      prompt: [{ text: 'A court is a {{r.view}}.', type: 'text' }, { of: 'r', type: 'view' }, { text: 'What is its area?', type: 'text' }],
      response: { ask: 'r.area', distractors: [{ expr: 'r.perimeter', tag: 'perimeter_for_area' }], form: 'number' },
      support: { explanation: '{{r.w.n}} × {{r.h.n}} = {{r.area}}.', hints: ['Multiply the width by the height.'] },
    },
    expect: { key: '126', prompt: ['A court is a rectangle.', 'What is its area?'], alt: 'A rectangle, labeled 14 meters wide and 9 meters tall.' },
  },
  {
    id: 'g4-rect-missing-width', note: 'missing width from area, told in words (4.MD.A.3)',
    activity: {
      aim: { skills: ['4.MD.A.3'], theme: 'farm', why: 'Area relationships as a multiplication equation with an unknown.' },
      level: 6,
      model: {
        quantities: [q('a', 'area', '96', null, 'm'), q('h', 'length', '8', null, 'm'), q('w', 'length', 'a/h', null, 'm')],
        structures: [{ id: 'r', kind: 'rect_area', roles: { h: 'h', w: 'w' }, show: null }],
      },
      prompt: [{ text: 'A pen has an area of {{a}}. One side is {{r.h}}.', type: 'text' }, { text: 'How long is the other side?', type: 'text' }],
      response: { ask: 'r.w', distractors: [{ expr: 'h', tag: 'used_one_side' }], form: 'number' },
      support: { explanation: '{{a.n}} ÷ {{r.h.n}} = {{r.w.n}}, so the other side is {{r.w}}.', hints: ['What times {{r.h.n}} makes {{a.n}}?'] },
    },
    expect: { key: '12', prompt: ['A pen has an area of 96 square meters. One side is 8 meters.', 'How long is the other side?'] },
  },
  {
    id: 'g3-fraction-strip-shade', note: 'shade a non-unit fraction of a strip (3.NF.A.1)',
    activity: {
      aim: { skills: ['3.NF.A.1'], theme: 'art', why: 'a/b as a parts of size 1/b.' },
      level: 3,
      model: {
        quantities: [q('p', 'count', '8'), q('u', 'fraction', '3/8')],
        structures: [fraction('f', 'p', null, 'strip')],
      },
      prompt: [{ text: 'Shade {{u}} of the {{f.view}}.', type: 'text' }, { of: 'f', type: 'view' }],
      response: { ask: 'u', form: 'shade', on: 'f' },
      support: { explanation: '{{u}} is {{u.word}}: shade that many of the {{f.parts.n}} equal parts.', hints: ['How many equal parts are there?'] },
    },
    expect: { key: '3/8', prompt: ['Shade $\\frac{3}{8}$ of the strip.'], alt: 'A strip cut into 8 equal parts; none are shaded.' },
  },
  {
    id: 'g3-fraction-circle-complement', note: 'the fraction not shaded (3.NF.A.1)',
    activity: {
      aim: { skills: ['3.NF.A.1'], theme: 'party', why: 'Parts of a whole that remain.' },
      level: 4,
      model: {
        quantities: [q('p', 'count', '6'), q('k', 'count', '1')],
        structures: [fraction('f', 'p', 'k', 'circle')],
      },
      prompt: [{ text: 'One slice of a cake is eaten.', type: 'text' }, { of: 'f', type: 'view' }, { text: 'What fraction of the {{f.view}} is not shaded?', type: 'text' }],
      response: { ask: 'f.complement', distractors: [{ expr: 'f.fraction', tag: 'complement_for_fraction' }], exactness: 'any', form: 'fraction' },
      support: { explanation: '{{f.parts.n}} parts, {{f.selected.n}} shaded, so {{f.complement}} is not shaded.', hints: ['Count the parts that are not shaded.'] },
    },
    expect: { key: '5/6', prompt: ['One slice of a cake is eaten.', 'What fraction of the circle is not shaded?'], alt: 'A circle cut into equal parts (part, part, part, part, part, part); shaded parts: part.' },
  },
  {
    id: 'g3-fraction-line-improper', note: 'place a fraction greater than one on a number line to two (3.NF.A.2, 3.NF.A.3c)',
    activity: {
      aim: { skills: ['3.NF.A.2'], theme: 'travel', why: 'Fractions beyond one whole on the line.' },
      level: 5,
      model: {
        quantities: [q('p', 'count', '4'), q('w', 'count', '2'), q('u', 'fraction', '5/4')],
        structures: [fraction('f', 'p', null, 'line', 'w')],
      },
      prompt: [{ text: 'Put a point at {{u}} on the {{f.view}}.', type: 'text' }, { of: 'f', type: 'view' }],
      response: { ask: 'u', form: 'place', on: 'f' },
      support: { explanation: 'Each whole has {{f.parts.n}} equal parts; {{u}} is one part past the first whole.', hints: ['Where is one whole?'] },
    },
    expect: { key: '5/4', prompt: ['Put a point at $\\frac{5}{4}$ on the number line.'], alt: 'A number line from 0 to 2, each whole cut into 4 equal parts; no point is marked.' },
  },
  {
    id: 'g3-fraction-whole', note: 'a fraction equal to a whole number (3.NF.A.3c)',
    activity: {
      aim: { skills: ['3.NF.A.3'], theme: 'cooking', why: 'Whole numbers as fractions.' },
      level: 4,
      model: {
        quantities: [q('p', 'count', '4'), q('k', 'count', '4')],
        structures: [fraction('f', 'p', 'k', 'rect')],
      },
      prompt: [{ of: 'f', type: 'view' }, { text: 'Every part of the {{f.view}} is shaded. How many wholes is that?', type: 'text' }],
      response: { ask: 'f.fraction', distractors: [{ expr: 'p', tag: 'whole_number_bias' }], form: 'number' },
      support: { explanation: '{{f.fraction}} is one whole.', hints: ['How many parts make one whole?'] },
    },
    expect: { key: '1', prompt: ['Every part of the rectangle is shaded. How many wholes is that?'], alt: 'A rectangle cut into equal parts (part, part, part, part); shaded parts: part, part, part, part.' },
  },
  {
    id: 'g4-fraction-hundredths', note: 'hundredths told in words; no figure (4.NF.C.5 groundwork)',
    activity: {
      aim: { skills: ['4.NF.A.1'], theme: 'science', why: 'Fractions with denominator one hundred.' },
      level: 5,
      model: {
        quantities: [q('p', 'count', '100', noun('square', 'squares', 'square')), q('k', 'count', '37', noun('square', 'squares', 'square'))],
        structures: [fraction('f', 'p', 'k', null)],
      },
      prompt: [{ text: 'A sheet has {{f.parts}}. Lee colors {{f.selected}}.', type: 'text' }, { text: 'What fraction of the sheet is colored?', type: 'text' }],
      response: { ask: 'f.fraction', distractors: [{ expr: 'f.complement', tag: 'counted_unshaded' }], exactness: 'any', form: 'fraction' },
      support: { explanation: '{{f.selected.n}} of {{f.parts.n}} is {{f.fraction}}.', hints: ['How many squares are there in all?'] },
    },
    expect: { key: '37/100', prompt: ['A sheet has 100 squares. Lee colors 37 squares.', 'What fraction of the sheet is colored?'] },
  },
  {
    id: 'g5-fraction-rect-shade-twelfths', note: 'shade a fraction with a larger denominator (grade 5 fraction work)',
    activity: {
      aim: { skills: ['5.NF.B.4'], theme: 'garden', why: 'Partitioning area into twelfths.' },
      level: 4,
      model: {
        quantities: [q('p', 'count', '12'), q('u', 'fraction', '5/12')],
        structures: [fraction('f', 'p', null, 'rect')],
      },
      prompt: [{ text: 'A garden bed is cut into equal plots. Shade {{u}} of the {{f.view}}.', type: 'text' }, { of: 'f', type: 'view' }],
      response: { ask: 'u', form: 'shade', on: 'f' },
      support: { explanation: 'Shade {{u.word}} of the {{f.parts.n}} equal parts.', hints: ['How many equal parts are there?'] },
    },
    expect: { key: '5/12', prompt: ['A garden bed is cut into equal plots. Shade $\\frac{5}{12}$ of the rectangle.'], alt: 'A rectangle cut into 12 equal parts; none are shaded.' },
  },
  {
    id: 'g3-fraction-order', note: 'order fractions by size; each candidate shown in its own form (3.NF.A.3d)',
    activity: {
      aim: { skills: ['3.NF.A.3'], theme: 'nature', why: 'Compare and order fractions by reasoning.' },
      level: 5,
      model: {
        quantities: [q('pa', 'count', '8'), q('ka', 'count', '5'), q('pb', 'count', '8'), q('kb', 'count', '1'), q('x', 'fraction', '3/8')],
        structures: [fraction('f', 'pa', 'ka', null), fraction('g', 'pb', 'kb', null)],
      },
      prompt: [{ text: 'Put these fractions in order from least to greatest.', type: 'text' }],
      response: { candidates: ['f.fraction', 'g.fraction', 'x'], direction: 'ascending', form: 'order' },
      support: { explanation: 'The parts are all the same size, so compare the top numbers: {{g.fraction}}, {{x}}, {{f.fraction}}.', hints: ['The parts are the same size.'] },
    },
    expect: { key: 'order:1,2,0', prompt: ['Put these fractions in order from least to greatest.'] },
  },
];
