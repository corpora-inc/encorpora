/** Gold specs for grades 6–8 (HAND-AUTHORED; see types.ts). The first slice has only labeled rectangles here. */
import { q } from './build';
import type { GoldSpec } from './types';

export const g68Gold: GoldSpec[] = [
  {
    id: 'g6-rect-labeled-decimal', note: 'area of a rectangle with a decimal side (6.G.A.1 groundwork)',
    activity: {
      aim: { skills: ['6.G.A.1'], theme: 'building', why: 'Area with non-whole side lengths.' },
      level: 4,
      model: {
        quantities: [q('w', 'length', '7.5', null, 'm'), q('h', 'length', '4', null, 'm')],
        structures: [{ id: 'r', kind: 'rect_area', roles: { h: 'h', w: 'w' }, show: 'labeled' }],
      },
      prompt: [{ text: 'A patio is a {{r.view}}.', type: 'text' }, { of: 'r', type: 'view' }, { text: 'What is its area?', type: 'text' }],
      response: { ask: 'r.area', distractors: [{ expr: 'r.perimeter', tag: 'perimeter_for_area' }], form: 'number' },
      support: { explanation: '{{r.w.n}} × {{r.h.n}} = {{r.area}}.', hints: ['Multiply the width by the height.'] },
    },
    expect: { key: '30', prompt: ['A patio is a rectangle.', 'What is its area?'], alt: 'A rectangle, labeled 7.5 meters wide and 4 meters tall.' },
  },
  {
    id: 'g6-rect-missing-side-decimal', note: 'missing side with a decimal answer, labeled view shows "?" (grade 6 area)',
    activity: {
      aim: { skills: ['6.G.A.1'], theme: 'building', why: 'Area relationships with non-whole numbers.' },
      level: 5,
      model: {
        quantities: [q('a', 'area', '21', null, 'm'), q('h', 'length', '6', null, 'm'), q('w', 'length', 'a/h', null, 'm')],
        structures: [{ id: 'r', kind: 'rect_area', roles: { h: 'h', w: 'w' }, show: 'labeled' }],
      },
      prompt: [{ text: 'This {{r.view}} has an area of {{a}}.', type: 'text' }, { of: 'r', type: 'view' }, { text: 'How wide is it?', type: 'text' }],
      response: { ask: 'r.w', distractors: [{ expr: 'h', tag: 'used_one_side' }], form: 'number' },
      support: { explanation: '{{a.n}} ÷ {{r.h.n}} = {{r.w.n}}.', hints: ['Divide the area by the known side.'] },
    },
    expect: { key: '3.5', prompt: ['This rectangle has an area of 21 square meters.', 'How wide is it?'], alt: 'A rectangle, labeled a question mark for its width and 6 meters tall.' },
  },
];
